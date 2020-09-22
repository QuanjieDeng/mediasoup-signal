/* eslint-disable no-param-reassign */

const events = require('events');
// eslint-disable-next-line import/no-extraneous-dependencies
const uuidv4 = require('uuid/v4');
const { cli } = require('winston/lib/winston/config');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('Client');

class Client extends events.EventEmitter {
  constructor({channel, token, options, room,agentId,routerId}) {
    super();
    this.channel = channel;
    this.room = room;
    this.token = token;
    this.agentId = agentId;
    this.routerId = routerId
    this.id = uuidv4();
    this.options = options;
    this.socketEventListeners = new Map();
    this.listenToSocketEvents();
    this.user = { name: token.userName, role: token.role };
    this.state = 'sleeping'; // ?
    this.rpc_cost_list = [];
    this.ave_cost = 0;
  }

  static async create({ channel, token, options, room,agentId,routerId}){
		log.info(`create() [client]ip:${options.ip}`);
		return new Client(
			{
				channel,
        token,
        options,
        room,
        agentId,
        routerId
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
        displayName : this.user.name,
        device      : this.device
      }
    };
    this.room.sendMessage("newPeer", msg,{ excludePeer:this });
  }

  notifyUserLeaveRom(){
    var msg= {
      data:{
        peerId          : this.id
      }
    };
    this.room.sendMessage("peerClosed", msg,{ excludePeer:this });
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
      //通知其他用户我的断开
      this.notifyUserLeaveRom();
      this.room.removeClient(this.id,this.agentId);
      this.emit('disconnect');
  }
  onClientRequestCom(methed,message,callback){
    log.debug(`message: onClientRequestCom ,client:${this.id} methed: ${JSON.stringify(methed)} `);
    if (this.room === undefined) {
      log.error(`message: onClientRequestCom for user in undefined room user: ${this.user}`);
      callback("error",{errmsg:"user's room undefuned",errcode:1000});
      this.disconnect();
      return;
    }
    var starttime  =  process.uptime()*1000;
    const rpccallback = (result) => {
      log.debug(`message: onClientRequestCom  client:${this.id} rpccallback-methed:${methed}`);
      var endttime  =  process.uptime()*1000;
      var cost = endttime- starttime;
      this.saverpccost(cost);

      if(result  == "timeout"){
        callback("error",{errmsg:"rpc call timeout",errcode:1001});
      }else{
        var retEvent =  result.retEvent;
        var  data =  result.data;
        callback(retEvent,data);
      }
    };
    this.room.processReqMessageFromClient(this.room.id, this.id,this.user.name,this.agentId, methed,message.data, rpccallback.bind(this));
  }


  onJoin(message,callback){
    log.debug(`message: user:${this.id} req  join room`);
    if (this.room === undefined) {
      log.error(`message: onClientRequestCom client:${this.id}  for user in undefined room user: ${this.user}`);
      this.disconnect();
      return;
    }
    this.displayName = message.data.displayName;
    this.device = message.data.device;
    var starttime  =  process.uptime()*1000;
    const rpccallback = (result) => {
      log.debug(`message: onJoin client:${this.id} rpccallback:${JSON.stringify(result)}`);
      var endttime  =  process.uptime()*1000;
      var cost = endttime- starttime;
      this.saverpccost(cost);

      if(result  == "timeout"){
        callback("error",{errmsg:"rpc call timeout",errcode:1001});
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
    this.room.processReqMessageFromClient(this.room.id, this.id,this.user.name,this.agentId, "join",message.data, rpccallback.bind(this));
  }

  /*
  save the  rpc cost time
  */
  saverpccost(cost){
    if(this.rpc_cost_list.length >= 5){
      this.rpc_cost_list.shift();
    }
    this.rpc_cost_list.push(cost);
    //计算平均值
    var sum  = 0;
    this.rpc_cost_list.forEach((v,index,arry)=>{
      sum +=  v;
    });
    if(this.rpc_cost_list.length   !=  0){
      this.ave_cost= sum/this.rpc_cost_list.length;
    }
  
  }
}

exports.Client = Client;
