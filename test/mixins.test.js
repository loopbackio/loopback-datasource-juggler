// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');
var path = require('path');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;
var Memory = require('../lib/connectors/memory');

var mixins = jdb.mixins;

describe('Model class', function () {
  
  it('should define a mixin', function() {
    mixins.define('Example', function(Model, options) {
      Model.prototype.example = function() {
        return options;
      };
    });
  });
  
  it('should load mixins from directory', function() {
    var expected = [ 'TimeStamp', 'Example', 'Address', 'Demo', 'Other' ];
    mixins.load(path.join(__dirname, 'fixtures', 'mixins'));
    mixins.registry.should.have.property('TimeStamp');
    mixins.registry.should.have.property('Example');
    mixins.registry.should.have.property('Address');
    mixins.registry.should.have.property('Demo');
    mixins.registry.should.have.property('Other');
  });
  
  it('should apply a mixin class', function() {
    var memory = new DataSource({connector: Memory});
    var Item = memory.createModel('Item', { name: 'string' }, {
      mixins: { TimeStamp: true, demo: true, Address: true }
    });
    
    var modelBuilder = new ModelBuilder();
    var Address = modelBuilder.define('Address', {
      street: { type: 'string', required: true },
      city: { type: 'string', required: true }
    });
    
    Item.mixin(Address);
    
    var def = memory.getModelDefinition('Item');
    var properties = def.toJSON().properties;
    
    // properties.street.should.eql({ type: 'String', required: true });
    // properties.city.should.eql({ type: 'String', required: true });
  });
  
  it('should apply mixins', function(done) {
    var memory = new DataSource({connector: Memory});
    var Item = memory.createModel('Item', { name: 'string' }, {
      mixins: { TimeStamp: true, demo: { ok: true }, Address: true }
    });
    
    Item.mixin('Example', { foo: 'bar' });
    Item.mixin('other');
    
    var def = memory.getModelDefinition('Item');
    var properties = def.toJSON().properties;
    properties.createdAt.should.eql({ type: 'Date' });
    properties.updatedAt.should.eql({ type: 'Date' });
    
    // properties.street.should.eql({ type: 'String', required: true });
    // properties.city.should.eql({ type: 'String', required: true });
    
    Item.demoMixin.should.be.true;
    Item.prototype.otherMixin.should.be.true;
    
    Item.create({ name: 'Item 1' }, function(err, inst) {
      inst.createdAt.should.be.a.date;
      inst.updatedAt.should.be.a.date;
      inst.example().should.eql({ foo: 'bar' });
      done();
    });
  });
  
});
