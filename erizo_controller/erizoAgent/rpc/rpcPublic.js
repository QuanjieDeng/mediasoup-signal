const erizoAgent = require('./../erizoAgent');
const { sync } = require('glob');
const RovReplManager = require('./../../common/ROV/rovReplManager').RovReplManager;
const logger = require('./../../common/logger').logger;
const log = logger.getLogger('ErizoAgent');
let replManager = false;
const ErizoAgentId =  erizoAgent.getAgentId();


exports.getMediasoupWork= async  (roomid, erizoControllerid,callback)=>{
  // try {
    log.debug("------1");
     const room = await  erizoAgent.getOrCreateRoom({ roomid,erizoControllerid});
     log.debug("------2");
      log.debug(`message: getEA  roomid: ${room.roomid} agentId: ${ErizoAgentId} erizoControllerid:${erizoControllerid} routerid:${room.getRouterId()}`);
      log.debug("------3");

      callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:room.getRouterId()});
      log.debug("------4");
    
  // } catch (error) {
    // log.error('message: error  getEA, error:', error);
  // }
};





//处理user信令消息
exports.handleUserRequest=(roomid,userid,message,callback)=>{
  try {
    //找到用户，交给用户去处理
    log.debug(`message: handleUserRequest  roomid: ${roomid} userid:${userid} agentId: ${ErizoAgentId}`);
        
    callback('callback',{ roomid: roomid, agentId: ErizoAgentId,retEvent:"success",data: {data:{}} });
    // callback('callback',{ roomid: roomid, agentId: ErizoAgentId,retEvent:"error",data: {errmsg:"", errcode:1002}});



  } catch (error) {
    log.error('message: error handleUserRequest, error:', error);
  }
};

//用户离开房间-断开连接，或者其他的原因等等
exports.deleteUser =  (roomid,userid,callback)=>{
  try {
    //找到room，交给room去处理
    log.debug(`message: deleteUser  roomid: ${roomid} userid:${userid} agentId: ${myErizoAgentId}`);
    // callback('callback',{ roomid: roomid, agentId: myErizoAgentId});
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
  