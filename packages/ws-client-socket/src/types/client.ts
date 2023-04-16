import { ClientOptions, RawData } from 'ws'
import {ReqInterceptors, ResInterceptors} from "./sockSend";
import { SocketDataRes } from '@vue/ws-client-socket'

export interface ClientSocketOptions {
    url: string, // 服务器地址
    logger: Console,
    socketOptions: {
        wsConfig: ClientOptions | string | undefined, // 后端ws库的配置 // 前端环境 websocket子协议
        reconnectMax: number, // 默认最多重启次数为3；0：不重启 -1：无限重启
        reconnectTime: number, // 重连时间
        heartCmd: string, // 心跳cmd指令
        heartTime: number, // 心跳时间
    },
    // socket 通信相关配置
    socketSendOptions: {
        reqInterceptors: ReqInterceptors,// 请求拦截器
        resInterceptors: ResInterceptors,// 响应拦截器
    },
}

// 实例化传入配置
export interface ClientSocketOptionsCon {
    url: ClientSocketOptions['url'], // 服务器地址
    logger?: ClientSocketOptions['logger'],
    socketOptions?: Partial<ClientSocketOptions['socketOptions']>,
    socketSendOptions?: Partial<ClientSocketOptions['socketSendOptions']>,
}


export interface ReactiveData {
    heartTimer: undefined | NodeJS.Timeout, // 心跳定时器
    reconnectNum: number, // 重启次数
    reconnectTimer: undefined | NodeJS.Timeout, // 重启定时器
    isSocketReconnect: boolean, // 正在重启
    isSocketClose: boolean, // socket已经关闭 不会自动重启
}


export type SocketOnEvent = {
    'socket-change-state': undefined,
    'socket-open': Event | undefined,
    'socket-error': Error | Event,
    'socket-close': {
        code: number,
        reason?: Buffer
    } | CloseEvent,
    'socket-message': SocketDataRes,
    '*': any
}
