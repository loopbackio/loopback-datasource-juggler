// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const jdb = require('../');
const DataSource = jdb.DataSource;
const should = require('./init.js');

describe('Memory connector with mocked discovery', function() {
  let ds;

  before(function() {
    ds = new DataSource({connector: 'memory'});

    const models = [{type: 'table', name: 'CUSTOMER', owner: 'STRONGLOOP'},
      {type: 'table', name: 'INVENTORY', owner: 'STRONGLOOP'},
      {type: 'table', name: 'LOCATION', owner: 'STRONGLOOP'}];

    ds.discoverModelDefinitions = function(options, cb) {
      process.nextTick(function() {
        cb(null, models);
      });
    };

    const modelProperties = [{
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'PRODUCT_ID',
      dataType: 'varchar',
      dataLength: 20,
      dataPrecision: null,
      dataScale: null,
      nullable: 0,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'LOCATION_ID',
      dataType: 'varchar',
      dataLength: 20,
      dataPrecision: null,
      dataScale: null,
      nullable: 0,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'AVAILABLE',
      dataType: 'int',
      dataLength: null,
      dataPrecision: 10,
      dataScale: 0,
      nullable: 1,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'TOTAL',
      dataType: 'int',
      dataLength: null,
      dataPrecision: 10,
      dataScale: 0,
      nullable: 1,
    }];

    ds.discoverModelProperties = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, modelProperties);
      });
    };
  });

  it('should convert table names to pascal cases and column names to camel case', function(done) {
    ds.discoverSchemas('INVENTORY', {}, function(err, schemas) {
      if (err) return done(err);
      schemas.should.have.property('STRONGLOOP.INVENTORY');
      const s = schemas['STRONGLOOP.INVENTORY'];
      s.name.should.be.eql('Inventory');
      Object.keys(s.properties).should.be.eql(
        ['productId', 'locationId', 'available', 'total'],
      );
      done();
    });
  });

  it('should keep the column names the same as database', function(done) {
    ds.discoverSchemas('INVENTORY', {disableCamelCase: true}, function(err, schemas) {
      if (err) return done(err);
      schemas.should.have.property('STRONGLOOP.INVENTORY');
      const s = schemas['STRONGLOOP.INVENTORY'];
      s.name.should.be.eql('Inventory');
      Object.keys(s.properties).should.be.eql(
        ['PRODUCT_ID', 'LOCATION_ID', 'AVAILABLE', 'TOTAL'],
      );
      done();
    });
  });

  it('should convert table/column names with custom mapper', function(done) {
    ds.discoverSchemas('INVENTORY', {
      nameMapper: function(type, name) {
        // Convert all names to lower case
        return name.toLowerCase();
      },
    }, function(err, schemas) {
      if (err) return done(err);
      schemas.should.have.property('STRONGLOOP.INVENTORY');
      const s = schemas['STRONGLOOP.INVENTORY'];
      s.name.should.be.eql('inventory');
      Object.keys(s.properties).should.be.eql(
        ['product_id', 'location_id', 'available', 'total'],
      );
      done();
    });
  });

  it('should not convert table/column names with null custom mapper',
    function(done) {
      ds.discoverSchemas('INVENTORY', {nameMapper: null}, function(err, schemas) {
        if (err) return done(err);
        schemas.should.have.property('STRONGLOOP.INVENTORY');
        const s = schemas['STRONGLOOP.INVENTORY'];
        s.name.should.be.eql('INVENTORY');
        Object.keys(s.properties).should.be.eql(
          ['PRODUCT_ID', 'LOCATION_ID', 'AVAILABLE', 'TOTAL'],
        );
        done();
      });
    });

  it('should honor connector\'s discoverSchemas implementation',
    function(done) {
      const models = {
        inventory: {
          product: {type: 'string'},
          location: {type: 'string'},
        },
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

  it('should callback function, passed as options parameter',
    function(done) {
      const models = {
        inventory: {
          product: {type: 'string'},
          location: {type: 'string'},
        },
      };
      ds.connector.discoverSchemas = function(modelName, options, cb) {
        process.nextTick(function() {
          cb(null, models);
        });
      };

      const options = function(err, schemas) {
        if (err) return done(err);
        schemas.should.be.eql(models);
        done();
      };

      ds.discoverSchemas('INVENTORY', options);
    });

  it('should discover schemas using `discoverSchemas` - promise variant',
    function(done) {
      ds.connector.discoverSchemas = null;
      ds.discoverSchemas('INVENTORY', {})
        .then(function(schemas) {
          schemas.should.have.property('STRONGLOOP.INVENTORY');

          const s = schemas['STRONGLOOP.INVENTORY'];
          s.name.should.be.eql('Inventory');

          Object.keys(s.properties).should.be.eql(
            ['productId', 'locationId', 'available', 'total'],
          );
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

  describe('discoverSchema', function() {
    let models;
    let schema;
    before(function() {
      schema = {
        name: 'Inventory',
        options: {
          idInjection: false,
          memory: {schema: 'STRONGLOOP', table: 'INVENTORY'},
        },
        properties: {
          available: {
            length: null,
            memory: {
              columnName: 'AVAILABLE',
              dataLength: null,
              dataPrecision: 10,
              dataScale: 0,
              dataType: 'int',
              nullable: 1,
            },
            precision: 10,
            required: false,
            scale: 0,
            type: undefined,
          },
          locationId: {
            length: 20,
            memory: {
              columnName: 'LOCATION_ID',
              dataLength: 20,
              dataPrecision: null,
              dataScale: null,
              dataType: 'varchar',
              nullable: 0,
            },
            precision: null,
            required: true,
            scale: null,
            type: undefined,
          },
          productId: {
            length: 20,
            memory: {
              columnName: 'PRODUCT_ID',
              dataLength: 20,
              dataPrecision: null,
              dataScale: null,
              dataType: 'varchar',
              nullable: 0,
            },
            precision: null,
            required: true,
            scale: null,
            type: undefined,
          },
          total: {
            length: null,
            memory: {
              columnName: 'TOTAL',
              dataLength: null,
              dataPrecision: 10,
              dataScale: 0,
              dataType: 'int',
              nullable: 1,
            },
            precision: 10,
            required: false,
            scale: 0,
            type: undefined,
          },
        },
      };
    });

    it('should discover schema using `discoverSchema`', function(done) {
      ds.discoverSchema('INVENTORY', {}, function(err, schemas) {
        if (err) return done(err);
        schemas.should.be.eql(schema);
        done();
      });
    });

    it('should callback function, passed as options parameter', function(done) {
      const options = function(err, schemas) {
        if (err) return done(err);
        schemas.should.be.eql(schema);
        done();
      };

      ds.discoverSchema('INVENTORY', options);
    });

    it('should discover schema using `discoverSchema` - promise variant', function(done) {
      ds.discoverSchema('INVENTORY', {})
        .then(function(schemas) {
          schemas.should.be.eql(schema);
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });
  });
});

describe('discoverModelDefinitions', function() {
  let ds;
  before(function() {
    ds = new DataSource({connector: 'memory'});

    const models = [{type: 'table', name: 'CUSTOMER', owner: 'STRONGLOOP'},
      {type: 'table', name: 'INVENTORY', owner: 'STRONGLOOP'},
      {type: 'table', name: 'LOCATION', owner: 'STRONGLOOP'}];

    ds.connector.discoverModelDefinitions = function(options, cb) {
      process.nextTick(function() {
        cb(null, models);
      });
    };
  });

  it('should discover model using `discoverModelDefinitions`', function(done) {
    ds.discoverModelDefinitions({}, function(err, schemas) {
      if (err) return done(err);

      const tableNames = schemas.map(function(s) {
        return s.name;
      });

      tableNames.should.be.eql(
        ['CUSTOMER', 'INVENTORY', 'LOCATION'],
      );
      done();
    });
  });

  it('should callback function, passed as options parameter', function(done) {
    const options = function(err, schemas) {
      if (err) return done(err);

      const tableNames = schemas.map(function(s) {
        return s.name;
      });

      tableNames.should.be.eql(
        ['CUSTOMER', 'INVENTORY', 'LOCATION'],
      );
      done();
    };

    ds.discoverModelDefinitions(options);
  });

  it('should discover model using `discoverModelDefinitions` - promise variant', function(done) {
    ds.discoverModelDefinitions({})
      .then(function(schemas) {
        const tableNames = schemas.map(function(s) {
          return s.name;
        });

        tableNames.should.be.eql(
          ['CUSTOMER', 'INVENTORY', 'LOCATION'],
        );
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});

describe('discoverModelProperties', function() {
  let ds;
  let modelProperties;
  before(function() {
    ds = new DataSource({connector: 'memory'});

    modelProperties = [{
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'PRODUCT_ID',
      dataType: 'varchar',
      dataLength: 20,
      dataPrecision: null,
      dataScale: null,
      nullable: 0,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'LOCATION_ID',
      dataType: 'varchar',
      dataLength: 20,
      dataPrecision: null,
      dataScale: null,
      nullable: 0,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'AVAILABLE',
      dataType: 'int',
      dataLength: null,
      dataPrecision: 10,
      dataScale: 0,
      nullable: 1,
    },
    {
      owner: 'STRONGLOOP',
      tableName: 'INVENTORY',
      columnName: 'TOTAL',
      dataType: 'int',
      dataLength: null,
      dataPrecision: 10,
      dataScale: 0,
      nullable: 1,
    }];

    ds.connector.discoverModelProperties = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, modelProperties);
      });
    };
  });

  it('should callback function, passed as options parameter', function(done) {
    const options = function(err, schemas) {
      if (err) return done(err);

      schemas.should.be.eql(modelProperties);
      done();
    };

    ds.discoverModelProperties('INVENTORY', options);
  });

  it('should discover model metadata using `discoverModelProperties`', function(done) {
    ds.discoverModelProperties('INVENTORY', {}, function(err, schemas) {
      if (err) return done(err);

      schemas.should.be.eql(modelProperties);
      done();
    });
  });

  it('should discover model metadata using `discoverModelProperties` - promise variant', function(done) {
    ds.discoverModelProperties('INVENTORY', {})
      .then(function(schemas) {
        schemas.should.be.eql(modelProperties);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});

describe('discoverPrimaryKeys', function() {
  let ds;
  let modelProperties, primaryKeys;
  before(function() {
    ds = new DataSource({connector: 'memory'});

    primaryKeys = [
      {
        owner: 'STRONGLOOP',
        tableName: 'INVENTORY',
        columnName: 'PRODUCT_ID',
        keySeq: 1,
        pkName: 'ID_PK',
      },
      {
        owner: 'STRONGLOOP',
        tableName: 'INVENTORY',
        columnName: 'LOCATION_ID',
        keySeq: 2,
        pkName: 'ID_PK',
      }];

    ds.connector.discoverPrimaryKeys = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, primaryKeys);
      });
    };
  });

  it('should discover primary key definitions using `discoverPrimaryKeys`', function(done) {
    ds.discoverPrimaryKeys('INVENTORY', {}, function(err, modelPrimaryKeys) {
      if (err) return done(err);

      modelPrimaryKeys.should.be.eql(primaryKeys);
      done();
    });
  });

  it('should callback function, passed as options parameter', function(done) {
    const options = function(err, modelPrimaryKeys) {
      if (err) return done(err);

      modelPrimaryKeys.should.be.eql(primaryKeys);
      done();
    };
    ds.discoverPrimaryKeys('INVENTORY', options);
  });

  it('should discover primary key definitions using `discoverPrimaryKeys` - promise variant', function(done) {
    ds.discoverPrimaryKeys('INVENTORY', {})
      .then(function(modelPrimaryKeys) {
        modelPrimaryKeys.should.be.eql(primaryKeys);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});

describe('discoverForeignKeys', function() {
  let ds;
  let modelProperties, foreignKeys;
  before(function() {
    ds = new DataSource({connector: 'memory'});

    foreignKeys = [{
      fkOwner: 'STRONGLOOP',
      fkName: 'PRODUCT_FK',
      fkTableName: 'INVENTORY',
      fkColumnName: 'PRODUCT_ID',
      keySeq: 1,
      pkOwner: 'STRONGLOOP',
      pkName: 'PRODUCT_PK',
      pkTableName: 'PRODUCT',
      pkColumnName: 'ID',
    }];

    ds.connector.discoverForeignKeys = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, foreignKeys);
      });
    };
  });

  it('should discover foreign key definitions using `discoverForeignKeys`', function(done) {
    ds.discoverForeignKeys('INVENTORY', {}, function(err, modelForeignKeys) {
      if (err) return done(err);

      modelForeignKeys.should.be.eql(foreignKeys);
      done();
    });
  });

  it('should callback function, passed as options parameter', function(done) {
    const options = function(err, modelForeignKeys) {
      if (err) return done(err);

      modelForeignKeys.should.be.eql(foreignKeys);
      done();
    };

    ds.discoverForeignKeys('INVENTORY', options);
  });

  it('should discover foreign key definitions using `discoverForeignKeys` - promise variant', function(done) {
    ds.discoverForeignKeys('INVENTORY', {})
      .then(function(modelForeignKeys) {
        modelForeignKeys.should.be.eql(foreignKeys);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});

describe('discoverExportedForeignKeys', function() {
  let ds;
  let modelProperties, exportedForeignKeys;
  before(function() {
    ds = new DataSource({connector: 'memory'});

    exportedForeignKeys = [{
      fkName: 'PRODUCT_FK',
      fkOwner: 'STRONGLOOP',
      fkTableName: 'INVENTORY',
      fkColumnName: 'PRODUCT_ID',
      keySeq: 1,
      pkName: 'PRODUCT_PK',
      pkOwner: 'STRONGLOOP',
      pkTableName: 'PRODUCT',
      pkColumnName: 'ID',
    }];

    ds.connector.discoverExportedForeignKeys = function(modelName, options, cb) {
      process.nextTick(function() {
        cb(null, exportedForeignKeys);
      });
    };
  });

  it('should discover foreign key definitions using `discoverExportedForeignKeys`', function(done) {
    ds.discoverExportedForeignKeys('INVENTORY', {}, function(err, modelForeignKeys) {
      if (err) return done(err);

      modelForeignKeys.should.be.eql(exportedForeignKeys);
      done();
    });
  });

  it('should callback function, passed as options parameter', function(done) {
    const options = function(err, modelForeignKeys) {
      if (err) return done(err);

      modelForeignKeys.should.be.eql(exportedForeignKeys);
      done();
    };

    ds.discoverExportedForeignKeys('INVENTORY', options);
  });

  it('should discover foreign key definitions using `discoverExportedForeignKeys` - promise variant',
    function(done) {
      ds.discoverExportedForeignKeys('INVENTORY', {})
        .then(function(modelForeignKeys) {
          modelForeignKeys.should.be.eql(exportedForeignKeys);
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });
});

describe('Mock connector', function() {
  const mockConnectors = require('./mock-connectors');
  describe('customFieldSettings', function() {
    const ds = new DataSource(mockConnectors.customFieldSettings);

    it('should be present in discoverSchemas', function(done) {
      ds.discoverSchemas('person', function(err, schemas) {
        should.not.exist(err);
        schemas.should.be.an.Object;
        schemas['public.person'].properties.name
          .custom.storage.should.equal('quantum');
        done();
      });
    });
  });
});

describe('Default memory connector', function() {
  const nonExistantError = 'Table \'NONEXISTENT\' does not exist.';
  let ds;

  before(function() {
    ds = new DataSource({connector: 'memory'});
  });

  it('discoverSchema should return an error when table does not exist', function(done) {
    ds.discoverSchema('NONEXISTENT', {}, function(err, schemas) {
      should.exist(err);
      err.message.should.eql(nonExistantError);
      done();
    });
  });

  it('discoverSchemas should return an error when table does not exist', function(done) {
    ds.discoverSchemas('NONEXISTENT', {}, function(err, schemas) {
      should.exist(err);
      err.message.should.eql(nonExistantError);
      done();
    });
  });
});
