/*
Params
  agents: object with the available agents
    agent_id : {
          info: {
            id: String,
            rpc_id: String,
            ip：String,
            rooms: int
          },
          metadata: Object,
          stats: {
        perc_cpu: Int
          },
      timeout: Int // number of periods during the agent has not respond
      }
Returns
  rpc_id: agent.info.rpc_id field of the selected agent.
 *default value: "ErizoAgent" - select the agent in round-robin mode
*/


const logger = require('./../../common/logger').logger;
const log = logger.getLogger('EcCloudHandler');

exports.getErizoAgent = (agents, agentId) => {
  if (agentId) {
    return `ErizoAgent_${agentId}`;
  }
  
  //使用房间数量最少的
  const  agentlist = [];
  const agentIds = Object.keys(agents);
  for (let i = 0; i < agentIds.length; i += 1) {
    const agent =  agents[agentIds[i]];
    /*
    EA的timeout大于1,表明该EA当前处于 断连容忍状态，不参与服务
    */
    if(agent.timeout > 1){
      continue;
    }
    /*
    检查EA状态，0 标识不可用,不参与服务
    */
    if(agent.info.state == 0){
      log.warn(`message: EA 状态为:${agent.info.state} 跳过，不参与服务`);
      continue;
    }
    var newagent = {
      rpc_id:agent.info.rpc_id,
      rooms:agent.info.rooms,
    }
    agentlist.push(newagent);
  }

  if(agentlist.length == 0){
    log.warn(`message: EA 房间数量搜集之后agentlist长度为0`);
    return 'ErizoAgent'
  }

  agentlist.sort((a,b)=>{return a.rooms- b.rooms});
  var earpcid =agentlist[0].rpc_id;
  return earpcid;
};
