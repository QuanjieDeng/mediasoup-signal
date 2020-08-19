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
    points: config.ratelimit.signal.points, // Number of points
    duration: config.ratelimit.signal.duration, // Per second(s)
    dbName: 'rateLimite',
    tableName: 'single',
};


const rateLimiterMongo = new RateLimiterMongo(opts);


const ralteLimiterSingle = (req, res, next) => {
    rateLimiterMongo.consume(req.ip,1)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(428).send('Too Many Requests-single');
    });
};

module.exports = ralteLimiterSingle;
