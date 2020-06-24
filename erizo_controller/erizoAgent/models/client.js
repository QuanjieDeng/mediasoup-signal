const events = require('events');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent-Client');

class Client extends events.EventEmitter {
  constructor({clientid, room}) {
    super();
    this.room = room;
    this.id = clientid;
    this.data = {};
    this._transports = new Map();
    this._producers =   new Map();
    this._consumers =  new Map();
    this._dataProducers = new Map();
    this._dataConsumers = new Map();
  }


  static async create({ room, clientid }){
    log.info('create() [clientid:%s]', clientid);

    return new Client(
        {
            clientid,
            room
        });
   }

  getid(){
      return this.id;
  }

  close(){
    //TODO  关闭其下的所有的transport
    log.info('close() [clientid:%s]', this.id);
    this.room.removeClient(this.id);
    this.emit('disconnect');
  }

  addTransport(id,transport){
      this._transports.set(id,transport);
  }

  //发送到远端的通知消息
  async notify(methed,msg){
    this.room.sendMsgToClient(methed,msg,function(){
      //nothing to do
    });
  }

  //发送到远端的请求消息
  async request(methed,msg){
    await this.room.sendMsgToClient(methed,msg,function(ret,result){
      log.info(`request callback: ret:${ret} result:${JSON.stringify(result)}`);
    });
  }


}

exports.Client = Client;
