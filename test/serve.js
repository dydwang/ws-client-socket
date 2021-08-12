console.log("WebSocket建立完毕 8181")
const WebSocket = require('ws')
const WebSocketServer = WebSocket.Server;
const fs = require('fs');
const cmdAPI = require('../cmd');
// 创建 websocket 服务器 监听在 3000 端口
const wss = new WebSocketServer({
    port: 10001,
    maxPayload: 0
})
// 服务器被客户端连接
wss.on('connection', (ws) => {
    ws.send(new Buffer(JSON.stringify(cmdAPI.test({}).data)));
    // 接收客户端信息并把信息返回发送
    ws.on('message', (message) => {
        // console.log('message');
        // let data = JSON.parse(message);
        setTimeout(()=>{
            ws.send(new Buffer(message));
        },1000);
    })
    ws.on("close", function (code, reason) {
        console.log("关闭连接close", code)
    });
    ws.on("error", function (code, reason) {
        console.log("异常关闭error", code)
    });
})

const ClientSock = require('../client');
const clientSock = new ClientSock({ restartMax: 0});
const readyState = clientSock.createSocket();