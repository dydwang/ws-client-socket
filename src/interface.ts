interface CmdAPI {
    [key: string]: {
        onmessage?: Function,
        data: {
            uuid: string | number,
            cmd: string,
            content?: object
        }
    }
}

interface SockSendSendCmd {
    [Key: string]: {
        data: object,
        onConfig: object,
        callback:(name: string) => void,
    } | undefined
}

type typeCmd = string;
type typeUUID = string;
type typeContent = object | undefined;
type typeResData = {
    cmd: typeCmd,
    uuid: typeUUID,
    content: typeContent
}
type typeCallback = (
    reqData: typeResData,
    resData: typeResData,
    onmessage: Function,
    socket: any
) => void;

interface SockSendOptions{
    content?: object | undefined,
    config?:{
        isOff?: boolean, // 发布一次就注销
    },
    uuid?: typeUUID,
    [key: string]: any
}

interface SockSendInterface {
    cmdAPI?: CmdAPI,
    emitter?: any,
    sendCmd?: SockSendSendCmd,
    socket?: any,
    send?(cmd: typeCmd, options?: SockSendOptions, callback?:typeCallback): typeUUID,
    emit?(resData: typeResData) : void,
    changeSocket?(socket: any) : void,
    restartEmit?(): void,
    off?(uuid: typeUUID): void
}
interface HeartCheckInterface {
    timeoutFun: undefined | NodeJS.Timeout;
    timeoutSize: number;
    sockSend: SockSendInterface;
    // 开始心跳检测
    startHeart(): void ,
    // 停止心跳
    stopHeart(): void
}

export {
    CmdAPI,
    typeUUID,
    SockSendSendCmd,
    SockSendInterface,
    HeartCheckInterface,
    SockSendOptions,
    typeResData,
    typeCallback,
    typeCmd
}
