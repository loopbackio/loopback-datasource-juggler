var assert = require('assert');
var uuid = require('node-uuid');
module.exports = Guid;

var UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Guid(data) {
  if (!(this instanceof Guid)) {
    return new Guid(data);
  }

  if (data === undefined || data === 'new') {
    data = uuid.v4();
  } else if (data instanceof Guid) {
    data = data.value;
  }

  assert(typeof data === 'string',
    'Guid value must be a string, was "' + (typeof data) + '" instead');
  assert(UUID_REGEXP.test(data),
    'Guid value must be a valid UUID as specified by RFC4122,' +
    ' was "' + data + '" instead');

  this.value = data;
}

Guid.prototype.toObject =
Guid.prototype.toJSON =
Guid.prototype.toString = function() {
  return this.value;
};


