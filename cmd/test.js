// 应用到现场
const UUID = require('uuid');
module.exports = ({uuid = UUID.v1(), content = {}}) => {
    return {
        data: {
            uuid,
            cmd: 'test',
            // 请求的数据
            content: {
                status: -1,
                formula_url: 'http://127.0.0.1:10005/uploads/resultNew.json', // 配方json地址
                formula_id: '', // 配方集合id
                ...content,
            },
        },
        // onmessage里调用的函数
        onmessage: ({content}, socket) => {
            console.log('test里调用的onmessage');
        }
    }
}
