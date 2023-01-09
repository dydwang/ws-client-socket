/**
 * @params {object} target 目标对象
 * @params {string} key 目标对象需监听的值
 * @callback call
 * **/
import { typeCall, WatchInter } from './types/watch'
class Watch implements WatchInter {
    public target: any
    public key: any
    constructor(target: object, key: string) {
        this.target = target
        this.key = key
    }
    init(call: typeCall) {
        let initialValue = this.target[this.key]
        return Object.defineProperty(this.target, this.key, {
            get: function () {
                return initialValue
            },
            set: function (newValue) {
                call && call(newValue, initialValue)
                initialValue = newValue
            }
        })
    }
    clear() {
        let value = this.target[this.key]
        delete this.target[this.key]
        this.target[this.key] = value
    }
}

export default Watch
