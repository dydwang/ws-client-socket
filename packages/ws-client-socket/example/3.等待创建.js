const {clientSocket} = require('./1.实例化');
let wsState = 0;
clientSocket.createSocket().then(state => {
  wsState = state;
})
const init = async () => {
  // 上面的websocket可能还未连接成功
  // 等待连接三次
  wsState = await clientSocket.waitCreate(3);
  console.log(wsState)
}
init();
