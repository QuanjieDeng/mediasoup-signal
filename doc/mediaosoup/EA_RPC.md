EA rpc接口文档

## getMediasoupWork
### 说明 
- 向EA申请一个medisoupworker
- 目前设计的思想是，EC并不需要知道room在哪一个worker上，这个信息由EA进行管理，EC只需要知道room所在的EA，
每次请求时传入roomid,EA就可以根据roomid找到对应的worker
### 请求参数
- roomid 房间ID
- erizoControllerid EC的ID
### 返回参数
```
{
    roomid: roomid,  //房间ID
    agentId: ErizoAgentId, EA的ID
    routerId:routerId  //对应的routerId
}
```


## handleUserRequest
### 说明
- 接受user的信令消息



## deleteUser
### 说明
- 通知EA删除某个用户，该用户可能因为各种原理离开了房间


## getErizoAgents
### 说明 
- 获取EA的信息




## getPingConst
### 说明
- 获取EA到用户IP的PING值




## handlePipRoute
### 说明
- 通知EA开启级联流程

## createPipTransport
### 说明
- 通知EA创建   pipeTransport

## connectPipTransport
### 说明
- 通知EA连接 pipeTransport

## createPipTransportProduce
### 说明 
- 通知EA在本地的pipeTransport上创建produce

## createPipTransportConsume
### 说明 
- 通知EA在本地的pipeTransport上创建consume

## closePipProduce
- 通知EA，关闭对用piptransprt上的 consume

## pausePipProduce
- 通知EA，暂停对用的pipetransport上的produce

## resumePipProduce
- 通知EA，重新恢复对应的produce



