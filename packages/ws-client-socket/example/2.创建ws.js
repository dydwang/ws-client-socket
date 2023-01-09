const {clientSocket} = require('./1.实例化')
const init = async () => {
  const wsState = await clientSocket.createSocket();
  console.log(wsState)
}
init();
