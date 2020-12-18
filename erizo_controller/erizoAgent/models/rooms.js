
const events = require('events');
const Room =  require('./room').Room;
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('Room');


class Rooms extends events.EventEmitter {
  constructor(amqper,workermanage) {
    super();
    this.amqper = amqper;
    this.workermanage =  workermanage;
    this.rooms = new Map();
    this.initMetrics();
  }

  size() {
    return this.rooms.size;
  }

 async getOrCreateRoom(mediasoupWorker,roomid,erizoControllerid,amqper) {
    let room = this.rooms.get(roomid);
    if (!room) {
      room = await Room.create({ roomid,amqper,erizoControllerid,mediasoupWorker });
      this.rooms.set(room.id, room);
      room.on('room-empty', this.deleteRoom.bind(this, roomid));
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
  addRoom(id,room) {
    this.rooms.set(id, room);
    this.emit('updated');
    room.on('room-empty', this.deleteRoom.bind(this, id));
    room.on('transport_event', this.onTransPortEvent.bind(this));
  }
  onTransPortEvent(eventname,state){
    log.info(`onTransPortEvent  eventname:${eventname} state:${state}`);
    if(eventname === "sctpstatechange"){
      if (state === 'failed'){
        this.metrics.SCTPconnectionsFailed +=1;
      }
    }else if(eventname === "dtlsstatechange"){
      if(state === 'failed'){
        this.metrics.DTLSconnectionsFailed  +=1;
      }

    }else if(eventname === "icestatechange"){
      if(state  === 'disconnected'){
        this.metrics.ICEconnectionsFailed  +=1;
      }
    }
  }

  deleteRoom(id) {
    log.info("message: delete room:",id);
    if (this.rooms.delete(id)) {
      this.emit('updated');
    }
  }

  initMetrics(){
    this.metrics = {
      ICEconnectionsFailed: 0,
      DTLSconnectionsFailed: 0,
      SCTPconnectionsFailed: 0
    };
  };
  /*
  get  mediasouop-worker Metrics
  it whill  clear the  Metrics
  */
  getAndResetMetrics = () => {
    const metrics = Object.assign({}, this.metrics);

    this.initMetrics();
    return metrics;
  };




}

exports.Rooms = Rooms;
