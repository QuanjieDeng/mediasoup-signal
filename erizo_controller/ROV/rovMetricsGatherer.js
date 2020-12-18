const readline = require('readline');
const fs = require('fs');

// eslint-disable-next-line global-require, import/no-extraneous-dependencies
const AWS = require('aws-sdk');

// eslint-disable-next-line import/no-unresolved
const config = require('../../licode_config');
class RovMetricsGatherer {
  constructor(rovClient, promClient, statsPrefix, logger) {
    this.rovClient = rovClient;
    this.prefix = statsPrefix;
    this.prometheusMetrics = {
      // release: new promClient.Gauge({ name: this.getNameWithPrefix('release_info'), help: 'commit short hash', labelNames: ['commit', 'date', 'ip'] }),
      activeRooms: new promClient.Gauge({ name: this.getNameWithPrefix('active_rooms'), help: 'active rooms in all erizoControllers' }),
      activeClients: new promClient.Gauge({ name: this.getNameWithPrefix('active_clients'), help: 'active clients in all erizoControllers' }),
      totalPublishers: new promClient.Gauge({ name: this.getNameWithPrefix('total_publishers'), help: 'total active publishers' }),
      totalSubscribers: new promClient.Gauge({ name: this.getNameWithPrefix('total_subscribers'), help: 'total active subscribers' }),
      activeErizoJsProcesses: new promClient.Gauge({ name: this.getNameWithPrefix('active_erizojs_processes'), help: 'active processes' }),
      totalICEconnectionsFailed: new promClient.Gauge({ name: this.getNameWithPrefix('total_ice_connections_failed'), help: 'ice connections failed' }),
      totalDTLSconnectionsFailed: new promClient.Gauge({ name: this.getNameWithPrefix('total_dtls_connections_failed'), help: 'dtls connections failed' }),
      totalSCTPconnectionsFailed: new promClient.Gauge({ name: this.getNameWithPrefix('total_sctp_connections_failed'), help: 'sctp connections failed' }),
      produceScore: new promClient.Gauge({ name: this.getNameWithPrefix('produce_score'), help: 'produceScore' }),
      consumeScore: new promClient.Gauge({ name: this.getNameWithPrefix('consume_score'), help: 'consumeScore' }),
      rpcCost: new promClient.Gauge({ name: this.getNameWithPrefix('rpcCost'), help: 'rpcCost' })
    };
    this.log = logger;
    this.releaseInfoRead = false;
    if (config && config.erizoAgent) {
      this.publicIP = config.erizoAgent.publicIP;
    }
  }

  getNameWithPrefix(name) {
    return `${this.prefix}${name}`;
  }

  getIP() {
    // Here we assume that ROV runs in the same instance than Erizo Controller
    if (config && config.cloudProvider && config.cloudProvider.name === 'amazon') {
      return new Promise((resolve) => {
        new AWS.MetadataService({
          httpOptions: {
            timeout: 5000,
          },
        }).request('/latest/meta-data/public-ipv4', (err, data) => {
          if (err) {
            this.log.error('Error: ', err);
          } else {
            this.publicIP = data;
          }
          resolve();
        });
      });
    }
    return Promise.resolve();
  }

  getReleaseInfo() {
    this.log.debug('Getting release info');
    if (!this.releaseInfoRead) {
      this.releaseInfoRead = true;
      try {
        return new Promise((resolve) => {
          const input = fs.createReadStream('../../RELEASE');

          input.on('error', (e) => {
            this.log.error('Error reading release file', e);
            resolve();
          });
          const fileReader = readline.createInterface({
            input,
            output: process.stdout,
            console: false,
          });
          let lineNumber = 0;
          let releaseCommit = '';
          let releaseDate = '';
          fileReader.on('line', (line) => {
            this.log.info(line);
            if (lineNumber === 0) {
              releaseCommit = line;
            } else {
              releaseDate = line;
            }
            lineNumber += 1;
          });

          fileReader.once('close', () => {
            this.prometheusMetrics.release.labels(releaseCommit, releaseDate, this.publicIP).set(1);
            resolve();
          });
        });
      } catch (e) {
        this.log.error('Error reading release file', e);
      }
    }
    return Promise.resolve();
  }

