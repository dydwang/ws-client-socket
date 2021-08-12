class HeartCheck {
    constructor(sockSend, heartTimeout) {
        this.timeoutSize = heartTimeout;
        this.timeoutFun = null;
        this.sockSend = sockSend;
    }
    // 开始心跳检测
    startHeart(){
        this.stopHeart();
        this.timeoutFun = setTimeout(()=>{
            this.sockSend.send('heart');
        }, this.timeoutSize);
    }
    // 停止心跳
    stopHeart() {
        this.timeoutFun && clearTimeout(this.timeoutFun);
    }
}
module.exports = HeartCheck;