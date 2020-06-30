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


## 启动
分为nuve  ec,ea
- nuve   直接切到目录  nuve/nuveAPI 执行  node  nuve.js   
- ec     直接切换目录  erizo_controller/erizoController   执行 node erizoController.js   
- ea     直接切换目录  erizo_controller/erizoAgent   执行  node  erzioAgent.js


