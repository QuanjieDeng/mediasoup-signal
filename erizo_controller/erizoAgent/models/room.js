
const events = require('events');
const Client = require('./client').Client;
const throttle = require('@sitespeed.io/throttle');
const config =  require('../../../licode_config');
const { cli } = require('winston/lib/winston/config');
const { threadId } = require('worker_threads');
const { use } = require('chai');
const { useFakeTimers } = require('sinon');
const { Logger } = require('log4js/lib/logger');
const { resolve, join } = require('path');
const { PersonalizeRuntime } = require('aws-sdk');
const logger = require('./../../common/logger').logger;
const erizoAgent =  require('./../erizoAgent');

const log = logger.getLogger('Room');

class Room extends events.EventEmitter {
  constructor({roomid,erizoControllerid, amqper,mediasoupRouter,audioLevelObserver}) {
    super();
    this.clients = new Map();
    this.id = roomid;
    this.erizoControllerId = erizoControllerid;
    this.amqper = amqper;
    this._mediasoupRouter = mediasoupRouter;
    this._audioLevelObserver = audioLevelObserver;
	this._networkThrottled = false;
	/*
	存储该该房间的关联piptransport  key:对端routerID  v:pipetransport对
	*/
	this._mapRouterPipeTransports =  new Map();
	/*
	存储该房间所有的PipeTransport
	*/
	this._mapPipeTransports =  new Map();

	/*
	存储房间内的 piptransport.produce
	*/
	this._mapPipeProduces =  new Map();
		/*
	存储房间内的 piptransport.consume
	*/
	this._mapPipeConsumes =  new Map();

	// Handle audioLevelObserver.
	this._handleAudioLevelObserver();
	global.audioLevelObserver = this._audioLevelObserver;

	log.info(`Room构造函数 erizoControllerId:${this.erizoControllerId} id:${this.id}`);
	
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
  close(){
	this._audioLevelObserver.close();
    this._mediasoupRouter.close();
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

  async createClient(clientid,clientname) {
    const room =  this;
    const client = await Client.create({ room , clientid,clientname });
    client.on('disconnect', this.onClientDisconnected.bind(this));
    this.clients.set(client.id, client);
    return client;
  }

  async getOrCreateClient(clientid,clientname){
      const  client =  this.getClientById(clientid);
      if(client){
          return client;
      }
      return await this.createClient(clientid,clientname);
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
      this.close();
      this.emit('room-empty');
    }
  }

  async   sendMsgToClient(clientId,methed,msg,callback)
  {
    const args = [clientId,msg,methed];
	var   ec_id = `erizoController_${this.erizoControllerId}`;
	log.debug(`sendMsgToClient-ec_id:${ec_id} clientId:${clientId} methed:${methed} msg:${msg}`);
	
    await this.amqper.callRpc(ec_id, 'forwordSingleMsgToClient', args, { callback(resp) {
		log.debug(`sendMsgToClient clientId:${clientId} rpccallback: resp:${JSON.stringify(resp)} methed:${methed} clientid:${clientId}`);
		if (resp === 'timeout') {
			callback("error",{data:{}});
		} else {
		  const event = resp.event;
		  const msg = resp.msg;
		  callback(event,msg);
		}
	  } });
  }

  async   sendNotifyMsgToClient(clientId,methed,msg)
  {
	log.debug(`sendNotifyMsgToClient  methed:${methed} clientid:${clientId} msg:${JSON.stringify(msg)}`);
    const args = [clientId,msg,methed];
	var   ec_id = `erizoController_${this.erizoControllerId}`;
	log.debug(`sendMsgToClient-ec_id:${ec_id} clientId:${clientId} methed:${methed} msg:${msg}`);
	
    this.amqper.callRpc(ec_id, 'forwordSingleMsgToClient', args,{callback(resp){
		//nothing to do
	}});
  }

  async   sendNotifyMsgToRoom(methed,msg)
  {
	log.debug(`sendNotifyMsgToRoom  methed:${methed} msg:${JSON.stringify(msg)}`);
	var   ec_id = `erizoController_${this.erizoControllerId}`;
	log.debug(`sendNotifyMsgToRoom-ec_id:${ec_id} methed:${methed} msg:${msg}`);

	var  sendmsg = {
		data:msg
	  }
    this.forEachClient((joinedPeer)=>{
		if(!joinedPeer.joined)
		  return;
		const args = [joinedPeer.id,sendmsg,methed];
		this.amqper.callRpc(ec_id, 'forwordSingleMsgToClient', args,{callback(resp){
			//nothing to do
		}});
	  });
  
	

  }



  _handleAudioLevelObserver()
  {
	  this._audioLevelObserver.on('volumes', (volumes) =>
	  {
		  const { producer, volume } = volumes[0];

		  log.debug(
		  	'audioLevelObserver "volumes" event [producerId:%s, volume:%s]',
		  	producer.id, volume);

		  // Notify all Peers.
		  this.forEachClient((joinedPeer)=>{
			if(!joinedPeer.joined)
				return;
			joinedPeer.notify('activeSpeaker',{peerId : producer.appData.peerId,volume : volume}).catch(() => {});

		   });
	  });

	  this._audioLevelObserver.on('silence', () =>
	  {
		  log.debug('audioLevelObserver "silence" event');

		  // Notify all Peers.

		  this.forEachClient((joinedPeer)=>{
			if(!joinedPeer.joined)
				return;
			joinedPeer.notify('activeSpeaker',{peerId : null }).catch(() => {});

		   });
	  });
  }

	async _createDataConsumer(
		{
			dataConsumerPeer,
			dataProducerPeer = null, // This is null for the bot DataProducer.
			dataProducer
		})
	{
		// NOTE: Don't create the DataConsumer if the remote Peer cannot consume it.
		if (!dataConsumerPeer.sctpCapabilities)
			return;

		// Must take the Transport the remote Peer is using for consuming.
		const transport = Array.from(dataConsumerPeer._transports.values())
			.find((t) => t.appData.consuming);

		// This should not happen.
		if (!transport)
		{
			log.warn('_createDataConsumer() | Transport for consuming not found');

			return;
		}

		// Create the DataConsumer.
		let dataConsumer;

		try
		{
			dataConsumer = await transport.consumeData(
				{
					dataProducerId : dataProducer.id
				});
		}
		catch (error)
		{
			log.warn('_createDataConsumer() | transport.consumeData():%o', error);

			return;
		}

		// Store the DataConsumer into the protoo dataConsumerPeer data Object.
		dataConsumerPeer._dataConsumers.set(dataConsumer.id, dataConsumer);

		// Set DataConsumer events.
		dataConsumer.on('transportclose', () =>
		{
			// Remove from its map.
			dataConsumerPeer._dataConsumers.delete(dataConsumer.id);
		});

		dataConsumer.on('dataproducerclose', () =>
		{
			// Remove from its map.
			dataConsumerPeer._dataConsumers.delete(dataConsumer.id);

			dataConsumerPeer.notify(
				'dataConsumerClosed', { dataConsumerId: dataConsumer.id })
				.catch(() => {});
		});

		// Send a protoo request to the remote Peer with Consumer parameters.
		try
		{
			await dataConsumerPeer.request(
				'newDataConsumer',
				{
					// This is null for bot DataProducer.
					peerId               : dataProducerPeer ? dataProducerPeer.id : null,
					dataProducerId       : dataProducer.id,
					id                   : dataConsumer.id,
					sctpStreamParameters : dataConsumer.sctpStreamParameters,
					label                : dataConsumer.label,
					protocol             : dataConsumer.protocol,
					appData              : dataProducer.appData
				},function(ret,msd){});
		}
		catch (error)
		{
			log.warn('_createDataConsumer() | failed:%o', error);
		}
	}
	



	async _createConsumer({ consumerPeer, producerPeer, producer })
	{
		log.info(`message: createConsumer consumerPeer:${consumerPeer.getid()} producerPeer:${producerPeer.getid()} producer:${producer.id} kind:${producer.kind}`);
		// Optimization:
		// - Create the server-side Consumer in paused mode.
		// - Tell its Peer about it and wait for its response.
		// - Upon receipt of the response, resume the server-side Consumer.
		// - If video, this will mean a single key frame requested by the
		//   server-side Consumer (when resuming it).
		// - If audio (or video), it will avoid that RTP packets are received by the
		//   remote endpoint *before* the Consumer is locally created in the endpoint
		//   (and before the local SDP O/A procedure ends). If that happens (RTP
		//   packets are received before the SDP O/A is done) the PeerConnection may
		//   fail to associate the RTP stream.

		// NOTE: Don't create the Consumer if the remote Peer cannot consume it.
		if (
			!consumerPeer.rtpCapabilities ||
			!this._mediasoupRouter.canConsume(
				{
					producerId      : producer.id,
					rtpCapabilities : consumerPeer.rtpCapabilities
				})
		)
		{
			log.debug(`message: createConsumer consumerPeer:${consumerPeer.getid()} producerPeer:${producerPeer.getid()} producer:${producer.id} can't comsume it`);
			return;
		}

		// Must take the Transport the remote Peer is using for consuming.
		const transport = Array.from(consumerPeer._transports.values())
			.find((t) => t.appData.consuming);

		// This should not happen.
		if (!transport)
		{
			log.warn('_createConsumer() | Transport for consuming not found');

			return;
		}

		// Create the Consumer in paused mode.
		let consumer;

		try
		{
			consumer = await transport.consume(
				{
					producerId      : producer.id,
					rtpCapabilities : consumerPeer.rtpCapabilities,
					paused          : true
				});
		}
		catch (error)
		{
			log.warn('_createConsumer() | transport.consume():%o', error);

			return;
		}

		// Store the Consumer into the protoo consumerPeer data Object.
		consumerPeer._consumers.set(consumer.id, consumer);

		// Set Consumer events.
		consumer.on('transportclose', () =>
		{
			// Remove from its map.
			consumerPeer._consumers.delete(consumer.id);
		});

		consumer.on('producerclose', () =>
		{
			// Remove from its map.
			consumerPeer._consumers.delete(consumer.id);

			consumerPeer.notify('consumerClosed', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('producerpause', () =>
		{
			consumerPeer.notify('consumerPaused', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('producerresume', () =>
		{
			consumerPeer.notify('consumerResumed', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('score', (score) =>
		{
			consumerPeer.notify('consumerScore', { consumerId: consumer.id, score })
				.catch(() => {});
		});

		consumer.on('layerschange', (layers) =>
		{
			consumerPeer.notify(
				'consumerLayersChanged',
				{
					consumerId    : consumer.id,
					spatialLayer  : layers ? layers.spatialLayer : null,
					temporalLayer : layers ? layers.temporalLayer : null
				})
				.catch(() => {});
		});

		// NOTE: For testing.
		// await consumer.enableTraceEvent([ 'rtp', 'keyframe', 'nack', 'pli', 'fir' ]);
		// await consumer.enableTraceEvent([ 'pli', 'fir' ]);
		// await consumer.enableTraceEvent([ 'keyframe' ]);

		consumer.on('trace', (trace) =>
		{
			log.debug(
				'consumer "trace" event [producerId:%s, trace.type:%s, trace:%o]',
				consumer.id, trace.type, trace);
		});

		// Send a request to the remote Peer with Consumer parameters.
		try
		{
			await consumerPeer.request(
				'newConsumer',
				{
					peerId         : producerPeer.id,
					producerId     : producer.id,
					id             : consumer.id,
					kind           : consumer.kind,
					rtpParameters  : consumer.rtpParameters,
					type           : consumer.type,
					appData        : producer.appData,
					producerPaused : consumer.producerPaused
				},async (ret,msg)=>{
					if(ret == "success"){
						log.info(`messages clientid:${consumerPeer.getid()} resume consumer:${consumer.id}`);
						await consumer.resume();
						consumerPeer.notify(
							'consumerScore',
							{
								consumerId : consumer.id,
								score      : consumer.score
							})
							.catch(() => {});
					}
				});

			// Now that we got the positive response from the remote endpoint, resume
			// the Consumer so the remote endpoint will receive the a first RTP packet
			// of this new stream once its PeerConnection is already ready to process
			// and associate it.
		}
		catch (error)
		{
			log.warn('_createConsumer() | failed:%o', error);
		}
	}




  async handleUserRequest(userid,clientname,methed,message,callback){
	  var  block_meth = [
		"getTransportStats",
		"getProducerStats",
		"getConsumerStats",
		"getDataProducerStats",
		"getDataConsumerStats",
		"applyNetworkThrottle",
		"resetNetworkThrottle"
	  ];
	  var index =  block_meth.indexOf(methed);
	  if(index >= 0 ){

	  }else{
		log.debug(`messages: room-handleUserRequest:userid:${userid} clientname:${clientname} methed:${methed}`);
	  }
      
      if(methed  =="getRouterRtpCapabilities"){//在第一个消息来到时创建client
	   const user = await this.getOrCreateClient(userid,clientname);
	   user.eaid = erizoAgent.getAgentId(); //设置所属的EA
       log.debug(`create success client:${user.getid()}`);
       var  resp = {
            data:this._mediasoupRouter.rtpCapabilities
        }
        callback('callback',{retEvent:"success",data: resp });
      }else{
        const user =   this.getClientById(userid);
        if(!user){
			log.error(`user not find:${userid}`);
            callback('callback',{retEvent:"error",data: {errmsg:"user not find", errcode:2002}});
            return;
        }

        switch (methed)
        {
          case 'createWebRtcTransport':
			{
				log.info(`messages: user:${userid} req create webrtctransport`);
				const {
				forceTcp,
				producing,
				consuming,
				sctpCapabilities
				} = message;
				const webRtcTransportOptions =
				{
				...config.mediasoup.webRtcTransportOptions,
				enableSctp     : Boolean(sctpCapabilities),
				numSctpStreams : (sctpCapabilities || {}).numStreams,
				appData        : { producing, consuming }
				};
						
				if (forceTcp)
				{
				webRtcTransportOptions.enableUdp = false;
				webRtcTransportOptions.enableTcp = true;
				}
						
				const transport = await this._mediasoupRouter.createWebRtcTransport(webRtcTransportOptions);
				transport.on('sctpstatechange', (sctpState) =>
				{
					log.debug('WebRtcTransport "sctpstatechange" event [sctpState:%s]', sctpState);
					this.emit('transport_event',"sctpstatechange",sctpState);
				});

				transport.on('dtlsstatechange', (dtlsState) =>
				{
					if (dtlsState === 'failed' || dtlsState === 'closed'){
						log.warn('WebRtcTransport "dtlsstatechange" event [dtlsState:%s]', dtlsState);
					}
					this.emit('transport_event',"dtlsstatechange",dtlsState);
				});
				transport.on('icestatechange', (iceState) =>
				{
					log.debug('WebRtcTransport "icestatechange" event [iceState:%s]', iceState);
					this.emit('transport_event',"icestatechange",iceState);
				});
						
				// await transport.enableTraceEvent([ 'bwe' ]);
				// transport.on('trace', (trace) =>
				// {
				// 	logger.debug(
				// 		'transport "trace" event [transportId:%s, trace.type:%s, trace:%o]',
				// 		transport.id, trace.type, trace);

				// 	if (trace.type === 'bwe' && trace.direction === 'out')
				// 	{
				// 		peer.notify(
				// 			'downlinkBwe',
				// 			{
				// 				desiredBitrate          : trace.info.desiredBitrate,
				// 				effectiveDesiredBitrate : trace.info.effectiveDesiredBitrate,
				// 				availableBitrate        : trace.info.availableBitrate
				// 			})
				// 			.catch(() => {});
				// 	}
				// });
				//store transport to client     object
				user.addTransport(transport.id,transport);
				
				var  res_createwebrtctransport = {
				data:{
					id             : transport.id,
					iceParameters  : transport.iceParameters,
					iceCandidates  : transport.iceCandidates,
					dtlsParameters : transport.dtlsParameters,
					sctpParameters : transport.sctpParameters
				}
				}
				callback('callback',{retEvent:"success",data: res_createwebrtctransport });
				const { maxIncomingBitrate } = config.mediasoup.webRtcTransportOptions;
				if (maxIncomingBitrate)
				{
				try { await transport.setMaxIncomingBitrate(maxIncomingBitrate); }
				catch (error) {}
				}
						
				break;
			}
          case 'join':
			{
				log.info(`message: user:${userid} req  join room`);
				if (user.joined){
					log.error(`messages:  user:${userid} joined yet!`);
					callback('callback',{retEvent:"error",data: {errmsg:"user joined", errcode:2003}});
					return;
				}
				
				const {
				displayName,
				device,
				rtpCapabilities,
				sctpCapabilities
				} = message;
				user.joined =  true;
				user.rtpCapabilities = rtpCapabilities;
				user.sctpCapabilities = sctpCapabilities;
				callback('callback',{retEvent:"success",data: {data:{}} });
				log.info(`message: user:${userid}   joined:${user.joined}`);

				//对房间内的所有的producer，为该用户创建consume
				this.forEachClient((joinedPeer)=>{
					if(!joinedPeer.joined)
						return;
					//音视频
					for(const producer of joinedPeer._producers.values())
					{
						this._createConsumer(
						{
							consumerPeer : user,
							producerPeer : joinedPeer,
							producer
						});
					}
					//文字消息
					for (const dataProducer of joinedPeer._dataProducers.values())
					{
						this._createDataConsumer(
						{
							dataConsumerPeer : user,
							dataProducerPeer : joinedPeer,
							dataProducer
						});
					}
		
				});

				break;
			}
		    case 'connectWebRtcTransport':
				{
					log.info(`message user:${userid} req connectWebRtcTransport`);
					const { transportId, dtlsParameters } = message;
					const transport = user._transports.get(transportId);

					if (!transport){
						log.error(`message: transport with id "${transportId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find transport", errcode:2003}});
						return;
					}

					await transport.connect({ dtlsParameters });

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'restartIce':
				{
					log.info(`message user:${userid} req restartIce`);
					const { transportId } =  message;
					const transport =   user._transports.get(transportId);
	
					if (!transport){
						log.error(`message: transport with id "${transportId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find transport", errcode:2003}});
						return;
					}
	
					const iceParameters = await transport.restartIce();
	
					var  res = {
						data:iceParameters
					}
					callback('callback',{retEvent:"success",data: res});
					break;
				}
		    case 'produce':
			  	{
					log.info(`message user:${userid} req produce`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { transportId, kind, rtpParameters } =  message;
					let { appData } = message;
					const transport =  user._transports.get(transportId);

					if (!transport){
						log.error(`message: transport with id "${transportId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find transport", errcode:2004}});
						return;
					}

					// Add peerId into appData to later get the associated Peer during
					// the 'loudest' event of the audioLevelObserver.
					appData = { ...appData, peerId: user.getid() };

					const producer = await transport.produce(
						{
							kind,
							rtpParameters,
							appData
							// keyFrameRequestDelay: 5000
						});

					// Store the Producer into the protoo Peer data Object.
					user._producers.set(producer.id, producer);

					// Set Producer events.
					producer.on('score', (score) =>
					{
						user.notify('producerScore', { producerId: producer.id, score })
							.catch(() => {});
					});

					producer.on('videoorientationchange', (videoOrientation) =>
					{
						log.debug(
							'producer "videoorientationchange" event [producerId:%s, videoOrientation:%o]',
							producer.id, videoOrientation);
					});

					var  res = {
						data:{
							id: producer.id
						}
					}
					callback('callback',{retEvent:"success",data: res});

					// Optimization: Create a server-side Consumer for each Peer.
					this.forEachClient((joinedPeer)=>{
						if(!joinedPeer.joined)
							return;
						if(joinedPeer.getid()== user.getid()){
							return;
						}
						if(joinedPeer.eaid  != erizoAgent.getAgentId()){
							log.debug(`message:user:${joinedPeer.id} not  our local user!`);
							return;
						}
						this._createConsumer(
							{
								consumerPeer : joinedPeer,
								producerPeer : user,
								producer
							});
			
					});
					
					//创建pipeConsume
					this._mapRouterPipeTransports.forEach(async (v,k)=>{
						const  piptransportpair =   v;
						const  local  =  piptransportpair[0];
						const  remote  =  piptransportpair[1];
						log.info(`message: 用户创建produce，为级联SFU创建consume remote_eaid:${remote.eaid}`);
						const  consumes  = await this._createPipeConsumer(user,producer,local,remote.eaid);
						//调用remote所属EA，创建本地produce
						var remoteea = `ErizoAgent_${remote.eaid}`;

						this.amqper.callRpc(remoteea, 'createPipTransportProduce',  [this.id,remote.id,consumes], { callback(resp){
							log.info(`createPipTransportProduce rpccallback:${JSON.stringify(resp)}`);
							if(resp == "timeout"){
								log.error(`message: createPipTransportProduce rpc call timeout`);
								return;
							}
						} });


					});
					// Add into the audioLevelObserver.
					if (producer.kind === 'audio')
					{
						this._audioLevelObserver.addProducer({ producerId: producer.id })
							.catch(() => {});
					}

					break;
			   }
			case 'closeProducer':
				{
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: closeProducer  Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { producerId } =   message;
					const producer = user._producers.get(producerId);
					log.info(`message user:${userid} req closeProducer producerId:${producerId}`);
					

					if (!producer){
						log.error(`message: producerId with id "${producerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find producer", errcode:2004}});
						return;
					}

					producer.close();

					// Remove from its map.
					user._producers.delete(producer.id);

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'pauseProducer':
				{
					log.info(`message user:${userid} req pauseProducer`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { producerId } =   message;
					const producer = user._producers.get(producerId);

					if (!producer){
						log.error(`message: producer with id "${producerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find producer", errcode:2004}});
						return;
					}

					await producer.pause();

					callback('callback',{retEvent:"success",data: {data:{}}});
					break;
				}
			case 'resumeProducer':
				{
					log.info(`message user:${userid} req resumeProducer`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { producerId } =  message;
					const producer = user._producers.get(producerId);

					if (!producer){
						log.error(`message: producer with id "${producerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find producer", errcode:2004}});
						return;
					}

					await producer.resume();

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'pauseConsumer':
				{
					log.info(`message user:${userid} req pauseConsumer`);
					// Ensure the Peer is joined.
					if (!user._joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}
	
					const { consumerId } =   message;
					const consumer =   user._consumers.get(consumerId);
	
					if (!consumer){
						log.error(`message: consumer with id "${consumerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2004}});
						return;
					}
	
					await consumer.pause();
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
	
			case 'resumeConsumer':
				{
					log.info(`message user:${userid} req resumeConsumer`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { consumerId } =   message;
					const consumer =   user._consumers.get(consumerId);

					if (!consumer){
						log.error(`message: consumer with id "${consumerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2004}});
						return;
					}

					await consumer.resume();

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'setConsumerPreferredLayers':
				{
					log.info(`message user:${userid} req setConsumerPreferredLayers`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}
	
					const { consumerId, spatialLayer, temporalLayer } =  message;
					const consumer =  user._consumers.get(consumerId);
	
					if (!consumer){
						log.error(`message: consumer with id "${consumerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2004}});
						return;
					}
	
					await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
	
			case 'setConsumerPriority':
				{
					log.info(`message user:${userid} req setConsumerPriority`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}

					const { consumerId, priority } =  message;
					const consumer = user._consumers.get(consumerId);

					if (!consumer){
						log.error(`message: consumer with id "${consumerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2004}});
						return;
					}

					await consumer.setPriority(priority);

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'requestConsumerKeyFrame':
				{
					log.info(`message user:${userid} req requestConsumerKeyFrame`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}
	
					const { consumerId } =  message;
					const consumer = user._consumers.get(consumerId);
	
					if (!consumer){
						log.error(`message: consumer with id "${consumerId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2004}});
						return;
					}
	
					await consumer.requestKeyFrame();
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
			case 'produceData':
				{
					log.info(`message user:${userid} req produceData`);
					// Ensure the Peer is joined.
					if (!user.joined){
						log.error(`message: Peer not yet joined`);
						callback('callback',{retEvent:"error",data: {errmsg:"Peer not yet joined", errcode:2003}});
						return;
					}
	
					const {
						transportId,
						sctpStreamParameters,
						label,
						protocol,
						appData
					} = message;
	
					const transport = user._transports.get(transportId);
	
					if (!transport){
						log.error(`message: transport with id "${transportId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find transport", errcode:2004}});
						return;
					}
	
					const dataProducer = await transport.produceData(
						{
							sctpStreamParameters,
							label,
							protocol,
							appData
						});
	
					// Store the Producer into the protoo Peer data Object.
					user._dataProducers.set(dataProducer.id, dataProducer);
	
					var resp = {
						data:{
							id: dataProducer.id
						}

					}
					callback('callback',{retEvent:"success",data:resp});
	
					switch (dataProducer.label)
					{
						case 'chat':
						{
							// Create a server-side DataConsumer for each Peer.
							this.forEachClient((joinedPeer)=>{
								if(!joinedPeer.joined)
									return;
								if(joinedPeer.getid()== user.getid()){
									return;
								}
		
								this._createDataConsumer(
									{
										dataConsumerPeer : joinedPeer,
										dataProducerPeer : user,
										dataProducer
									});
					
							});
							break;
						}
					}
					break;
				}
			case 'getTransportStats':
				{
					log.debug(`message user:${userid} req getTransportStats`);
					const { transportId } = message;
					const transport =user._transports.get(transportId);
	
					if (!transport){
						log.error(`message: transport with id "${transportId}" not found`);
						callback('callback',{retEvent:"error",data: {errmsg:"can't find transport", errcode:2003}});
						return;
					}
	
					const stats = await transport.getStats();
	
					var  resp = {
						data:stats
					}
					callback('callback',{retEvent:"success",data:resp});
	
	
					break;
				}
	
			case 'getProducerStats':
			{
				log.debug(`message user:${userid} req getProducerStats`);
				const { producerId } =   message;
				const producer = user._producers.get(producerId);

				if (!producer){
					log.error(`message: producer with id "${producerId}" not found`);
					callback('callback',{retEvent:"error",data: {errmsg:"can't find producer", errcode:2003}});
					return;
				}

				const stats = await producer.getStats();

				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});

				break;
			}
			case 'getConsumerStats':
			{
				log.debug(`message user:${userid} req getConsumerStats`);
				const { consumerId } =   message;
				const consumer =  user._consumers.get(consumerId);

				if (!consumer){
					log.error(`message: consumer with id "${consumerId}" not found`);
					callback('callback',{retEvent:"error",data: {errmsg:"can't find consumer", errcode:2003}});
					return;
				}

				const stats = await consumer.getStats();
				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});

				break;
			}
			case 'getDataProducerStats':
			{
				log.debug(`message user:${userid} req getDataProducerStats`);
				const { dataProducerId } =   message;
				const dataProducer =   user._dataProducers.get(dataProducerId);

				if (!dataProducer){
					log.error(`message: dataProducer with id "${dataProducerId}" not found`);
					callback('callback',{retEvent:"error",data: {errmsg:"can't find dataProducer", errcode:2003}});
					return;
				}

				const stats = await dataProducer.getStats();
				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});
				break;
			}

			case 'getDataConsumerStats':
			{
				log.debug(`message user:${userid} req getDataConsumerStats`);
				const { dataConsumerId }  =  message;
				const dataConsumer = user._dataConsumers.get(dataConsumerId);

				if (!dataConsumer){
					log.error(`message: dataConsumer with id "${dataConsumerId}" not found`);
					callback('callback',{retEvent:"error",data: {errmsg:"can't find dataConsumer", errcode:2003}});
					return;
				}

				const stats = await dataConsumer.getStats();
				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});

				break;
			}
			case 'applyNetworkThrottle':
			{
				log.info(`message user:${userid} req applyNetworkThrottle`);
				const DefaultUplink = 1000000;
				const DefaultDownlink = 1000000;
				const DefaultRtt = 0;

				const { uplink, downlink, rtt, secret } =   message;

				if (!secret || secret !== process.env.NETWORK_THROTTLE_SECRET)
				{
					callback('callback',{retEvent:"error",data:{errmsg:"operation NOT allowed", errcode:1002}});
					return;
				}

				try
				{
					await throttle.start(
						{
							up   : uplink || DefaultUplink,
							down : downlink || DefaultDownlink,
							rtt  : rtt || DefaultRtt
						});

					log.warn(
						'network throttle set [uplink:%s, downlink:%s, rtt:%s]',
						uplink || DefaultUplink,
						downlink || DefaultDownlink,
						rtt || DefaultRtt);

					callback('callback',{retEvent:"success",data:{data:{}}});
				}
				catch (error)
				{
					log.error('network throttle apply failed: %o', error);
					callback('callback',{retEvent:"error",data:{errmsg:error.toString(), errcode:1002}});
				}
				break;
			}

			case 'resetNetworkThrottle':
			{
				log.info(`message user:${userid} req resetNetworkThrottle`);
				const { secret } =   message;

				if (!secret || secret !== process.env.NETWORK_THROTTLE_SECRET)
				{
					callback('callback',{retEvent:"error",data:{errmsg:"operation NOT allowed", errcode:1002}});
					return;
				}
				try
				{
					await throttle.stop({});
					log.warn('network throttle stopped');
					callback('callback',{retEvent:"success",data:{data:{}}});
				}
				catch (error)
				{
					log.error('network throttle stop failed: %o', error);
					callback('callback',{retEvent:"error",data:{errmsg:error.toString(), errcode:1002}});
				}

				break;
			}
			default:
			{
				log.error(`unknown request.method：${methed}`);
				callback('callback',{retEvent:"error",data: {errmsg:"unknown request.method", errcode:1004}});
			}
       }
            
      }
  }

  getPipeTransport(id){
	return this._mapPipeTransports.get(id);

  }
  setPipeTransport(piptransport){
	this._mapPipeTransports.set(piptransport.id,piptransport);
  }
  delPipeTransport(id){
	this._mapPipeTransports.delete(id);
  }


  setPipProduce(produce){
	this._mapPipeProduces.set(produce.id,produce);
  }
  getPipProduce(produceid){
	return this._mapPipeProduces.get(produceid);
  }

  delPipProduce(produceid){
	this._mapPipeProduces.delete(produceid);
  }

  setPipConsume(consume){
	this._mapPipeConsumes.set(consume.id,consume);
  }
  getPipConsume(consumeid){
	return this._mapPipeConsumes.get(consumeid);
  }

  delPipConsume(consumeid){
	return this._mapPipeConsumes.delete(consumeid);
  }

  /*
  处理SFU级联请求，收到该请求的room,说明在Router<---->的过程中，是作为发起端，主动发起整个串联的流程
  两个Router之间的级联过程如下
  A                       	B
  |createPipTransport     	|
  |						  	|
  |----createPipTransport-->|
  |						  	|
  |connectPipTransport		|
  |						  	|
  |----connectPipTransport->|
  |						  	|
  |createconsume			|
  |----------createproduce->|
  |						  	|
  |----------createconsume->|
  |createproduce            |
  */
  async handlePipRoute(toRouterId,agentId,callback){
		log.info(`message:handlePipRoute toRouterId:${toRouterId} agentId:${agentId}`);
		var remotePipeTransport = {
			eaid:agentId,
			id:undefined,
			ip:undefined,
			port:undefined,
			srtpParameters:undefined
		}
		var localPipeTransport ;
		log.info(`message: handlePipRoute-创建本地transport`);
		//创建本地transport
		localPipeTransport = await this._mediasoupRouter.createPipeTransport({ 
			listenIp : global.config.erizoAgent.publicIP,
			enableSctp: true,
			numSctpStreams: { OS: 1024, MIS: 1024 },
			enableRtx: false,
			enableSrtp: false
		});

		log.info(`message: handlePipRoute-创建对端transport`);
		//创建对端transport
		await new Promise((resolve)=>{
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'createPipTransport',  [this.id,toRouterId], { callback(resp){
				log.info(`createPipTransport rpccallback:${JSON.stringify(resp)}`);
				if(resp == "timeout"){
					log.error(`message: createPipTransport rpc call timeout`);
					resolve();
					return;
				}
				remotePipeTransport= resp.data;
				log.info(`message: remotePipeTransport 
					id:${remotePipeTransport.id} 
					ip:${remotePipeTransport.ip} 
					port:${remotePipeTransport.port}`);

				resolve();
			} });
		});

		log.info(`message: handlePipRoute-连接本地transport`);
		//连接本地transport
		await localPipeTransport.connect({
			ip             : remotePipeTransport.ip,
			port           : remotePipeTransport.port,
			srtpParameters : remotePipeTransport.srtpParameters
		  });
		localPipeTransport.observer.on('close', () =>
		{
			log.warn(`message: room:${this.id} `);
		});
	

		log.info(`message: handlePipRoute-连接对端transport`);		
		//连接对端transport
		var tmplocalpiptransport = {
			eaid 		   : erizoAgent.getAgentId(),
			id			   : localPipeTransport.id,
			ip             : localPipeTransport.tuple.localIp,
			port           : localPipeTransport.tuple.localPort,
			srtpParameters : localPipeTransport.srtpParameters
		};

		await new Promise((resolve)=>{

			var rpccallback=(resp)=>{
				log.info(`connectPipTransport rpccallback:${JSON.stringify(resp)}`);
				if(resp == "timeout"){
					log.error(`message: connectPipTransport rpc call timeout`);
					resolve();
					return;
				}
				this.setPipeTransport(localPipeTransport);
				this._mapRouterPipeTransports.set(toRouterId,[localPipeTransport,remotePipeTransport]);
				log.info(`message new piptransportpairs 
				remote-router:${toRouterId} 
				localpiptransport:${localPipeTransport.id} ip:${ localPipeTransport.tuple.localIp} port:${localPipeTransport.tuple.localPort}
				remotepiptransport:${remotePipeTransport.id} ip:${remotePipeTransport.ip} port:${remotePipeTransport.port} eaid:${remotePipeTransport.eaid}`);
				resolve();
			}
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'connectPipTransport',  [this.id,this._mediasoupRouter.id,remotePipeTransport.id,tmplocalpiptransport], { callback:rpccallback});
		});

		log.info(`message: handlePipRoute-创建本地consume`);		
		//创建本地的consume
		/*
		针对本地房间内的所有produce都创建对应的consume
		*/
		var pipRemteConsumes = []
		let usercount = 0
		await new Promise((resolve)=>{
			this.forEachClient(async (joinedPeer)=>{
				try{
										/*
					EAID和本机ID不相同说明不是本机的用户
					*/
					if(joinedPeer.eaid != erizoAgent.getAgentId()){
						return;
					}
					var   Peer = {
						info:joinedPeer,
						consumes:[]
					}
					let produceconut =0;
					await new Promise(async (resolve2)=>{
						for(const producer of joinedPeer._producers.values()){
							try{
								var  pipeRemoteConsumer = await localPipeTransport.consume(
									{
									  producerId : producer.id
									});
								this.setPipConsume(pipeRemoteConsumer);
								// Set Consumer events.
								this._setPipeConsumeEvents(pipeRemoteConsumer,agentId);

								var  newConsume = {
									producerid:producer.id,
									kind:pipeRemoteConsumer.kind,
									rtpParameters:pipeRemoteConsumer.rtpParameters,
									paused:pipeRemoteConsumer.producerPaused,
									appData:producer.appData
								}
				
								Peer.consumes.push(newConsume);
								
							}finally{
								produceconut += 1;
								if(produceconut === joinedPeer._producers.size){
									resolve2();
								}
							}
						}
					});

					pipRemteConsumes.push(Peer);
				}finally{
					usercount += 1;
					if(usercount === this.clients.size){
						resolve();
					}

				}
			});
		});

		log.info(`message: handlePipRoute-创建对端produce`);		
		//创建对端produce
		/*
		针对本地房间的所有的consume都在对端创建相应的consume,
		在远端，针对所有的produce为房间内用户创建consume
		*/
		await new Promise((resolve)=>{
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'createPipTransportProduce',  [this.id,remotePipeTransport.id,pipRemteConsumes], { callback(resp){
				log.info(`createPipTransportProduce rpccallback:${JSON.stringify(resp)}`);
				if(resp == "timeout"){
					log.error(`message: createPipTransportProduce rpc call timeout`);
					resolve();
					return;
				}
				resolve();
			} });
		});


