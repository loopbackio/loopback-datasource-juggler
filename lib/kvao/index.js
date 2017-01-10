'use strict';

function KeyValueAccessObject() {
};

module.exports = KeyValueAccessObject;

KeyValueAccessObject.delete = require('./delete');
KeyValueAccessObject.deleteAll = require('./delete-all');
KeyValueAccessObject.get = require('./get');
KeyValueAccessObject.set = require('./set');
KeyValueAccessObject.expire = require('./expire');
KeyValueAccessObject.ttl = require('./ttl');
KeyValueAccessObject.iterateKeys = require('./iterate-keys');
KeyValueAccessObject.keys = require('./keys');

KeyValueAccessObject.getConnector = function() {
  return this.getDataSource().connector;
};

