const erizoAgent = require('./../erizoAgent');
const RovReplManager = require('./../../common/ROV/rovReplManager').RovReplManager;
const logger = require('./../../common/logger').logger;
const log = logger.getLogger('RPCPublic');
const ping = require ("net-ping");
const { AwaitQueue } = require('awaitqueue');
// Async queue to manage rooms.
// @type {AwaitQueue}
const queue = new AwaitQueue();
let replManager = false;
const ErizoAgentId =  erizoAgent.getAgentId();
const rooms =  erizoAgent.getRooms();

exports.getMediasoupWork= async  (roomid, erizoControllerid,callback)=>{
  try {
    //如果当前状态为0，则对该请求不做处理
    if(erizoAgent.getMyState() == 0){
      log.info(`message: getMediasoupWork mystate:${erizoAgent.getMyState()}`);
      return;
    }
    /*
    这里使用queue，去保证请求的顺序执行，防止对一个房间重复创建
    */
    queue.push(async()=>{
      const room = await  erizoAgent.getOrCreateRoom({ roomid,erizoControllerid});
      log.debug(`message: getMediasoupWork  roomid: ${roomid} agentId: ${ErizoAgentId} erizoControllerid:${erizoControllerid} routerid:${room.getRouterId()}`);
      callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:room.getRouterId()});
    });
    // const room = await  erizoAgent.getOrCreateRoom({ roomid,erizoControllerid});
    // log.debug(`message: getMediasoupWork  roomid: ${roomid} agentId: ${ErizoAgentId} erizoControllerid:${erizoControllerid} routerid:${room.getRouterId()}`);
    // callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:room.getRouterId()});
  } catch (error) {
    log.error('message: error  getEA, error:', error);
    callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:undefined});
  }
};


//处理user信令消息
exports.handleUserRequest=(roomid,userid,clientname,methed,message,callback)=>{
  try {
    //找到用户，交给用户去处理
    var  block_meth = [
      "getTransportStats",
      "getProducerStats",
      "getConsumerStats",
      "getDataProducerStats",
      "getDataConsumerStats",
      "applyNetworkThrottle",
      "resetNetworkThrottle"
      ];
    var index =  block_meth.indexOf(methed);
    if(index >= 0 ){

    }else{
      log.debug(`message: handleUserRequest  roomid: ${roomid} userid:${userid} clientname:${clientname} methed:${methed} `);
    }
    const room =   rooms.getRoomById(roomid);
    if(!room){
      log.error(`messages: handleUserRequest can't  get  room by-roomid:${roomid}`);
      callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
      return;
    }
    room.handleUserRequest(userid,clientname,methed,message,callback);
  } catch (error) {
    callback('callback',{retEvent:"error",data: {errmsg:"ea error!", errcode:2000}});
    log.error('message: error handleUserRequest, error:', error);
  }
};

//用户离开房间-断开连接，或者其他的原因等等
exports.deleteUser =  (roomid,userid)=>{
  try {
    log.debug(`message: deleteUser  roomid: ${roomid} userid:${userid}`);
    const room =   rooms.getRoomById(roomid);
    if(!room){
      log.error(`messages: handleUserRequest can't  get  room by-roomid:${roomid}`);
      return;
    }
    const  user =   room.getClientById(userid);
    if(user){
      user.close();
    }
    //防止用户提前断开连接
    room.onClientDisconnected();

  } catch (error) {
    log.error('message: error deleteUser, error:', error);
  }
};

exports.rovMessage=  (args, callback) => {
  if (!replManager) {
    replManager = new RovReplManager(erizoAgent.getContext());
  }
  replManager.processRpcMessage(args, callback);
};

exports.getErizoAgents = (callback) =>{
  erizoAgent.getReporter().getErizoAgent(callback);
};

/*
处理EC宕机事件,遍历所有的房间，如果该房间所在的EC为通知中的，则删除该房间，以及他关联的所有对象
*/
exports.handleEcDown = (ecid) =>{
  log.debug(`message handleEcDown ecid:${ecid}`);
  rooms.forEachRoom((room)=>{
    if(room.erizoControllerId === ecid){
      log.info(`handleEcDown,room:${room.id} whill delete,blown ec:${ecid}`);
      room.close();
      rooms.deleteRoom(room.id);
    }
  });

};




