/* eslint-disable no-param-reassign */

const events = require('events');
// eslint-disable-next-line import/no-extraneous-dependencies
const uuidv4 = require('uuid/v4');
const { cli } = require('winston/lib/winston/config');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoController - Client');

class Client extends events.EventEmitter {
  constructor({channel, token, options, room}) {
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

  static async create({ channel, token, options, room}){
		log.info('create() [client]');
		return new Client(
			{
				channel,
        token,
        options,
				room
			});
    }



  listenToSocketEvents() {
    log.debug(`message: Adding listeners to socket events, client.id: ${this.id}`);
    this.socketEventListeners.set('getRouterRtpCapabilities', this.onClientRequestCom.bind(this,"getRouterRtpCapabilities"));
    this.socketEventListeners.set('createWebRtcTransport', this.onClientRequestCom.bind(this,"createWebRtcTransport"));
    this.socketEventListeners.set('join', this.onJoin.bind(this));
    this.socketEventListeners.set('connectWebRtcTransport', this.onClientRequestCom.bind(this,"connectWebRtcTransport"));
    this.socketEventListeners.set('produce', this.onClientRequestCom.bind(this,"produce"));
    this.socketEventListeners.set('closeProducer', this.onClientRequestCom.bind(this,"closeProducer"));
    this.socketEventListeners.set('pauseProducer', this.onClientRequestCom.bind(this,"pauseProducer"));
    this.socketEventListeners.set('resumeProducer', this.onClientRequestCom.bind(this,"resumeProducer"));
    this.socketEventListeners.set('pauseConsumer', this.onClientRequestCom.bind(this,"pauseConsumer"));
    this.socketEventListeners.set('resumeConsumer', this.onClientRequestCom.bind(this,"resumeConsumer"));
    this.socketEventListeners.set('restartIce', this.onClientRequestCom.bind(this,"restartIce"));
    this.socketEventListeners.set('setConsumerPreferredLayers', this.onClientRequestCom.bind(this,"setConsumerPreferredLayers"));
    this.socketEventListeners.set('setConsumerPriority', this.onClientRequestCom.bind(this,"setConsumerPriority"));
    this.socketEventListeners.set('requestConsumerKeyFrame', this.onClientRequestCom.bind(this,"requestConsumerKeyFrame"));
    this.socketEventListeners.set('produceData', this.onClientRequestCom.bind(this,"produceData"));
    this.socketEventListeners.set('getTransportStats', this.onClientRequestCom.bind(this,"getTransportStats"));
    this.socketEventListeners.set('getProducerStats', this.onClientRequestCom.bind(this,"getProducerStats"));
    this.socketEventListeners.set('getConsumerStats', this.onClientRequestCom.bind(this,"getConsumerStats"));
    this.socketEventListeners.set('getDataProducerStats', this.onClientRequestCom.bind(this,"getDataProducerStats"));
    this.socketEventListeners.set('getDataConsumerStats', this.onClientRequestCom.bind(this,"getDataConsumerStats"));
    this.socketEventListeners.set('applyNetworkThrottle', this.onClientRequestCom.bind(this,"applyNetworkThrottle"));
    this.socketEventListeners.set('resetNetworkThrottle', this.onClientRequestCom.bind(this,"resetNetworkThrottle"));


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


  //发送消息没有callback
  sendMessage(type, arg) {
    this.channel.sendMessage(type, arg);
  }

  sendMessageSync(type, arg,callback) {
    this.channel.sendMessageSync(type, arg,callback);
  }

  notifyNewUserJoinRom(){
    var msg= {
      data:{
        id          : this.id,
        displayName : this.displayName,
        device      : this.device
      }
    };
    this.room.sendMessage("newPeer", msg,{ excludePeer:this });
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
  onClientRequestCom(methed,message,callback){
    log.info(`message: onClientRequestCom ,methed: ${JSON.stringify(methed)} `);
    if (this.room === undefined) {
      log.error(`message: onClientRequestCom for user in undefined room user: ${this.user}`);
      this.disconnect();
      return;
    }
    const rpccallback = (result) => {
      log.info(`onClientRequestCom rpccallback-methed:${methed}`);
      if(result  == "timeout"){
        callback("error",{data:{}});
      }else{
        var retEvent =  result.retEvent;
        var  data =  result.data;
        callback(retEvent,data);
      }
    };
    this.room.processReqMessageFromClient(this.room.id, this.id, methed,message.data, rpccallback.bind(this));
  }


  onJoin(message,callback){
    log.info(`message: user:${this.id} req  join room`);
    log.info(`messages: user's name:${JSON.stringify(message)}`);
    if (this.room === undefined) {
      log.error(`message: onClientRequestCom for user in undefined room user: ${this.user}`);
      this.disconnect();
      return;
    }
    this.displayName = message.data.displayName;
    this.device = message.data.device;

    const rpccallback = (result) => {
      log.info(`onJoin rpccallback:${JSON.stringify(result)}`);
      if(result  == "timeout"){
        callback("error",{data:{}});
      }else{
        //通知房间内的其他用户有新用户加入
        this.notifyNewUserJoinRom();
        //返回用户
        var retEvent =  result.retEvent;


        const peerInfos = this.room.getClientList({excludePeer:this});
        var  resp = {
          data:{
            peers:peerInfos
          }
        }
        callback(retEvent,resp);
      }
    };
    this.room.processReqMessageFromClient(this.room.id, this.id, "join",message.data, rpccallback.bind(this));
  }
  //
  // ongetRouterRtpCapabilities(message,callback){
  //   log.info(`message: ongetRouterRtpCapabilities,messgae: ${message} `);
  //   if (this.room === undefined) {
  //     log.error(`message: ongetRouterRtpCapabilities for user in undefined room user: ${this.user}`);
  //     this.disconnect();
  //     return;
  //   }
  //   const rpccallback = (result) => {
  //     log.info("ongetRouterRtpCapabilities  rpccallback:"+JSON.stringify(result));
  //     if(result  == "timeout"){
  //       callback("error",{data:{}});
  //     }else{
  //       var retEvent =  result.retEvent;
  //       var  data =  result.data;
  //       callback(retEvent,data);
  //     }
  //   };
  //   this.room.controller.processReqMessageFromClient(this.room.id, this.id, "getRouterRtpCapabilities",message.data, rpccallback.bind(this));
  // }


}

exports.Client = Client;
