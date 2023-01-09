import { WebSocket as NodeSocket, RawData } from 'ws';
import {
    ClientSocketOptions,
    Socket, SocketOnEvent
} from './types/client'
import mitt from 'mitt';
import { SockSend } from './sockSend'
const emitter = mitt<SocketOnEvent>();
import WS from 'ws';
import Watch from './watch'
import { SendRes } from './types/sockSend'
export class ClientSocket  {
    public isNodeEnv: boolean = typeof WebSocket === 'undefined' // 是否为node环境
    public options: Required<ClientSocketOptions> = {
        url: '', // 服务器地址
        isCacheCmd: false, // 缓存接口  默认不缓存
        cmdAPI: {}, // 接口文件
        restartMax: 3, // 默认最多重启次数为3；0：不重启 -1：无限重启
        reconnectTime: 2 * 1000,
        wsConfig: {},
        wsProtocols: '', // 前端环境 websocket子协议
        heartCmd: 'heart', // 心跳cmd指令
        timeout: 5 * 1000, // 连接超时
        // 请求拦截器
        reqInterceptors: (data) => {
            return Buffer.from(JSON.stringify(data))
        },
        // 响应拦截器
        resInterceptors: (data) => {
            return JSON.parse(data.toString()) as SendRes
        },
    }
    // 主要用来获取ws的生命周期
    public on = emitter.on;
    public socket: Socket;
    public restartNum = 0; // 重启次数
    public sockSend: SockSend;
    public lockReconnect: boolean = false; // 正在重连socket
    public socketIsClose: boolean = false; // socket已经关闭
    public socketReadyState = {
        0: 'websocket连接尚未建立, 无法连接到服务端',
        1: 'websocket连接已建立，可以进行通信',
        2: 'websocket连接正在进行关闭',
        3: 'websocket连接已经关闭或者连接不能打开'
    }
    private heartTimer: undefined | NodeJS.Timeout; // 心跳定时
    private websocketReconnectTimer: undefined | NodeJS.Timeout; // 重连定时
    constructor(options: ClientSocketOptions) {
        this.options = {
            ...this.options,
            ...options
        }
        this.options.wsConfig.handshakeTimeout = this.options.timeout;
        this.sockSend = new SockSend({
            socket: this.socket,
            heartCmd: this.options.heartCmd,
            isCacheCmd: this.options.isCacheCmd,
            cmdAPI: this.options.cmdAPI,
            reqInterceptors: this.options.reqInterceptors, // 请求拦截器
            resInterceptors: this.options.resInterceptors, // 响应拦截器
        })
    }

    // 创建websocket
    public async createSocket() {
        return new Promise((resolve) => {
            this.restartNum = 0;
            emitter.on('socket-create-status', () => {
                resolve(this.socket?.readyState);
            });
            this.websocketInstance();
        })
    }
    /**
     * 等待ws的启动 默认等待3次  并不会启动ws 只会等待ws启动成功
     * @params {number} restartMaxNow 该次请求最多重启次数
     * 传递该值的情况为
     * 1.已经实例化并运行过createSocket
     * 2.readyState 不为1（ws不在运行中）
     * 3.需等待重启最多restartMaxNow次
     * **/
    public waitCreate(restartMaxNow = 3) {
        // 如果传递restartMax 不用在意this.restartMax
        return new Promise((rs)=>{
            // 如果已经启动成功
            if(this.socket) {
                if(this.socket.readyState === 1) {
                    // ws 已经启动
                    return rs(this.socket.readyState);
                }else if(this.socketIsClose) {
                    //  ws已经完全关闭无法重启
                    return rs(this.socket.readyState);
                }
            }else {
                this.createSocket();
            }
            // 当前重启次数
            let restartNum = 0;
            const watchRestartNum = new Watch(this, 'restartNum');
            watchRestartNum.init((newsValue: number, oldValue: number)=>{
                if(newsValue - 1 === oldValue) {
                    restartNum++;
                    console.log(`等待重启 ${this.options.url} ${restartNum}/${restartMaxNow}`);
                    // 等待 restartMaxNow 次后还未启动成功
                    if(restartNum >= restartMaxNow) {
                        this.socket && rs(this.socket.readyState);
                        watchRestartNum.clear();
                    }
                }else{
                    // 启动成功后 restartNum 会变为0
                    this.socket && rs(this.socket.readyState);
                    watchRestartNum.clear();
                }
            })
        })
    }

