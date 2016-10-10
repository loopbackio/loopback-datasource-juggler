'use strict';

// temporary config not comitted to git,
// this will need rework for the real test suite
var dbConfig = require('./kv-extreme-scale.config');

var DataSource = require('..').DataSource;
var connector = require('../lib/connectors/kv-extreme-scale');
var extend = require('util')._extend;

function createDataSource() {
  var settings = extend(dbConfig, {connector: connector});
  return new DataSource(settings);
};

describe('ExtremeScale connector', function() {
  this.timeout(10000);

  beforeEach(clearDatabase);

  describe('Juggler API', function() {
    require('./kvao.suite')(createDataSource, {
      canExpire: false,
      canQueryTtl: false,
      ttlPrecision: 1000,
    });
  });

  function clearDatabase(cb) {
    var ds = createDataSource();
    var requestOptions = {
      method: 'DELETE',
      uri: '',
    };
    ds.connector.request(requestOptions, cb);
  };
});
