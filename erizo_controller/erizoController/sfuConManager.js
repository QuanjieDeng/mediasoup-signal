/*
主要实现SFU级联的核心逻辑
*/


const logger = require('./../common/logger').logger;
const log = logger.getLogger('SFUConManager');


class SFUConManager{
  constructor({id,amqper, ecch, erizoControllerId}) {
    this.roomid =  id;
    this.amqper = amqper;
    this.ecch = ecch;
    this.erizoControllerId = erizoControllerId;
    this.eventListeners = [];
    this.AgentRouterMap = new Map();

  }
  
  addRouter(agentId,routerId){
    var  ea_router_key =  `${agentId}@${routerId}`;
    if(this.AgentRouterMap.has(ea_router_key)){
      log.info(`message: ea-router:${ea_router_key} exiest yet!`);
    }else{
      log.info(`message: add  new ea-router:${ea_router_key}`);
      /*
      在这里开启每个已经存在的router到新的router之间的piptransport级联
      */
     this.AgentRouterMap.forEach((v,k)=>{
       log.info(`message start pipRouter from:${v.routerId}  to:${routerId}`);
       //发送rpc请求到from 告诉他有你开启piptransport的建立过程
       var from_ea_id = `ErizoAgent_${v.agentId}`;
       this.amqper.callRpc(from_ea_id, 'handlePipRoute',  [this.roomid,v.routerId,routerId,agentId], { callback(resp){
           log.info(`handlePipRoute rpccallback:${JSON.stringify(resp)}`);

       } },10000);
       

     });


     this.AgentRouterMap.set(ea_router_key,{agentId:agentId,routerId:routerId});
    }
  }

  static async create({id,amqper, ecch, erizoControllerId}){
		log.info('create() [SFUConManager]');
		return new SFUConManager(
			{
            id,
            amqper,
            ecch,
            erizoControllerId
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

//   //就是对客户端的消息进行转发到EA 
//   processReqMessageFromClient = (roomid, clientId,methed,msg, callback) => {
//     const args = [roomid, clientId,methed, msg];
//     var   agentid = `ErizoAgent_${erizoAgentId}`;
//     amqper.callRpc(agentid, 'handleUserRequest', args, { callback });
//   };

//   //通知EA删除用户
//   removeClient = (roomid,clientId) => {
//     log.info(`message: removeClient clientId ${clientId}`);
//     const args = [roomid, clientId];
//     var   agentid = `ErizoAgent_${erizoAgentId}`;
//     amqper.callRpc(agentid, 'deleteUser', args);
//   };

};
exports.SFUConManager = SFUConManager;

