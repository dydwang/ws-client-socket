const UUID = require('uuid');
// 心跳检测
module.exports = ({uuid = UUID.v1(), content = {}}) => {
    return {
        data: {
            uuid,// 任务id
            cmd: 'heart',
            content: {
                ...content,
            },
        },
        // onmessage里调用的函数
        // messageData serve推送来的数据
        // type = 1  serve -> client
        // type = undefined client -> serve -> client
        onmessage: (messageData, socket, type) => {
            console.log('成功心跳');
        }
    }
}
