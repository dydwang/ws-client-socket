const {clientSocket} = require('./1.实例化');
let wsState = 0;
clientSocket.createSocket().then(state => {
  wsState = state;
})
const init = async () => {
  // 上面的websocket可能还未连接成功
  // 等待连接三次
  wsState = await clientSocket.waitCreate(3);
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
    }
  })
  clientSocket.sockSend.send('test')
}
init();
