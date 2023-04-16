const {clientSocket} = require('./1.实例化');
const data = require('../package.json')
const init = async () => {
    await clientSocket.createSocket();
    const arr = new Array(100000).fill(1)
    for(let i = 0; i < arr.length; i++) {
        clientSocket.sockSend.send('test', {
            options: {
                isOff: true
            },
            content: {data}
        }, ({req, res}) => {
            // console.log(req, res)
            if(i === arr.length - 1) {
                console.log(req, res)
            }
        })
    }
    // clientSocket.close()
    console.log(123)
}
init()
