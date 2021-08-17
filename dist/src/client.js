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
var cmdAPIModule;
try {
    cmdAPIModule = require('../cmd'); // 默认的cmd
}
catch (e) {
    cmdAPIModule = require('../../cmd'); // 默认的cmd
}
var ws = require("ws");
var HeartCheck = require('./heartCheck');
var SockSend = require('./sockSend');
var Watch = require('./watch');
var ClientSocket = /** @class */ (function () {
    function ClientSocket(config) {
        this.socket = {}; // websocket 实例
        this.url = "ws://127.0.0.1:10001"; // 服务端地址
        this.cmdAPI = {}; // 接口文件
        this.restartMax = 3; // 默认最多重启次数为3
        this.reconnectTime = 2 * 1000; // 默认2s重连一次
        this.heartTimeout = 10 * 1000; // 心跳时间
        this.timeout = undefined; // 重连定时器
        this.restartNum = 0; // 当前重启次数
        this.socketIsClose = false; // 是否已经完全关闭
        this.lockReconnect = false; // 是否正在重连
        // 有一个属性 ws连接状态码 socket.readyState
        this.socketReadyState = {
            0: 'websocket连接尚未建立, 无法连接到服务端',
            1: 'websocket连接已建立，可以进行通信',
            2: 'websocket连接正在进行关闭',
            3: 'websocket连接已经关闭或者连接不能打开'
        };
        this.heartCheck = undefined;
        for (var key in config) {
            this[key] = config[key];
        }
        this.cmdAPI = __assign(__assign(__assign({}, cmdAPIModule), ClientSocket.cmdAPIInit), this.cmdAPI);
        this.sockSend = new SockSend(this.cmdAPI); // 订阅形式传输消息
        // node环境
        if (ClientSocket.isNodeEve) {
            this.wsConfig = __assign({ handshakeTimeout: 3000 }, this.wsConfig);
        }
        else {
            //浏览器环境
            this.wsConfig = this.wsConfig || null;
        }
    }
    /**
     * 等待ws的启动 默认等待3次
     * @params {number} restartMaxNow 该次请求最多重启次数
     * 传递该值的情况为
     * 1.已经实例化并运行过createSocket
     * 2.readyState 不为1（ws不在运行中）
     * 3.需等待重启最多restartMaxNow次
     * **/
    ClientSocket.prototype.waitCreate = function (restartMaxNow) {
        var _this = this;
        if (restartMaxNow === void 0) { restartMaxNow = 3; }
        // 如果传递restartMax 不用在意this.restartMax
        return new Promise(function (rs) {
            // 如果已经启动成功
            if (_this.socket.readyState === 1) {
                return rs(_this.socket.readyState);
            }
            else if (_this.socketIsClose) {
                //  ws已经完全关闭无法重启 尝试重启
                _this.socketIsClose = false;
                _this.websocketStart();
            }
            // 当前重启次数
            var restartNum = 0;
            var watchRestartNum = new Watch(_this, 'restartNum');
            watchRestartNum.init(function (newsValue, oldValue) {
                if (newsValue - 1 === oldValue) {
                    restartNum++;
                    console.log('等待重启' + restartNum);
                    // 等待 restartMaxNow 次后还未启动成功
                    if (restartNum >= restartMaxNow) {
                        rs(_this.socket.readyState);
                        watchRestartNum.clear();
                    }
                }
                else {
                    // 启动成功后 restartNum 会变为0
                    rs(_this.socket.readyState);
                    watchRestartNum.clear();
                }
            });
        });
    };
    // promise 返回ws的状态 number
    ClientSocket.prototype.createSocket = function () {
        var _this = this;
        console.log('createSocket');
        return new Promise(function (rs) {
            // 成功启动ws后调用该回调函数或超过连接次数后返回Socket状态
            _this.waitSocketState = function (readyState) {
                rs(readyState);
            };
            _this.websocketStart();
        });
    };
    // 实例化 websocket
    ClientSocket.prototype.websocketStart = function () {
        try {
            // node环境
            if (ClientSocket.isNodeEve) {
                this.socket = new ws(this.url, this.wsConfig);
            }
            else {
                // 浏览器环境
                // @ts-ignore
                this.socket = new WebSocket(this.url, this.wsConfig);
            }
            this.websocketInit();
        }
        catch (e) {
            console.log('catch', e);
            this.websocketReconnect();
        }
    };
    // 对ws重连
    ClientSocket.prototype.websocketReconnect = function () {
        var _this = this;
        // 是否正在执行重连 或者已经完全关闭后不再重启
        if (this.lockReconnect || this.socketIsClose) {
            return;
        }
        else if (this.restartNum >= this.restartMax && this.restartMax > 0) {
            // 最多重启restartMax次(如果restartMax <= 0不用考虑重启次数)
            this.socketIsClose = true;
            this.waitSocketState && this.waitSocketState(this.socket.readyState);
            return;
        }
        this.restartNum++;
        console.log('重启', this.restartNum);
        this.lockReconnect = true;
        //没连接上会一直重连，设置延迟避免请求过多
        this.timeout && clearTimeout(this.timeout);
        this.timeout = setTimeout(function () {
            _this.websocketStart();
            _this.lockReconnect = false;
        }, this.reconnectTime);
    };
    // 对socket的事件进行注册
    ClientSocket.prototype.websocketInit = function () {
        var _this = this;
        var onOpen = function () {
            // console.log("sock connect success !!!!--------------------------------");
            // 更新传输信息里的socket
            _this.sockSend.changeSocket(_this.socket);
            // 心跳检测
            _this.heartCheck = new HeartCheck(_this.sockSend, _this.heartTimeout);
            // 启动成功后重启次数归零
            _this.restartNum = 0;
            // 继续运行还未完成的事件
            _this.sockSend.restartEmit();
            // 创建后开始心跳检测
            _this.heartCheck && _this.heartCheck.startHeart();
            // 启动websocket成功
            _this.waitSocketState && _this.waitSocketState(_this.socket.readyState);
        };
        var onError = function (err) {
            console.log("error--- ", err);
        };
        var onClose = function (err) {
            _this.heartCheck && _this.heartCheck.stopHeart();
            console.log("close---", err);
            _this.websocketReconnect(); // 重连
        };
        var onEnd = function () {
            console.log("end");
        };
        // node 环境接收信息
        var onMessageNode = function (data) {
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            _this.heartCheck.startHeart();
            var messageData = JSON.parse(data.toString());
            _this.sockSend.emit(messageData);
        };
        // web 环境接收信息
        var onMessageWeb = function (res) {
            // 读取blob 每次都新建 避免相互影响
            var fileReader = new FileReader();
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            _this.heartCheck.startHeart();
            //将Blob 对象转换成字符串
            fileReader.readAsText(res.data, 'utf-8');
            fileReader.onload = function () {
                var messageData = JSON.parse(fileReader.result.toString());
                _this.sockSend.emit(messageData);
            };
        };
        // node环境
        if (typeof (WebSocket) === "undefined") {
            // @ts-ignore
            this.socket.on("open", onOpen);
            // @ts-ignore
            this.socket.on("error", onError);
            // @ts-ignore
            this.socket.on("close", onClose);
            // @ts-ignore
            this.socket.on("end", onEnd);
            // @ts-ignore
            this.socket.on("message", onMessageNode);
        }
        else {
            // 浏览器环境
            // @ts-ignore
            this.socket.onopen = onOpen;
            // @ts-ignore
            this.socket.onerror = onError;
            // @ts-ignore
            this.socket.onclose = onClose;
            // @ts-ignore
            this.socket.onmessage = onMessageWeb;
        }
    };
    // 初始化的cmdAPI 不需要每次实例化都引入cmdAPI
    ClientSocket.cmdAPIInit = {};
    // 当前环境是node环境
    ClientSocket.isNodeEve = typeof (window) === "undefined";
    return ClientSocket;
}());
module.exports = ClientSocket;
