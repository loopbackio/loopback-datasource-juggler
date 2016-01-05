var ObjectId;

try {
  ObjectId = require('mongodb').ObjectId;
} catch(e) {
  if (e.code === 'MODULE_NOT_FOUND')
    throw e;
}

module.exports = ObjectId;
module.exports.ObjectID = ObjectId;
module.exports.ObjectId = ObjectId;
