# ws-client-socket

## 下载
```
npm install ws-client-socket -S
```

### 初始化项目
```
const ClientSocket = require('ws-client-socket');
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
```

### 启动项目 clientSocket.createSocket()
```
(async ()=>{
    const wsReadyState = await clientSocket.createSocket();
    if(wsReadyState === 1) {
        // 可以进行通信
    }
)
```

### 等待项目启动 clientSock.waitCreate(restartNum)
```
// 在项目进行长连接
// 接口内调用ws时先判断是否连接, 如果未连接自动进行有次数的等待连接
let wsReadyState = 0; // ws启动状态
clientSock.createSocket().then(state=>{
    wsReadyState = state;
})

(async ()=>{
        // 第一次判断时 没链接ws 主动连接 等待连接3次
        if(wsReadyState !== 1) {
            wsReadyState = await clientSock.waitCreate(3);
        }
        // 第二次 没链接ws 返回连接错误参数
        if(wsReadyState === 1) {
            // 可以进行通信
        }
})()
```


### 回调通信 clientSocket.sockSend.send(cmd, option, callback)
```
// 回调方式 client -> serve -> client
// 内部生成uuid 自动绑定 
clientSocket.sockSend.send('test', {name: '1'},({reqData, resData, onmessage, socket})=>{
    console.log('回调方式', resData.content.name);
});
```

### 订阅通信 clientSocket.sockSend.emitter.on(cmd,callback)
```
// 还未创建ws连接就可以开始订阅
// 订阅方式 serve -> client
// 只要服务端推送该命令就会触发
clientSocket.sockSend.emitter.on('test', ({resData})=>{
    console.log('订阅方式', resData.content.name);
});
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

