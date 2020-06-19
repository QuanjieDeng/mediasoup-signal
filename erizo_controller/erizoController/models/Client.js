/* eslint-disable no-param-reassign */

const events = require('events');
// eslint-disable-next-line import/no-extraneous-dependencies
const uuidv4 = require('uuid/v4');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoController - Client');

class Client extends events.EventEmitter {
  constructor(channel, token, options, room) {
    super();
    this.channel = channel;
    this.room = room;
    this.token = token;
    this.id = uuidv4();
    this.options = options;
    this.socketEventListeners = new Map();
    this.listenToSocketEvents();
    this.user = { name: token.userName, role: token.role };
    this.state = 'sleeping'; // ?
  }

  listenToSocketEvents() {
    log.debug(`message: Adding listeners to socket events, client.id: ${this.id}`);
    // this.socketEventListeners.set('sendDataStream', this.onSendDataStream.bind(this));

    this.socketEventListeners.forEach((value, key) => {
      this.channel.socketOn(key, value);
    });
    this.channel.on('disconnect', this.onDisconnect.bind(this));
  }
  stopListeningToSocketEvents() {
    log.debug(`message: Removing listeners to socket events, client.id: ${this.id}`);
    this.socketEventListeners.forEach((value, key) => {
      this.channel.socketRemoveListener(key, value);
    });
  }

  disconnect() {
    this.stopListeningToSocketEvents();
    this.channel.disconnect();
  }

  setNewChannel(channel) {
    const oldChannel = this.channel;
    const buffer = oldChannel.getBuffer();
    log.info('message: reconnected, oldChannelId:', oldChannel.id, ', channelId:', channel.id);
    oldChannel.removeAllListeners();
    oldChannel.disconnect();
    this.channel = channel;
    this.listenToSocketEvents();
    this.channel.sendBuffer(buffer);
  }



  sendMessage(type, arg) {
    this.channel.sendMessage(type, arg);
  }


  onDisconnect() {
    this.stopListeningToSocketEvents();
    const timeStamp = new Date();

    log.info(`message: Channel disconnect, clientId: ${this.id}`, ', channelId:', this.channel.id);


      if (global.config.erizoController.report.session_events) {
        this.room.amqper.broadcast('event', { room: this.room.id,
          user: this.id,
          type: 'user_disconnection',
          timestamp: timeStamp.getTime() });
      }
      this.room.removeClient(this.id);
      this.emit('disconnect');
  }


}

exports.Client = Client;
