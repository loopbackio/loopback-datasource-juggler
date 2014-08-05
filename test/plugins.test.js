// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;
var Memory = require('../lib/connectors/memory');

var plugins = jdb.plugins;

describe('Model class', function () {
  
  it('should define a plugin', function() {
    plugins.define('example', function(Model, options) {
      Model.prototype.example = function() {
        return options;
      };
    });
  })
  
  it('should apply plugin', function(done) {
    var memory = new DataSource({connector: Memory});
    var Item = memory.createModel('Item', { name: 'string' }, {
      plugins: { timestamps: true }
    });
    
    Item.plugin('example', { foo: 'bar' });
    
    var def = memory.getModelDefinition('Item');
    var json = def.toJSON();
    var properties = json.properties;
    properties.createdAt.should.eql({ type: 'Date' });
    properties.updatedAt.should.eql({ type: 'Date' });
    
    Item.create({ name: 'Item 1' }, function(err, inst) {
      inst.createdAt.should.be.a.date;
      inst.updatedAt.should.be.a.date;
      inst.example().should.eql({ foo: 'bar' });
      done();
    });
  });
  
});