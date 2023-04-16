import { Data as NodeSocketData, WebSocket as NodeSocket } from 'ws';
export type Socket = NodeSocket | WebSocket | undefined;

export type UUID = string;
export type Cmd = string;
export type ReqContent = Record<string, any>;
export type SendData = {
    uuid: UUID,
    cmd: Cmd,
    content?: ReqContent
}

export interface SendDataReq extends SendData{

}

export interface SendDataRes extends SendData{
    error_msg?: string,
    status?: -1 | 0 | 1, // -1 : 失败 0：进行中 1：成功
}

export type WebSocketData = string | ArrayBufferLike | Blob | ArrayBufferView;
export type SocketData = NodeSocketData | WebSocketData;
export type SocketDataRes = SocketData | MessageEvent<SocketData>


export type RequiredAll<T> = {
    [K in keyof T]-?: RequiredAll<Required<T[K]>>
}

