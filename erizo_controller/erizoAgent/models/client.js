const events = require('events');
const uuidv4 = require('uuid/v4');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent - Client');

class Client extends events.EventEmitter {
  constructor(clientid, options, room) {
    super();
    this.room = room;
    this.id = clientid;
    this.options =  options;
  }




}

exports.Client = Client;
