'use strict';
var kvMemory = require('../lib/connectors/kv-memory');
var DataSource = require('..').DataSource;

describe('KeyValue-Memory connector', function() {
  var dataSourceFactory = function() {
    return new DataSource({connector: kvMemory});
  };

  require('./kvao.suite')(dataSourceFactory);
});
