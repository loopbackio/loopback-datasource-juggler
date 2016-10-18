// TODO(bajtos) move this code to loopback-connector

'use strict';

var msgpack = require('msgpack5');

module.exports = function createPacker() {
  var packer = msgpack({forceFloat64: true});
  packer.register(1, Date, encodeDate, decodeDate);
  return packer;
};

function encodeDate(obj) {
  return new Buffer(obj.toISOString(), 'utf8');
}

function decodeDate(buf) {
  return new Date(buf.toString('utf8'));
}