		log.info(`message: handlePipRoute-创建对端consume`);		
		//创建对端consume
		/*
		针对远端的房间的所有produce都创建consume
		*/
		let  remoteConsumes;
		await new Promise((resolve)=>{
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'createPipTransportConsume',  [this.id,remotePipeTransport.id,erizoAgent.getAgentId()], { callback(resp){
				log.info(`createPipTransportConsume rpccallback:${JSON.stringify(resp)}`);
				if(resp == "timeout"){
					log.error(`message: createPipTransportConsume rpc call timeout`);
					resolve();
					return;
				}
				remoteConsumes = resp.data.consumes;
				resolve();
			} });
		});

		log.info(`message: handlePipRoute-创建本地produce remoteConsumes-size:${remoteConsumes.length}`);		
		//创建本地produce
		/*
		针对远端的所有的consume,在本地创建produce
		*/
		//遍历所有的consume创建本地的produce,确保所有的produce都创建完成再进行下一步
		var peers = [];
		let  conut = 0;
		await  new  Promise((resolve)=>{
			remoteConsumes.forEach(async (v,index,arry)=>{
				try{
					var  user = await this.getOrCreateClient(v.info.id,v.info.name);
					user.joined =  true;
					peers.push(user);
					v.consumes.forEach(async (consume,index,arry)=>{
						var  produce =  await  localPipeTransport.produce({
							id            : consume.producerid,
							kind          : consume.kind,
							rtpParameters : consume.rtpParameters,
							paused        : consume.producerPaused,
							appData       : consume.appData
						});
						this.setPipProduce(produce);
		
						user._producers.set(produce.id,produce);
					});

				}finally{
					conut +=  1;
					if(conut  === remoteConsumes.length){
						resolve();
					}

				}
			});
			resolve();
		});
		callback('callback',{retEvent:"sucess",data:{}});


		log.info(`message: handlePipRoute-本地房间创建consume`);

		//为房间内的所有用户针对所有的produce创建consume
		peers.forEach((user,index,arry)=>{
			user._producers.forEach((produce,index,arry)=>{

				this.forEachClient((joinedPeer)=>{
					if(!joinedPeer.joined)
						return;
					if(joinedPeer.eaid  != erizoAgent.getAgentId()){ //只为原本在该房间内的用户创建
						return;
					}

					this._createConsumer({
						consumerPeer: joinedPeer,
						producerPeer: user,
						producer:produce
	
					});
				});
			});
		});
		
	}

	async createPipTransport(callback){
		log.info(`message: createPipTransport room:${this.id}`);
		var  localPipeTransport;
		localPipeTransport = await this._mediasoupRouter.createPipeTransport({
			listenIp : global.config.erizoAgent.publicIP,
			enableSctp: true,
			numSctpStreams: { OS: 1024, MIS: 1024 },
			enableRtx: false,
			enableSrtp: false

		});
		this.setPipeTransport(localPipeTransport);

		localPipeTransport.observer.on('close', () =>
		{
		  log.warn(`message: room:${this.id}  piptransport:${localPipeTransport.id} closed!`);
		});
		var  resp = {
			eaid		   : erizoAgent.getAgentId(),
			id 		   	   : localPipeTransport.id,
			ip             : localPipeTransport.tuple.localIp,
			port           : localPipeTransport.tuple.localPort,
			srtpParameters : localPipeTransport.srtpParameters

		};
		
		callback('callback',{retEvent:"sucess",data:resp});
	}
	async connectPipTransport(localpipetransportid,remotepipetransport,remoterouterid,callback){
		log.info(`message: connectPipTransport 
				room:${this.id} 
				localpipetransportid:${localpipetransportid} 
				remotepipetransport:${JSON.stringify(remotepipetransport)}`);
		var  localPipeTransport = this.getPipeTransport(localpipetransportid);
		if(!localPipeTransport){
			callback('callback',{retEvent:"error",data:{}});
			return;
		}
		await localPipeTransport.connect({
			ip             : remotepipetransport.ip,
			port           : remotepipetransport.port,
			srtpParameters : remotepipetransport.srtpParameters

		});
		var pair = [localPipeTransport,remotepipetransport];

		this._mapRouterPipeTransports.set(remoterouterid,pair);
		log.info(`message new piptransportpairs 
			remote-router:${remoterouterid} 
			localpiptransport:${localPipeTransport.id}  ip:${localPipeTransport.tuple.localIp} port:${localPipeTransport.tuple.localPort} 
			remotepiptransport:${remotepipetransport.id} ip:${remotepipetransport.ip} port:${remotepipetransport.port} eaid:${remotepipetransport.eaid}`);

		callback('callback',{retEvent:"sucess",data:{}});

	}


	async createPipTransportProduce(localpipetransportid,remoteConsumes,callback){
		log.info(`message: createPipTransportProduce 
		room:${this.id} 
		localpipetransportid:${localpipetransportid}`);

		var  localPipeTransport = this.getPipeTransport(localpipetransportid);
		if(!localPipeTransport){
			log.error(`message: can't  get localpippetransport  by:${localpipetransportid}`);
			callback('callback',{retEvent:"error",data:{}});
			return;
		}

		//遍历所有的consume创建本地的produce,确保所有的produce都创建完成再进行下一步
		var peers = [];
		let  conut = 0;
		await  new  Promise((resolve)=>{
			remoteConsumes.forEach(async (v,index,arry)=>{
				try{
					const  user = await this.getOrCreateClient(v.info.id,v.info.name);
					user.joined =  true;

					peers.push(user);
					let countconsume = 0;
					await new Promise((resolve2)=>{
						v.consumes.forEach(async (consume,index,arry)=>{
							try{
								var  produce =  await  localPipeTransport.produce({
									id            : consume.producerid,
									kind          : consume.kind,
									rtpParameters : consume.rtpParameters,
									paused        : consume.producerPaused,
									appData       : consume.appData
								});
								this.setPipProduce(produce);
								user._producers.set(produce.id,produce);
							}finally{
								countconsume+=1;
								if(countconsume  === v.consumes.length){
									resolve2();
								}
							}

						});

					});


				}finally{
					conut +=  1;
					if(conut  === remoteConsumes.length){
						resolve();
					}

				}
			});
		});



		//为房间内的所有用户针对所有的produce创建consume
		peers.forEach((user,index,arry)=>{
			user._producers.forEach((produce,index,arry)=>{

				this.forEachClient((joinedPeer)=>{
					if(!joinedPeer.joined)
						return;
					if(joinedPeer.eaid  != erizoAgent.getAgentId()){//只为那些原本就在该房间的用户创建consume
						return;
					}

					this._createConsumer({
						consumerPeer: joinedPeer,
						producerPeer: user,
						producer:produce
	
					});
				});
			});
		});

		callback('callback',{retEvent:"sucess",data:{}});
	}


	async createPipTransportConsume(localpipetransportid,remoteeaid,callback){
		log.info(`message: createPipTransportConsume 
		room:${this.id} 
		localpipetransportid:${localpipetransportid}`);

		const localPipeTransport =  this.getPipeTransport(localpipetransportid);
		
		var pipRemteConsumes = []
		let usercount = 0
		await new Promise(async(resolve)=>{
			this.forEachClient(async (joinedPeer)=>{
				try{
					/*
					EAID和本机ID不相同说明不是本机的用户
					*/
					if(joinedPeer.eaid != erizoAgent.getAgentId()){
						return;
					}
					var   Peer = {
						info:joinedPeer,
						consumes:[]
					}
					let produceconut =0;
					await new Promise(async (resolve2)=>{
						for(const producer of joinedPeer._producers.values()){
							try{
								var  pipeRemoteConsumer = await localPipeTransport.consume(
									{
									  producerId : producer.id
									});
								this.setPipConsume(pipeRemoteConsumer);
								this._setPipeConsumeEvents(pipeRemoteConsumer,remoteeaid);

								var  newConsume = {
									producerid:producer.id,
									kind:pipeRemoteConsumer.kind,
									rtpParameters:pipeRemoteConsumer.rtpParameters,
									paused:pipeRemoteConsumer.producerPaused,
									appData:producer.appData
								}
				
								Peer.consumes.push(newConsume);
								
							}finally{
								produceconut += 1;
								if(produceconut === joinedPeer._producers.size){
									resolve2();
								}
							}
						}
					});

					pipRemteConsumes.push(Peer);
				}finally{
					usercount += 1;
					if(usercount === this.clients.size){
						resolve();
					}

				}
			});
		});
		var  resp = {
			consumes:pipRemteConsumes
		}
		callback('callback',{retEvent:"sucess",data:resp});
	}

	async  _createPipeConsumer(user,producer,localPipeTransport,remoteeaid){
		log.info(`message: _createPipeConsumer:user:${user.id} produce:${producer.id} remoteeaid:${remoteeaid}`);
		if(!localPipeTransport){
			log.error(`message: localPipeTransport is  null!`);
			return ;
		}
		const comsumes = [];
		const   Peer = {
			info:user,
			consumes:[]
		}
		//创建本地的consume
		var  pipeRemoteConsumer = await localPipeTransport.consume(
			{
			  producerId : producer.id
			});
		this.setPipConsume(pipeRemoteConsumer);
		//监听事件
		this._setPipeConsumeEvents(pipeRemoteConsumer,remoteeaid);
		
		var  newConsume = {
			producerid:producer.id,
			kind:pipeRemoteConsumer.kind,
			rtpParameters:pipeRemoteConsumer.rtpParameters,
			paused:pipeRemoteConsumer.producerPaused,
			appData:producer.appData
		}

		Peer.consumes.push(newConsume);
		comsumes.push(Peer);
		return comsumes;
	}

	_setPipeConsumeEvents(pipeRemoteConsumer,agentId){
		log.info(`message:_setPipeConsumeEvents pipconsume:${pipeRemoteConsumer.id} remoteAgentId:${agentId}`);

		pipeRemoteConsumer.on('transportclose', () =>
		{
			log.info(`message: PipeConsumeEvents-transportclose consumeid:${pipeRemoteConsumer.id} `);
			this.delPipeTransport(pipeRemoteConsumer.id);
		});

		pipeRemoteConsumer.on('producerclose', () =>
		{
			log.info(`message: PipeConsumeEvents-producerclose consumeid:${pipeRemoteConsumer.id} `);

			// Remove from its map.
			this.delPipConsume(pipeRemoteConsumer.id);
			//通知远端关闭对应的produce
			var remoteea = `ErizoAgent_${agentId}`;
			log.info(`remoteea:${remoteea}`);

			this.amqper.callRpc(remoteea, 'closePipProduce',  [this.id,pipeRemoteConsumer.producerId], { callback(resp){}});
		});

		pipeRemoteConsumer.on('producerpause', () =>
		{
			log.info(`message: PipeConsumeEvents-producerpause consumeid:${pipeRemoteConsumer.id} producerId:${pipeRemoteConsumer.producerId}`);
			
			//通知远端暂停对应的produce
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'pausePipProduce',  [this.id,pipeRemoteConsumer.producerId], { callback(resp){}});
		});

		pipeRemoteConsumer.on('producerresume', () =>
		{
			log.info(`message: PipeConsumeEvents-producerresume consumeid:${pipeRemoteConsumer.id} `);

			//通知远端恢复对应的produce
			var remoteea = `ErizoAgent_${agentId}`;
			this.amqper.callRpc(remoteea, 'resumePipProduce',  [this.id,pipeRemoteConsumer.producerId], { callback(resp){}});
		});
	}



	/*
	关联EA通知关闭pipproduce 关闭
	*/
	closePipProduce(localproduceid,callback){
		const  localpipproduce =   this.getPipProduce(localproduceid);
		if(!localpipproduce){
			log.error(`message:closePipProduce can't get  localpipproduce by id:${localproduceid}`);
			callback('callback',{retEvent:"error",data:{}});
			return;
		}
		localpipproduce.close();
		this.delPipProduce(localproduceid);
		callback('callback',{retEvent:"sucess",data:{}});
	}

	/*
	关联EA通知暂停pipproduce
	*/
	async pausePipProduce(localproduceid,callback){
		const  localpipproduce =   this.getPipProduce(localproduceid);
		if(!localpipproduce){
			log.error(`message:pausePipProduce can't get  localpipproduce by id:${localproduceid}`);
			callback('callback',{retEvent:"error",data:{}});
			return;
		}
		await localpipproduce.pause();
		callback('callback',{retEvent:"sucess",data:{}});
  	}
  	/*
	关联EA通知恢复pipproduce
	*/
    async resumePipProduce(localproduceid,callback){
		const  localpipproduce =   this.getPipProduce(localproduceid);
		if(!localpipproduce){
			log.error(`message:resumePipProduce can't get  localpipproduce by id:${localproduceid}`);
			callback('callback',{retEvent:"error",data:{}});
			return;
		}
		await localpipproduce.resume();
		callback('callback',{retEvent:"sucess",data:{}});
  	}

}



exports.Room = Room;
