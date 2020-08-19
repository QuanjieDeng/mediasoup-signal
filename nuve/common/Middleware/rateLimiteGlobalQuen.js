
const {RateLimiterMemory, RateLimiterQueue} = require('rate-limiter-flexible');
const {RateLimiterMongo} = require('rate-limiter-flexible');
const { MongoClient } = require('mongodb');
const config = require('./../../../licode_config');

const mongoOpts = {
  useNewUrlParser: true,
  // reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  // reconnectInterval: 100, // Reconnect every 100ms,
  useUnifiedTopology: true
};

const mongoConn = MongoClient.connect(
    `mongodb://${config.nuve.dataBaseURL}`,
    mongoOpts
);

const opts = {
    storeClient: mongoConn,
    points: config.nuve.ratelimit.global.points, // Number of points
    duration: config.nuve.ratelimit.global.duration, // Per second(s)
    dbName: 'rateLimite',
    tableName: 'globalWithQuen',
};


const rateLimiterMongo = new RateLimiterMongo(opts);
const limiterQueue = new RateLimiterQueue(rateLimiterMongo, {
  maxQueueSize: config.nuve.ratelimit.global.quensize,
});

const rateLimiteGlobalQuen = (req, res, next) => {
  limiterQueue.removeTokens(1,"globalquen")
    .then(() => {
      next();
    })
    .catch(() => {
      console.log(`ralteLimiterSingle globalquen too amny`);
      res.status(429).send('Too Many Requests');
    })
};

module.exports = rateLimiteGlobalQuen;