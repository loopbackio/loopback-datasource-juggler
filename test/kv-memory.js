var kvMemory = require('../lib/connectors/kv-memory');
var DataSource = require('..').DataSource;

describe('KeyValue-Memory connector', function() {
  var lastDataSource;
  var dataSourceFactory = function() {
    lastDataSource = new DataSource({ connector: kvMemory });
    return lastDataSource;
  };

  afterEach(function disconnectKVMemoryConnector() {
    if (lastDataSource) return lastDataSource.disconnect();
  });

  require('./kvao.suite')(dataSourceFactory);
});
