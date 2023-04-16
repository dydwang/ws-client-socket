import { ReqContent, SendData, SendDataReq, SendDataRes, SocketData, SocketDataRes, UUID } from './basics'

export type ReqInterceptors = (req: SendDataReq) => SocketData | Promise<SocketData>;
export type ResInterceptors = (res: SocketDataRes) => SendDataRes | Promise<SendDataRes>;

export type SockSendOptions = {
    url: string,
    clientSend: (req: SendDataReq) => void
}

export interface SendOptions {
    isOff?: boolean // 发布一次就注销
    timeout?: number // 默认不超时
    onSendBefore?: (req: SendDataReq) => void;
}

export interface SockSendData {
    content?: ReqContent
    options?: SendOptions
    uuid?: UUID
}

export interface SendCallbackData {
    req: SendDataReq,
    res: SendDataRes,
}
export type SendCallback = (data: SendCallbackData) => void;

export interface SendCmdCacheItem {
    req: SendData,
    options: SendOptions,
    resolve: (value: SendCallbackData | PromiseLike<SendCallbackData>) => void,
    reject: (reason?: any) => void,
    status: 'pending' | 'resolved' | 'rejected',
    callback?: SendCallback,
    onTimeout?: NodeJS.Timeout
}
export type SendCmdCache = Record<UUID, SendCmdCacheItem>
