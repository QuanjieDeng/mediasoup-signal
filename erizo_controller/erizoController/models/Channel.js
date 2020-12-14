
const events = require('events');
const logger = require('./../../common/logger').logger;
const crypto = require('crypto');
// eslint-disable-next-line import/no-extraneous-dependencies
const uuidv4 = require('uuid/v4');
const config = require('./../../../licode_config');
const log = logger.getLogger('Channel');
const limiterQueue =  require('./../ralteLimiterMemory').limiterQueue;
const limiterFlexible =  require('./../ralteLimiterMemory').limiterFlexible;


const NUVE_KEY = global.config.nuve.superserviceKey;

const RECONNECTION_TIMEOUT = 10000;

const calculateSignature = (token, key) => {
  const toSign = `${token.tokenId},${token.host}`;
  const signed = crypto.createHmac('sha1', key).update(toSign).digest('hex');
  return (new Buffer(signed)).toString('base64');
};

const checkSignature = (token, key) => {
  const calculatedSignature = calculateSignature(token, key);

  if (calculatedSignature !== token.signature) {
    log.info('message: invalid token signature');
    return false;
  }
  return true;
};

function listenToSocketHandshakeEvents(channel) {
  channel.socket.on('token', channel.onToken.bind(channel));
  channel.socket.on('reconnected', channel.onReconnected.bind(channel));
  channel.socket.on('disconnect', channel.onDisconnect.bind(channel));

  channel.socket.on('disconnect', channel.onDisconnect.bind(channel));
}

const CONNECTED = Symbol('connected');
const RECONNECTING = Symbol('reconnecting');
const DISCONNECTED = Symbol('disconnected');

const WEBSOCKET_NORMAL_CLOSURE = 1000;
const WEBSOCKET_GOING_AWAY_CLOSURE = 1001;

class Channel extends events.EventEmitter {
  constructor(socket, nuve) {
    super();
    this.socket = socket;
    this.nuve = nuve;
    this.state = DISCONNECTED;
    this.messageBuffer = [];
    this.id = uuidv4();

    // Hack to know the exact reason of the WS closure (socket.io does not publish it)
    this.closeCode = WEBSOCKET_NORMAL_CLOSURE;
    const onCloseFunction = this.socket.conn.transport.socket.internalOnClose;
    this.socket.conn.transport.socket.internalOnClose = (code, reason) => {
      this.closeCode = code;
      if (onCloseFunction) {
        onCloseFunction(code, reason);
      }
    };
    listenToSocketHandshakeEvents(this);
  }

  async onToken(options, callback) {
    const token = options.token;
    log.debug('message: token received');
    if(config.erizoController.ratelimit.global.global){
      try {
        // await limiterFlexible.consume(this.socket.handshake.address); // consume 1 point per event from IP
        await limiterFlexible.consume('global'); // consume 1 point per event from IP
      } catch(rejRes) {
        log.error(`message: onToken too  many client`);
        callback("error",{errmsg:"up to  RateLimiter",errcode:1000});
        return;
      }
    }


    if (token && checkSignature(token, NUVE_KEY)) {
      this.nuve.deleteToken(token.tokenId).then((tokenDB) => {
        if (token.host === tokenDB.host) {
          this.state = CONNECTED;
          this.emit('connected', tokenDB, options, callback);
        } else {
          log.warn(`message: Token has invalid host, clientId: ${this.id}`);
          callback("error",{errmsg:"Token has invalid host",errcode:1001});
          this.disconnect();
        }
      }).catch((reason) => {
        if (reason === 'error') {
          log.warn('message: Trying to use token that does not exist - ' +
                     `disconnecting Client, clientId: ${this.id}`);
          callback("error",{errmsg:"Token does not exist",errcode:1002});
          this.disconnect();
        } else if (reason === 'timeout') {
          log.warn('message: Nuve does not respond token check - ' +
                     `disconnecting client, clientId: ${this.id}`);
          callback("error",{errmsg:"Token check,Nuve does not respond",errcode:1003});
          this.disconnect();
        }
      });
    } else {
      log.warn(`message: Token authentication error, clientId: ${this.id}`);
      callback("error",{errmsg:"Authentication error",errcode:1004});
      this.disconnect();
    }
  }

  onDisconnect() {
    log.debug('message: socket disconnected, code:', this.closeCode);
    if (this.closeCode !== WEBSOCKET_NORMAL_CLOSURE &&
        this.closeCode !== WEBSOCKET_GOING_AWAY_CLOSURE) {
      this.state = RECONNECTING;
      this.disconnecting = setTimeout(() => {
        this.emit('disconnect');
        this.state = DISCONNECTED;
      }, RECONNECTION_TIMEOUT);
      return;
    }
    this.state = DISCONNECTED;
    this.emit('disconnect');
  }

  socketOn(eventName, listener) {
    this.socket.on(eventName, listener);
  }

  socketRemoveListener(eventName, listener) {
    this.socket.removeListener(eventName, listener);
  }

  onReconnected(clientId) {
    this.state = CONNECTED;
    clearTimeout(this.disconnecting);
    this.emit('reconnected', clientId);
  }

  sendMessage(type, arg) {
    if (this.state === RECONNECTING) {
      this.addToBuffer(type, arg,undefined);
      return;
    }
    this.socket.emit(type, arg);
  }


  sendMessageSync(type, arg,callback) {
    if (this.state === RECONNECTING) {
      this.addToBuffer(type, arg,callback);
      return;
    }
    this.socket.emit(type, arg,callback);
  }

  addToBuffer(type, arg,callback) {
    this.messageBuffer.push([type, arg,callback]);
  }

  getBuffer() {
    return this.messageBuffer;
  }

  sendBuffer(buffer) {
    if (this.state !== CONNECTED) {
      return;
    }
    log.debug('message: sending buffered messages, number:', buffer.length,
      ', channelId:', this.id);
    buffer.forEach((message) => {
      log.debug('message: sending buffered message, message:', message, ', channelId:', this.id);
      if(message.length ==3 &&  message[2]!= undefined){//长度为3 并且[2]不为undefied，则表明是有callback函数的，使用sendMessageSync发送
        this.sendMessageSync(...message);
      }else{
        this.sendMessage(message[0],message[1]);
      }
    });
  }

  disconnect() {
    this.state = DISCONNECTED;
    clearTimeout(this.disconnecting);
    this.socket.disconnect();
  }
}

exports.Channel = Channel;
