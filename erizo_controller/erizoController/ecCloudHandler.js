/* global require, exports, setInterval */

const { config } = require('chai');

/* eslint-disable no-param-reassign */

const logger = require('./../common/logger').logger;

// Logger
const log = logger.getLogger('EcCloudHandler');

const EA_TIMEOUT = 10000;  //EA超时阈值
const GET_EA_INTERVAL = 2000; //EA报活间隔，报活检测次数最大为 EA_TIMEOUT/GET_EA_INTERVAL
const AGENTS_ATTEMPTS = 5; //获取EA重试最大次数
const WARN_UNAVAILABLE = 503;
const WARN_TIMEOUT = 504;
exports.EcCloudHandler = (spec) => {
  const that = {};
  const amqper = spec.amqper;
  const agents = {};
  const eventListeners = [];
  let getErizoAgent;

  const forEachAgent = (action) => {
    const agentIds = Object.keys(agents);
    for (let i = 0; i < agentIds.length; i += 1) {
      action(agentIds[i], agents[agentIds[i]]);
    }
  };

  dispatchEvent = (type, evt) => {
    eventListeners.forEach((eventListener) => {
      eventListener(type, evt);
    });
  };

  that.addEventListener = (eventListener) => {
    eventListeners.push(eventListener);
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
          agentInList.info.rooms = agent.info.rooms;
          log.debug(`message:update EA id:${agent.info.id} ip:${agent.info.ip} rooms:${agent.info.rooms}`);
          newAgent = false;
        }
      });

      if (newAgent === true) {
        log.info(`message:new EA id:${agent.info.id} ip:${agent.info.ip} rooms:${agent.info.rooms} state:${agent.info.state}`);
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
        dispatchEvent("remove_ea",agentId);
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


  const getMeiasoupWorkerTryAgain = (count,roomid,erizoControllerid, callback) => {
    log.warn(`message:getMeiasoupWorkerTryAgain roomid:${roomid} times:${count}`);
    if (count >= AGENTS_ATTEMPTS) {
      callback('timeout');
      return;
    }
    amqper.callRpc('ErizoAgent', 'getMediasoupWork', [roomid,erizoControllerid], { callback(resp) {
      if (resp === 'timeout') {
        getMeiasoupWorkerTryAgain((count += 1),roomid,erizoControllerid, callback);
      } else {
        const roomid = resp.roomId;
        const agentId = resp.agentId;
        const routerId = resp.routerId;
        log.info(`message: getMeiasoupWorker success, TryAgain:${count},roomid: ${roomid}, ` +
          `agentId: ${agentId}, routerId: ${routerId}`);

        callback(roomid, agentId, routerId);
      }
    } });
  };



  that.getMeiasoupWorker =async  (roomid,ip,eapolicy,erizoControllerid,callbackFor) =>{
    /*
    提前判断EA的状态，至少保证有一个EA处于可用状态，在重试状态的EA，不作为备选对象
    */
    let ea_ok  = checkEAStatus();
    if(!ea_ok){
      log.warn(`message: getMeiasoupWorker no ea's status os ok!`);
      callbackFor('timeout');
      return;
    }
    let agentQueue =await getErizoAgentPolicy(ip,eapolicy);

    log.info(`message: getMeiasoupWorker, agentId: ${agentQueue} roomid:${roomid} ip:${roomid}`);
    amqper.callRpc(agentQueue, 'getMediasoupWork', [roomid,erizoControllerid], { callback(resp) {
      if (resp === 'timeout') {
        getMeiasoupWorkerTryAgain(0,roomid, erizoControllerid,callbackFor);
      } else {
        const roomid = resp.roomId;
        const agentId = resp.agentId;
        const routerId = resp.routerId;
        log.info(`message: getMeiasoupWorker success, roomid: ${roomid}, ` +
          `agentId: ${agentId}, routerId: ${routerId}`);
        callbackFor(roomid, agentId, routerId);
      }
    } });

  } 

  const checkEAStatus =  ()=>{
    let  ok_ea_num = 0;
    forEachAgent((agentId, agentInList)=>{
      if(agentInList.timeout <= 1){
        ok_ea_num +=1;
        return true;
      }
    });

    if(ok_ea_num <= 0){
      return false;
    }else{
      return true;
    }
  }


  const   getErizoAgentPolicy = async (ip,eapolicy="ROOM-BEST")=>{
    log.info(`message: getErizoAgentPolicy ip:${ip} eapolicy:${eapolicy}`);
    let agentQueue = 'ErizoAgent';
    if(eapolicy == "ROOM-BEST"){
      if (getErizoAgent) {
        agentQueue = getErizoAgent(agents, undefined);
      }
      return  agentQueue;

    }else if(eapolicy =="TTL-BEST"){
      // log.info(`message: getErizoAgentPolicy===${eapolicy}`);
      const  agentlist = [];
      let count = 0;
      await new Promise((resolve)=>{
        forEachAgent(async(agentId, agentInList)=>{
            if(agentInList.info.state  == 0){
              return;
            }
          // log.info(`message: forEachAgent agentId:${agentId}`);
            var earpcid =`ErizoAgent_${agentId}`
            log.info(`eaid:${earpcid}`);
            await amqper.callRpc(earpcid, 'getPingConst', [ip], { callback(resp){
              try{
                log.info(`message: getPingConst   earpcid:${earpcid} ea.ip:${agentInList.info.ip} rcpcallback:resp:${JSON.stringify(resp)}`);
                if(resp  == "timeout"){
                  return;
                }
                if(resp.retEvent == "sucess"){
                  var newagent = {
                    id:agentId,
                    spent:resp.spent
                  }
                  agentlist.push(newagent);
                }

              }finally{
                log.info(`agentId:${agentId} finnally`);
                count+=1;
                const agentIds = Object.keys(agents);
                if(count === agentIds.length){
                  resolve();
                }
              }

            } });
        });
      });
      
      if(agentlist.length == 0){
        log.warn(`message: EAping值搜集之后agentlist长度为0`);
        return agentQueue
      }
      agentlist.sort((a,b)=>{return a.spent- b.spent});
      var earpcid =`ErizoAgent_${ agentlist[0].id}`;
      return earpcid;
    }
  }




  const   getErizoAgentPolicy = async (ip,eapolicy="LOOP")=>{
    log.info(`message: getErizoAgentPolicy ip:${ip} eapolicy:${eapolicy}`);
    let agentQueue = 'ErizoAgent';
    if(eapolicy == "LOOP"){
      if (getErizoAgent) {
        agentQueue = getErizoAgent(agents, undefined);
      }
      return  agentQueue;

    }else if(eapolicy =="TTL-BEST"){
      // log.info(`message: getErizoAgentPolicy===${eapolicy}`);
      const  agentlist = [];
      let count = 0;
      await new Promise((resolve)=>{
        forEachAgent(async(agentId, agentInList)=>{
          // log.info(`message: forEachAgent agentId:${agentId}`);
            var earpcid =`ErizoAgent_${agentId}`
            log.info(`eaid:${earpcid}`);
            await amqper.callRpc(earpcid, 'getPingConst', [ip], { callback(resp){
              try{
                log.info(`message: getPingConst   earpcid:${earpcid} ea.ip:${agentInList.info.ip} rcpcallback:resp:${JSON.stringify(resp)}`);
                if(resp  == "timeout"){
                  return;
                }
                if(resp.retEvent == "sucess"){
                  var newagent = {
                    id:agentId,
                    spent:resp.spent
                  }
                  agentlist.push(newagent);
                }

              }finally{
                log.info(`agentId:${agentId} finnally`);
                count+=1;
                const agentIds = Object.keys(agents);
                if(count === agentIds.length){
                  resolve();
                }
              }

            } });
        });
      });
      
      if(agentlist.length == 0){
        log.warn(`message: EAping值搜集之后agentlist长度为0`);
        return agentQueue
      }
      agentlist.sort((a,b)=>{return a.spent- b.spent});
      var earpcid =`ErizoAgent_${ agentlist[0].id}`;
      return earpcid;
    }
  }

  that.getErizoAgentsList = () => JSON.stringify(agents);

  return that;
};