  getTotalRooms() {
    this.log.debug('Getting total rooms');
    return this.rovClient.runInComponentList('console.log(context.rooms.size)', this.rovClient.components.erizoControllers)
      .then((results) => {
        let totalRooms = 0;
        results.forEach((roomsSize) => {
          totalRooms += parseInt(roomsSize, 10);
        });
        this.log.debug(`Total rooms result: ${totalRooms}`);
        this.prometheusMetrics.activeRooms.set(totalRooms);
        return Promise.resolve();
      });
  }

  getTotalClients() {
    this.log.debug('Getting total clients');
    return this.rovClient.runInComponentList('var totalClients = 0; context.rooms.forEach((room) => {totalClients += room.clients.size}); console.log(totalClients);',
      this.rovClient.components.erizoControllers)
      .then((results) => {
        let totalClients = 0;
        results.forEach((clientsInRoom) => {
          totalClients += isNaN(clientsInRoom) ? 0 : parseInt(clientsInRoom, 10);
        });
        this.prometheusMetrics.activeClients.set(totalClients);
        this.log.debug(`Total clients result: ${totalClients}`);
        return Promise.resolve();
      });
  }
/*


    
*/
  getTotalPublishersAndSubscribers() {
    this.log.info('Getting total publishers and subscribers');
    const requestPromises = [];    
    const  command ='var totalValues = {produce: 0, consume: 0};'+
      'context.rooms.forEach((room)=>{room.forEachClient((client)=>{totalValues.produce += client._producers.size;'+
      'totalValues.consume += client._consumers.size;});});console.log(JSON.stringify(totalValues));';
    this.rovClient.components.erizoAgents.forEach((controller) => {
      requestPromises.push(controller.runAndGetPromise(command));
    });
    let totalPublishers = 0;
    let totalSubscribers = 0;
    return Promise.all(requestPromises).then((results) => {
      this.log.info(`getTotalPublishersAndSubscribers result:${JSON.stringify(results)}`);
      results.forEach((result) => {
        const parsedResult = JSON.parse(result);
        totalPublishers += parsedResult.produce;
        totalSubscribers += parsedResult.consume;
      });
      this.prometheusMetrics.totalPublishers.set(totalPublishers);
      this.prometheusMetrics.totalSubscribers.set(totalSubscribers);
      this.log.debug(`Total publishers and subscribers result: ${totalPublishers}, ${totalSubscribers}`);
      return Promise.resolve();
    });
  }

  getActiveProcesses() {
    this.log.debug('Getting active processes');
    let totalActiveProcesses = 0;
    const requestPromises = [];    
    const  command ='console.log(context.workermanage.getsize());';
    this.rovClient.components.erizoAgents.forEach((controller) => {
      requestPromises.push(controller.runAndGetPromise(command));
    });
    return Promise.all(requestPromises).then((results) => {
      this.log.info(`getActiveProcesses result:${JSON.stringify(results)}`);
      results.forEach((result) => {
        totalActiveProcesses += isNaN(result) ? 0 : parseInt(result, 10);
      });
      this.prometheusMetrics.activeErizoJsProcesses.set(totalActiveProcesses);
      return Promise.resolve();
    });
  }

