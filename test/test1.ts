const ClientSocket = require("../index.ts");
// console.log(ClientSocket);
(async ()=>{
    const clientSocket = new ClientSocket({
        url: 'ws://127.0.0.1:10001',
        cmdAPI: {},
        reconnectTime: 100
    });
    await  clientSocket.createSocket();
    // console.log(clientSocket);

    clientSocket.sockSend.send('heart', {},({reqData, resData, onmessage, socket})=>{
        // console.log(reqData, resData, onmessage, socket);
    });

    clientSocket.sockSend.emitter.on('test',({reqData, resData, onmessage, socket})=>{
        console.log(reqData, resData, onmessage, socket);
    });
})()