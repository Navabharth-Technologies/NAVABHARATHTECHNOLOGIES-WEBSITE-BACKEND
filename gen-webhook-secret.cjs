const c = require('crypto');
console.log('ATS_WEBHOOK_SECRET=' + c.randomBytes(32).toString('hex'));
