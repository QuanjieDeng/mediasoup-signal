const cloudHandler = require('../cloudHandler');
const logger = require('./../logger').logger;

// Logger
const log = logger.getLogger('WorkerResource');


/*
 * Get Users. Represent a list of users of a determined room. This is consulted to cloudHandler.
 */
exports.getWorkerInfo = (req, res) => {
    cloudHandler.getWorkerInfo((info) => {
    if (info === 'timeout') {
        res.status(503).send('time out!');
        return;
    }
    res.send(info);
    });
};
