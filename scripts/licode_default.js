const os = require('os');
const { fail } = require('assert');
var config = {}

/*********************************************************
 COMMON CONFIGURATION
 It's used by Nuve, ErizoController, ErizoAgent and ErizoJS
**********************************************************/
config.rabbit = {};
config.rabbit.host = 'localhost'; //default value: 'localhost'
config.rabbit.port = 5672; //default value: 5672
config.rabbit.url="amqp:test:123456@localhost:5672"
// Sets the AQMP heartbeat timeout to detect dead TCP Connections
config.rabbit.heartbeat = 8; //default value: 8 seconds, 0 to disable
config.logger = {};
config.logger.configFile = '../log4js_configuration.json'; //default value: "../log4js_configuration.json"

/*********************************************************
 CLOUD PROVIDER CONFIGURATION
 It's used by Nuve and ErizoController
**********************************************************/
config.cloudProvider = {};
config.cloudProvider.name = '';

/*********************************************************
 NUVE CONFIGURATION
**********************************************************/
config.nuve = {};
config.nuve.dataBaseURL = "localhost/nuvedb"; // default value: 'localhost/nuvedb'
config.nuve.superserviceID = '_auto_generated_ID_'; // default value: ''
config.nuve.superserviceKey = '_auto_generated_KEY_'; // default value: ''
config.nuve.testErizoController = 'localhost:8080'; // default value: 'localhost:8080'
// Nuve Cloud Handler policies are in nuve/nuveAPI/ch_policies/ folder
config.nuve.cloudHandlerPolicy = 'default_policy.js'; // default value: 'default_policy.js'
config.nuve.port = 3000; // default value: 3000
config.nuve.ratelimit = {};

config.nuve.ratelimit.global={
    global:false,
    quen:true,
    points : 1000, //Number of points
    duration : 1, // Per second(s)
    quensize : 1000 //quensize
}

config.nuve.ratelimit.signal = {
    signal :false, //open tag
    points : 10, //Number of points
    duration : 1 // Per second(s)
}

/*********************************************************
 ERIZO CONTROLLER CONFIGURATION
**********************************************************/
config.erizoController = {};

// Public erizoController IP for websockets (useful when behind NATs)
// Use '' to automatically get IP from the interface
config.erizoController.publicIP = ''; //default value: ''
config.erizoController.networkinterface = ''; //default value: ''

// This configuration is used by the clients to reach erizoController
// Use '' to use the public IP address instead of a hostname
config.erizoController.hostname = ''; //default value: ''
config.erizoController.port = 8080; //default value: 8080
// Use true if clients communicate with erizoController over SSL
config.erizoController.ssl = false; //default value: false

// This configuration is used by erizoController server to listen for connections
// Use true if erizoController listens in HTTPS.
config.erizoController.listen_ssl = false; //default value: false
config.erizoController.listen_port = 8080; //default value: 8080

// Custom location for SSL certificates. Default located in /cert
//config.erizoController.ssl_key = '/full/path/to/ssl.key';
//config.erizoController.ssl_cert = '/full/path/to/ssl.crt';
//config.erizoController.sslCaCerts = ['/full/path/to/ca_cert1.crt', '/full/path/to/ca_cert2.crt'];

// Use the name of the inferface you want to bind to for websockets
// config.erizoController.networkInterface = 'eth1' // default value: undefined

config.erizoController.exitOnNuveCheckFail = false;  // default value: false

config.erizoController.warning_n_rooms = 15; // default value: 15
config.erizoController.limit_n_rooms = 20; // default value: 20
config.erizoController.interval_time_keepAlive = 1000; // default value: 1000


// If true, erizoController sends report to rabbitMQ queue "report_handler"
config.erizoController.report = {
    session_events: false, 		// Session level events -- default value: false
    connection_events: false, 	// Connection (ICE) level events -- default value: false
    rtcp_stats: false				// RTCP stats -- default value: false
};

// Subscriptions to rtcp_stats via AMQP
config.erizoController.reportSubscriptions = {
	maxSubscriptions: 10,	// per ErizoJS -- set 0 to disable subscriptions -- default 10
	minInterval: 1, 		// in seconds -- default 1
	maxTimeout: 60			// in seconds -- default 60
};


// Erizo Controller Cloud Handler policies are in erizo_controller/erizoController/ch_policies/ folder
config.erizoController.cloudHandlerPolicy = 'default_policy.js'; // default value: 'default_policy.js'
config.erizoController.TTLBestForce = false; //强制开启TTLBest,开启后全部使用TTLBest模式
config.erizoController.TTLBest = true;//开启后用户可选择使用TTL-BEST模式，否则使用默认的LOOP模式

