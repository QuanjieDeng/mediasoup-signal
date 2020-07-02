## 目录

[说明](#说明)

[请求类EVENT事件](#请求类event事件)

 [token--ok](#token)

 [getRouterRtpCapabilities--ok](#getRouterRtpCapabilities)

 [createWebRtcTransport--ok](#createWebRtcTransport)

 [join-ok](#join)

 [connectWebRtcTransport](#connectWebRtcTransport)

 [produce](#produce)

 [closeProducer](#closeProducer)

 [pauseProducer](#pauseProducer)

 [resumeProducer](#resumeProducer)

 [pauseConsumer](#pauseConsumer)

 [resumeConsumer](#resumeConsumer)

 [restartIce](#restartIce)

 [setConsumerPreferredLayers](#setConsumerPreferredLayers)

 [setConsumerPriority](#setConsumerPriority)

 [requestConsumerKeyFrame](#requestConsumerKeyFrame)

 [produceData](#produceData)

 [getTransportStats](#getTransportStats)

 [getProducerStats](#getProducerStats)

 [getConsumerStats](#getConsumerStats)

 [getDataProducerStats](#getDataProducerStats)

 [getDataConsumerStats](#getDataConsumerStats)

 [applyNetworkThrottle](#applyNetworkThrottle)

 [resetNetworkThrottle](#resetNetworkThrottle)

[触发类EVENT事件](#触发类EVENT事件)

 [newConsumer](#newConsumer)

 [newDataConsumer](#newDataConsumer)

 [producerScore](#producerScore)

 [newPeer](#newPeer)

 [peerClosed](#peerClosed)

 [downlinkBwe](#downlinkBwe)

 [consumerClosed](#consumerClosed)

 [consumerPaused](#consumerPaused)

 [consumerResumed](#consumerResumed)

 [consumerLayersChanged](#consumerLayersChanged)

 [consumerScore](#consumerScore)

 [dataConsumerClosed](#dataConsumerClosed)

 [activeSpeaker](#activeSpeaker)


## 说明 
- 该文档描述的是licode 使用mediasoup替换EJ后，重新定义的客户端的socket.io的接口

## 请求类EVENT事件
### token
#### 说明 
- token事件是连接建立之后第一个需要发送的事件，主要用来对客户端进行认证
#### 请求方式
- 事件名称 token
- 参数
```
{
    token: {
        tokenId: '5e5cbdbc46a1666be6da9197',
        host: '192.168.94.81:8080',
        secure: false,
        signature: 'OTQ4ZjYyYzI2YzRkYTJlNDBkMzM4ZDE5ZTFhMjg5YzU1ZWE5ZWNjYw=='
    },
    roomid: '测试房间',
    username: '小明'
}
```
#### 参数说明 
- token  为通过nuve接口获取到的token值
- roomid 房间ID

#### 返回示例
- 事件  success/error
- 参数
```
{
 "clientId":"1cb6ab1d-5531-40cb-8516-cb8bfe50bd7c",//客户端ID
 "roomId":"12123123" //房间ID
}

失败的时候的返回
{
    "errmsg":"",
    "errcode":1002
}

```

### getRouterRtpCapabilities
#### 说明
- 该方法用户请求用户所在房间的router的媒体能力
#### 请求方式
- 事件名称 getRouterRtpCapabilities
- 参数-该请求不需要任何的参数,但是结构需要保留
```
{
    "data":{}
}
```
#### 返回示例
- 事件  success/error
- 参数
```
{
    "data":{-返回router的rtp能力-}
}
```
失败的返回
```
{
    "errmsg":"",
    "errcode":1002
}
```
### createWebRtcTransport
#### 说明 
- 请求创建WebRtcTransport,该接口最终会调用medisoup的接口创建一个WebRtcTransport
一个用户最多只需要创建两个transport，一个收，一个发，对于一个房间内的多路流，mediasoup使用
一个transport进行传输，如果一个用户只收或者是只发，则只需要创建一个transport
#### 请求方式
- 事件名称   createWebRtcTransport
- 参数
```
{
     "data":{
		"forceTcp": false, //是否强制使用tcp
		"producing": true, //是否为发送类型
		"consuming": false, //是否为接受类型
		"sctpCapabilities": { //sctp能力-在客户端使用Device.sctpCapabilities获取，如果用户不希望接受文字消息，则传空
			"numStreams": {
				"OS": 1024,
				"MIS": 1024
			}
		}
	}
}
```
#### 返回示例
- 事件  success/error  
- 参数
```
//成功返回
{
	"data": {
		"id": "77b681a4-3a28-45dd-a942-58c012569430",   //WebRtcTransportId
		"iceParameters": { //ICE连接参数
			"iceLite": true,
			"password": "nc9gowz1cvdm824z4hmp1p4y9kan1bp8",
			"usernameFragment": "27k337e8fi49flne"
		},
		"iceCandidates": [  //服务器返回的ICE备选地址
			{
				"foundation": "udpcandidate",
				"ip": "192.168.94.81",
				"port": 49734,
				"priority": 1076302079,
				"protocol": "udp",
				"type": "host"
			}
		],
		"dtlsParameters": { //DTLS连接的参数
			"fingerprints": [
				{
					"algorithm": "sha-1",
					"value": "B4:F8:B0:4B:E4:24:5D:7D:E8:DB:60:9F:51:5B:7E:78:9F:10:17:B1"
				},
				{
					"algorithm": "sha-224",
					"value": "94:A4:EC:9A:C5:76:6D:1D:7E:1B:D9:B3:47:2E:C6:A7:25:25:92:4D:0B:8F:AD:C3:06:51:42:44"
				},
				{
					"algorithm": "sha-256",
					"value": "10:27:3D:4E:8C:53:14:7A:EC:18:29:4B:03:77:27:4A:11:9C:C4:96:EF:64:39:D1:DB:B1:ED:8A:52:94:6F:3B"
				},
				{
					"algorithm": "sha-384",
					"value": "5A:C7:0D:86:84:DC:1B:67:F9:E3:71:B5:14:A2:22:11:3B:36:08:69:39:5E:71:59:BF:7E:DF:84:17:29:65:C2:93:0C:EB:B8:DF:CC:01:6F:B4:AB:27:D4:1A:A9:DB:51"
				},
				{
					"algorithm": "sha-512",
					"value": "29:92:00:41:81:64:A6:89:1A:60:C8:5A:40:F5:59:2C:14:A2:A9:E3:AD:80:CE:5D:80:25:26:85:A0:A4:42:CB:E3:75:A2:B8:08:F4:AD:12:B6:34:8E:B4:32:2C:3E:DE:41:6E:C3:B2:1A:B8:98:14:46:96:27:ED:C5:FD:60:1E"
				}
			],
			"role": "auto"
		},
		"sctpParameters": {   //SCTP参数
			"MIS": 1024,
			"OS": 1024,
			"isDataChannel": true,
			"maxMessageSize": 262144,
			"port": 5000
		}
	}
}
//失败返回
{
    "errmsg":"",
    "errcode":1002
}

```
### join
#### 说明 
- join请求，表明用户请求加入到房间
- 客户端需要保证在WebRtcTransport创建完毕之后在调用此方法，调用此方法表明客户端已经做好了拉流的准备
- 发送join之后，服务器会为该用户对房间内的produce创建comsumer,并通知该用户，也就说如果一个用户发送了join之后，并且rtpCapabilities不为空，则默认就开启了拉流，这部分工作服务器直接做掉

#### 请求方式
- 事件 join
- 参数
```
{
    "data":{
        "displayName": "Chespin",  //用户在房间的显示名
        "device": {         //用户的设备信息
                "flag": "chrome",
                "name": "Chrome",
                "version": "79.0.3945.117"
            },
        "rtpCapabilities": {}, //用户的rtp能力,如果用户不希望拉流，则值为空
        "sctpCapabilities": {  //用户的sctp能力，如果用户不希望接受文字消息，则值传空
            "numStreams": {
                "OS": 1024,
                "MIS": 1024
            }
        }
    }
}
```

#### 返回示例
- 事件  success/error  
- 参数
```
//成功返回
{
    "data":{
        "peers":[ //成功返回时，会返回房间内的其他的成员列表
                {
                "id":"5j0pydzb",
                "displayName":"Chespin",
                "device":{
                    "flag":"chrome","name":"Chrome","version":"79.0.3945.117"
                    }
                }
                ]
    }
}

//失败返回
{
    "errmsg":"",
    "errcode":1002
}

```
### connectWebRtcTransport
#### 说明
- 客户端需要等待本地的transport抛出事件connect后才可以调用该接口
- 调用该接口后，双方开启dtls握手过程
#### 请求方式
- 事件 connectWebRtcTransport
- 参数
```
{
    "data": {
		"transportId": "8e5bbca5-9578-4a34-99a9-7f6b476b49ea", //要操作的transportId
		"dtlsParameters": { //dtls参数，由客户端的transport.connect事件抛出
			"role": "client",//服务器的dtls角色   
			"fingerprints": [  //协商的加密参数
				{
					"algorithm": "sha-256",
					"value": "CC:06:61:AA:DC:E1:87:57:80:95:CE:9E:61:5D:8B:3F:7C:A3:2E:C8:01:4A:4F:C4:E3:F6:42:92:1A:79:FC:B8"
				}
			]
		}
	}
}
```

#### 返回示例
- 事件 success/error  
- 参数
```
//成功返回
{
    "data":{}
}
//失败返回
{
    "errmsg":"",
    "errcode":1002
}
```
### produce
#### 说明
- produce请求表明客户端已经做好了推流的准备,produce不等待客户端的sendTransport抛出produce事件之后才可以调用
- 客户端需要在发送join 请求后调用 sendTransport.produce,然后才会触发produce事件
- 在发送了produce之后，客户端即开始向服务器推流
```
this._sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            // eslint-disable-next-line no-shadow
                            const { id } = yield this._protoo.request('produce', {
                                transportId: this._sendTransport.id,
                                kind,
                                rtpParameters,
                                appData
                            });
                            callback({ id });
                        }
                        catch (error) {
                            errback(error);
                        }
                    }));
```

#### 请求方式 
- 事件 produce
- 参数 
```
{
	"data": {
		"transportId": "d864ab89-1d25-4e7a-844e-2577f90ad3af",  //所属的transport
		"kind": "audio",   //produce类型  由 sendTransport.produce事件抛出
		"rtpParameters": {
			"codecs": [
				{
					"mimeType": "audio/opus",
					"payloadType": 109,
					"clockRate": 48000,
					"channels": 2,
					"parameters": {
						"maxplaybackrate": 48000,
						"stereo": 1,
						"useinbandfec": 1,
						"sprop-stereo": 1,
						"usedtx": 1
					},
					"rtcpFeedback": []
				}
			],
			"headerExtensions": [
				{
					"uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
					"id": 3,
					"encrypt": false,
					"parameters": {}
				},
				{
					"uri": "urn:ietf:params:rtp-hdrext:ssrc-audio-level",
					"id": 1,
					"encrypt": false,
					"parameters": {}
				}
			],
			"encodings": [
				{
					"ssrc": 2180756716,
					"dtx": false
				}
			],
			"rtcp": {
				"cname": "{d8857706-3a0f-4d3b-9228-431931dba49f}",
				"reducedSize": true
			},
			"mid": "0"
		},
		"appData": {}
	}
}
```
### closeProducer
#### 说明
- 当麦克风或者时视频采集设备连接失败或者时被禁用，则需要发送该事件关闭对应的producer

#### 请求方式
- 事件 closeProducer
- 参数 
{
    "data":{
        "producerId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```
### pauseProducer
#### 说明
- 暂时静音或者暂时关闭视频,则需要发送该事件到服务器 


#### 请求方式
- 事件 pauseProducer
- 参数 
{
    "data":{
        "producerId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```
### resumeProducer
#### 说明
- 重新打开音频或者时视频 


#### 请求方式
- 事件 resumeProducer
- 参数 
{
    "data":{
        "producerId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### pauseConsumer
#### 说明
- 请求暂停consumer


#### 请求方式
- 事件 pauseConsumer
- 参数 
{
    "data":{
        "consumerId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### resumeConsumer
#### 说明
- 请求恢复consumer


#### 请求方式
- 事件 resumeConsumer
- 参数 
{
    "data":{
        "consumerId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### restartIce
#### 说明
- 请求重启ICE
- 服务器返回新的ICE参数后，需要调用客户端的sendTransport.restartIce({ iceParameters })


#### 请求方式
- 事件 restartIce
- 参数 
{
    "data":{
        "transportId":"ddf70094-cca2-4ae5-aced-207d467cbe17"
    }
}

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{
        "iceParameters":{} //服务器返回的新的ICE参数
    }
}
```


### setConsumerPreferredLayers
#### 说明
- 设置视频编解码的 空间/时间层  相关的知识可了解：  SVC（可适性视频编码或可分级视频编码）

#### 请求方式
- 事件 setConsumerPreferredLayers
- 参数 
```
{
    "data":{
        "consumerId":"123123",
        "spatialLayer":1,
        "temporalLayer":2

    }
}
```

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### setConsumerPriority
#### 说明
- 当有多个consumer时，设置其中的一个consumer优先级
- 当估计的输出比特率不足以满足所有视频消费者的需求时，消费者的优先级才有意义

#### 请求方式
- 事件 setConsumerPriority
- 参数 
```
{
    "data":{
        "consumerId":"123123", 
        "priority":100 //优先级  1-255

    }
}
```

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### requestConsumerKeyFrame
#### 说明
- 请求一个媒体源的关键帧

#### 请求方式
- 事件 setConsumerPriority
- 参数 
```
{
    "data":{
        "consumerId":"123123"

    }
}
```

#### 返回示例
- 事件 success  
- 参数
```
//成功返回
{
    "data":{}
}
```

### produceData
#### 说明
- 请求创建消息生产者
- 客户端通过调用 sendTransport.produceData创建生产者，当抛出事件producedata时向服务器发送该请求 

#### 请求方式 
- 事件 produceData
- 参数 
```
{
    "data": {
		"transportId": "d864ab89-1d25-4e7a-844e-2577f90ad3af",
		"sctpStreamParameters": {  //由sendTransport.producedata事件抛出
			"streamId": 0,
			"ordered": false,
			"maxRetransmits": 1
		},
		"label": "chat",
		"protocol": "",
		"appData": {
			"info": "my-chat-DataProducer"
		}
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
    "data": {
		"id": "9c375f9a-4129-4343-b297-7735e4136153"  //DataProduceId
	}
}
```
### getTransportStats
#### 说明
- 请求Transport状态

#### 请求方式 
- 事件 getTransportStats
- 参数 
```
{
    "data": {
		"transportId": "d864ab89-1d25-4e7a-844e-2577f90ad3af"
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
	"data": [
		{
			"bytesReceived": 10013,
			"bytesSent": 1668,
			"dtlsState": "connected",
			"iceRole": "controlled",
			"iceSelectedTuple": {
				"localIp": "192.168.94.81",
				"localPort": 49734,
				"protocol": "udp",
				"remoteIp": "192.168.94.199",
				"remotePort": 53077
			},
			"iceState": "completed",
			"maxIncomingBitrate": 1500000,
			"probationBytesSent": 0,
			"probationSendBitrate": 0,
			"recvBitrate": 80104,
			"rtpBytesReceived": 8268,
			"rtpBytesSent": 0,
			"rtpRecvBitrate": 26458,
			"rtpSendBitrate": 0,
			"rtxBytesReceived": 0,
			"rtxBytesSent": 0,
			"rtxRecvBitrate": 0,
			"rtxSendBitrate": 0,
			"sctpState": "connected",
			"sendBitrate": 13344,
			"timestamp": 716862405,
			"transportId": "77b681a4-3a28-45dd-a942-58c012569430",
			"type": "webrtc-transport"
		}
	]
}
```

### getProducerStats
#### 说明
- 请求生产者状态

#### 请求方式 
- 事件 getProducerStats
- 参数 
```
{
    "data": {
		"producerId": "d864ab89-1d25-4e7a-844e-2577f90ad3af"
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
	"data": [
		{
			"bitrate": 26256,
			"byteCount": 8205,
			"firCount": 0,
			"fractionLost": 0,
			"jitter": 4387853,
			"kind": "audio",
			"mimeType": "audio/opus",
			"nackCount": 0,
			"nackPacketCount": 0,
			"packetCount": 37,
			"packetsDiscarded": 0,
			"packetsLost": 0,
			"packetsRepaired": 0,
			"packetsRetransmitted": 0,
			"pliCount": 0,
			"score": 10,
			"ssrc": 204982130,
			"timestamp": 716862412,
			"type": "inbound-rtp"
		}
	]
}
```

### getConsumerStats
#### 说明
- 请求消费者状态

#### 请求方式 
- 事件 getConsumerStats
- 参数 
```
{
    "data": {
		"consumerId": "d864ab89-1d25-4e7a-844e-2577f90ad3af"
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
	"data": [
		{
			"bitrate": 26256,
			"byteCount": 8205,
			"firCount": 0,
			"fractionLost": 0,
			"jitter": 4387853,
			"kind": "audio",
			"mimeType": "audio/opus",
			"nackCount": 0,
			"nackPacketCount": 0,
			"packetCount": 37,
			"packetsDiscarded": 0,
			"packetsLost": 0,
			"packetsRepaired": 0,
			"packetsRetransmitted": 0,
			"pliCount": 0,
			"score": 10,
			"ssrc": 204982130,
			"timestamp": 716862412,
			"type": "inbound-rtp"
		}
	]
}
```
### getDataProducerStats
#### 说明
- 请求消息生产者状态

#### 请求方式 
- 事件 getDataProducerStats
- 参数 
```
{
    "data": {
		"dataProducerId": "d864ab89-1d25-4e7a-844e-2577f90ad3af"
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
	"data": [
		{
			"bytesReceived": 0,
			"label": "chat",
			"messagesReceived": 0,
			"protocol": "",
			"timestamp": 716862416,
			"type": "data-producer"
		}
	]
}
```
### getDataConsumerStats
#### 说明
- 请求消息消费者状态

#### 请求方式 
- 事件 getDataConsumerStats
- 参数 
```
{
    "data": {
		"dataConsumerId": "d864ab89-1d25-4e7a-844e-2577f90ad3af"
	}
}

```
#### 返回示例
- 事件 success
- 参数 
```
{
	"data": [
		{
			"bytesSent": 0,
			"label": "bot",
			"messagesSent": 0,
			"protocol": "",
			"timestamp": 716862420,
			"type": "data-consumer"
		}
	]
}
```
### applyNetworkThrottle
#### 说明
- 请求应用网络带宽控制
### resetNetworkThrottle
#### 说明
- 请求重置网络带宽控制

## 触发类EVENT事件

### newConsumer
#### 说明
- 通知新的消费者，服务器已经创建好，当前处于暂停状态，当客户端正确回复，则运行该comsumer
- 客户端根据自身的需求判断是否要创建本地的consume
- 客户端必须根据自身的情况进行回复

#### 处理方式 
- 事件名称 newConsumer
- 参数 
```
{
	"data": {
		"peerId": "5j0pydzb",   //produce用户ID
		"producerId": "ddf70094-cca2-4ae5-aced-207d467cbe17",   //对应的produce
		"id": "b2e20965-60c1-4966-9dba-4470e27864ad",   //consumerID
		"kind": "audio",   //consumer类型
		"rtpParameters": {   //producer的rtp能力
			"codecs": [
				{
					"mimeType": "audio/opus",
					"payloadType": 100,
					"clockRate": 48000,
					"channels": 2,
					"parameters": {
						"minptime": 10,
						"useinbandfec": 1,
						"sprop-stereo": 1,
						"usedtx": 1
					},
					"rtcpFeedback": []
				}
			],
			"headerExtensions": [
				{
					"uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
					"id": 1,
					"encrypt": false,
					"parameters": {}
				},
				{
					"uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
					"id": 4,
					"encrypt": false,
					"parameters": {}
				},
				{
					"uri": "urn:ietf:params:rtp-hdrext:ssrc-audio-level",
					"id": 10,
					"encrypt": false,
					"parameters": {}
				}
			],
			"encodings": [
				{
					"ssrc": 686025034
				}
			],
			"rtcp": {
				"cname": "4X6bysyZyMPcx+Qd",
				"reducedSize": true,
				"mux": true
			},
			"mid": "0"
		},
		"type": "simple",   //consumer类型
		"appData": {
			"peerId": "5j0pydzb"
		},
		"producerPaused": false   //produce当前状态
	}
}
```
- callback
#### 客户端行为
- 客户端收到此消息表明，服务器已经创建好consumer,客户端需要调用revTransport.consume 创建本地的consume
```
const { peerId, producerId, id, kind, rtpParameters, type, appData, producerPaused } = request.data;
try {
    const consumer = yield this._recvTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData: Object.assign(Object.assign({}, appData), { peerId }) // Trick.
    });
```
#### 返回示例 
- 事件  success/error
- 参数 
```
//成功-表示接受该consumer
{
    "data":{}
}
//失败-拒绝接受该consumer
{
    "errmsg":"",
    "errcode":403
}
```

### newDataConsumer
#### 说明
- 通知新的数据消费者，服务器已经创建好，当前处于暂停状态，当客户端正确回复，则运行该comsumer
- 客户端必须回复此消息

#### 处理方式
- 事件 newDataConsumer
- 参数
```
{
	"data": {
		"peerId": "5j0pydzb",    //对端的ID
		"dataProducerId": "763f9c2b-0f0e-4acf-9eb1-7f3e1b6b1b2a", //对应的DataProducerId
		"id": "ac906033-ef4e-4b4b-870e-954c44b49942",  //新创建的DataConsumerId
		"sctpStreamParameters": {   //sctp能力
			"maxRetransmits": 1,
			"ordered": false,
			"streamId": 0
		},
		"label": "chat",   //标识
		"protocol": "",
		"appData": {
			"info": "my-chat-DataProducer"
		}
	}
}
```

#### 客户端行为
- 客户端接受到该事件需要调用recvTransport.consumeData创建consumeData  或者直接回复错误 进行拒绝
```
const { peerId, // NOTE: Null if bot.
dataProducerId, id, sctpStreamParameters, label, protocol, appData } = request.data;
try {
    const dataConsumer = yield this._recvTransport.consumeData({
        id,
        dataProducerId,
        sctpStreamParameters,
        label,
        protocol,
        appData: Object.assign(Object.assign({}, appData), { peerId }) // Trick.
    });
```

#### 返回示例
- 事件  success/error
- 参数 
```
//成功-表示接受该consumer
{
    "data":{}
}
//失败-标识拒绝该consumer
{
    "errmsg":"",
    "errcode":403
}
```

### producerScore
#### 说明
- 通知一个producer的质量，不需要回复

#### 通知格式
- 事件 
- 参数 
```
{
	"data": {
		"consumerId": "b2e20965-60c1-4966-9dba-4470e27864ad",
		"score": {
			"producerScore": 10,
			"score": 10
		}
	}
}
```


### newPeer
#### 说明 
- 通知有新的用户加入 

#### 通知格式
- 事件 newPeer
- 参数
```
{
	"data": {
		"id": "zwrorb63",
		"displayName": "Drowzee",
		"device": {
			"flag": "firefox",
			"name": "Firefox",
			"version": "77.0"
		}
	}
}
```

### peerClosed
#### 说明 
- 通知有用户离开
#### 通知格式
- 事件 peerClosed
- 参数
```
{
	"data": {
        "peerId": "savwwasda"
	}
}
```

### downlinkBwe
#### 说明 
- 暂时不清楚-demo里面时没有处理

#### 通知格式
- 事件  downlinkBwe
- 参数 
```
{
	"data": {
		"desiredBitrate": 0,
		"effectiveDesiredBitrate": 0,
		"availableBitrate": 1000000
	}
}
```


### consumerClosed
#### 说明 
- 通知有流退出了，需要关闭本地的comsumer对象 
- 客户端在收到该事件收需调用  consumer.close()  关闭对应的本地consume

#### 通知格式
- 事件 consumerClosed
- 参数 
```
{
	"data": {
		"consumerId": "1231231"
	}
}
```



### consumerPaused
#### 说明 
- 通知有流暂停了 

#### 通知格式
- 事件 consumerPaused
- 参数 
```
{
	"data": {
		"consumerId": "1231231"
	}
}
```

### consumerResumed
#### 说明 
- 通知有流恢复了 
#### 通知格式
- 事件 consumerResumed
- 参数 
```
{
	"data": {
		"consumerId": "1231231"
	}
}
```


### consumerLayersChanged
#### 说明  
- 通知consume的SVC等级变化

#### 通知格式 
- 事件 consumerLayersChanged
- 参数 
```
{
	"data": {
		"consumerId": "63b445ce-fbeb-4a8e-b2e1-8e3fa341a261",
		"spatialLayer": 2,
		"temporalLayer": 0
	}
}
```

### consumerScore
#### 说明 
- 通知comsuer的分数
#### 通知格式 
- 事件 consumerScore
- 参数
```
{
	"data": {
		"consumerId": "b2e20965-60c1-4966-9dba-4470e27864ad",
		"score": {
			"producerScore": 10,
			"score": 10
		}
	}
}
```


### dataConsumerClosed
#### 说明 
- 通知有流退出了，需要关闭本地的comsumer对象 

#### 通知格式 
- 事件 dataConsumerId
- 参数 
```
{
    "data":{
        "dataConsumerId":"12e1dsddw"
    }
}
```

### activeSpeaker
#### 说明 
- 通知当前正在讲话的用户 

#### 通知格式 
- 事件 activeSpeaker
- 参数 
```
{
	"data": {
		"peerId": "5j0pydzb",   //用户ID
		"volume": -50    //音量大小 范围为  -127 -- 0
	}
}
```
