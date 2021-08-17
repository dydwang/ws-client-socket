import * as dns from "dns";

const UUID = require('uuid');
const emitter = require('tiny-emitter/instance'); // 发布订阅插件
import {
    CmdAPI,
    SockSendInterface,
    SockSendOptions,
    typeUUID,
    typeResData,
    typeCmd,
    typeCallback
} from './interface';


// 获取content
const getContent = (options: SockSendOptions): object => {
    const content: any = {};
    for (let key in options) {
        if( key !== 'uuid' && key !== "config") {
            content[key] = options[key];
        }
    }
    return content
}
class SockSend implements SockSendInterface{
    public cmdAPI = {};
    public emitter = emitter;
    public sendCmd = {}; // 记录调用了那些cmd
    public socket: any;
    constructor(cmdAPI: CmdAPI) {
        this.cmdAPI = cmdAPI; // 共有那些cmdAPI
        // this.emitter = emitter;
    }
    // 更新socket
    changeSocket(socket: any) {
        this.socket = socket;
    }
    // 向serve通信
    // 注册事件 把事件存储起来
    send(cmd: typeCmd, options: SockSendOptions, callback?: typeCallback) {
        // 该cmd指令不存在接口中
        if(!(cmd in this.cmdAPI)) {
            console.error(new Error(`无法通信，请注册cmd:${cmd}事件`));
            return "";
        }
        options = options || {};
        const opts: SockSendOptions = {
            content: options.content || getContent(options), // 通信传值 client -> serve
            config: options.config || {}, // 配置
            uuid: options.uuid || UUID.v1(), // 任务id
        };
        const { content, config, uuid } = opts;
        const onConfig = {
            isOnce: true, // 执行一次后会主动注销
            ...config,
        }
        // cmd里获取需传输的数据格式
        let {data} = this.cmdAPI[cmd]({
            uuid,
            content
        });
        // 把通信的事件存储 emit里根据uuid调用
        this.sendCmd[uuid] = {
            data,
            onConfig,
            callback
        };
        this.socket.send(Buffer.from(JSON.stringify(data)));
        return uuid;
    }
    // websocket onmessage 通过uuid 调用事件
    emit(resData: typeResData) {
        const { cmd, uuid } = resData;
        // 服务端主动推送
        // serve -> client
        if(!(uuid in this.sendCmd)) {
            // 发布cmd接口
            this.emitter.emit(cmd, {
                resData,
                socket: this.socket,
            });
            (cmd in this.cmdAPI)
                ? this.cmdAPI[cmd]({}).onmessage(resData, this.socket, 1)
                : console.error(new Error(`无法接收，未注册cmd:${cmd}事件`));
        } else{
            // 客户端触发  服务端返回
            // client -> serve -> client
            const {
                data:reqData,
                callback,
                onConfig
            } = this.sendCmd[uuid];
            const onmessage = reqData.onmessage;
            // 订阅方式 发布cmd接口
            // console.log(this.emitter, cmd);
            this.emitter.emit(cmd, {
                reqData,
                resData,
                onmessage,
                socket: this.socket,
            });
            // 回调方式
            callback && callback({
                reqData,
                resData,
                onmessage,
                socket: this.socket,
            });
            // 调用一次就注销
            onConfig.isOnce && this.off(uuid);
        }
    }
    // 重连时重新调用所有未完成事件
    restartEmit() {
        for(let uuid in this.send) {
            let { data } = this.send[uuid];
            this.socket.send(Buffer.from(JSON.stringify(data)));
        }
    }
    // 注销事件 避免数据臃肿
    off(uuid: typeUUID) {
        delete this.send[uuid];
        // this.emitter.off();
    }
}
module.exports = SockSend;
