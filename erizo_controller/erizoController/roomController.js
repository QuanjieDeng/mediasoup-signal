/* global require, exports, setInterval */

/* eslint-disable no-param-reassign */

const logger = require('./../common/logger').logger;


// Logger
const log = logger.getLogger('RoomController');
class RoomController{
  constructor({amqper, ecch, erizoControllerId, erizoAgentId}) {
    this.amqper = amqper;
    this.ecch = ecch;
    this.erizoControllerId = erizoControllerId;
    this.erizoAgentId = erizoAgentId;
    this.eventListeners = [];
  }
  static async create({amqper, ecch, erizoControllerId, erizoAgentId}){
		log.info('create() [RoomController:%s]', id);
		return new Room(
			{
				amqper,
        ecch,
        erizoControllerId,
				erizoAgentId
			});
    }


  //保留
  dispatchEvent = (type, evt) => {
    eventListeners.forEach((eventListener) => {
      eventListener(type, evt);
    });
  };

  addEventListener = (eventListener) => {
    eventListeners.push(eventListener);
  };

  //就是对客户端的消息进行转发到EA 
  processReqMessageFromClient = (roomid, clientId,methed,msg, callback) => {
    const args = [roomid, clientId,methed, msg];
    var   agentid = `ErizoAgent_${erizoAgentId}`;
    amqper.callRpc(agentid, 'handleUserRequest', args, { callback });
  };

  //通知EA删除用户
  removeClient = (roomid,clientId) => {
    log.info(`message: removeClient clientId ${clientId}`);
    const args = [roomid, clientId];
    var   agentid = `ErizoAgent_${erizoAgentId}`;
    amqper.callRpc(agentid, 'deleteUser', args);
  };

};
exports.RoomController = RoomController;

// exports.RoomController = (spec) => {
//   const that = {};
//   const amqper = spec.amqper;
//   const ecch = spec.ecch;
//   const erizoControllerId = spec.erizoControllerId;
//   const erizoAgentId = spec.erizoAgentId;
//   const KEEPALIVE_INTERVAL = 5 * 1000;
//   const TIMEOUT_LIMIT = 2;
//   const MAX_ERIZOJS_RETRIES = 3;
//   const eventListeners = [];


//   //保留
//   const dispatchEvent = (type, evt) => {
//     eventListeners.forEach((eventListener) => {
//       eventListener(type, evt);
//     });
//   };

//   //这里是对EJ的保活，暂时保留，后面可能会需要
//   // const callbackFor = function callbackFor(erizoId) {
//   //   return (ok) => {
//   //     const erizo = erizos.findById(erizoId);
//   //     if (!erizo) return;

//   //     if (ok !== true) {
//   //       erizo.kaCount += 1;

//   //       if (erizo.kaCount > TIMEOUT_LIMIT) {
//   //         const streamsInErizo = streamManager.getPublishersInErizoId(erizoId);
//   //         if (streamsInErizo.length > 0) {
//   //           log.error('message: ErizoJS timed out will be removed, ' +
//   //             `erizoId: ${erizoId}, ` +
//   //             `publishersAffected: ${streamsInErizo.length}`);
//   //           streamsInErizo.forEach((publisher) => {
//   //             dispatchEvent('unpublish', publisher.id);
//   //           });
//   //         } else {
//   //           log.debug(`message: empty erizoJS removed, erizoId: ${erizoId}`);
//   //         }
//   //         ecch.deleteErizoJS(erizoId);
//   //         erizos.deleteById(erizoId);
//   //       }
//   //     } else {
//   //       erizo.kaCount = 0;
//   //     }
//   //   };
//   // };

//   // const sendKeepAlive = () => {
//   //   erizos.forEachUniqueErizo((erizo) => {
//   //     const erizoId = erizo.erizoId;
//   //     amqper.callRpc(`ErizoJS_${erizoId}`, 'keepAlive', [], { callback: callbackFor(erizoId) });
//   //   });
//   // };

//   // setInterval(sendKeepAlive, KEEPALIVE_INTERVAL);



//   that.addEventListener = (eventListener) => {
//     eventListeners.push(eventListener);
//   };



//   //就是对客户端的消息进行转发到EA 
//   that.processReqMessageFromClient = (roomid, clientId,methed,msg, callback) => {
//     const args = [roomid, clientId,methed, msg];
//     var   agentid = `ErizoAgent_${erizoAgentId}`;
//     amqper.callRpc(agentid, 'handleUserRequest', args, { callback });
//   };

//   //通知EA删除用户
//   that.removeClient = (roomid,clientId) => {
//     log.info(`message: removeClient clientId ${clientId}`);
//     const args = [roomid, clientId];
//     var   agentid = `ErizoAgent_${erizoAgentId}`;
//     amqper.callRpc(agentid, 'deleteUser', args);
//   };

//   return that;
// };
