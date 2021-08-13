const ClientSocket = require('../index');
ClientSocket.cmdAPIInit = {
    result:()=>{
        return {
            data:{
                cmd: 'result',
                content:{}
            },
            onmessage:()=>{}
        }
    }
};


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
(async ()=>{
    const state = await clientSocket.createSocket();
    console.log(clientSocket.cmdAPI);
})()
