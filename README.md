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



config.mediasoup.webRtcTransportOptions = 		{
    listenIps :
    [
        {
            ip          : process.env.MEDIASOUP_LISTEN_IP || '192.168.94.109',
            announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
        }
    ],
    initialAvailableOutgoingBitrate : 1000000,
    minimumAvailableOutgoingBitrate : 600000,
    maxSctpMessageSize              : 262144,
    // Additional options that are not part of WebRtcTransportOptions.
    maxIncomingBitrate              : 1500000
};

config.mediasoup.plainTransportOptions = 		{
    listenIp :
    {
        ip          : process.env.MEDIASOUP_LISTEN_IP || '192.168.94.109',
        announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
    },
    maxSctpMessageSize : 262144,
    enableSrtp : false
};

## 启动
分为nuve  ec,ea
- nuve   直接切到目录  nuve/nuveAPI 执行  node  nuve.js   
- ec     直接切换目录  erizo_controller/erizoController   执行 node erizoController.js   
- ea     直接切换目录  erizo_controller/erizoAgent   执行  node  erzioAgent.js


