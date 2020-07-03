const events = require('events');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('Client');

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
    log.info('close() [clientid:%s]', this.id);
    //关闭其下的所有的transport
    for (const transport of  this._transports.values())
    {
      transport.close();
    }
    this.room.removeClient(this.id);
    this.emit('disconnect');
  }

  addTransport(id,transport){
      this._transports.set(id,transport);
  }

  //发送到远端的通知消息
  async notify(methed,msg){
    var  sendmsg = {
      data:msg
    }
    this.room.sendNotifyMsgToClient(this.id,methed,sendmsg);
  }

  //发送到远端的请求消息
  async request(methed,msg,callback){
    var  sendmsg = {
      data:msg
    }
    await this.room.sendMsgToClient(this.id,methed,sendmsg,function(ret,result){
      log.debug(`client:request callback:methed:${methed}  ret:${ret} result:${JSON.stringify(result)}`);
      callback(ret,result);
    });
  }


}

exports.Client = Client;
