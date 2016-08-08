'use strict';

function KeyValueAccessObject() {
};

module.exports = KeyValueAccessObject;

KeyValueAccessObject.get = require('./get');
KeyValueAccessObject.set = require('./set');
KeyValueAccessObject.expire = require('./expire');

KeyValueAccessObject.getConnector = function() {
  return this.getDataSource().connector;
};

