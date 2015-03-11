var should = require('./init.js');

var jdb = require('../');
var DataSource = jdb.DataSource;

var ds, Item, Variant;
describe('Datasource-specific field types for foreign keys', function () {
  before(function () {
    ds = new DataSource('memory');
    Item = ds.define('Item', {
      "myProp": {
        "id": true,
        "type": "string",
        "memory": {
          "dataType": "string"
        }
      }
    });
    Variant = ds.define('Variant', {}, {
      relations: {
        "item": {
          "type": "belongsTo",
          "as": "item",
          "model": "Item",
          "foreignKey": "myProp"
        }
      }
    });
  });

  it('should create foreign key with database-specific field type', function (done) {
    var VariantDefinition = ds.getModelDefinition('Variant');
    should.exist(VariantDefinition);
    should.exist(VariantDefinition.properties.myProp.memory);
    should.exist(VariantDefinition.properties.myProp.memory.dataType);
    VariantDefinition.properties.myProp.memory.dataType.should.be.equal("string");
    done();
  });
})
;
