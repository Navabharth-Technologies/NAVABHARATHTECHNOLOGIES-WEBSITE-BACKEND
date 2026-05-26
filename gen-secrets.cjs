const c = require('crypto');
console.log('JWT_ACCESS_SECRET=' + c.randomBytes(64).toString('hex'));
console.log('JWT_REFRESH_SECRET=' + c.randomBytes(64).toString('hex'));
console.log('ADMIN_API_KEY='      + c.randomBytes(32).toString('hex'));
