const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const fs = require('fs');
const cmdAPI = {};
// 创建 websocket 服务器 监听在 3000 端口
const wss = new WebSocketServer({
    port: 8989,
    maxPayload: 0,
});
// 服务器被客户端连接
wss.on('connection', (ws) => {
    // 接收客户端信息并把信息返回发送
    ws.on('message', async (message) => {
        const res = JSON.parse(message);
        // console.log(res);
        const { uuid, cmd, content } = res;
        // console.log(cmd, uuid);
        ws.send(new Buffer(message));
        // ws.send(JSON.stringify(message))
    });
    ws.on('close', function (code, reason) {
        console.log('关闭连接close', code);
    });
    ws.on('error', function (code, reason) {
        console.log('异常关闭error', code);
    });
});
