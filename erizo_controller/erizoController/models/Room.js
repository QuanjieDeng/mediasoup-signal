
const events = require('events');
const { cli } = require('winston/lib/winston/config');
// const controller = require('../roomController').RoomController;
const Client = require('./Client').Client;
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoController - Room');

class Room extends events.EventEmitter {
  constructor({erizoControllerId, amqper,agentId, ecch, id}) {
    super();
    this.clients = new Map();
    this.id = id;
    this.erizoControllerId = erizoControllerId;
    this.amqper = amqper;
    this.ecch = ecch;
    this.erizoAgentId = agentId;
  }

  static async create({ erizoControllerId, amqper,agentId, ecch, id}){
		log.info('create() [roomId:%s]', id);
		return new Room(
			{
				erizoControllerId,
        amqper,
        agentId,
        ecch,
				id
			});
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

  async createClient(channel, token, options) {
    const room = this;
    const client = await Client.create({channel, token, options, room});
    client.on('disconnect', this.onClientDisconnected.bind(this, client));
    this.clients.set(client.id, client);
    return client;
  }

  forEachClient(doSomething) {
    this.clients.forEach((client) => {
      doSomething(client);
    });
  }

  removeClient(id) {
    this.removeClientEA(this.id,id);
    return this.clients.delete(id);
  }

  onClientDisconnected() {
    if (this.clients.size === 0) {
      log.debug(`message: deleting empty room, roomId: ${this.id}`);
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
      if(client.id == excludePeer.id){
        return;
      }

      log.debug(`message: sendMsgToRoom,clientId:${client.id},roomId:${this.id} method:${method}`);

      client.sendMessage(method, args);
    });
  }


  //就是对客户端的消息进行转发到EA 
  processReqMessageFromClient (roomid, clientId,methed,msg, callback){

    const args = [roomid, clientId,methed, msg];
    var   agentid = `ErizoAgent_${this.erizoAgentId}`;
    this.amqper.callRpc(agentid, 'handleUserRequest', args, { callback });
  };

  //通知EA删除用户
  removeClientEA(roomid,clientId){
    log.info(`message: removeClient clientId ${clientId}`);
    const args = [roomid, clientId];
    var   agentid = `ErizoAgent_${this.erizoAgentId}`;
    this.amqper.callRpc(agentid, 'deleteUser', args);
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

  async getOrCreateRoom(erizoControllerId, agentId,id) {
    let room = this.rooms.get(id);
    if (room === undefined) {
      const  amqper =  this.amqper;
      const  ecch =  this.ecch;
      room =await Room.create({erizoControllerId,agentId, amqper, ecch, id});
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