    public close() {
        // 不再重启
        this.socketIsClose = true;
        emitter.off('*');
        this.socket?.close && this.socket.close(1000);
        this.sockSend?.off && this.sockSend.off();
    }

    // 实例化 websocket
    private websocketInstance() {
        try {
            if (this.isNodeEnv) {
                this.socket = new WS(this.options.url, this.options.wsConfig);
            } else {
                // 浏览器环境
                this.socket = new WebSocket(this.options.url, this.options.wsProtocols);
            }
            this.websocketEvent();
        } catch (e) {
            console.log('catch', e);
            // 出错重连
            this.websocketReconnect();
        }
    }

    // 对socket的事件进行注册
    private websocketEvent() {
        const that = this;
        const socketEvent = {
            onopen(...args: any[]) {
                emitter.emit('socket-open', args);
                // 启动成功
                emitter.emit('socket-create-status');
                // 启动成功后重启次数归零
                that.restartNum = 0;
                // 更新sockSend里的socket
                that.sockSend.options.socket = that.socket;
                // 继续运行还未完成的事件
                that.sockSend.restartSend();
                // 创建后开始心跳检测
                that.startHeart();
            },
            onerror(...args: any[]) {
                emitter.emit('socket-error', args);
                emitter.emit('socket-create-status');
                const err: Error | Event | string = args[0];
                console.error('ws onError', err);
            },
            onclose(...args: any[]) {
                emitter.emit('socket-close', args);
                emitter.emit('socket-create-status');
                const err: Error | Event | string = args[0];
                console.error('ws onClose', err)
                that.stopHeart();
                that.websocketReconnect() // 重连
            },
            onend(...args: any[]) {
                emitter.emit('socket-end', args);
                emitter.emit('socket-create-status');
                const err: Error = args[0];
                console.error('ws onEnd', err);
            },
            async onmessage(...args: any[]) {
                emitter.emit('socket-message', args);
                const data: RawData = args[0];
                //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
                that.startHeart();
                const messageData = await that.options.resInterceptors(data);
                that.sockSend.emit(messageData);
            }
        }
        if (this.isNodeEnv) {
            const socket = <NodeSocket>this.socket;
            socket.on('open', socketEvent.onopen);
            socket.on('error', socketEvent.onerror);
            socket.on('close', socketEvent.onclose);
            socket.on('end', socketEvent.onend);
            socket.on('message', socketEvent.onmessage);
        }else {
            const socket = <WebSocket>this.socket;
            socket.onopen = socketEvent.onopen;
            socket.onerror = socketEvent.onerror;
            socket.onclose = socketEvent.onclose;
            socket.onmessage = socketEvent.onmessage;
        }
    }

    // 对ws重连
    private websocketReconnect() {
        const socket = <WebSocket | NodeSocket>this.socket;
        if(this.lockReconnect) {
            console.log(`正在执行重连, ${this.options.url}`);
            return;
        }
        else if (this.socketIsClose) {
            console.log(`socket已经完全关闭后不再重启, ${this.options.url}`);
            return;
        }
        // 最多重启restartMax次(如果restartMax = 0 不重启)
        else if((this.restartNum >= this.options.restartMax || this.options.restartMax === 0) && this.options.restartMax >= 0) {
            this.socketIsClose = true;
            const error_msg = `wsReadyState: ${socket.readyState}, ${this.socketReadyState[socket.readyState as 0 | 1 | 2 | 3]}, ${socket.url}`;
            this.sockSend.sendError(error_msg);
            console.log(error_msg);
            // 已经没法重启了
            emitter.emit('socket-create-status');
            return;
        }
        this.restartNum++;
        console.log(
            '重启socket次数：',
            this.restartNum,
            `最多重启次数${this.options.restartMax === -1 ? '无限制' : this.options.restartMax}`,
            this.options.url
        )
        this.lockReconnect = true;
        //没连接上会一直重连，设置延迟避免请求过多
        this.websocketReconnectTimer && clearTimeout(this.websocketReconnectTimer);
        this.websocketReconnectTimer = setTimeout(() => {
            this.lockReconnect = false;
            this.websocketInstance();
        }, this.options.reconnectTime);
    }

    // 开始心跳
    private startHeart() {
        this.stopHeart();
        this.heartTimer = setInterval(() => {
            this.sockSend && this.sockSend.send(this.options.heartCmd);
        }, this.options.timeout)
    }

    // 停止心跳
    private stopHeart() {
        this.heartTimer && clearInterval(this.heartTimer);
    }
}
