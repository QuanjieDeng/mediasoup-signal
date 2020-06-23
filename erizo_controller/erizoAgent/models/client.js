const events = require('events');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent-Client');

class Client extends events.EventEmitter {
  constructor({clientid, room}) {
    super();
    this.room = room;
    this.id = clientid;
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




}

exports.Client = Client;
