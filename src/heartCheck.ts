
import {
    SockSendInterface,
    HeartCheckInterface
} from './interface';
class HeartCheck implements HeartCheckInterface {
    public timeoutFun: undefined | NodeJS.Timeout;
    public timeoutSize: number;
    public sockSend: SockSendInterface = {};
    constructor(sockSend: SockSendInterface, heartTimeout: number) {
        this.timeoutSize = heartTimeout;
        this.sockSend = sockSend;
    }
    // 开始心跳检测
    startHeart(){
        this.stopHeart();
        this.timeoutFun = <any>setTimeout(()=>{
            this.sockSend.send('heart');
        }, this.timeoutSize);
    }
    // 停止心跳
    stopHeart() {
        this.timeoutFun && clearTimeout(this.timeoutFun);
    }
}
module.exports = HeartCheck;