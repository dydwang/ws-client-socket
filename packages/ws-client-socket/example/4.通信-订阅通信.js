const {clientSocket} = require('./1.实例化');

const init = async () => {
  // 上面的websocket可能还未连接成功
  // 等待连接三次
  await clientSocket.createSocket();
  // 订阅 serve -> client
  clientSocket.sockSend.on('test', ({ req, res, socket }) => {
    console.log(res)
  });

  clientSocket.sockSend.on('heart', ({ req, res, socket }) => {
    console.log(res)
  });

  clientSocket.sockSend.send('test', {
    content: {
      name: '张三'
    },
    options: {
      onSendBefore: (req) => {
        console.log(req)
      }
    }
  })
  clientSocket.sockSend.send('test')
}
init();
