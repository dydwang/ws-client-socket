const ws = require("ws");
const HeartCheck = require('./heartCheck');
const SockSend = require('./sockSend');
const Watch = require('./watch');
const cmdAPIModule = require('./cmd'); // 默认的cmd

const path = 'ws://127.0.0.1:10001'; // 本机

class ClientSocket{
    constructor(config = {}) {
        const {
            url = path,  // 服务端地址
            restartMax = 3, // 默认最多重启次数为3
            reconnectTime = 2 * 1000, // 默认2s重连一次
            cmdAPI = {}, // 接口文件
            wsConfig = {}, // websocket配置
            heartTimeout = 10 * 1000, // 心跳检测时间  10s
        } = config;
        this.url = url;
        this.cmdAPI = {
            ...cmdAPIModule,
            ... cmdAPI
        };
        // node环境
        if(typeof(WebSocket) === "undefined") {
            this.wsConfig = {
                handshakeTimeout: 3000, // 连接超时
                ...wsConfig
            };
        }else{
            //浏览器环境
            this.wsConfig = wsConfig || "";
        }
        this.heartTimeout = heartTimeout;
        this.reconnectTime = reconnectTime;
        this.restartMax = restartMax;

        this.lockReconnect = false; // 是否正在重连
        this.timeout = null; // 重连定时器
        this.sockSend = new SockSend(this.cmdAPI); // 订阅形式传输消息
        this.socket = {};
        this.restartNum = 0; // 当前重启次数
        this.socketIsClose = false; // 是否已经完全关闭
        // 有一个属性Socket.readyState，
        this.socketReadyState = {
            0: 'websocket连接尚未建立, 无法连接到服务端',
            1: 'websocket连接已建立，可以进行通信',
            2: 'websocket连接正在进行关闭',
            3: 'websocket连接已经关闭或者连接不能打开'
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
    waitCreate(restartMaxNow = 3) {
        // 如果传递restartMax 不用在意this.restartMax
        return new Promise((rs)=>{
            // 如果已经启动成功
            if(this.socket.readyState === 1) {
                return rs(this.socket.readyState);
            }else if(this.socketIsClose) {
                //  ws已经完全关闭无法重启 尝试重启
                this.socketIsClose = false;
                this.websocketStart();
            }
            // 当前重启次数
            let restartNum = 0;
            let watchRestartNum = new Watch(this, 'restartNum');
            watchRestartNum.init((newsValue, oldValue)=>{
                if(newsValue - 1 === oldValue) {
                    restartNum++;
                    console.log('等待重启' + restartNum);
                    // 等待 restartMaxNow 次后还未启动成功
                    if(restartNum >= restartMaxNow) {
                        rs(this.socket.readyState);
                        watchRestartNum.clear();
                    }
                }else{
                    // 启动成功后 restartNum 会变为0
                    rs(this.socket.readyState);
                    watchRestartNum.clear();
                }
            })
        })
    }
    createSocket() {
        return new Promise((rs)=>{
            // 成功启动ws后调用该回调函数或超过连接次数后返回Socket状态
            this.waitSocketState = (readyState) =>{
                rs(readyState);
            }
            this.websocketStart();
        });
    }
    // 启动websocket
    websocketStart() {
        try {
            // node环境
            if(typeof(WebSocket) === "undefined"){
                this.socket = new ws(this.url, this.wsConfig);
            }else{
                // 浏览器环境
                this.socket = new WebSocket(this.url, this.wsConfig);
            }
            this.websocketInit();
        } catch (e) {
            console.log('catch', e);
            this.websocketReconnect();
        }
    }

    // 对ws重连
    websocketReconnect() {
        // 是否正在执行重连 或者已经完全关闭后不再重启
        if (this.lockReconnect || this.socketIsClose) {
            return;
        }else if(this.restartNum >= this.restartMax && this.restartMax > 0) {
            // 最多重启restartMax次(如果restartMax <= 0不用考虑重启次数)
            this.socketIsClose = true;
            this.waitSocketState(this.socket.readyState);
            return;
        }
        this.restartNum++;
        console.log('重启', this.restartNum);
        this.lockReconnect = true;
        //没连接上会一直重连，设置延迟避免请求过多
        this.timeout && clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.websocketStart();
            this.lockReconnect = false;
        }, this.reconnectTime);
    }
    // 对socket的事件进行注册
    websocketInit () {
        const onOpen = () => {
            // console.log("sock connect success !!!!--------------------------------");
            // 更新传输信息里的socket
            this.sockSend.changeSocket(this.socket);
            // 心跳检测
            this.heartCheck = new HeartCheck(this.sockSend, this.heartTimeout);
            // 启动成功后重启次数归零
            this.restartNum = 0;
            // 继续运行还未完成的事件
            this.sockSend.restartEmit();
            // 创建后开始心跳检测
            this.heartCheck.startHeart();
            // 启动websocket成功
            this.waitSocketState && this.waitSocketState(this.socket.readyState);
        }
        const onError = (err) => {
            console.log("error--- ", err);
        }
        const onClose = (e) => {
            this.heartCheck && this.heartCheck.stopHeart();
            console.log("close---", this.socket.readyState);
            this.websocketReconnect(); // 重连
        }
        const onEnd = (e) => {
            console.log("end");
        }
        // node 环境接收信息
        const onMessageNode = (data) => {
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            this.heartCheck.startHeart();
            const messageData = JSON.parse(data.toString());
            this.sockSend.emit(messageData);
        }
        // 读取blob
        const fileReader = typeof(FileReader) !== "undefined" ? new FileReader() : {};
        // web 环境接收信息
        const onMessageWeb = (res) => {
            console.log(res);
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            this.heartCheck.startHeart();
            //将Blob 对象转换成字符串
            fileReader.readAsText(res.data, 'utf-8');
            fileReader.onload = (e) => {
                const messageData = JSON.parse(fileReader.result.toString());
                this.sockSend.emit(messageData);
            }
        }
        // node环境
        if(typeof(WebSocket) === "undefined") {
            this.socket.on("open",onOpen);
            this.socket.on("error", onError);
            this.socket.on("close", onClose);
            this.socket.on("end", onEnd);
            this.socket.on("message", onMessageNode);
        }else{
            // 浏览器环境
            this.socket.onopen = onOpen;
            this.socket.onerror = onError;
            this.socket.onclose = onClose;
            this.socket.onmessage = onMessageWeb;
        }
    }
    // 销毁socket
    clearSocket() {
        // 不再重启
        this.socketIsClose = true;
        // 断开ws
        this.socket.close(1000);
        // 销毁订阅
        this.sockSend.emitter.off();
    }
}

module.exports = ClientSocket;