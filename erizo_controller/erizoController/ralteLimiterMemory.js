const {RateLimiterMemory, RateLimiterQueue} = require('rate-limiter-flexible');
const config = require('./../../licode_config');


const limiterFlexible = new RateLimiterMemory({
  points: config.erizoController.ratelimit.global.points,   //可以处理的数量
  duration:config.erizoController.ratelimit.global.duration, //单位时间 
});


// const limiterQueue = new RateLimiterQueue(limiterFlexible, {
//   maxQueueSize: 10,
// });







exports.limiterFlexible = limiterFlexible;
// exports.limiterQueue = limiterQueue;
