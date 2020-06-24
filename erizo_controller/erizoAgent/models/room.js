
const events = require('events');
const Client = require('./client').Client;
const config =  require('../../../licode_config');
const { cli } = require('winston/lib/winston/config');
const { threadId } = require('worker_threads');
const logger = require('./../../common/logger').logger;

const log = logger.getLogger('ErizoAgent-Room');

class Room extends events.EventEmitter {
  constructor({id,erizoControllerId, amqper,mediasoupRouter,audioLevelObserver}) {
    super();
    this.clients = new Map();
    this.id = id;
    this.erizoControllerId = erizoControllerId;
    this.amqper = amqper;
    this._mediasoupRouter = mediasoupRouter;
    this._audioLevelObserver = audioLevelObserver;
    this._networkThrottled = false;
    global.audioLevelObserver = this._audioLevelObserver;
    log.info("Room构造函数");
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

  async   sendMsgToClient(methed,msg,callback)
  {
    const rpccallback = (result) => {
      log.info(`sendMsgToClient rpccallback:${JSON.stringify(result)}`);
      if(result  == "timeout"){
        callback("error",{data:{}});
      }else{
        callback("success",result);
      }
    };

    const args = [clientId,msg,methed];
    var   ec_id = `erizoController_${this.erizoControllerId}`;
    amqper.callRpc(ec_id, 'forwordSingleMsgToClient', args, { rpccallback });
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
			logger.warn('_createDataConsumer() | Transport for consuming not found');

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
			logger.warn('_createDataConsumer() | transport.consumeData():%o', error);

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
				});
		}
		catch (error)
		{
			logger.warn('_createDataConsumer() | failed:%o', error);
		}
	}



	async _createConsumer({ consumerPeer, producerPeer, producer })
	{
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
			logger.debug(
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
				});

			// Now that we got the positive response from the remote endpoint, resume
			// the Consumer so the remote endpoint will receive the a first RTP packet
			// of this new stream once its PeerConnection is already ready to process
			// and associate it.
			await consumer.resume();

			consumerPeer.notify(
				'consumerScore',
				{
					consumerId : consumer.id,
					score      : consumer.score
				})
				.catch(() => {});
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

            //对房间内的所有的producer，为该用户创建consume
            this.forEachClient(function(joinedPeer){
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
          default:
          {
              log.error(`unknown request.method：${method}`);
              callback('callback',{retEvent:"error",data: {errmsg:"unknown request.method", errcode:1004}});
          }
       }
            
      }
  }

}



exports.Room = Room;
