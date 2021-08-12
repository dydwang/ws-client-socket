const UUID = require('uuid');
const emitter = require('tiny-emitter/instance'); // 发布订阅插件

class SockSend {
    constructor(cmdAPI) {
        this.emitter = emitter;
        this.sendCmd = {}; // 记录调用了那些cmd
        this.cmdAPI = cmdAPI; // 共有那些cmdAPI
    }
    // 更新socket
    changeSocket(socket) {
        this.socket = socket;
    }
    // 向serve通信
    // 注册事件 把事件存储起来
    send(cmd, options = {}, callback) {
        const opts = {
            content: {...options}, // 通信传值 client -> serve
            config: {}, // 配置
            uuid: UUID.v1(), // 任务id
            ...options
        };
        const { content, config, uuid } = opts;
        delete content.config;
        delete content.uuid;

        const onConfig = {
            isOff: true, // 是否要被主动注销
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
    emit(resData) {
        const { cmd, uuid } = resData;
        const sendCmdUuid = this.sendCmd[uuid] || {};
        // 服务端主动推送
        // serve -> client
        if(!this.sendCmd[uuid]) {
            // 发布cmd接口
            this.emitter.emit(cmd, {
                resData,
                socket: this.socket,
            });
            this.cmdAPI[cmd]({}).onmessage(resData, this.socket, 1)
        }else{
            // 客户端触发  服务端返回
            // client -> serve -> client
            const { data:reqData, callback, onConfig } = sendCmdUuid;
            const onmessage = reqData.onmessage;
            // 订阅方式 发布cmd接口
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
            onConfig.isOff && this.off(uuid);
        }
    }
    // 重连时重新调用所有未完成事件
    restartEmit() {
        // console.log('restartEmit');
        for(let uuid in this.send) {
            let { data } = this.send[uuid];
            this.socket.send(Buffer.from(JSON.stringify(data)));
        }
    }
    // 注销事件 避免数据臃肿
    off(uuid) {
        delete this.send[uuid];
        // this.emitter.off();
    }
}
module.exports = SockSend;

// Sock_send.on('result', {uuid: 12354689},  ({reqData, resData, onmessage, sock})=>{
//     // onmessage()
// })
