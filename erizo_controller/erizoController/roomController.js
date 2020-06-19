/* global require, exports, setInterval */

/* eslint-disable no-param-reassign */

const logger = require('./../common/logger').logger;


// Logger
const log = logger.getLogger('RoomController');

exports.RoomController = (spec) => {
  const that = {};
  const amqper = spec.amqper;
  const ecch = spec.ecch;
  const erizoControllerId = spec.erizoControllerId;
  const KEEPALIVE_INTERVAL = 5 * 1000;
  const TIMEOUT_LIMIT = 2;
  const MAX_ERIZOJS_RETRIES = 3;
  const eventListeners = [];

  let getErizoJS;
  let currentErizo = 0;

  //保留
  const dispatchEvent = (type, evt) => {
    eventListeners.forEach((eventListener) => {
      eventListener(type, evt);
    });
  };

  //这里是对EJ的保活，暂时保留，后面可能会需要
  // const callbackFor = function callbackFor(erizoId) {
  //   return (ok) => {
  //     const erizo = erizos.findById(erizoId);
  //     if (!erizo) return;

  //     if (ok !== true) {
  //       erizo.kaCount += 1;

  //       if (erizo.kaCount > TIMEOUT_LIMIT) {
  //         const streamsInErizo = streamManager.getPublishersInErizoId(erizoId);
  //         if (streamsInErizo.length > 0) {
  //           log.error('message: ErizoJS timed out will be removed, ' +
  //             `erizoId: ${erizoId}, ` +
  //             `publishersAffected: ${streamsInErizo.length}`);
  //           streamsInErizo.forEach((publisher) => {
  //             dispatchEvent('unpublish', publisher.id);
  //           });
  //         } else {
  //           log.debug(`message: empty erizoJS removed, erizoId: ${erizoId}`);
  //         }
  //         ecch.deleteErizoJS(erizoId);
  //         erizos.deleteById(erizoId);
  //       }
  //     } else {
  //       erizo.kaCount = 0;
  //     }
  //   };
  // };

  // const sendKeepAlive = () => {
  //   erizos.forEachUniqueErizo((erizo) => {
  //     const erizoId = erizo.erizoId;
  //     amqper.callRpc(`ErizoJS_${erizoId}`, 'keepAlive', [], { callback: callbackFor(erizoId) });
  //   });
  // };

  // setInterval(sendKeepAlive, KEEPALIVE_INTERVAL);



  that.addEventListener = (eventListener) => {
    eventListeners.push(eventListener);
  };



  //就是对客户端的消息进行转发到EA 
  that.processConnectionMessageFromClient = (erizoId, clientId, connectionId, msg, callback) => {
    const args = [erizoControllerId, clientId, connectionId, msg];
    amqper.callRpc(getErizoQueueFromErizoId(erizoId), 'processConnectionMessage', args, { callback });
  };








  that.removeClient = (clientId) => {
    log.info(`message: removeClient clientId ${clientId}`);
    erizos.forEachUniqueErizo((erizo) => {
      const erizoId = erizo.erizoId;
      const args = [clientId];
      log.info(`message: removeClient - calling ErizoJS to remove client, erizoId: ${erizoId}, clientId: ${clientId}`);
      amqper.callRpc(`ErizoJS_${erizoId}`, 'removeClient', args, {
        callback: (result) => {
          log.info(`message: removeClient - result from erizoJS ${erizo.erizoId}, result ${result}`);
        } });
    });
  };

  return that;
};
