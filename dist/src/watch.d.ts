/**
 * @params {object} target 目标对象
 * @params {string} key 目标对象需监听的值
 * @callback call
 * **/
declare class WatchObject {
    target: object;
    key: string;
    constructor(target: any, key: any);
    init(call: any): object;
    clear(): void;
}