//测算ping值
exports.getPingConst = (ip,callback) =>{
  const session = ping.createSession();
  session.pingHost(ip, (error, target, sent, rcvd) => {
    if (error) {
      log.error(`${target} failed:${error.toString()}`);
      callback('callback',{retEvent:"error"});
    } else {
      const spent = rcvd.getTime() - sent.getTime();
      log.info(`${target} ok, spent: ${spent}ms`);
      callback('callback',{retEvent:"sucess",spent:spent});
    }
  })
  
};

exports.handlePipRoute = (roomid,fromRouterId,toRouterId,agentId,callback)=>{
  log.info(`message:handlePipRoute roomid:${roomid} fromRouterId:${fromRouterId} toRouterId:${toRouterId} agentId:${agentId}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: handlePipRoute can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  if(room._mediasoupRouter.id != fromRouterId){
    log.error(`messages: handlePipRoute room:${roomid} mediasoupRouter not  fitch!`);
    callback('callback',{retEvent:"error",data: {errmsg:"fromRouterId is error!", errcode:2001}});
    return;
  }
  room.handlePipRoute(toRouterId,agentId,callback);
}



exports.createPipTransport = (roomid,routerid,callback)=>{
  log.info(`message:createPipTransport roomid:${roomid} routerid:${routerid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: handlePipRoute can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  if(room._mediasoupRouter.id != routerid){
    log.error(`messages: createPipTransport room:${roomid} mediasoupRouter not  fitch!`);
    callback('callback',{retEvent:"error",data: {errmsg:"routerid is error!", errcode:2001}});
    return;
  }
  room.createPipTransport(callback);
}

exports.connectPipTransport = (roomid,remoterouterid,localpipetransportid,remotepipetransport,callback)=>{
  log.info(`message:connectPipTransport roomid:${roomid}  remoterouterid:${remoterouterid} localpipetransportid:${localpipetransportid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: connectPipTransport can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }

  room.connectPipTransport(localpipetransportid,remotepipetransport,remoterouterid,callback);
}

exports.createPipTransportProduce = (roomid,localpipetransportid,consumes,callback)=>{
  log.info(`message:createPipTransportProduce roomid:${roomid}  localpipetransportid:${localpipetransportid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: createPipTransportProduce can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  room.createPipTransportProduce(localpipetransportid,consumes,callback);
}


exports.createPipTransportConsume = (roomid,localpipetransportid,remoteeaid,callback) =>{
  log.info(`message:createPipTransportConsume roomid:${roomid}  localpipetransportid:${localpipetransportid} remoteeaid:${remoteeaid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: createPipTransportConsume can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  room.createPipTransportConsume(localpipetransportid,remoteeaid,callback);
}


exports.closePipProduce = (roomid,localproduceid,callback) =>{
  log.info(`message:closePipProduce roomid:${roomid}  localproduceid:${localproduceid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: closePipProduce can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  room.closePipProduce(localproduceid,callback);
}

exports.pausePipProduce = (roomid,localproduceid,callback) =>{
  log.info(`message:pausePipProduce roomid:${roomid}  localproduceid:${localproduceid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: pausePipProduce can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  room.pausePipProduce(localproduceid,callback);
}

exports.resumePipProduce = (roomid,localproduceid,callback) =>{
  log.info(`message:resumePipProduce roomid:${roomid}  localproduceid:${localproduceid}`);
  const room =   rooms.getRoomById(roomid);
  if(!room){
    log.error(`messages: resumePipProduce can't  get  room by-roomid:${roomid}`);
    callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:2001}});
    return;
  }
  room.resumePipProduce(localproduceid,callback);
}



exports.getWorkerInfo = (callback)=>{
  log.debug(`message:getWorkerInfo`);
  erizoAgent.getWorkerInfo(function(info){
    callback('callback',{info:info});
  });
}
