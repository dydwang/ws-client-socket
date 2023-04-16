import { WebSocket as NodeSocket, RawData, ClientOptions, MessageEvent } from 'ws'
import mitt from 'mitt';
import { ClientSocketOptions, ClientSocketOptionsCon, ReactiveData, SocketOnEvent } from '../types/client'
const emitter = mitt<SocketOnEvent>();
import WS from 'ws';
import { SockSend } from './sockSend'
import {reactive} from "@vue/reactivity";
import {watch} from "@vue/runtime-core";
import { RequiredAll, SendData, SendDataReq, Socket, SocketDataRes, WebSocketData } from '../types/basics'
import deepmerge from 'deepmerge';
const isNodeEnv = typeof window === 'undefined' || !globalThis.window;
export class ClientSocket  {
    public options: ClientSocketOptions = {
        url: '', // 服务器地址
        logger: console,
        // socket的相关配置
        socketOptions: {
            wsConfig: isNodeEnv ? {} : undefined, // 后端ws库的配置 // 前端环境 websocket子协议
            reconnectMax: 3, // 默认最多重启次数为3；0：不重启 -1：无限重启
            reconnectTime: 2 * 1000, // 重连时间
            heartCmd: 'heart', // 心跳cmd指令
            heartTime: 5 * 1000, // 心跳时间
        },
        // socket 通信相关配置
        socketSendOptions: {
            // 请求拦截器
            reqInterceptors: (data) => {
                return Buffer.from(JSON.stringify(data))
            },
            // 响应拦截器
            resInterceptors: (data) => {
                return JSON.parse(data.toString())
            },
        },
    }
    // 主要用来获取ws的生命周期
    public on = emitter.on;
    public socket: Socket;
    public sockSend: SockSend;
    public socketReadyState = {
        0: 'websocket连接尚未建立, 无法连接到服务端',
        1: 'websocket连接已建立，可以进行通信',
        2: 'websocket连接正在进行关闭',
        3: 'websocket连接已经关闭或者连接不能打开'
    }
    protected reactiveData = reactive<ReactiveData>({
        heartTimer: undefined, // 心跳定时器
        reconnectNum: 0, // 重启次数
        reconnectTimer: undefined, // 重启定时器
        isSocketReconnect: false, // 正在重启
        isSocketClose: false, // socket已经关闭 不会自动重启
    })
    private socketEventMap = {
        // node event: undefined
        // web event: Event
        onopen: (event?: Event) => {
            // 启动成功后重启次数归零
            this.reactiveData.reconnectNum = 0;
            // 创建后开始心跳检测
            this.startHeart();
            emitter.emit('socket-open', event);
            // 启动成功
            emitter.emit('socket-change-state');
        },
        // node error: Error
        // web error: Event
        onerror: (error: Error | Event) => {
            this.options.logger.error('ws onError', error);
            emitter.emit('socket-error', error);
            emitter.emit('socket-change-state');
        },
        // node code: number, reason: Buffer
        // web code: CloseEvent
        onclose: (code: number | CloseEvent, reason?: Buffer) => {
            this.stopHeart();
            this.websocketReconnect(); // 重连
            if(isNodeEnv) {
                this.options.logger.error('ws onClose', reason && reason.toString());
                emitter.emit('socket-close', {
                    code: code as number,
                    reason
                });
            }else {
                this.options.logger.error('ws onClose', (<CloseEvent>code)?.reason)
                emitter.emit('socket-close', code as CloseEvent);
            }
            emitter.emit('socket-change-state');
        },
        // node data: WebSocket.RawData | MessageEvent, isBinary: boolean
        // web data: MessageEvent
        onmessage: async (data: SocketDataRes) => {
            //拿到任何消息都说明当前连接是正常的  重新开始心跳检测
            this.startHeart();
            const messageData = await this.options.socketSendOptions.resInterceptors(data);
            this.sockSend.emit(messageData);
            emitter.emit('socket-message', data);
        }
    }
    constructor(options: ClientSocketOptionsCon) {
        this.options.socketOptions.wsConfig = {
            handshakeTimeout: this.options.socketOptions.reconnectTime
        };
        // 深度合并
        this.options = deepmerge(this.options, options) as Required<ClientSocketOptions>;
        this.sockSend = new SockSend({
            url: this.options.url,
            clientSend: this.clientSend
        })
    }

    // 发送消息
    private clientSend = async(req: SendDataReq) => {
        // 如果有socket
        if (this.socket && this.socket.readyState === 1) {
            const reqData = (await this.options.socketSendOptions.reqInterceptors(req)) as WebSocketData;
            this.socket.send(reqData);
        } else {
            this.sockSend.sendError(`websocket未创建成功 ${this.options.url}`, req.uuid);
        }
    }

    /**
        创建websocket
     */
    public async createSocket(): Promise<number> {
        this.reactiveData.reconnectNum = 1;
        return new Promise((resolve) => {
            emitter.on('socket-change-state', () => {
                resolve(this.socket?.readyState || 0);
            });
            this.websocketInstance();
        })
    }

