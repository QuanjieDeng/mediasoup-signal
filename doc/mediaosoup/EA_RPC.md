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

### 请求参数
- roomid
- userid
- msg

### 返回参数 
```
//成功
{
  retEvent:"success",
  data: {
    
  }
}

//失败
{
  retEvent:"error",
  data: {
      errmsg:"can't find room",
      errcode:1002
    }
  }
}
```

## deleteUser
### 说明

### 请求参数 
- roomid
- userid

### 返回参数
```
{ 
  roomid: roomid,
  agentId: myErizoAgentId
  }
)
```
## getErizoAgents
### 说明 
- 获取EA的信息

### 返回参数 
