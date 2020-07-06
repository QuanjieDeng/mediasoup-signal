
const events = require('events');
const Client = require('./client').Client;
const throttle = require('@sitespeed.io/throttle');
const config =  require('../../../licode_config');
const { cli } = require('winston/lib/winston/config');
const { threadId } = require('worker_threads');
const { use } = require('chai');
const { useFakeTimers } = require('sinon');
const { Logger } = require('log4js/lib/logger');
const logger = require('./../../common/logger').logger;

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

  async createClient(clientid) {
    const room =  this;
    const client = await Client.create({ room , clientid });
    client.on('disconnect', this.onClientDisconnected.bind(this));
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
		log.info(`message: createConsumer consumerPeer:${consumerPeer.getid()} producerPeer:${producerPeer.getid()} producer:${producer.id}`);
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
			log.error(`user not find:${userid}`);
            callback('callback',{retEvent:"error",data: {errmsg:"user not find", errcode:1003}});
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
				});

				transport.on('dtlsstatechange', (dtlsState) =>
				{
				if (dtlsState === 'failed' || dtlsState === 'closed'){
					log.warn('WebRtcTransport "dtlsstatechange" event [dtlsState:%s]', dtlsState);
				}
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
				if (user.joined)
				throw new Error('Peer already joined');
				
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

					if (!transport)
						throw new Error(`transport with id "${transportId}" not found`);

					await transport.connect({ dtlsParameters });

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'restartIce':
				{
					log.info(`message user:${userid} req restartIce`);
					const { transportId } =  message;
					const transport =   user._transports.get(transportId);
	
					if (!transport)
						throw new Error(`transport with id "${transportId}" not found`);
	
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
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { transportId, kind, rtpParameters } =  message;
					let { appData } = message;
					const transport =  user._transports.get(transportId);

					if (!transport)
						throw new Error(`transport with id "${transportId}" not found`);

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

						this._createConsumer(
							{
								consumerPeer : joinedPeer,
								producerPeer : user,
								producer
							});
			
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
					log.info(`message user:${userid} req closeProducer`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { producerId } =   message;
					const producer = user._producers.get(producerId);

					if (!producer)
						throw new Error(`producer with id "${producerId}" not found`);

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
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { producerId } =   message;
					const producer = user._producers.get(producerId);

					if (!producer)
						throw new Error(`producer with id "${producerId}" not found`);

					await producer.pause();

					callback('callback',{retEvent:"success",data: {data:{}}});
					break;
				}
			case 'resumeProducer':
				{
					log.info(`message user:${userid} req resumeProducer`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { producerId } =  message;
					const producer = user._producers.get(producerId);

					if (!producer)
						throw new Error(`producer with id "${producerId}" not found`);

					await producer.resume();

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'pauseConsumer':
				{
					log.info(`message user:${userid} req pauseConsumer`);
					// Ensure the Peer is joined.
					if (!user._joined)
						throw new Error('Peer not yet joined');
	
					const { consumerId } =   message;
					const consumer =   user._consumers.get(consumerId);
	
					if (!consumer)
						throw new Error(`consumer with id "${consumerId}" not found`);
	
					await consumer.pause();
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
	
			case 'resumeConsumer':
				{
					log.info(`message user:${userid} req resumeConsumer`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { consumerId } =   message;
					const consumer =   user._consumers.get(consumerId);

					if (!consumer)
						throw new Error(`consumer with id "${consumerId}" not found`);

					await consumer.resume();

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'setConsumerPreferredLayers':
				{
					log.info(`message user:${userid} req setConsumerPreferredLayers`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');
	
					const { consumerId, spatialLayer, temporalLayer } =  message;
					const consumer =  user._consumers.get(consumerId);
	
					if (!consumer)
						throw new Error(`consumer with id "${consumerId}" not found`);
	
					await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
	
			case 'setConsumerPriority':
				{
					log.info(`message user:${userid} req setConsumerPriority`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');

					const { consumerId, priority } =  message;
					const consumer = user._consumers.get(consumerId);

					if (!consumer)
						throw new Error(`consumer with id "${consumerId}" not found`);

					await consumer.setPriority(priority);

					callback('callback',{retEvent:"success",data: {data:{}}});

					break;
				}
			case 'requestConsumerKeyFrame':
				{
					log.info(`message user:${userid} req requestConsumerKeyFrame`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');
	
					const { consumerId } =  message;
					const consumer = user._consumers.get(consumerId);
	
					if (!consumer)
						throw new Error(`consumer with id "${consumerId}" not found`);
	
					await consumer.requestKeyFrame();
	
					callback('callback',{retEvent:"success",data: {data:{}}});
	
					break;
				}
			case 'produceData':
				{
					log.info(`message user:${userid} req produceData`);
					// Ensure the Peer is joined.
					if (!user.joined)
						throw new Error('Peer not yet joined');
	
					const {
						transportId,
						sctpStreamParameters,
						label,
						protocol,
						appData
					} = message;
	
					const transport = user._transports.get(transportId);
	
					if (!transport)
						throw new Error(`transport with id "${transportId}" not found`);
	
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
					log.info(`message user:${userid} req getTransportStats`);
					const { transportId } = message;
					const transport =user._transports.get(transportId);
	
					if (!transport)
						throw new Error(`transport with id "${transportId}" not found`);
	
					const stats = await transport.getStats();
	
					var  resp = {
						data:stats
					}
					callback('callback',{retEvent:"success",data:resp});
	
	
					break;
				}
	
			case 'getProducerStats':
			{
				log.info(`message user:${userid} req getProducerStats`);
				const { producerId } =   message;
				const producer = user._producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				const stats = await producer.getStats();

				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});

				break;
			}
			case 'getConsumerStats':
			{
				log.info(`message user:${userid} req getConsumerStats`);
				const { consumerId } =   message;
				const consumer =  user._consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				const stats = await consumer.getStats();
				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});

				break;
			}
			case 'getDataProducerStats':
			{
				log.info(`message user:${userid} req getDataProducerStats`);
				const { dataProducerId } =   message;
				const dataProducer =   user._dataProducers.get(dataProducerId);

				if (!dataProducer)
					throw new Error(`dataProducer with id "${dataProducerId}" not found`);

				const stats = await dataProducer.getStats();
				var  resp = {
					data:stats
				}
				callback('callback',{retEvent:"success",data:resp});
				break;
			}

			case 'getDataConsumerStats':
			{
				log.info(`message user:${userid} req getDataConsumerStats`);
				const { dataConsumerId }  =  message;
				const dataConsumer = user._dataConsumers.get(dataConsumerId);

				if (!dataConsumer)
					throw new Error(`dataConsumer with id "${dataConsumerId}" not found`);

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

}



exports.Room = Room;
