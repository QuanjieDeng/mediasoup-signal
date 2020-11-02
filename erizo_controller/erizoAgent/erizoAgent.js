/* global require */
const config = require('./../../licode_config');
if(config.skywalking.open){
  console.log(`load skywalking agent`);
  require("skyapm-nodejs-mediasoup").start({
    serviceName: 'ea',
    instanceName: 'ea',
    directServers: config.skywalking.url,
    authentication: config.skywalking.authentication
  });
}
// eslint-disable-next-line import/no-extraneous-dependencies
const Getopt = require('node-getopt');
// eslint-disable-next-line import/no-unresolved


// Configuration default values
global.config = config || {};
global.config.erizoAgent = global.config.erizoAgent || {};
global.config.erizoAgent.maxProcesses = global.config.erizoAgent.maxProcesses || 1;
global.config.erizoAgent.prerunProcesses = global.config.erizoAgent.prerunProcesses === undefined
  ? 1 : global.config.erizoAgent.prerunProcesses;
global.config.erizoAgent.publicIP = global.config.erizoAgent.publicIP || '';
global.config.erizoAgent.instanceLogDir = global.config.erizoAgent.instanceLogDir || '.';
global.config.erizoAgent.useIndividualLogFiles =
  global.config.erizoAgent.useIndividualLogFiles || false;



const BINDED_INTERFACE_NAME = global.config.erizoAgent.networkInterface;

// Parse command line arguments
const getopt = new Getopt([
  ['r', 'rabbit-host=ARG', 'RabbitMQ Host'],
  ['g', 'rabbit-port=ARG', 'RabbitMQ Port'],
  ['b', 'rabbit-heartbeat=ARG', 'RabbitMQ AMQP Heartbeat Timeout'],
  ['l', 'logging-config-file=ARG', 'Logging Config File'],
  ['M', 'max-processes=ARG', 'Stun Server URL'],
  ['P', 'prerun-processes=ARG', 'Default video Bandwidth'],
  ['I', 'individual-logs', 'Use individual log files for ErizoJS processes'],
  ['m', 'metadata=ARG', 'JSON metadata'],
  ['d', 'debug', 'Run erizoJS with debug library'],
  ['h', 'help', 'display this help'],
]);

//房间管理
const interfaces = require('os').networkInterfaces();
const addresses = [];
let privateIP;
let publicIP;
let address;
const opt = getopt.parse(process.argv.slice(2));
let metadata;

Object.keys(opt.options).forEach((prop) => {
  const value = opt.options[prop];
  switch (prop) {
    case 'help':
      getopt.showHelp();
      process.exit(0);
      break;
    case 'rabbit-host':
      global.config.rabbit = global.config.rabbit || {};
      global.config.rabbit.host = value;
      break;
    case 'rabbit-port':
      global.config.rabbit = global.config.rabbit || {};
      global.config.rabbit.port = value;
      break;
    case 'rabbit-heartbeat':
      global.config.rabbit = global.config.rabbit || {};
      global.config.rabbit.heartbeat = value;
      break;
    case 'max-processes':
      global.config.erizoAgent = global.config.erizoAgent || {};
      global.config.erizoAgent.maxProcesses = value;
      break;
    case 'prerun-processes':
      global.config.erizoAgent = global.config.erizoAgent || {};
      global.config.erizoAgent.prerunProcesses = value;
      break;
    case 'individual-logs':
      global.config.erizoAgent = global.config.erizoAgent || {};
      global.config.erizoAgent.useIndividualLogFiles = true;
      break;
    case 'metadata':
      metadata = JSON.parse(value);
      break;
    default:
      global.config.erizoAgent[prop] = value;
      break;
  }
});

//get   uuid
const guid = (function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return function id() {
    return `${s4() + s4()}-${s4()}-${s4()}-${
      s4()}-${s4()}${s4()}${s4()}`;
  };
}());




