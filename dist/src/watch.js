/**
 * @params {object} target 目标对象
 * @params {string} key 目标对象需监听的值
 * @callback call
 * **/
var WatchObject = /** @class */ (function () {
    function WatchObject(target, key) {
        this.target = target;
        this.key = key;
    }
    WatchObject.prototype.init = function (call) {
        var initialValue = this.target[this.key];
        return Object.defineProperty(this.target, this.key, {
            get: function () {
                return initialValue;
            },
            set: function (newValue) {
                call && call(newValue, initialValue);
                initialValue = newValue;
            }
        });
    };
    WatchObject.prototype.clear = function () {
        var value = this.target[this.key];
        delete this.target[this.key];
        this.target[this.key] = value;
    };
    return WatchObject;
}());
// const watch = (target, key, call) => {
//     let initialValue = target[key];
//     return Object.defineProperty(target,key, {
//         get: function () {
//             return initialValue;
//         },
//         set: function (newValue) {
//             call && call(newValue, initialValue);
//             initialValue = newValue;
//         }
//     });
// }
module.exports = WatchObject;
