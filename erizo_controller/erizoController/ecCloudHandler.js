/* global require, exports, setInterval */

/* eslint-disable no-param-reassign */

const logger = require('./../common/logger').logger;

// Logger
const log = logger.getLogger('EcCloudHandler');

const EA_TIMEOUT = 30000;
const GET_EA_INTERVAL = 5000;
const AGENTS_ATTEMPTS = 5;
const WARN_UNAVAILABLE = 503;
const WARN_TIMEOUT = 504;
exports.EcCloudHandler = (spec) => {
  const that = {};
  const amqper = spec.amqper;
  const agents = {};
  let getErizoAgent;

  const forEachAgent = (action) => {
    const agentIds = Object.keys(agents);
    for (let i = 0; i < agentIds.length; i += 1) {
      action(agentIds[i], agents[agentIds[i]]);
    }
  };

  that.getErizoAgents = () => {
    amqper.broadcast('ErizoAgent', { method: 'getErizoAgents', args: [] }, (agent) => {
      if (agent === 'timeout') {
        log.warn(`message: no agents available, code: ${WARN_UNAVAILABLE}`);
        return;
      }

      let newAgent = true;

      forEachAgent((agentId, agentInList) => {
        if (agentId === agent.info.id) {
          // The agent is already registered, I update its stats and reset its
          agentInList.stats = agent.stats;
          agentInList.timeout = 0;
          newAgent = false;
        }
      });

      if (newAgent === true) {
        // New agent
        agents[agent.info.id] = agent;
        agents[agent.info.id].timeout = 0;
      }
    });

    // Check agents timeout
    forEachAgent((agentId, agentInList) => {
      agentInList.timeout += 1;
      if (agentInList.timeout > EA_TIMEOUT / GET_EA_INTERVAL) {
        log.warn('message: agent timed out is being removed, ' +
                 `code: ${WARN_TIMEOUT}, agentId: ${agentId}`);
        delete agents[agentId];
      }
    });
  };

  setInterval(that.getErizoAgents, GET_EA_INTERVAL);


  if (global.config.erizoController.cloudHandlerPolicy) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    getErizoAgent = require(`./ch_policies/${
      global.config.erizoController.cloudHandlerPolicy}`).getErizoAgent;
  }

  if (global.config.erizoController.cloudHandlerPolicy) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    getErizoAgent = require(`./ch_policies/${
      global.config.erizoController.cloudHandlerPolicy}`).getErizoAgent;
  }

  const getMeiasoupWorkerTryAgain = (count,roomid,erizoControllerid, callback) => {
    if (count >= AGENTS_ATTEMPTS) {
      callback('timeout');
      return;
    }

    log.warn('message: agent selected timed out trying again, ' +
             `code: ${WARN_TIMEOUT}`);

    amqper.callRpc('ErizoAgent', 'getMediasoupWork', [roomid,erizoControllerid], { callback(resp) {
      const roomid = resp.roomId;
      const agentId = resp.agentId;
      const routerId = resp.routerId;
      if (resp === 'timeout') {
        tryAgain((count += 1), callback);
      } else {
        callback(roomid, agentId, routerId);
      }
    } });
  };



  that.getMeiasoupWorker =  (roomid,erizoControllerid,callbackFor) =>{
    let agentQueue = 'ErizoAgent';

    if (getErizoAgent) {
      agentQueue = getErizoAgent(agents, undefined);
    }
    log.info(`message: getMeiasoupWorker, agentId: ${agentQueue}`);
    amqper.callRpc(agentQueue, 'getMediasoupWork', [roomid,erizoControllerid], { callback(resp) {
      const roomid = resp.roomId;
      const agentId = resp.agentId;
      const routerId = resp.routerId;
      log.info(`message: getMeiasoupWorker success, roomid: ${roomid}, ` +
        `agentId: ${agentId}, routerId: ${routerId}`);

      if (resp === 'timeout') {
        getMeiasoupWorkerTryAgain(0,roomid, erizoControllerid,callbackFor);
      } else {
        callbackFor(roomid, agentId, routerId);
      }
    } });

  }

  that.getErizoAgentsList = () => JSON.stringify(agents);

  return that;
};
