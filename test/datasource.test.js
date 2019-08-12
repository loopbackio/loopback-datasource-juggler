// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');
const DataSource = require('../lib/datasource.js').DataSource;

describe('DataSource', function() {
  it('reports helpful error when connector init throws', function() {
    const throwingConnector = {
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
    const dataSource = new DataSource('myDataSource', {
      connector: 'memory',
    });

    dataSource.name.should.equal('myDataSource');
  });

  /**
   * new DataSource(dsName, settings)
   */
  it('should allow the name assigned to it to take precedence over the settings name', function() {
    const dataSource = new DataSource('myDataSource', {
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('myDataSource');
  });

  /**
   * new DataSource(settings) with settings.name
   */
  it('should retain the name from the settings if no name is assigned', function() {
    const dataSource = new DataSource({
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('defaultDataSource');
  });

  /**
   * new DataSource(undefined, settings)
   */
  it('should retain the name from the settings if name is undefined', function() {
    const dataSource = new DataSource(undefined, {
      name: 'defaultDataSource',
      connector: 'memory',
    });

    dataSource.name.should.equal('defaultDataSource');
  });

  /**
   * new DataSource(settings) without settings.name
   */
  it('should use the connector name if no name is provided', function() {
    const dataSource = new DataSource({
      connector: 'memory',
    });

    dataSource.name.should.equal('memory');
  });

  /**
   * new DataSource(connectorInstance)
   */
  it('should accept resolved connector', function() {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    const dataSource = new DataSource(mockConnector);

    dataSource.name.should.equal('loopback-connector-mock');
    dataSource.connector.should.equal(mockConnector);
  });

  /**
   * new DataSource(dsName, connectorInstance)
   */
  it('should accept dsName and resolved connector', function() {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    const dataSource = new DataSource('myDataSource', mockConnector);

    dataSource.name.should.equal('myDataSource');
    dataSource.connector.should.equal(mockConnector);
  });

  /**
   * new DataSource(connectorInstance, settings)
   */
  it('should accept resolved connector and settings', function() {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        return cb(null);
      },
    };
    const dataSource = new DataSource(mockConnector, {name: 'myDataSource'});

    dataSource.name.should.equal('myDataSource');
    dataSource.connector.should.equal(mockConnector);
  });

  it('should set states correctly with eager connect', function(done) {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        this.connect(cb);
      },

      connect: function(cb) {
        process.nextTick(function() {
          cb(null);
        });
      },
    };
    const dataSource = new DataSource(mockConnector);
    // DataSource is instantiated
    // connected: false, connecting: false, initialized: false
    dataSource.connected.should.be.false();
    dataSource.connecting.should.be.false();
    dataSource.initialized.should.be.false();

    dataSource.on('initialized', function() {
      // DataSource is initialized with lazyConnect
      // connected: false, connecting: false, initialized: true
      dataSource.connected.should.be.false();
      dataSource.connecting.should.be.false();
      dataSource.initialized.should.be.true();
    });

    dataSource.on('connected', function() {
      // DataSource is now connected
      // connected: true, connecting: false
      dataSource.connected.should.be.true();
      dataSource.connecting.should.be.false();
    });

    // Call connect() in next tick so that we'll receive initialized event
    // first
    process.nextTick(function() {
      // At this point, the datasource is already connected by
      // connector's (mockConnector) initialize function
      dataSource.connect(function() {
        // DataSource is now connected
        // connected: true, connecting: false
        dataSource.connected.should.be.true();
        dataSource.connecting.should.be.false();
        done();
      });
      // As the datasource is already connected, no connecting will happen
      // connected: true, connecting: false
      dataSource.connected.should.be.true();
      dataSource.connecting.should.be.false();
    });
  });

  it('should set states correctly with deferred connect', function(done) {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        // Explicitly call back with false to denote connection is not ready
        process.nextTick(function() {
          cb(null, false);
        });
      },

      connect: function(cb) {
        process.nextTick(function() {
          cb(null);
        });
      },
    };
    const dataSource = new DataSource(mockConnector);
    // DataSource is instantiated
    // connected: false, connecting: false, initialized: false
    dataSource.connected.should.be.false();
    dataSource.connecting.should.be.false();
    dataSource.initialized.should.be.false();

    dataSource.on('initialized', function() {
      // DataSource is initialized with lazyConnect
      // connected: false, connecting: false, initialized: true
      dataSource.connected.should.be.false();
      dataSource.connecting.should.be.false();
      dataSource.initialized.should.be.true();
    });

    dataSource.on('connected', function() {
      // DataSource is now connected
      // connected: true, connecting: false
      dataSource.connected.should.be.true();
      dataSource.connecting.should.be.false();
    });

    // Call connect() in next tick so that we'll receive initialized event
    // first
    process.nextTick(function() {
      dataSource.connect(function() {
        // DataSource is now connected
        // connected: true, connecting: false
        dataSource.connected.should.be.true();
        dataSource.connecting.should.be.false();
        done();
      });
      // As the datasource is not connected, connecting will happen
      // connected: false, connecting: true
      dataSource.connected.should.be.false();
      dataSource.connecting.should.be.true();
    });
  });

  it('should set states correctly with lazyConnect = true', function(done) {
    const mockConnector = {
      name: 'loopback-connector-mock',
      initialize: function(ds, cb) {
        ds.connector = mockConnector;
        process.nextTick(function() {
          cb(null);
        });
      },

      connect: function(cb) {
        process.nextTick(function() {
          cb(null);
        });
      },
    };
    const dataSource = new DataSource(mockConnector, {lazyConnect: true});
    // DataSource is instantiated
    // connected: false, connecting: false, initialized: false
    dataSource.connected.should.be.false();
    dataSource.connecting.should.be.false();
    dataSource.initialized.should.be.false();

    dataSource.on('initialized', function() {
      // DataSource is initialized with lazyConnect
      // connected: false, connecting: false, initialized: true
      dataSource.connected.should.be.false();
      dataSource.connecting.should.be.false();
      dataSource.initialized.should.be.true();
    });

    dataSource.on('connected', function() {
      // DataSource is now connected
      // connected: true, connecting: false
      dataSource.connected.should.be.true();
      dataSource.connecting.should.be.false();
    });

    // Call connect() in next tick so that we'll receive initialized event
    // first
    process.nextTick(function() {
      dataSource.connect(function() {
        // DataSource is now connected
        // connected: true, connecting: false
        dataSource.connected.should.be.true();
        dataSource.connecting.should.be.false();
        done();
      });
      // DataSource is now connecting
      // connected: false, connecting: true
      dataSource.connected.should.be.false();
      dataSource.connecting.should.be.true();
    });
  });

  describe('deleteModelByName()', () => {
    it('removes the model from ModelBuilder registry', () => {
      const ds = new DataSource('ds', {connector: 'memory'});

      ds.createModel('TestModel');
      Object.keys(ds.modelBuilder.models)
        .should.containEql('TestModel');
      Object.keys(ds.modelBuilder.definitions)
        .should.containEql('TestModel');

      ds.deleteModelByName('TestModel');

      Object.keys(ds.modelBuilder.models)
        .should.not.containEql('TestModel');
      Object.keys(ds.modelBuilder.definitions)
        .should.not.containEql('TestModel');
    });

    it('removes the model from connector registry', () => {
      const ds = new DataSource('ds', {connector: 'memory'});

      ds.createModel('TestModel');
      Object.keys(ds.connector._models)
        .should.containEql('TestModel');

      ds.deleteModelByName('TestModel');

      Object.keys(ds.connector._models)
        .should.not.containEql('TestModel');
    });
  });

  describe('getMaxOfflineRequests', () => {
    let ds;
    beforeEach(() => ds = new DataSource('ds', {connector: 'memory'}));

    it('sets the default maximum number of event listeners to 16', () => {
      ds.getMaxOfflineRequests().should.be.eql(16);
    });

    it('uses provided number of listeners', () => {
      ds.settings.maxOfflineRequests = 17;
      ds.getMaxOfflineRequests().should.be.eql(17);
    });

    it('throws an error if a non-number is provided for the max number of listeners', () => {
      ds.settings.maxOfflineRequests = '17';

      (function() {
        return ds.getMaxOfflineRequests();
      }).should.throw('maxOfflineRequests must be a number');
    });
  });
});
