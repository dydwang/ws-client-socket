/// <reference types="node" />
interface CmdAPI {
    [key: string]: {
        onmessage?: Function;
        data: {
            uuid: string | number;
            cmd: string;
            content: object;
        };
    };
}
interface SockSendSendCmd {
    [Key: string]: {
        data: object;
        onConfig: object;
        callback: (name: string) => void;
    } | undefined;
}
declare type typeCmd = string;
declare type typeUUID = string;
declare type typeContent = object | undefined;
declare type typeResData = {
    cmd: typeCmd;
    uuid: typeUUID;
    content: typeContent;
};
declare type typeCallback = (reqData: typeResData, resData: typeResData, onmessage: Function, socket: any) => void;
interface SockSendOptions {
    content?: object | undefined;
    config?: {
        isOff?: boolean;
    };
    uuid?: typeUUID;
    [key: string]: any;
}
interface SockSendInterface {
    cmdAPI?: CmdAPI;
    emitter?: any;
    sendCmd?: SockSendSendCmd;
    socket?: any;
    send?(cmd: typeCmd, options?: SockSendOptions, callback?: typeCallback): typeUUID;
    emit?(resData: typeResData): void;
    changeSocket?(socket: any): void;
    restartEmit?(): void;
    off?(uuid: typeUUID): void;
}
interface HeartCheckInterface {
    timeoutFun: undefined | NodeJS.Timeout;
    timeoutSize: number;
    sockSend: SockSendInterface;
    startHeart(): void;
    stopHeart(): void;
}
export { CmdAPI, typeUUID, SockSendSendCmd, SockSendInterface, HeartCheckInterface, SockSendOptions, typeResData, typeCallback, typeCmd };