    /**
     * 等待ws的启动 默认等待3次  并不会启动ws 只会等待ws启动成功
     * @params {number} reconnectMax 该次请求最多等待重启次数
     * 传递该值的情况为
     * 1.已经实例化并运行过createSocket
     * 2.readyState 不为1（ws不在运行中）
     * 3.需等待重启最多reconnectMax次
     * **/
    public waitCreate(reconnectMax = 3): Promise<number> {
        return new Promise((resolve)=>{
            // 当前重启次数
            let restartNum = 0;
            const unWatch = watch(() => this.reactiveData.reconnectNum, (newsValue, oldValue) => {
                // this.options.logger.log('newsValue, oldValue', newsValue, oldValue)
                if(newsValue - 1 === oldValue) {
                    restartNum++;
                    this.options.logger.log(`等待重启 ${this.options.url} ${restartNum}/${reconnectMax}`);
                    // 等待 reconnectMax 次后还未启动成功
                    if(restartNum >= reconnectMax) {
                        resolve(this.socket?.readyState || 0);
                        unWatch();
                    }else if(this.reactiveData.isSocketClose) {
                        //  ws已经完全关闭无法重启
                        resolve(this.socket?.readyState || 0);
                        unWatch();
                    }
                }else if(newsValue === 0 || this.reactiveData.isSocketClose){
                    // 启动成功 或 永久关闭后 restartNum 会变为0
                    resolve(this.socket?.readyState || 0);
                    unWatch();
                }
            }, {

            })
            // 如果已经启动成功
            if(this.socket) {
                if(this.socket.readyState === 1) {
                    unWatch();
                    // ws 已经启动
                    return resolve(this.socket?.readyState);
                }else if(this.reactiveData.isSocketClose) {
                    unWatch();
                    //  ws已经完全关闭无法重启
                    return resolve(this.socket?.readyState);
                }
            }else {
                this.createSocket();
            }
        })
    }

    // 实例化 websocket
    private websocketInstance() {
        try {
            if (isNodeEnv) {
                this.socket = new WS(this.options.url, this.options.socketOptions.wsConfig as ClientOptions);
            } else {
                // 浏览器环境
                this.socket = new WebSocket(this.options.url, this.options.socketOptions.wsConfig as string);
            }
            this.websocketEvent();
        } catch (e) {
            this.options.logger.log('catch', e);
            // 出错重连
            this.websocketReconnect();
        }
    }

    // 对ws重连
    private websocketReconnect() {
        this.reactiveData.reconnectNum++;
        const socket = <WebSocket | NodeSocket>this.socket;
        if(this.reactiveData.isSocketReconnect) {
            return this.options.logger.log(`正在执行重连, ${this.options.url}`);
        }
        else if (this.reactiveData.isSocketClose) {
            return this.options.logger.log(`socket已经完全关闭后不再重启, ${this.options.url}`);
        }
        // 最多重启restartMax次(如果restartMax = 0 不重启)
        else if(((this.reactiveData.reconnectNum > this.options.socketOptions.reconnectMax) || (this.options.socketOptions.reconnectMax === 0)) && this.options.socketOptions.reconnectMax >= 0) {
            this.reactiveData.isSocketClose = true;
            const error_msg = `启动socket失败, ${this.socketReadyState[socket.readyState]}, ${socket.url}, ${this.reactiveData.reconnectNum - 1}/${this.options.socketOptions.reconnectMax}`;
            this.sockSend.sendError(error_msg);
            this.options.logger.log(error_msg);
            // 已经没法重启了
            return emitter.emit('socket-change-state');
        }
        this.reactiveData.isSocketReconnect = true;
        this.options.logger.log(
            '重启socket',
            this.options.url,
            `${this.reactiveData.reconnectNum}/${this.options.socketOptions.reconnectMax === -1 ? '无限制' : this.options.socketOptions.reconnectMax}`
        )

        //没连接上会一直重连，设置延迟避免请求过多
        this.reactiveData.reconnectTimer && clearTimeout(this.reactiveData.reconnectTimer);
        this.reactiveData.reconnectTimer = setTimeout(() => {
            this.reactiveData.isSocketReconnect = false;
            this.websocketInstance();
        }, this.options.socketOptions.reconnectTime);
    }

    // 对socket的事件进行注册
    private websocketEvent() {
        const that = this;
        if(this.socket) {
            const wm = new WeakMap<NodeSocket | WebSocket, typeof this.socketEventMap>();
            wm.set(this.socket, this.socketEventMap);
            // this.socket 被销毁时 自动垃圾回收
            if (isNodeEnv) {
                const socket = <NodeSocket>this.socket;
                socket.addListener('open', wm.get(socket)?.onopen as typeof that.socketEventMap.onopen);
                socket.addListener('error', wm.get(socket)?.onerror as typeof that.socketEventMap.onerror);
                socket.addListener('close', wm.get(socket)?.onclose as typeof that.socketEventMap.onclose);
                socket.addListener('message', wm.get(socket)?.onmessage as typeof that.socketEventMap.onmessage);
            }else {
                const socket = <WebSocket>this.socket;
                socket.addEventListener('open', wm.get(socket)?.onopen as typeof that.socketEventMap.onopen);
                socket.addEventListener('error', wm.get(socket)?.onerror as typeof that.socketEventMap.onerror);
                socket.addEventListener('close', wm.get(socket)?.onclose as typeof that.socketEventMap.onclose);
                socket.addEventListener('message', wm.get(socket)?.onmessage as typeof that.socketEventMap.onmessage);
            }
        }
    }

    // 开始心跳
    private startHeart() {
        this.stopHeart();
        this.reactiveData.heartTimer = setInterval(() => {
            this.sockSend && this.sockSend.send(this.options.socketOptions.heartCmd);
        }, this.options.socketOptions.heartTime)
    }

    // 停止心跳
    private stopHeart() {
        this.reactiveData.heartTimer && clearInterval(this.reactiveData.heartTimer);
    }

    public close() {
        // 不再重启
        this.reactiveData.isSocketClose = true;
        emitter.off('*');
        this.socket?.close && this.socket.close(1000);
        this.sockSend.off();
    }
}
