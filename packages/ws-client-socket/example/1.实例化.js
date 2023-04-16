const {ClientSocket} = require('../index')
exports.clientSocket = new ClientSocket({
    url: 'ws://127.0.0.1:8989',
    logger: console,
    // socket的相关配置
    socketOptions: {
        wsConfig: {}, // 后端ws库的配置
        wsProtocols: '', // 前端环境 websocket子协议
        reconnectMax: 3, // 默认最多重启次数为3；0：不重启 -1：无限重启
        reconnectTime: 2 * 1000, // 重连时间
        heartCmd: 'heart', // 心跳cmd指令
        heartTime: 5 * 1000, // 心跳时间
    },
    // socket 通信相关配置
    socketSendOptions: {
        // 请求拦截器  把 {cmd: '', uuid:'', content: {}} 转为 其他形式的对象的buffer或string
        reqInterceptors: (req) => {
            const data = {
                uuid: '123456',
                msg_id: req.uuid, //这个自己定义，用于返回信息成功失败信息的时候，来表示是哪一条的结果。
                event_name: req.cmd, //事件名自己定
                content: req.content, //通信内容主体
                app_machine_id: 'appMachineId', //物理工控机的唯一标识
                app_instance_id: 'appInstanceId', //本地软件的实例id，通常可以用软件路径的md5
                app_name: 'parameter_pv', //用于显示的名称，自己app是什么就用什么，中文也可以
                level: 'Info', //info，notice，warnning，error，fatal
                local_time_stamp: Date.now(), //时间精度ms
            };
            // return JSON.stringify(data)
            return Buffer.from(JSON.stringify(data))
        },
        // 响应拦截器　把 其他形式的对象的buffer或string 转为 {cmd: '', uuid:'', content: {}}
        resInterceptors: (data) => {
            // const res = JSON.parse(data.data);

            // const fileReader = new FileReader();
            // //将Blob 对象转换成字符串
            // fileReader.readAsText(res.data, 'utf-8');
            // fileReader.onload = e => {
            //     const res = JSON.parse(fileReader.result.toString());
            // }

            const res = JSON.parse(data.toString())
            return {
                uuid: res.msg_id,
                cmd: res.event_name,
                content: {
                    ...res.content,
                    code: Number(res.content?.code),
                },
            };
        },
    },
});

