var kue = require('kue');
kue.createQueue(require("../lib/queue_conf.js"));
kue.app.listen(3000);
