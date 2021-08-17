"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var HeartCheck = /** @class */ (function () {
    function HeartCheck(sockSend, heartTimeout) {
        this.sockSend = {};
        this.timeoutSize = heartTimeout;
        this.sockSend = sockSend;
    }
    // 开始心跳检测
    HeartCheck.prototype.startHeart = function () {
        var _this = this;
        this.stopHeart();
        this.timeoutFun = setTimeout(function () {
            _this.sockSend.send('heart');
        }, this.timeoutSize);
    };
    // 停止心跳
    HeartCheck.prototype.stopHeart = function () {
        this.timeoutFun && clearTimeout(this.timeoutFun);
    };
    return HeartCheck;
}());
module.exports = HeartCheck;
