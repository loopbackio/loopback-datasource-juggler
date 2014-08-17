// This test written in mocha+should.js
var should = require('./init.js');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;
var Memory = require('../lib/connectors/memory');

var modelBuilder = new ModelBuilder();
var mixins = modelBuilder.mixins;

function timestamps(Model, options) {

  Model.defineProperty('createdAt', { type: Date });
  Model.defineProperty('updatedAt', { type: Date });

  var originalBeforeSave = Model.beforeSave;
  Model.beforeSave = function(next, data) {
    Model.applyTimestamps(data, this.isNewRecord());
    if (data.createdAt) {
      this.createdAt = data.createdAt;
    }
    if (data.updatedAt) {
      this.updatedAt = data.updatedAt;
    }
    if (originalBeforeSave) {
      originalBeforeSave.apply(this, arguments);
    } else {
      next();
    }
  };

  Model.applyTimestamps = function(data, creation) {
    data.updatedAt = new Date();
    if (creation) {
      data.createdAt = data.updatedAt;
    }
  };
}

mixins.define('TimeStamp', timestamps);

describe('Model class', function () {
  
  it('should define mixins', function() {
    mixins.define('Example', function(Model, options) {
      Model.prototype.example = function() {
        return options;
      };
    });
    mixins.define('Demo', function(Model, options) {
      Model.demoMixin = options.value;
    });
    mixins.define('Multi', function(Model, options) {
      Model.multiMixin = Model.multiMixin || {};
      Model.multiMixin[options.key] = options.value;
    });
  });
  
  it('should apply a mixin class', function() {
    var Address = modelBuilder.define('Address', {
      street: { type: 'string', required: true },
      city: { type: 'string', required: true }
    });

    var memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    var Item = memory.createModel('Item', { name: 'string' }, {
      mixins: { Address: true }
    });

    var properties = Item.definition.properties;
    
    properties.street.should.eql({ type: String, required: true });
    properties.city.should.eql({ type: String, required: true });
  });
  
  it('should apply mixins', function(done) {
    var memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    var Item = memory.createModel('Item', { name: 'string' }, {
      mixins: { 
        TimeStamp: true, Demo: { value: true },
        Multi: [
          { key: 'foo', value: 'bar' }, 
          { key: 'fox', value: 'baz' }
        ]
      }
    });
    
    Item.mixin('Example', { foo: 'bar' });
    
    Item.demoMixin.should.be.true;
    
    Item.multiMixin.foo.should.equal('bar');
    Item.multiMixin.fox.should.equal('baz');
    
    var properties = Item.definition.properties;
    properties.createdAt.should.eql({ type: Date });
    properties.updatedAt.should.eql({ type: Date });
    
    Item.create({ name: 'Item 1' }, function(err, inst) {
      inst.createdAt.should.be.a.date;
      inst.updatedAt.should.be.a.date;
      inst.example().should.eql({ foo: 'bar' });
      done();
    });
  });
  
});
