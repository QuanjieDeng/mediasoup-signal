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
    /*
    记录该 ea-router对下 客户端的数量
    */
    this.AgentRouterClients = new Map();

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
       if(this._getEARouterClients(k)  <=0){
         return;
       }
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

  addClient(agentid,routerid){
    var  ea_router_key =  `${agentid}@${routerid}`;
    if(this.AgentRouterClients.has(ea_router_key)){
      var  conut =  this.AgentRouterClients.get(ea_router_key);
      conut +=1;
      this.AgentRouterClients.set(ea_router_key,conut);
    }else{
      this.AgentRouterClients.set(ea_router_key,1);
    }
  }

  delClient(agentid,routerid){
    var  ea_router_key =  `${agentid}@${routerid}`;
    if(this.AgentRouterClients.has(ea_router_key)){
      var  conut =  this.AgentRouterClients.get(ea_router_key);
      conut  = conut-1;
      this.AgentRouterClients.set(ea_router_key,conut);
    }
  }


  _getEARouterClients(key){
    if(this.AgentRouterClients.has(key)){
      var  conut =  this.AgentRouterClients.get(key);
      return conut;
    }
    return  0;
  }

  //获取当前room所有的EA列表
  getEAlist(){
    const ealist = [];
    this.AgentRouterMap.forEach((v,k)=>{
      ealist.push(v.agentId);
    });
    return ealist;
  }


};
exports.SFUConManager = SFUConManager;

