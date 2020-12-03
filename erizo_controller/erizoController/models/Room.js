
const events = require('events');
const { cli } = require('winston/lib/winston/config');
const SFUConManager  = require('../sfuConManager').SFUConManager;
const Client = require('./Client').Client;
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('Room');

class Room extends events.EventEmitter {
  constructor({erizoControllerId, amqper,agentId,routerId, ecch, id,eapolicy,sfum}) {
    super();
    this.clients = new Map();
    this.id = id;
    this.erizoControllerId = erizoControllerId;
    this.amqper = amqper;
    this.ecch = ecch;
    
    /*
    erizoAgentId 记录当前房间所在的EA,只有为LOOP模式时，该值记录了房间所在的EA
    */
    this.erizoAgentId = agentId; 
    /*
    routerId 记录当前房间所在routerid,只有为LOOP模式时，该值记录房间所在的router
    */
    this.routerId =  routerId;
    this.eapolicy = eapolicy;
    /*
    在TLL-BEST模式时，sfum存储当前房间所有的EA-router对
    负责管理房间所属的EA,和发起SFU级联的相关逻辑
    */
    this.sfum =  sfum;

  }

  static async create({ erizoControllerId, amqper,agentId,routerId, ecch, id,eapolicy}){
    log.info('create() [roomId:%s]', id);
    
    const sfum =  await SFUConManager.create({id,amqper, ecch, erizoControllerId});
    sfum.addRouter(agentId,routerId);
		return new Room(
			{
				erizoControllerId,
        amqper,
        agentId,
        routerId,
        ecch,
        id,
        eapolicy,
        sfum
			});
  }

  // addRouter(agentId,routerId){
  //   var  ea_router_key =  `${agentId}@${routerId}`;
  //   if(this.AgentRouterMap.has(ea_router_key)){
  //     log.info(`message: ea-router:${ea_router_key} exiest yet!`);
  //   }else{
  //     log.info(`message: add  new ea-router:${ea_router_key}`);
  //     /*
  //     在这里开启每个已经存在的router到新的router之间的piptransport级联
  //     */
  //    this.AgentRouterMap.forEach((v,k)=>{
  //      log.info(`message start pipRouter from:${v.routerId}  to:${routerId}`);
       

  //    });


  //    this.AgentRouterMap.set(ea_router_key,{agentId:agentId,routerId:routerId});
  //   }
  // }



  addRouter(agentId,routerId){
    this.sfum.addRouter(agentId,routerId);
  }

  getClientList({ excludePeer = undefined } = {}){
    const  client_list = [];
    this.clients.forEach(function(v,k){
      if(v == excludePeer){
        return;
      }
      
      var  user = {
        id          : v.id,
        displayName : v.displayName,
        device      : v.device
      }
      client_list.push(user);
    })
    return client_list;
  }
  hasClientWithId(id) {
    return this.clients.has(id);
  }

  getClientById(id) {
    return this.clients.get(id);
  }

  async createClient(channel, token, options,agentId,routerId) {
    const room = this;
    const client = await Client.create({channel, token, options, room,agentId,routerId});
    client.on('disconnect', this.onClientDisconnected.bind(this, client));
    this.clients.set(client.id, client);
    this.sfum.addClient(agentId,routerId);
    return client;
  }

  forEachClient(doSomething) {
    this.clients.forEach((client) => {
      doSomething(client);
    });
  }

  removeClient(id,agentId) {
    this.removeClientEA(this.id,id,agentId);
    return this.clients.delete(id);
  }

  onClientDisconnected(client) {
    this.sfum.delClient(client.agentId,client.routerId);
    if (this.clients.size === 0) {
      log.info(`message: deleting empty room, roomId: ${this.id}`);
      this.emit('room-empty');
    }
  }

  //用户消息单播
  sendSingleMessageToClient(clientId,msg, methed,callback) {
    const client = this.getClientById(clientId);
    if (client) {
      client.sendMessageSync(methed,msg,callback);
    }else{
      log.error(`message: sendSingleMessageToClient can't  get client  by clientid:${clientId}`);
    }
  }

  //房间内消息广播
  sendMessage(method, args,{ excludePeer = undefined } = {}) {
    this.forEachClient((client) => {
      if(excludePeer && (client.id == excludePeer.id)){
        return;
      }

      log.debug(`message: sendMsgToRoom,clientId:${client.id},roomId:${this.id} method:${method}`);
      setTimeout(() => {
        client.sendMessage(method, args);
      }, 0);
      
    });
  }


  //就是对客户端的消息进行转发到EA 
  processReqMessageFromClient (roomid, clientId,clientname,eaid,methed,msg, callback){

    const args = [roomid, clientId,clientname,methed, msg];
    var   agentid = `ErizoAgent_${eaid}`;
    this.amqper.callRpc(agentid, 'handleUserRequest', args, { callback });
  };

  //通知EA删除用户
  removeClientEA(roomid,clientId,agentId){
    log.info(`message: removeClient clientId ${clientId}`);
    const tmpargs = [roomid, clientId];
    // const ealist = this.sfum.getEAlist();
    // ealist.forEach((v,index,arry)=>{
    //   var   agentid = `ErizoAgent_${v}`;
    //   this.amqper.callRpc(agentid, 'deleteUser', args);

    // });
    /*
    在全集群内广播，而不仅是在房间拥有的EA上广播
    可能的情况是当大量连接创建时，在LOOP模式下，EC的房间来不及创建，新进的用户发现没有创建room,就会再次申请EA，
    但是最终一个房间只会使用一个EA，就会导致一些EA上创建了一个空的房间，所以在删除用户时进行全域删除
    */
    this.amqper.broadcast("ErizoAgent",{ method: 'deleteUser', args: tmpargs});


  };

}

class Rooms extends events.EventEmitter {
  constructor(amqper, ecch) {
    super();
    this.amqper = amqper;
    this.ecch = ecch;
    this.rooms = new Map();
  }

  size() {
    return this.rooms.size;
  }

  async getOrCreateRoom(erizoControllerId, agentId,routerId,id,eapolicy) {
    let room = this.rooms.get(id);
    if (room === undefined) {
      log.debug(`message:getOrCreateRoom room:${id} not exist,whill create`);
      const  amqper =  this.amqper;
      const  ecch =  this.ecch;
      room =await Room.create({erizoControllerId,agentId,routerId, amqper, ecch, id,eapolicy});
      this.rooms.set(room.id, room);
      room.on('room-empty', this.deleteRoom.bind(this, id));
      this.emit('updated');
    }
    return room;
  }



  forEachRoom(doSomething) {
    this.rooms.forEach((room) => {
      doSomething(room);
    });
  }

  getRoomWithClientId(id) {
    // eslint-disable-next-line no-restricted-syntax
    for (const room of this.rooms.values()) {
      if (room.hasClientWithId(id)) {
        return room;
      }
    }
    return undefined;
  }

  getRoomById(id) {
    return this.rooms.get(id);
  }

  deleteRoom(id) {
    if (this.rooms.delete(id)) {
      this.emit('updated');
    }
  }
}

exports.Room = Room;
exports.Rooms = Rooms;
