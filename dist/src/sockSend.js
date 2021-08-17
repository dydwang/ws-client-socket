"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var UUID = require('uuid');
var emitter = require('tiny-emitter/instance'); // 发布订阅插件
// 获取content
var getContent = function (options) {
    var content = {};
    for (var key in options) {
        if (key !== 'uuid' && key !== "config") {
            content[key] = options[key];
        }
    }
    return content;
};
var SockSend = /** @class */ (function () {
    function SockSend(cmdAPI) {
        this.cmdAPI = {};
        this.emitter = emitter;
        this.sendCmd = {}; // 记录调用了那些cmd
        this.cmdAPI = cmdAPI; // 共有那些cmdAPI
        // this.emitter = emitter;
    }
    // 更新socket
    SockSend.prototype.changeSocket = function (socket) {
        this.socket = socket;
    };
    // 向serve通信
    // 注册事件 把事件存储起来
    SockSend.prototype.send = function (cmd, options, callback) {
        // 该cmd指令不存在接口中
        if (!(cmd in this.cmdAPI)) {
            console.error(new Error("\u65E0\u6CD5\u901A\u4FE1\uFF0C\u8BF7\u6CE8\u518Ccmd:" + cmd + "\u4E8B\u4EF6"));
            return "";
        }
        options = options || {};
        var opts = {
            content: options.content || getContent(options),
            config: options.config || {},
            uuid: options.uuid || UUID.v1(), // 任务id
        };
        var content = opts.content, config = opts.config, uuid = opts.uuid;
        var onConfig = __assign({ isOff: true }, config);
        // cmd里获取需传输的数据格式
        var data = this.cmdAPI[cmd]({
            uuid: uuid,
            content: content
        }).data;
        // 把通信的事件存储 emit里根据uuid调用
        this.sendCmd[uuid] = {
            data: data,
            onConfig: onConfig,
            callback: callback
        };
        this.socket.send(Buffer.from(JSON.stringify(data)));
        return uuid;
    };
    // websocket onmessage 通过uuid 调用事件
    SockSend.prototype.emit = function (resData) {
        var cmd = resData.cmd, uuid = resData.uuid;
        // 服务端主动推送
        // serve -> client
        if (!(uuid in this.sendCmd)) {
            // 发布cmd接口
            this.emitter.emit(cmd, {
                resData: resData,
                socket: this.socket,
            });
            (cmd in this.cmdAPI)
                ? this.cmdAPI[cmd]({}).onmessage(resData, this.socket, 1)
                : console.error(new Error("\u65E0\u6CD5\u63A5\u6536\uFF0C\u672A\u6CE8\u518Ccmd:" + cmd + "\u4E8B\u4EF6"));
        }
        else {
            // 客户端触发  服务端返回
            // client -> serve -> client
            var _a = this.sendCmd[uuid], reqData = _a.data, callback = _a.callback, onConfig = _a.onConfig;
            var onmessage_1 = reqData.onmessage;
            // 订阅方式 发布cmd接口
            // console.log(this.emitter, cmd);
            this.emitter.emit(cmd, {
                reqData: reqData,
                resData: resData,
                onmessage: onmessage_1,
                socket: this.socket,
            });
            // 回调方式
            callback && callback({
                reqData: reqData,
                resData: resData,
                onmessage: onmessage_1,
                socket: this.socket,
            });
            // 调用一次就注销
            onConfig.isOff && this.off(uuid);
        }
    };
    // 重连时重新调用所有未完成事件
    SockSend.prototype.restartEmit = function () {
        for (var uuid in this.send) {
            var data = this.send[uuid].data;
            this.socket.send(Buffer.from(JSON.stringify(data)));
        }
    };
    // 注销事件 避免数据臃肿
    SockSend.prototype.off = function (uuid) {
        delete this.send[uuid];
        // this.emitter.off();
    };
    return SockSend;
}());
module.exports = SockSend;