  getWorkerMetrics() {
    this.log.debug('Enter  getWorkerMetrics ');
    return this.rovClient.runInComponentList('console.log(JSON.stringify(context.getAndResetMetrics()))', this.rovClient.components.erizoAgents)
      .then((results) => {
        this.log.info(`getWorkerMetrics return :${results}`);
        let totalICEConnectedFailed = 0;
        let totalDTLSConnectedFailed = 0;
        let totalSCTPConnectedFailed = 0;
        results.forEach((result) => {
          const parsedResult = JSON.parse(result);
          totalICEConnectedFailed += parsedResult.ICEconnectionsFailed;
          totalDTLSConnectedFailed += parsedResult.DTLSconnectionsFailed;
          totalSCTPConnectedFailed += parsedResult.SCTPconnectionsFailed;
        });
        this.prometheusMetrics.totalICEconnectionsFailed.set(totalICEConnectedFailed);
        this.prometheusMetrics.totalDTLSconnectionsFailed.set(totalDTLSConnectedFailed);
        this.prometheusMetrics.totalSCTPconnectionsFailed.set(totalSCTPConnectedFailed);
        return Promise.resolve();
      });
  }
  getRTPScore(){
    this.log.debug('Entry getRTPScore');
    const  cmd = 'var aveValues = {produceScore: 0,consumeScore: 0};'+
    'var  aveproducescore = 0;var  sumeproducesize = 0;var  aveconsumescore = 0;var  sumeconsumesize = 0;'+
    'context.rooms.forEach((room)=>{room.forEachClient((client)=>{'+
        'for(const producer of client._producers.values()){const score = producer.score;aveproducescore  += score[0].score;sumeproducesize += 1;}'+
        'for(const consume of client._consumers.values()){aveconsumescore += consume.score.score;sumeconsumesize += 1;}});});'+
    'if(sumeproducesize != 0){aveValues.produceScore =  aveproducescore/sumeproducesize;}'+
    'if(sumeconsumesize != 0){aveValues.consumeScore =  aveconsumescore/sumeconsumesize;}'+'console.log(JSON.stringify(aveValues));';

    return this.rovClient.runInComponentList(cmd, this.rovClient.components.erizoAgents)
      .then((results) => {
        // this.log.info(`getRTPScore return :${results}`);
        let totalProduceScore = 0;
        let totalConsumeScore = 0;
        let size = 0;
        results.forEach((result) => {
          const parsedResult = JSON.parse(result);
          totalProduceScore += parsedResult.produceScore;
          totalConsumeScore += parsedResult.consumeScore;
          size += 1;
        });
        //计算平均值
        let  aveProduceScore = 10;
        let  aveConsumeScore = 0;
        if(size != 0){
          aveProduceScore = totalProduceScore/size;
          aveConsumeScore = totalConsumeScore/size;
        }

        this.prometheusMetrics.produceScore.set(aveProduceScore);;
        this.prometheusMetrics.consumeScore.set(aveConsumeScore);
        return Promise.resolve();
      });
  }
  getRpcCost(){
    this.log.debug('Getting getRpcCost ');
    const cmd = 'var totalconst = 0;var size = 0;var ave_cost = 0;'+
    'context.rooms.forEach((room) => {room.clients.forEach((client)=>{totalconst += client.ave_cost;size += 1;});});'+
    'if(size  !=  0){ave_cost =  totalconst/size;} console.log(ave_cost);';
    
    return this.rovClient.runInComponentList(cmd,this.rovClient.components.erizoControllers)
      .then((results) => {
        var totalconst = 0;
        var size = 0;
        var ave_cost = 0;

        results.forEach((ave_cost) => {
          totalconst += isNaN(ave_cost) ? 0 : parseInt(ave_cost, 10);
          // totalconst += ave_cost;
          size += 1;
        });
        if(size  !=  0){
          ave_cost =  totalconst/size;
        }
        this.prometheusMetrics.rpcCost.set(ave_cost);
        return Promise.resolve();
      });
  }
  gatherMetrics() {
    return this.getIP()
      // .then(() => this.getReleaseInfo())
      .then(() => this.rovClient.updateComponentsList())
      .then(() => this.getTotalRooms())
      .then(() => this.getTotalClients())
      .then(() => this.getTotalPublishersAndSubscribers())
      .then(() => this.getActiveProcesses())
      .then(() => this.getWorkerMetrics())
      .then(() => this.getRTPScore())
      .then(() => this.getRpcCost());
  }
}

exports.RovMetricsGatherer = RovMetricsGatherer;
