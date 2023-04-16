import * as UUID from 'uuid';
import { RawData } from 'ws';
import mitt from 'mitt';
import {
    SendCallback,
    SendCallbackData,
    SendCmdCache,
    SendCmdCacheItem,
    SendOptions,
    SockSendData,
    SockSendOptions
} from '../types/sockSend'
import {Cmd, SendData, SendDataReq, SendDataRes, WebSocketData, UUID as UUIDType} from "../types/basics";
const emitter = mitt<Record<string, SendCallbackData>>();
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
        const sendOptions: SendOptions = {
            isOff: false, // 是否要被主动注销
            ...data?.options,
        }
        const uuid = data?.uuid || UUID.v1();
        // cmd里获取需传输的数据格式
        const req: SendData = { uuid, cmd, content: data?.content};
        return new Promise<SendCallbackData>((async (resolve, reject) => {
            const sendCacheItem: SendCmdCacheItem = {
                req,
                callback,
                resolve,
                reject,
                options: sendOptions,
                status: 'pending', // 'pending' 请求中 | 'resolved' 已完成 | 'rejected' 已失败
            }
            // 如果配置项包含超时
            if(sendOptions.timeout) {
                sendCacheItem.onTimeout = setTimeout(() => {
                    this.sendError(`连接超时：${this.options.url}; cmd: ${cmd}; ${sendOptions.timeout}ms`, uuid)
                }, sendOptions.timeout)
            }
            // 发送消息
            this.options.clientSend(req);
            data?.options?.onSendBefore && data.options.onSendBefore(req);
            this.sendCmdCache[uuid] = sendCacheItem;
        }))
    }

    // 可能是所有接口 或 某个接口 发送错误消息
    sendError(error_msg: string, uuid?: UUIDType) {
        if(!uuid) {
            for (let uuid in this.sendCmdCache) {
                this.sendError(error_msg, uuid);
            }
        }else {
            const sendCmdCacheItem: SendCmdCacheItem = this.sendCmdCache[uuid];
            // 将正在运行中状态变为失败
            if (sendCmdCacheItem?.status === 'pending') {
                this.sendCmdCache[uuid].status = 'rejected'
            }
            const resData: SendDataRes = {
                uuid,
                cmd: sendCmdCacheItem?.req?.cmd,
                error_msg,
                content: {},
                status: -1
            }
            this.emit(resData);
        }
    }


    emit(res: SendDataRes) {
        const { cmd, uuid, content = {} } = res;
        const sendCmdCacheItem: SendCmdCacheItem = this.sendCmdCache[uuid];
        if (sendCmdCacheItem?.status === 'pending') {
            sendCmdCacheItem.status = 'resolved' // 已成功返回
        }
        // 如果有超时 则清除超时定时器
        sendCmdCacheItem?.onTimeout && clearTimeout(sendCmdCacheItem?.onTimeout);
        const SendCallbackData: SendCallbackData = {
            req: sendCmdCacheItem?.req,
            res,
        }
        // 订阅方式 发布cmd接口
        // 服务端主动推送
        // serve -> client
        emitter.emit(cmd, SendCallbackData);
        // 客户端触发  服务端返回
        // client -> serve -> client
        if (!!sendCmdCacheItem) {
            // 回调方式
            sendCmdCacheItem.callback && sendCmdCacheItem.callback(SendCallbackData);
            // 同步方式 只会接收一次数据
            sendCmdCacheItem.resolve && sendCmdCacheItem.resolve(SendCallbackData);
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