if (interfaces) {
  Object.keys(interfaces).forEach((k) => {
    if (!global.config.erizoAgent.networkinterface ||
      global.config.erizoAgent.networkinterface === k) {
      Object.keys(interfaces[k]).forEach((k2) => {
        address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          if (k === BINDED_INTERFACE_NAME || !BINDED_INTERFACE_NAME) {
            addresses.push(address.address);
          }
        }
      });
    }
  });
}

privateIP = addresses[0];

if (global.config.erizoAgent.publicIP === '' || global.config.erizoAgent.publicIP === undefined) {
  publicIP = addresses[0];

  if (global.config.cloudProvider.name === 'amazon') {
    // eslint-disable-next-line
    const AWS = require('aws-sdk');
    new AWS.MetadataService({
      httpOptions: {
        timeout: 5000,
      },
    }).request('/latest/meta-data/public-ipv4', (err, data) => {
      if (err) {
        log.info('Error: ', err);
      } else {
        log.info('Got public ip: ', data);
        publicIP = data;
      }
    });
  }
} else {
  publicIP = global.config.erizoAgent.publicIP;
}
global.config.erizoAgent.publicIP =publicIP ;
//初始化webrtctransport info
if(!process.env.MEDIASOUP_LISTEN_IP){
  global.config.mediasoup.webRtcTransportOptions.listenIps[0].ip =  global.config.erizoAgent.publicIP;
}  
// Load submodules with updated config
const logger = require('./../common/logger').logger;
const Room =  require('./models/room').Room;
const log = logger.getLogger('ErizoAgent');
const amqper = require('./../common/amqper');
const { V4MAPPED } = require('dns');
const myErizoAgentId = guid();
const wm = require('./workerManager').WorkerManager({ amqper,myErizoAgentId });
const Rooms = require('./models/rooms').Rooms;
const rooms =   new Rooms(amqper,wm);
const reporter = require('./erizoAgentReporter').Reporter({ id: myErizoAgentId,ip:publicIP, metadata,rooms });



rooms.on('updated',function(){
  log.debug(`rooms-updated-rooms'size:${rooms.size()}`);
})





exports.getContext = () => rooms;
exports.getReporter = () => reporter;
exports.getAgentId = () => myErizoAgentId;
exports.getAmqp = () => amqper;
exports.getRooms = () => rooms;
exports.getVM = () => wm;


run();

async function run()
{
  rooms.on('updated', function(){
    let nRooms = 0;
    nRooms = rooms.size();
    log.debug('message: Updating my state,  rooms:', nRooms);

  });
	// Run a mediasoup Worker.
  await  wm.runMediasoupWorkers();
  
  const rpcPublic = require('./rpc/rpcPublic');
  amqper.connect(() => {
    amqper.setPublicRPC(rpcPublic);
    amqper.bind('ErizoAgent');
    amqper.bind(`ErizoAgent_${myErizoAgentId}`);
    amqper.bindBroadcast('ErizoAgent', () => {
      log.warn('message: amqp no method defined');
    });
  });
}




exports.getOrCreateRoom = async({ roomid, erizoControllerid }) =>{
	let room = rooms.getRoomById(roomid);

	// If the Room does not exist create a new one.
	if (!room)
	{
		log.info('creating a new Room [roomId:%s]', roomid);

		const mediasoupWorker = wm.getMediasoupWorker();

		room = await Room.create({ roomid,amqper,erizoControllerid,mediasoupWorker });

    rooms.addRoom(roomid, room);
    
	}

	return room;
}




