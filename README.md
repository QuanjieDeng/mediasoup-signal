# mediasoup-signal

基于meidiasoup实现的信令服务器


## 构建 
信令服务器基于licode代码改造，基本逻辑相同
- 下载代码到本地
```
git     clone  https://github.com/QuanjieDeng/mediasoup-signal.git 
```
- 安装依赖
```
./scripts/installUbuntuDeps.sh  
```
- 安装 EC&EA
```
 ./scripts/installErizo.sh   
```
- 安装NUVE
```
 ./scripts/installNuve.sh
```
## 配置
### 修改系统栈大小 
    由于EC中存在大量的同步调用，导致部分的函数调用栈比较大，所以在部署EC的机器上需要修改其调用栈 
    目前参考的值为65500  并且在启动EC时附带参数   --stack-size=65500


licode相关的配置不在追述,这里主要说mediasoup相关的配置 
- webrtctransport监听地址
```
config.mediasoup.webRtcTransportOptions = 		{
    listenIps :
    [
        {
            ip          : process.env.MEDIASOUP_LISTEN_IP || '192.168.94.109',   //注意配置具体的ip地址
            announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
        }
    ],
    ........
};
```
- plainTransport监听地址

```
config.mediasoup.plainTransportOptions = 		{
    listenIp :
    {
        ip          : process.env.MEDIASOUP_LISTEN_IP || '192.168.94.109',
        announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
    },
    maxSctpMessageSize : 262144,
    enableSrtp : false
};


```

## 启动
分为nuve  ec,ea
- nuve   直接切到目录  nuve/nuveAPI 执行  node  nuve.js   
- ec     直接切换目录  erizo_controller/erizoController   执行 node erizoController.js   
- ea     直接切换目录  erizo_controller/erizoAgent   执行  node  erzioAgent.js


## Docker
### 镜像制作
- 切换到代码的根目录 
- 执行命令生成镜像 
```
docker  build  -t mediasoup-signal:v1    .
```

### 容器启动 
- mongo
```
docker run     -p  27017:27017   -v   /tmp/mongo:/opt/licode/build/db  mediasoup-signal:v1  --mongodb
```
- rabbitmq
```
docker run    -p  5672:5672  mediasoup-signal:v1 --rabbitmq
```
- nuve
```
docker run     -p  3000:3000    -e "RABBITMQ_URL=amqp:test:123456@192.168.94.109:5672"    -e "MONGO_URL=192.168.94.109/nuvedb"  mediasoup-signal:v1 --nuve
```
- ec
```
docker run   -p  8080:8080    -e "RABBITMQ_URL=amqp:test:123456@192.168.94.109:5672"   -e "PUBLIC_IP=192.168.94.109"         mediasoup-signal:v1   --erizoController
```
- ea 
```
MIN_PORT=40000 
MAX_PORT=40050
docker run   --net  host -p $MIN_PORT-$MAX_PORT:$MIN_PORT-$MAX_PORT/udp  -e "RABBITMQ_URL=amqp:test:123456@192.168.94.109:5672"  -e "PUBLIC_IP=192.168.94.109" -e  "RTCMINPORT=$MIN_PORT"  -e  "RTCMAXPORT=$MAX_PORT"  mediasoup-signal:v1  --erizoAgent

可选参数 
DEBUG环境变量 设置mediasoup子进程的日志显示
由于mediasoup的nodejs层使用 debug模块控制日志的限制
注册的民命空间有 
mediasoup：*
mediasoup:WARN*
mediasoup:ERROR*
默认不打开子进程的日志，如果需要打开则直接设置环境变量DEBUG的值即可 
例如-需要打开所有的日志 
export  DEBUG=mediasoup*

只打开WARN级别的日志
export  DEBUG=mediasoup:WARN*

```
