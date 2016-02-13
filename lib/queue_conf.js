var Conf = module.exports = {
    prefix: 'q',
    redis: {
        host: '127.0.0.1',
        port: 6379,
        auth: process.env.REDIS_PASS,
        db: 3, // if provided select a non-default redis db
        options: {
            // see https://github.com/mranney/node_redis#rediscreateclient
        }
    }
};