var fs = require( 'fs' );
var os = require( 'os' );
const { map } = require('async');
var CPUCoreNumbers = os.cpus().length;
// var CPUTikHistory = null;
var getProcessCPUUsage = ( pid, oldProcessTick, CPUTikHistory,sysTickPerSec ) => {
    log.info(`getProcessCPUUsage pid:${pid} oldProcessTick:${oldProcessTick} CPUTikHistory:${CPUTikHistory}`);
    var ProcessTickSum = 0;
    if( Array.isArray( pid ) ){
        pid.forEach( p => {
            let ProcessStat = fs.readFileSync( `/proc/${p}/stat`, 'utf8' );
            let ProcessStatArr = ProcessStat.match( /(\w+)+/g )
            if( ProcessStatArr == null ) return null;
            ProcessTickSum += parseInt( ProcessStatArr[14] ) + parseInt( ProcessStatArr[15] )+ parseInt( ProcessStatArr[16] )+ parseInt( ProcessStatArr[17] );
        } )
    }else{
        let ProcessStat = fs.readFileSync( `/proc/${pid}/stat`, 'utf8' );
        let ProcessStatArr = ProcessStat.match( /(\w+)+/g )
        if( ProcessStatArr == null ) return null;
        ProcessTickSum = parseInt( ProcessStatArr[14] ) + parseInt( ProcessStatArr[15] )+parseInt( ProcessStatArr[16] )+ parseInt( ProcessStatArr[17] );;
    }

    let TikSum = 0;
    if( sysTickPerSec == null ){
        let CPUStat = fs.readFileSync( '/proc/stat', 'utf8' );
        let MatchLine = CPUStat.match(/(.*)\n/);
        if( MatchLine == null ){
            console.error( "This function not match this machain, please take care" );
            process.exit();
        }
        let CPULineArr = MatchLine[1].match( /(\w+)+/g );
        // console.log( CPULineArr )
        if( CPULineArr[0] != 'cpu' ){
            console.error( "This function not match this machain, please take care" );
            process.exit();
        }
        CPULineArr.forEach( (num) => {
            let i = parseInt( num );
            if( isNaN( i ) ) return;
            TikSum += parseInt(num);
        } )
        if( CPUTikHistory == 0 ){
            CPUTikHistory = TikSum;
        }
    }

    if( ( oldProcessTick == null ) || ( oldProcessTick == 0 ) ){
        if( sysTickPerSec == null ){
            return {
                rate: "0",
                processTick: ProcessTickSum,
                sysTick: TikSum,
                CPUTikHistory:CPUTikHistory
            }
        }else{
            return {
                rate: "0",
                processTick: ProcessTickSum,
                CPUTikHistory:CPUTikHistory
            }
        }
    }

    if( sysTickPerSec == null ){
        DiffSysTick = TikSum - CPUTikHistory;
        CPUTikHistory = TikSum;
        if( DiffSysTick == 0 ){
            return {
                rate: "0",
                processTick: ProcessTickSum,
                sysTick: TikSum,
                CPUTikHistory:CPUTikHistory
            }
        }
        let rate = ( ProcessTickSum - oldProcessTick )*100/DiffSysTick*CPUCoreNumbers
        return {
            rate: rate.toFixed(1),
            processTick: ProcessTickSum,
            sysTick: TikSum,
            CPUTikHistory:CPUTikHistory
        }
    }else{
        let rate = ( ProcessTickSum - oldProcessTick )*100/sysTickPerSec*CPUCoreNumbers;

        return {
            rate: rate.toFixed(1),
            processTick: ProcessTickSum,
            CPUTikHistory:CPUTikHistory
        }
    }
}




const worker_info_map = new Map();

exports.getWorkerInfo =async (callback)=>{

  const  workerlist = await  wm.getMediasoupWorkerList();
  let produceconut = 0;
  const infolist = [];
  await new Promise(async (resolve)=>{
    workerlist.forEach(async(v,index,arry)=>{
      try{
        var tmpusage =  worker_info_map.get(v.pid);
        if(!tmpusage){
          tmpusage = {
            processTick:0,
            CPUTikHistory:0
          }
        }
        const  usage =  getProcessCPUUsage(v.pid,tmpusage.processTick,tmpusage.CPUTikHistory);
        worker_info_map.set(v.pid,usage);

        var  resp = {
          pid:v.pid,
          rate:usage.rate
        }
        infolist.push(resp);
      }finally{
        produceconut += 1;
        if(produceconut === workerlist.length){
          resolve();
        }
      }
    });
  });
  callback(infolist);
}