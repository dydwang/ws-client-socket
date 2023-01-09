import { ClientOptions, Data as NodeSocketData, WebSocket as NodeSocket } from 'ws'
import { SendReq, SendRes } from './sockSend'

export type ReqContent = Record<string, any>;
export type UUID = string;
export type Cmd = string;
export type Url = string;
export type IsCacheCmd = boolean;
export type CmdAPIItem = {
    uuid: UUID,
    cmd: Cmd,
    content?: ReqContent
}
export type CmdAPIInitFun = (data: CmdAPIItem) => CmdAPIItem;
export type CmdAPIInit = Record<Cmd, CmdAPIInitFun>;

export { NodeSocketData };
export type WebSocketData = string | ArrayBufferLike | Blob | ArrayBufferView;
export type SocketData = NodeSocketData | WebSocketData;
export type ReqInterceptors = (req: SendReq) => SocketData | Promise<SocketData>;
export type ResInterceptors = (res: SocketData | MessageEvent<SocketData>) => SendRes | Promise<SendRes>;

export interface ClientSocketOptions {
    url: Url, // 服务器地址
    isCacheCmd?: IsCacheCmd, // 缓存接口  默认不缓存
    cmdAPI?: CmdAPIInit, // 接口文件
    restartMax?: number // 默认最多重启次数为3 ；0：不重启 -1：无限重启
    reconnectTime?: number // 默认2s重连一次
    wsConfig?: ClientOptions // websocket配置
    wsProtocols?: string // 前端环境 websocket子协议
    heartCmd?: Cmd, // 心跳cmd指令
    timeout?: number, // 连接超时时间
    reqInterceptors?: ReqInterceptors, // 请求拦截器
    resInterceptors?: ResInterceptors, // 响应拦截器
}

export type Socket = NodeSocket | WebSocket | undefined;


export type SocketOnEvent = {
    'socket-create-status': any,
    'socket-open': any[],
    'socket-error': any[],
    'socket-close': any[],
    'socket-end': any[],
    'socket-message': any[],
    '*': any
}

export type SocketReadyState = 0 | 1 | 2 | 3
