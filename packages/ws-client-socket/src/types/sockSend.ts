import {
    Socket,
    Cmd,
    IsCacheCmd,
    ReqContent,
    UUID,
    CmdAPIInit,
    CmdAPIItem,
    ReqInterceptors,
    ResInterceptors,
    ClientSocketOptions
} from './client'
export type SockSendOptions = {
    socket: Socket,
    heartCmd: Cmd,
    isCacheCmd: IsCacheCmd,
    cmdAPI: CmdAPIInit,
    reqInterceptors: ReqInterceptors,
    resInterceptors: ResInterceptors
}

export interface SendOptions {
    isOff?: boolean // 发布一次就注销
    isCacheCmd?: IsCacheCmd // 是否缓存
    timeout?: number // 默认不超时
    reqInterceptors?: ReqInterceptors, // 请求拦截器
    resInterceptors?: ResInterceptors, // 响应拦截器
}

export interface SockSendData {
    content?: ReqContent
    options?: SendOptions
    uuid?: UUID
}

export interface SendReq extends CmdAPIItem{

}

export interface SendRes extends CmdAPIItem{
    error_msg?: string,
    status?: -1 | 0 | 1, // -1 : 失败 0：进行中 1：成功
}

export interface SendCallbackBack {
    req: SendReq,
    res: SendRes,
    socket: Socket
}
export type SendCallback = (data: SendCallbackBack) => any;

export interface SendCmdCacheItem {
    req: CmdAPIItem,
    options: SendOptions,
    resolve: any | PromiseConstructor["resolve"],
    reject: any | PromiseConstructor["reject"],
    status: 'pending' | 'resolved' | 'rejected',
    callback?: SendCallback,
    onTimeout?: NodeJS.Timeout
}
export type SendCmdCache = Record<UUID, SendCmdCacheItem>
