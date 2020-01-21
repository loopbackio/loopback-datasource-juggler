// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

function KeyValueAccessObject() {
}

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

