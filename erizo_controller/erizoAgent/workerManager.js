/*
workermanager.js 负责woker的创建，消除，负载分配
*/
const erizoAgent = require('./erizoAgent');
const logger = require('./../common/logger').logger;
const log = logger.getLogger('ErizoAgent-WM');
const mediasoup = require('mediasoup');
const config = require('./../../licode_config');

exports.WorkerManager = (spec) => {
  const that = {};
  const amqper = spec.amqper;
  const erizoAgentId = spec.erizoAgentId;
  
  const mediasoupWorkers = [];
  let nextMediasoupWorkerIdx = 0;

  that.runMediasoupWorkers = async () =>{
    const { numWorkers } = config.mediasoup;

    log.info('running %d mediasoup Workers...', numWorkers);

    for (let i = 0; i < numWorkers; ++i)
    {
        const worker = await mediasoup.createWorker(
            {
                logLevel   : config.mediasoup.workerSettings.logLevel,
                logTags    : config.mediasoup.workerSettings.logTags,
                rtcMinPort : Number(config.mediasoup.workerSettings.rtcMinPort),
                rtcMaxPort : Number(config.mediasoup.workerSettings.rtcMaxPort)
            });

        worker.on('died', () =>
        {
            log.error(
                'mediasoup Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

            setTimeout(() => process.exit(1), 2000);
        });

        mediasoupWorkers.push(worker);

        // Log worker resource usage every X seconds.
        setInterval(async () =>
        {
            const usage = await worker.getResourceUsage();

            log.info('mediasoup Worker resource usage [pid:%d]: %o', worker.pid, usage);
        }, 120000);
    }
  };

  that.getMediasoupWorker= () =>{
      const worker = mediasoupWorkers[nextMediasoupWorkerIdx];
      if (++nextMediasoupWorkerIdx === mediasoupWorkers.length)
          nextMediasoupWorkerIdx = 0;
      return worker;
  };

  that.getMediasoupWorkerList= () =>{
    const  list = [];
    mediasoupWorkers.forEach((v,index,arry)=>{
        list.push(v);
    });
    return   list;
};
   
that.getsize= () =>{
    return mediasoupWorkers.length;
};
  

  return that;
};
