let cmdAPIModule: CmdAPI
try {
    cmdAPIModule = require('../cmd'); // 默认的cmd
}catch (e) {
    cmdAPIModule = require('../../cmd'); // 默认的cmd
}
const ws = require("ws");
const HeartCheck = require('./heartCheck');
const SockSend = require('./sockSend');
const Watch = require('./watch');
// cmdAPI接口类型
import {
    CmdAPI
} from './interface';

import {
    SockSendInterface,
    HeartCheckInterface
} from './interface';

interface Config {
    url: string, // 服务器地址
    cmdAPI: CmdAPI, // 接口文件
    restartMax?: number, // 默认最多重启次数为3
    reconnectTime?: number, // 默认2s重连一次
    wsConfig?: object | string | null, // websocket配置
    heartTimeout?: number, // 心跳检测时间  10s
}
interface ClientSocketInter extends Config{
    cmdAPIInit?: CmdAPI,
    isNode?: boolean,
    waitSocketState: ((readyState: number) => void) | undefined, // 等待websocket启动 并返回ws状态
    lockReconnect: boolean,
    timeout: NodeJS.Timeout | undefined,
    socket: {
        [key: string]: any
    },
    sockSend: SockSendInterface | undefined,
    socketIsClose: boolean,
    socketReadyState: object,
    heartCheck: HeartCheckInterface | undefined,
    createSocket(): Promise<any>,
    websocketStart(): void,
    websocketReconnect(): void,
}
class ClientSocket implements ClientSocketInter{
    // 初始化的cmdAPI 不需要每次实例化都引入cmdAPI, 需要在实例化之前赋值
    static cmdAPIInit = {};
    // 当前环境是node环境
    static isNodeEve = typeof(window) === "undefined";
    // websocket 实例
    public socket = {};
    // socket 传输信息
    public sockSend;
    public url = "ws://127.0.0.1:10001"; // 服务端地址
    public cmdAPI = {}; // 接口文件
    public restartMax = 3; // 默认最多重启次数为3
    public reconnectTime = 2 * 1000; // 默认2s重连一次
    public wsConfig; // websocket 配置json
    public heartTimeout = 10 * 1000; // 心跳时间
    public timeout = undefined; // 重连定时器
    public restartNum = 0;// 当前重启次数
    public socketIsClose = false; // 是否已经完全关闭
    public lockReconnect = false; // 是否正在重连
    // 有一个属性 ws连接状态码 socket.readyState
    public socketReadyState = {
        0: 'websocket连接尚未建立, 无法连接到服务端',
        1: 'websocket连接已建立，可以进行通信',
        2: 'websocket连接正在进行关闭',
        3: 'websocket连接已经关闭或者连接不能打开'
    }
    public waitSocketState: { (arg0: number): void; (readyState: number): void; } | undefined;
    public heartCheck;

    constructor(config: Config) {
        for (let key in config) {
            this[key] = config[key];
        }
        this.cmdAPI = {
            ...cmdAPIModule,
            ...ClientSocket.cmdAPIInit,
            ...this.cmdAPI
        };
        this.sockSend = new SockSend(this.cmdAPI); // 订阅形式传输消息
        // node环境
        if(ClientSocket.isNodeEve) {
            this.wsConfig = {
                handshakeTimeout: 3000, // 连接超时
                ...<object>this.wsConfig
            };
        }else{
            //浏览器环境
            this.wsConfig = <string>this.wsConfig || null ;
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
            if((<any>this.socket).readyState === 1) {
                return rs((<any>this.socket).readyState);
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
                        rs((<any>this.socket).readyState);
                        watchRestartNum.clear();
                    }
                }else{
                    // 启动成功后 restartNum 会变为0
                    rs((<any>this.socket).readyState);
                    watchRestartNum.clear();
                }
            })
        })
    }
    // promise 返回ws的状态 number
    createSocket() {
        console.log('createSocket');
        return new Promise((rs)=>{
            // 成功启动ws后调用该回调函数或超过连接次数后返回Socket状态
            this.waitSocketState = (readyState: number) =>{
                rs(readyState);
            }
            this.websocketStart();
        });
    }
    // 实例化 websocket
    websocketStart() {
        try {
            // node环境
            if(ClientSocket.isNodeEve){
                this.socket = new ws(this.url, this.wsConfig);
            }else{
                // 浏览器环境
                // @ts-ignore
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
            this.waitSocketState && this.waitSocketState((<any>this.socket).readyState);
            return;
        }
        this.restartNum++;
        console.log('重启', this.restartNum);
        this.lockReconnect = true;
        //没连接上会一直重连，设置延迟避免请求过多
        this.timeout && clearTimeout(this.timeout);
        this.timeout = <any>setTimeout(() => {
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
            this.heartCheck && this.heartCheck.startHeart();
            // 启动websocket成功
            this.waitSocketState && this.waitSocketState((<any>this.socket).readyState);
        }
        const onError = (err: any) => {
            console.log("error--- ", err);
        }
        const onClose = (err: any) => {
            this.heartCheck && this.heartCheck.stopHeart();
            console.log("close---", err);
            this.websocketReconnect(); // 重连
        }
        const onEnd = () => {
            console.log("end");
        }
        // node 环境接收信息
        const onMessageNode = (data) => {
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            this.heartCheck.startHeart();
            const messageData = JSON.parse(data.toString());
           this.sockSend.emit(messageData);
        }
        // web 环境接收信息
        const onMessageWeb = (res: any) => {
            // 读取blob 每次都新建 避免相互影响
            const fileReader = new FileReader();
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            this.heartCheck.startHeart();
            //将Blob 对象转换成字符串
            fileReader.readAsText(res.data, 'utf-8');
            fileReader.onload = () => {
                const messageData = JSON.parse(fileReader.result.toString());
                this.sockSend.emit(messageData);
            }
        }
        // node环境
        if(typeof(WebSocket) === "undefined") {
            // @ts-ignore
            this.socket.on("open",onOpen);
            // @ts-ignore
            this.socket.on("error", onError);
            // @ts-ignore
            this.socket.on("close", onClose);
            // @ts-ignore
            this.socket.on("end", onEnd);
            // @ts-ignore
            this.socket.on("message", onMessageNode);
        }else{
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
    }
}

module.exports = ClientSocket;

