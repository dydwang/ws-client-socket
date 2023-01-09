const {clientSocket} = require('./1.实例化');
let wsState = 0;
clientSocket.createSocket().then(state => {
  wsState = state;
})
const init = async () => {
  // 上面的websocket可能还未连接成功
  // 等待连接三次
  wsState = await clientSocket.waitCreate(3);
  // 回调 client -> serve -> client
  clientSocket.sockSend.send('test', {
    content: {
      name: '张三'
    }
  }, ({req, res, socket}) => {
    console.log('我是回调通信')
    console.log(res)
  })
}
init();
