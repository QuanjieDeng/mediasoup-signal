
const events = require('events');
const Client = require('./client').Client;
const config =  require('../../../licode_config')
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent - Room');

class Room extends events.EventEmitter {
  constructor({id,erizoControllerId, amqper,mediasoupRouter,audioLevelObserver}) {
    super();
    this.clients = new Map();
    this.id = id;
    this.erizoControllerId = erizoControllerId;
    this.amqper = amqper;
    this._mediasoupRouter = mediasoupRouter;
    this._audioLevelObserver = audioLevelObserver;
    this._networkThrottled = false;
    global.audioLevelObserver = this._audioLevelObserver;
    log.info("Room构造函数");
  }


  static async create({  roomid,amqper,erizoControllerid,mediasoupWorker }){
		log.info('create() [roomId:%s]', roomid);
		// Router media codecs.
		const { mediaCodecs } = config.mediasoup.routerOptions;

		// Create a mediasoup Router.
		const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs });

		// Create a mediasoup AudioLevelObserver.
		const audioLevelObserver = await mediasoupRouter.createAudioLevelObserver(
			{
				maxEntries : 1,
				threshold  : -80,
				interval   : 800
			});
		return new Room(
			{
				roomid,
                erizoControllerid,
                amqper,
				mediasoupRouter,
				audioLevelObserver
			});
    }
    
  getRouterId() {
    return this._mediasoupRouter.id;
  }

  hasClientWithId(id) {
    return this.clients.has(id);
  }

  getClientById(id) {
    return this.clients.get(id);
  }

  createClient(clientid, options) {
    const client = new Client(clientid, options, this);
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
    return this.clients.delete(id);
  }

  onClientDisconnected() {
    if (this.clients.size === 0) {
      log.debug(`message: deleting empty room, roomId: ${this.id}`);
      this.emit('room-empty');
    }
  }

}



exports.Room = Room;
