
const erizoController = require('./../erizoController');
const logger = require('./../../common/logger').logger;
const log = logger.getLogger('ErizoController - rpc');
const RovReplManager = require('./../../common/ROV/rovReplManager').RovReplManager;

let replManager = false;
/*
 * This function is called remotely from nuve to get a list of the users in a determined room.
 */
exports.getUsersInRoom = (id, callback) => {
  erizoController.getUsersInRoom(id, (users) => {
    if (users === undefined) {
      callback('callback', 'error');
    } else {
      callback('callback', users);
    }
  });
};

exports.deleteRoom = (roomId, callback) => {
  erizoController.deleteRoom(roomId, (result) => {
    callback('callback', result);
  });
};

exports.deleteUser = (args, callback) => {
  const user = args.user;
  const roomId = args.roomId;
  erizoController.deleteUser(user, roomId, (result) => {
    callback('callback', result);
  });
};

//
exports.forwordSingleMsgToClient = (clientId, msg,methed,callback) => {
  log.debug(`messages: forwordSingleMsgToClient client:${clientId}   methed:${methed}    msg:${JSON.stringify(msg)}`);
  var   tmpcallback = (event,msg)=>{
    log.debug(`messages: forwordSingleMsgToClient client:${clientId}   methed:${methed} 临时callback，下面开始调用rpc_callback`);
    callback('callback',{event:event,msg:msg});
  }
  erizoController.forwordSingleMsgToClient(clientId, msg,methed,tmpcallback);
};

exports.forwordSingleMsgToRoom = (roomid, msg,methed) => {
  erizoController.forwordSingleMsgToRoom(roomid, msg,methed);
};

exports.rovMessage = (args, callback) => {
  if (!replManager) {
    replManager = new RovReplManager(erizoController.getContext());
  }
  replManager.processRpcMessage(args, callback);
};
