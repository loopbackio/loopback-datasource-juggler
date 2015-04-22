var jdb = require('../');
var DataSource = jdb.DataSource;
var should = require('./init.js');

describe('Memory connector with mocked discovery', function() {
  var ds;

  before(function() {
    ds = new DataSource({connector: 'memory'});

    var models = [{type: 'table', name: 'CUSTOMER', owner: 'STRONGLOOP'},
      {type: 'table', name: 'INVENTORY', owner: 'STRONGLOOP'},
      {type: 'table', name: 'LOCATION', owner: 'STRONGLOOP'}];

    ds.discoverModelDefinitions = function(options, cb) {
      process.nextTick(function() {
        cb(null, models);
      });
    };

    var modelProperties = [{
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'PRODUCT_ID',
      dataType: 'varchar',
      dataLength: 20,
      dataPrecision: null,
      dataScale: null,
      nullable: 0
    },
      {
        owner: 'STRONGLOOP',
        tableName: 'INVENTORY',
        columnName: 'LOCATION_ID',
        dataType: 'varchar',
        dataLength: 20,
        dataPrecision: null,
        dataScale: null,
        nullable: 0
      },
      {
        owner: 'STRONGLOOP',
        tableName: 'INVENTORY',
        columnName: 'AVAILABLE',
        dataType: 'int',
        dataLength: null,
        dataPrecision: 10,
        dataScale: 0,
        nullable: 1
      },
      {
        owner: 'STRONGLOOP',
        tableName: 'INVENTORY',
        columnName: 'TOTAL',
        dataType: 'int',
        dataLength: null,
        dataPrecision: 10,
        dataScale: 0,
        nullable: 1
      }];

    ds.discoverModelProperties = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, modelProperties);
      });
    };
  });

  it('should convert table/column names to camel cases', function(done) {
    ds.discoverSchemas('INVENTORY', {}, function(err, schemas) {
      if (err) return done(err);
      schemas.should.have.property('STRONGLOOP.INVENTORY');
      var s = schemas['STRONGLOOP.INVENTORY'];
      s.name.should.be.eql('Inventory');
      Object.keys(s.properties).should.be.eql(
        ['productId', 'locationId', 'available', 'total']);
      done();
    });
  });

  it('should convert table/column names with custom mapper', function(done) {
    ds.discoverSchemas('INVENTORY', {
      nameMapper: function(type, name) {
        // Convert all names to lower case
        return name.toLowerCase();
      }
    }, function(err, schemas) {
      if (err) return done(err);
      schemas.should.have.property('STRONGLOOP.INVENTORY');
      var s = schemas['STRONGLOOP.INVENTORY'];
      s.name.should.be.eql('inventory');
      Object.keys(s.properties).should.be.eql(
        ['product_id', 'location_id', 'available', 'total']);
      done();
    });
  });

  it('should not convert table/column names with null custom mapper',
    function(done) {
      ds.discoverSchemas('INVENTORY', {nameMapper: null}, function(err, schemas) {
        if (err) return done(err);
        schemas.should.have.property('STRONGLOOP.INVENTORY');
        var s = schemas['STRONGLOOP.INVENTORY'];
        s.name.should.be.eql('INVENTORY');
        Object.keys(s.properties).should.be.eql(
          ['PRODUCT_ID', 'LOCATION_ID', 'AVAILABLE', 'TOTAL']);
        done();
      });
    });

  it('should honor connector\'s discoverSchemas implementation',
    function(done) {
      var models = {
        inventory: {
          product: {type: 'string'},
          location: {type: 'string'}
        }
      };
      ds.connector.discoverSchemas = function(modelName, options, cb) {
        process.nextTick(function() {
          cb(null, models);
        });
      };
      ds.discoverSchemas('INVENTORY', {nameMapper: null}, function(err, schemas) {
        if (err) return done(err);
        schemas.should.be.eql(models);
        done();
      });
    });
});
