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




  that.getMeiasoupWorker = (roomid,callbackFor) =>{
    let agentQueue = 'ErizoAgent';

    if (getErizoAgent) {
      agentQueue = getErizoAgent(agents, undefined);
    }
    log.info(`message: getMeiasoupWorker, agentId: ${agentQueue}`);
    amqper.callRpc(agentQueue, 'getMediasoupWork', [roomid], { callback(resp) {
      const roomid = resp.roomid;
      const agentId = resp.agentId;
      const workerId = resp.workerId;
      log.info(`message: getMeiasoupWorker success, roomid: ${roomid}, ` +
        `agentId: ${agentId}, workerId: ${workerId}`);

      if (resp === 'timeout') {
        getMeiasoupWorkerTryAgain(0,roomid, callbackFor);
      } else {
        callbackFor(roomid, agentId, workerId);
      }
    } });

  }


  that.getErizoAgentsList = () => JSON.stringify(agents);

  return that;
};
