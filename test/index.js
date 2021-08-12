const ClientSocket = require('../index')
const clientSocket = new ClientSocket({
    url: 'ws://127.0.0.1:10001',  // 服务端地址
    restartMax: 3, // 默认最多重启次数为3
    reconnectTime: 2 * 1000, // 默认2s重连一次
    cmdAPI: {}, // 接口文件
    wsConfig: {
        handshakeTimeout: 3000, // 连接超时时长
    }, // websocket配置
    heartTimeout: 10 * 1000, // 心跳检测时间  10s
});
let aJsUuid; // a.js里的uuid
// 还未创建ws连接就可以开始订阅
// 订阅方式 serve -> client
// 只要服务端推送该命令就会触发
clientSocket.sockSend.emitter.on('applySite', ({resData})=>{
    console.log('订阅方式', resData.content.name);
    if(resData.uuid === aJsUuid) {
        console.log('我在b.js里订阅', aJsUuid, resData);
    }
});

(async ()=>{
    const wsReadyState = await clientSocket.createSocket();
    if(wsReadyState === 1) {
        // 回调方式 client -> serve -> client
        // 内部生成uuid 自动绑定
        clientSocket.sockSend.send('test', {name: '1'},
            ({reqData, resData, onmessage, socket})=>{
            console.log('回调方式', resData.content.name);
        });

        clientSocket.sockSend.send('test', {name: '2'}, ({resData})=>{
            console.log('回调方式', resData.content.name);
        });

        // 某种使用场景 a.js里进行通信  b.js订阅
        // send会返回uuid
        aJsUuid = clientSocket.sockSend.send('test', {name: '3'});
    }
})();

