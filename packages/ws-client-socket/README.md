# ws-client-socket

## 下载
```
npm install @lp/ws-client-socket -S
```

## 源码
https://gitlab.hzleaper.com:81/dydwang/ws-client-socket/-/tree/main/packages/ws-client-socket

## 测试
```
本地环境短时间建立连接进行通信（client -> serve -> client）:1w连接约3.5s, 1.5w连接约5s
```
## 引入
```
const {ClientSocket} = require('@lp/ws-client-socket');
import {ClientSocket} from '@lp/ws-client-socket';
```

## 示例 
```
请看example文件夹
```

## 实例化化项目
```
const {ClientSocket} = require('@lp/ws-client-socket')
exports.clientSocket = new ClientSocket({
    url: 'ws://127.0.0.1:8989',
    restartMax: -1, // 无限重启
    reconnectTime: 5 * 1000, // 5秒重连一次
    isCacheCmd: false, // 不缓存失败的请求
    cmdAPI: {
        test({cmd, uuid, content}) {
            return {
                cmd,
                uuid,
                content: {
                    age: 18,
                    ...content
                }
            }
        }
    }, // 接口文件
    wsConfig: {}, // node 环境ws 库配置
    wsProtocols: '', // 前端环境 websocket子协议
    heartCmd: 'heart', // 心跳cmd指令
    timeout: 5 * 1000, // 连接超时
    // 请求拦截器  把 {cmd: '', uuid:'', content: {}} 转为 其他形式的对象的buffer或string
    reqInterceptors: (req) => {
        const data = {
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
                code: Number(res.content.code),
            },
        };
    },
});
```


## 启动项目
1、直接创建
```
const init = async () => {
  const wsState = await clientSocket.createSocket();
  console.log(wsState)
}
```
2、等待创建
```
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
```

## 通信
1、同步通信
```
  // 同步 client -> serve -> client
  const {req, res, socket} = await clientSocket.sockSend.sendSync('test', {
    content: {
      name: '张三'
    }
  });
```

2、回调通信
```
  // 回调 client -> serve -> client
  clientSocket.sockSend.send('test', {
    content: {
      name: '张三'
    }
  }, ({req, res, socket}) => {
    console.log('我是回调通信')
    console.log(res)
  })
```

3、订阅通信
```
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
```
