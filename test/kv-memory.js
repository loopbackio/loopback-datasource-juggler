// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const kvMemory = require('../lib/connectors/kv-memory');
const DataSource = require('..').DataSource;

describe('Optimized KeyValue-Memory connector', function() {
  const dataSourceFactory = function() {
    return new DataSource({connector: kvMemory});
  };

  require('./kvao.suite')(dataSourceFactory);
});

describe('Unoptimized KeyValue-Memory connector', function() {
  const dataSourceFactory = function() {
    const ds = new DataSource({connector: kvMemory});

    // disable optimized methods
    ds.connector.deleteAll = false;

    return ds;
  };

  require('./kvao.suite')(dataSourceFactory);
});
