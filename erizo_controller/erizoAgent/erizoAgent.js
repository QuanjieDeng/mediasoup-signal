/* global require */

// eslint-disable-next-line import/no-extraneous-dependencies
const Getopt = require('node-getopt');
// eslint-disable-next-line import/no-unresolved
const config = require('./../../licode_config');


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

global.config.erizoAgent.launchDebugErizoJS = global.config.erizoAgent.launchDebugErizoJS || false;

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
const rooms  = false;
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
    case 'debug':
      global.config.erizoAgent.launchDebugErizoJS = true;
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


// Load submodules with updated config
const logger = require('./../common/logger').logger;
const amqper = require('./../common/amqper');
const myErizoAgentId = guid();
const reporter = require('./erizoAgentReporter').Reporter({ id: myErizoAgentId, metadata });
const wm = require('./workerManager').WorkerManager({ amqper,myErizoAgentId });

// Logger
const log = logger.getLogger('ErizoAgent');


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
//创建 worker


exports.getContext = () => rooms;
exports.getReporter = () => reporter;
exports.getAgentId = () => myErizoAgentId;


exports.getAmqp = () => amqper;



// const rpcPublic = require('./rpc/rpcPublic');
// amqper.connect(() => {
//   amqper.setPublicRPC(rpcPublic);
//   amqper.bind('ErizoAgent');
//   amqper.bind(`ErizoAgent_${myErizoAgentId}`);
//   amqper.bindBroadcast('ErizoAgent', () => {
//     log.warn('message: amqp no method defined');
//   });
// });

run();

async function run()
{
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

