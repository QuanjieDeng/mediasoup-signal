const erizoAgent = require('./../erizoAgent');
const RovReplManager = require('./../../common/ROV/rovReplManager').RovReplManager;
const logger = require('./../../common/logger').logger;
const log = logger.getLogger('RPCPublic');
let replManager = false;
const ErizoAgentId =  erizoAgent.getAgentId();
const rooms =  erizoAgent.getRooms();


exports.getMediasoupWork= async  (roomid, erizoControllerid,callback)=>{
  try {
    const room = await  erizoAgent.getOrCreateRoom({ roomid,erizoControllerid});
    log.debug(`message: getMediasoupWork  roomid: ${roomid} agentId: ${ErizoAgentId} erizoControllerid:${erizoControllerid} routerid:${room.getRouterId()}`);
    callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:room.getRouterId()});
  } catch (error) {
    log.error('message: error  getEA, error:', error);
    callback('callback',{ roomId: roomid, agentId: ErizoAgentId,routerId:undefined});
  }
};


//处理user信令消息
exports.handleUserRequest=(roomid,userid,methed,message,callback)=>{
  try {
    //找到用户，交给用户去处理
    log.debug(`message: handleUserRequest  roomid: ${roomid} userid:${userid} methed:${methed}`);
    const room =   rooms.getRoomById(roomid);
    if(!room){
      log.error(`messages: handleUserRequest can't  get  room by-roomid:${roomid}`);
      callback('callback',{retEvent:"error",data: {errmsg:"can't find room", errcode:1002}});
      return;
    }
    room.handleUserRequest(userid,methed,message,callback);
  } catch (error) {
    log.error('message: error handleUserRequest, error:', error);
  }
};

//用户离开房间-断开连接，或者其他的原因等等
exports.deleteUser =  (roomid,userid)=>{
  // try {
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

  // } catch (error) {
  //   log.error('message: error deleteUser, error:', error);
  // }
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
  