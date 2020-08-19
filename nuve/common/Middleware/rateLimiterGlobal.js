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
    points: config.ratelimit.global.points, // Number of points
    duration: config.ratelimit.global.duration, // Per second(s)
    dbName: 'rateLimite',
    tableName: 'globalNoQuen',
};


const rateLimiterMongo = new RateLimiterMongo(opts);


const rateLimiterGlobal = (req, res, next) => {
    rateLimiterMongo.consume("global",1)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('Too Many Requests-single');
    });
};

module.exports = rateLimiterGlobal;
