
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
  }

  deleteRoom(id) {
    log.info("message: delete room:",id);
    if (this.rooms.delete(id)) {
      this.emit('updated');
    }
  }
}

exports.Rooms = Rooms;
