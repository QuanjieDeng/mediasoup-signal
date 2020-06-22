
const events = require('events');
const controller = require('../roomController');
const Client = require('./Client').Client;
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoController - Room');

class Room extends events.EventEmitter {
  constructor(erizoControllerId, amqper, ecch, id) {
    super();
    this.clients = new Map();
    this.id = id;
    this.erizoControllerId = erizoControllerId;
    this.amqper = amqper;
    this.ecch = ecch;
    this.status = "start";   //start---run---error
    this.init();
  }


  init(){
    //申请分配EA
    const rpccallback = (roomid, agentId, routerId) => {
      if(roomid != "timeout"){
        this.status = "run";
        this.erizoAgentId =   agentId;
        this.routerId = routerId;
        this.setupRoomController();
      }else{
        log.error(`message: Room：${id} can't get mediaosupworker!`);
        this.status = "error";
      }
    };

    this.ecch.getMeiasoupWorker(this.id,this.erizoControllerId,rpccallback);
  }

  hasClientWithId(id) {
    return this.clients.has(id);
  }

  getClientById(id) {
    return this.clients.get(id);
  }

  createClient(channel, token, options) {
    const client = new Client(channel, token, options, this);
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
    if (this.controller) {
      this.controller.removeClient(id);
    }
    return this.clients.delete(id);
  }

  onClientDisconnected() {
    if (this.clients.size === 0) {
      log.debug(`message: deleting empty room, roomId: ${this.id}`);
      this.emit('room-empty');
    }
  }

  setupRoomController() {
    this.controller = controller.RoomController({
      amqper: this.amqper,
      ecch: this.ecch,
      erizoControllerId: this.erizoControllerId,
      erizoAgentId: this.erizoAgentId,
    });
    this.controller.addEventListener(this.onRoomControllerEvent.bind(this));
  }

  onRoomControllerEvent(type, evt) {
    if (type === 'unpublish') {
      // It's supposed to be an integer.
      const streamId = parseInt(evt, 10);
      log.warn('message: Triggering removal of stream ' +
                 'because of ErizoJS timeout, ' +
                 `streamId: ${streamId}`);
      this.sendMessage('onRemoveStream', { id: streamId });
      // remove clients and streams?
    }
  }

  //用户消息单播
  sendSingleMessageToClient(clientId,msg, methed,callback) {
    const client = this.getClientById(clientId);
    if (client) {
      client.sendMessageSync(methed,msg,callback);
    }
  }

  //房间内消息广播
  sendMessage(method, args) {
    this.forEachClient((client) => {
      log.debug('message: sendMsgToRoom,',
        'clientId:', client.id, ',',
        'roomId:', this.id, ', ',
        logger.objectToLog(method));
      client.sendMessage(method, args);
    });
  }
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

  getOrCreateRoom(erizoControllerId, id) {
    let room = this.rooms.get(id);
    if (room === undefined) {
      room = new Room(erizoControllerId, this.amqper, this.ecch, id);
      log.info("room-status："+room.status);
      log.info("room-erizoAgentId"+room.erizoAgentId);
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
