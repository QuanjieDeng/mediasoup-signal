
const events = require('events');
const Client = require('./client').Client;
const config =  require('../../../licode_config');
const { cli } = require('winston/lib/winston/config');
const { threadId } = require('worker_threads');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent-Room');

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
    log.debug(`getClientById--client${id}`);
    return this.clients.get(id);
  }

  async createClient(clientid) {
    const room =  this;
    const client = await Client.create({ room , clientid });
    client.on('disconnect', this.onClientDisconnected.bind(this, client));
    this.clients.set(client.id, client);
    return client;
  }

  async getOrCreateClient(clientid){
      const  client =  this.getClientById(clientid);
      if(client){
          return client;
      }
      return await this.createClient(clientid);
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

  async handleUserRequest(userid,methed,message,callback){
      log.debug(`messages: room-handleUserRequest:userid:${userid} methed:${methed}`);
      
      if(methed  =="getRouterRtpCapabilities"){//在第一个消息来到时创建client
       const user = await this.getOrCreateClient(userid);
       log.debug(`create success client:${user.getid()}`);
       var  resp = {
            data:this._mediasoupRouter.rtpCapabilities
        }
        callback('callback',{retEvent:"success",data: resp });
      }else{
        const user =   this.getClientById(userid);
        if(!user){
            callback('callback',{retEvent:"error",data: {errmsg:"user not find", errcode:1003}});
            return;
        }

        switch (methed)
		{
			case 'join':
			{
				break;
            }
            default:
            {
                log.error(`unknown request.method：${method}`);
                callback('callback',{ roomid: roomid, agentId: ErizoAgentId,retEvent:"error",data: {errmsg:"unknown request.method", errcode:1004}});
            }
        }
        
      }
  }

}



exports.Room = Room;