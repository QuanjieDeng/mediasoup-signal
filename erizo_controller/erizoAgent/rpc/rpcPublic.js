const erizoAgent = require('./../erizoAgent');
const RovReplManager = require('./../../common/ROV/rovReplManager').RovReplManager;
const logger = require('./../../common/logger').logger;
const log = logger.getLogger('ErizoAgent');
let replManager = false;
const ErizoAgentId =  erizoAgent.getAgentId();

//为一个房间获取分配一个worker,EC广播该消息，收到的EA根据自己的情况进行回复
exports.getMediasoupWork= (roomid, erizoControllerid,callback)=>{
  try {
    //判断自身条件
    //创建room,并分配一个worker给他
    //回复EC
    log.debug(`message: getEA  roomid: ${roomid} agentId: ${ErizoAgentId} erizoControllerid:${erizoControllerid}`);
    var workerId ="123123";
    callback('callback',{ roomid: roomid, agentId: ErizoAgentId,workerId:workerId});
  } catch (error) {
    log.error('message: error  getEA, error:', error);
  }
};

// //解除room和worker的关系
// exports.releaseMediasoupWork=  (roomid, callback)=>{
//   try {
//     //根据roomid 找到room 获取其中的Router 关闭
//     //删除room
//     log.debug(`message: releaseEA  roomid: ${roomid} agentId: ${myErizoAgentId}`);
//     callback('callback',{ roomid: roomid, agentId: myErizoAgentId});
//   } catch (error) {
//     log.error('message: error releaseEA, error:', error);
//   }
// };

//处理user信令消息
exports.handleUserRequest=(roomid,userid,message,callback)=>{
  try {
    //找到用户，交给用户去处理
    log.debug(`message: handleUserRequest  roomid: ${roomid} userid:${userid} agentId: ${ErizoAgentId}`);
    callback('callback',{ roomid: roomid, agentId: ErizoAgentId});
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
  log.debug(`message: getErizoAgents---`);
  erizoAgent.getReporter().getErizoAgent(callback);
};
  