config.erizoController.ratelimit = {};
config.erizoController.ratelimit.global={
    global:false,
    points : 1000, //Number of points
    duration : 1, // Per second(s)
}
/*********************************************************
 ERIZO AGENT CONFIGURATION
**********************************************************/
config.erizoAgent = {};

// Max processes that ErizoAgent can run
config.erizoAgent.maxProcesses 	  = 1; // default value: 1
// Number of precesses that ErizoAgent runs when it starts. Always lower than or equals to maxProcesses.
config.erizoAgent.prerunProcesses = 1; // default value: 1

// Public erizoAgent IP for ICE candidates (useful when behind NATs)
// Use '' to automatically get IP from the interface
config.erizoAgent.publicIP = ''; //default value: ''
config.erizoAgent.networkinterface = ''; //default value: ''

// Use the name of the inferface you want to bind for ICE candidates
// config.erizoAgent.networkInterface = 'eth1' // default value: undefined

//Use individual log files for each of the started erizoJS processes
//This files will be named erizo-ERIZO_ID_HASH.log
config.erizoAgent.useIndividualLogFiles = false;

// Custom log directory for agent instance log files.
// If useIndividualLogFiles is enabled, files will go here
// Default is [licode_path]/erizo_controller/erizoAgent
// config.erizoAgent.instanceLogDir = '/path/to/dir';

/*********************************************************
 ROV CONFIGURATION
**********************************************************/
config.rov = {};
// The stats gathering period in ms
config.rov.statsPeriod = 20000;
// The port to expose the stats to prometheus
config.rov.serverPort = 3005;
// A prefix for the prometheus stats
config.rov.statsPrefix = "mediasoup_";


/***** END *****/
// Following lines are always needed.
var module = module || {};
module.exports = config;



/****** mediasoup *****/
config.mediasoup = {};
config.mediasoup.numWorkers = Object.keys(os.cpus()).length;
config.mediasoup.workerSettings = {
    logLevel : 'debug',
    logTags  :
    [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        'rtx',
        'bwe',
        'score',
        'simulcast',
        'svc',
        'sctp'
    ],
    rtcMinPort : process.env.MEDIASOUP_MIN_PORT || 40000,
    rtcMaxPort : process.env.MEDIASOUP_MAX_PORT || 49999
};
config.mediasoup.routerOptions = 		{
    mediaCodecs :
    [
        {
            kind      : 'audio',
            mimeType  : 'audio/opus',
            clockRate : 48000,
            channels  : 2
        },
        {
            kind       : 'video',
            mimeType   : 'video/VP8',
            clockRate  : 90000,
            parameters :
            {
                'x-google-start-bitrate' : 1000
            }
        },
        {
            kind       : 'video',
            mimeType   : 'video/VP9',
            clockRate  : 90000,
            parameters :
            {
                'profile-id'             : 2,
                'x-google-start-bitrate' : 1000
            }
        },
        {
            kind       : 'video',
            mimeType   : 'video/h264',
            clockRate  : 90000,
            parameters :
            {
                'packetization-mode'      : 1,
                'profile-level-id'        : '4d0032',
                'level-asymmetry-allowed' : 1,
                'x-google-start-bitrate'  : 1000
            }
        },
        {
            kind       : 'video',
            mimeType   : 'video/h264',
            clockRate  : 90000,
            parameters :
            {
                'packetization-mode'      : 1,
                'profile-level-id'        : '42e01f',
                'level-asymmetry-allowed' : 1,
                'x-google-start-bitrate'  : 1000
            }
        }
    ]
};

config.mediasoup.webRtcTransportOptions = 		{
    listenIps :
    [
        {
            ip          : process.env.MEDIASOUP_LISTEN_IP,
            announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
        }
    ],
    initialAvailableOutgoingBitrate : 1000000,
    minimumAvailableOutgoingBitrate : 600000,
    maxSctpMessageSize              : 262144,
    // Additional options that are not part of WebRtcTransportOptions.
    maxIncomingBitrate              : 1500000
};

config.mediasoup.plainTransportOptions = 		{
    listenIp :
    {
        ip          : process.env.MEDIASOUP_LISTEN_IP,
        announcedIp : process.env.MEDIASOUP_ANNOUNCED_IP
    },
    maxSctpMessageSize : 262144,
    enableSrtp : false
};


config.ratelimit = {};
config.ratelimit.global={
    global:true,
    quen:false,
    points : 10, //Number of points
    duration : 1, // Per second(s)
    quensize : 1 //quensize
};


config.ratelimit.signal = {
    signal :true, //open tag
    points : 10, //Number of points
    duration : 1 // Per second(s)
};