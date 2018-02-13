// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var should = require('./init.js');
var DataSource = require('../lib/datasource.js').DataSource;

describe('DataSource', function() {
  it('reports helpful error when connector init throws', function() {
    var throwingConnector = {
      name: 'loopback-connector-throwing',
      initialize: function(ds, cb) {
        throw new Error('expected test error');
      },
    };

    (function() {
      // this is what LoopBack does
      return new DataSource({
        name: 'dsname',
        connector: throwingConnector,
      });
    }).should.throw(/loopback-connector-throwing/);
  });

  it('reports helpful error when connector init via short name throws', function() {
    (function() {
      // this is what LoopBack does
      return new DataSource({
        name: 'dsname',
        connector: 'throwing',
      });
    }).should.throw(/expected test error/);
  });

  it('reports helpful error when connector init via long name throws', function() {
    (function() {
      // this is what LoopBack does
      return new DataSource({
        name: 'dsname',
        connector: 'loopback-connector-throwing',
      });
    }).should.throw(/expected test error/);
  });

  /**
   * new DataSource(dsName, settings) without settings.name
   */
  it('should retain the name assigned to it', function() {
    var dataSource = new DataSource('myDataSource', {
      connector: 'memory',
    });

    dataSource.name.should.equal('myDataSource');
  });

  /**
   * new DataSource(dsName, settings)
   */
  it('should allow the name assigned to it to take precedence over the settings name', function() {
    var dataSource = new DataSource('myDataSource', {
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('myDataSource');
  });

  /**
   * new DataSource(settings) with settings.name
   */
  it('should retain the name from the settings if no name is assigned', function() {
    var dataSource = new DataSource({
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('defaultDataSource');
  });

  /**
   * new DataSource(undefined, settings)
   */
  it('should retain the name from the settings if name is undefined', function() {
    var dataSource = new DataSource(undefined, {
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('defaultDataSource');
  });

  /**
   * new DataSource(settings) without settings.name
   */
  it('should use the connector name if no name is provided', function() {
    var dataSource = new DataSource({
      connector: 'memory',
    });

    dataSource.name.should.equal('memory');
  });

  /**
   * new DataSource(connectorInstance)
   */
  it('should accept resolved connector', function() {
    var mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    var dataSource = new DataSource(mockConnector);

    dataSource.name.should.equal('loopback-connector-mock');
    dataSource.connector.should.equal(mockConnector);
  });

  /**
   * new DataSource(dsName, connectorInstance)
   */
  it('should accept resolved connector', function() {
    var mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    var dataSource = new DataSource('myDataSource', mockConnector);

    dataSource.name.should.equal('myDataSource');
    dataSource.connector.should.equal(mockConnector);
  });

  /**
   * new DataSource(connectorInstance, settings)
   */
  it('should accept resolved connector and settings', function() {
    var mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    var dataSource = new DataSource(mockConnector, {name: 'myDataSource'});

    dataSource.name.should.equal('myDataSource');
    dataSource.connector.should.equal(mockConnector);
  });
});
