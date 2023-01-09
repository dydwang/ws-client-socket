import * as UUID from 'uuid';
import mitt from 'mitt';
import {
    SendCallback, SendCallbackBack,
    SendCmdCache,
    SendCmdCacheItem,
    SendOptions, SendReq, SendRes,
    SockSendData,
    SockSendOptions
} from './types/sockSend'
import { Cmd, CmdAPIItem, WebSocketData, ReqContent, ReqInterceptors, UUID as UUIDType } from './types/client'
const emitter = mitt();

export class SockSend {
    public options: SockSendOptions;
    public sendCmdCache: SendCmdCache = {}; // 缓存的接口
    public on = emitter.on;
    constructor(options: SockSendOptions) {
        this.options = options;
    }

    /**
     * 注册事件 把事件存储起来 client -> serve  向serve通信
     * @params cmd 指令
     * @params data 配置项
     * @params data.uuid? 任务id
     * @params data.content? 数据
     * @params data.options? 配置项
     * @params data.options.isOff 是否要被主动注销
     * @params data.options.isCacheCmd 是否缓存
     * @params data.options.timeout 超时时间
     * @params callback({req, res, socket}) 回调函数
     * */
    send(cmd: Cmd, data?: SockSendData, callback?: SendCallback) {
        data = data || {};
        const sendOptions: SendOptions = {
            isOff: false, // 是否要被主动注销
            ...data.options,
        }
        const cmdAPIData = this.options.cmdAPI[cmd] ? this.options.cmdAPI[cmd]({
            cmd,
            uuid: data.uuid || UUID.v1(),
            content: data.content
        }) : null;
        const uuid = cmdAPIData?.uuid || data.uuid || UUID.v1();
        // cmd里获取需传输的数据格式
        const req: CmdAPIItem = { uuid, cmd, content: cmdAPIData?.content || data.content };
        const sendSync: Promise<SendCallbackBack> = new Promise((async (resolve, reject) => {
            const sendCacheItem: SendCmdCacheItem = {
                req,
                callback,
                resolve,
                reject,
                options: sendOptions,
                status: 'pending', // 'pending' 请求中 | 'resolved' 已完成 | 'rejected' 已失败
            }
            const wsUrl = this.options.socket?.url || '';
            // 如果配置项包含超时
            if(sendOptions.timeout) {
                sendCacheItem.onTimeout = setTimeout(() => {
                    this.sendError(`连接超时：${wsUrl}; cmd: ${cmd}; ${sendOptions.timeout}ms`, uuid)
                }, sendOptions.timeout)
            }
            this.sendCmdCache[uuid] = sendCacheItem;
            // 如果有socket
            if (this.options.socket && this.options.socket.readyState === 1) {
                const reqData = await this.options.reqInterceptors(req);
                this.options.socket.send(reqData as WebSocketData);
            } else {
                this.sendError(`websocket未创建成功 ${wsUrl}`, uuid)
            }
        }))
        return {
            uuid,
            sendSync,
        }
    }

    // 同步方式：慎用！该方法只会接收一次服务端消息
    sendSync(cmd: Cmd, data?: SockSendData, callback?: SendCallback) {
        return this.send(cmd, data, callback).sendSync
    }

    // 重连时重新调用所有未完成事件
    restartSend() {
        for (let uuid in this.sendCmdCache) {
            const { req, status, options, callback } = this.sendCmdCache[uuid];
            const { cmd, content } = req;
            const { isCacheCmd }= options;
            // 重新发送不是心跳的任务 并且未完成的任务
            if (cmd !== this.options.heartCmd && status !== 'resolved' && isCacheCmd) {
                this.send(cmd, {
                    uuid,
                    content,
                    options
                }, callback)
            }
        }
    }

    // 连接失败

    // 可能是所有接口 或 某个接口
    sendError(error_msg: string, uuid?: UUIDType) {
        if(!uuid) {
            for (let uuid in this.sendCmdCache) {
                this.sendErrorUuid(error_msg, uuid);
            }
        }else {
            this.sendErrorUuid(error_msg, uuid);
        }
    }

    // 某个接口发送错误消息
    sendErrorUuid(error_msg: string, uuid: UUIDType) {
        const { status, req } = this.sendCmdCache[uuid];
        const { cmd } = req;
        // 将正在运行中状态变为失败
        if (status === 'pending') {
            this.sendCmdCache[uuid].status = 'rejected'
        }
        const resData: SendRes = {
            uuid,
            cmd,
            error_msg,
            content: {},
            status: -1
        }
        this.emit(resData)
    }

    emit(res: SendRes) {
        const { cmd, uuid, content = {} } = res;
        const sendCmdCacheItem: SendCmdCacheItem = this.sendCmdCache[uuid];
        if (sendCmdCacheItem?.status === 'pending') {
            sendCmdCacheItem.status = 'resolved' // 已成功返回
        }
        // 如果有超时 则清除超时定时器
        sendCmdCacheItem?.onTimeout && clearTimeout(sendCmdCacheItem?.onTimeout);
        const sendCallbackBack: SendCallbackBack = {
            req: sendCmdCacheItem?.req,
            res,
            socket: this.options.socket
        }
        // 订阅方式 发布cmd接口
        // 服务端主动推送
        // serve -> client
        emitter.emit(cmd, sendCallbackBack);
        // 客户端触发  服务端返回
        // client -> serve -> client
        if (!!sendCmdCacheItem) {
            // 回调方式
            sendCmdCacheItem.callback && sendCmdCacheItem.callback(sendCallbackBack);
            // 同步方式 只会接收一次数据
            sendCmdCacheItem.resolve && sendCmdCacheItem.resolve(sendCallbackBack);
            // 调用一次就注销
            sendCmdCacheItem.options.isOff && this.off(uuid);
        }
    }
    // 通过uuid注销事件 避免数据臃肿
    off(uuid?: string) {
        if(uuid) {
            delete this.sendCmdCache[uuid]
        }else {
            this.sendCmdCache = {};
            emitter.off("*");
        }
    }
}
