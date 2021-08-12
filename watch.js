/**
 * @params {object} target 目标对象
 * @params {string} key 目标对象需监听的值
 * @callback call
 * **/
class Watch{
    constructor(target, key) {
        this.target = target;
        this.key = key;
    }
    init(call) {
        let initialValue = this.target[this.key];
        return Object.defineProperty(this.target,this.key, {
            get: function () {
                return initialValue;
            },
            set: function (newValue) {
                call && call(newValue, initialValue);
                initialValue = newValue;
            }
        });
    }
    clear() {
        let value = this.target[this.key];
        delete this.target[this.key];
        this.target[this.key] = value;
    }
}
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

module.exports = Watch;