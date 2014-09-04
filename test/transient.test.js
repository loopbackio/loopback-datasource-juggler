var jdb = require('../');
var Schema = jdb.Schema;
var DataSource = jdb.DataSource;
var assert = require('assert');
var async = require('async');
var should = require('./init.js');

var getTransientSchema = function(settings) {
    return new Schema('transient', settings);
};

var db, TransientModel, Person, Widget, Item;

describe('Transient connector', function () {
  
  before(function () {
    db = getTransientSchema();
    TransientModel = db.define('TransientModel', {}, { idInjection: false });
    
    Person = TransientModel.extend('Person', {name: String});
    Person.attachTo(db);
    
    Widget = db.define('Widget', {name: String});
    Item = db.define('Item', {
      id: {type: Number, id: true}, name: String
    });
  });
  
  it('should respect idInjection being false', function(done) {
    should.not.exist(Person.definition.properties.id);
    should.exist(Person.definition.properties.name);
    
    Person.create({ name: 'Wilma' }, function(err, inst) {
      should.not.exist(err);
      inst.toObject().should.eql({ name: 'Wilma' });
      
      Person.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(0);
        done();
      });
    });
  });
  
  it('should generate a random string id', function(done) {
    should.exist(Widget.definition.properties.id);
    should.exist(Widget.definition.properties.name);
    
    Widget.definition.properties.id.type.should.equal(String);
    
    Widget.create({ name: 'Thing' }, function(err, inst) {
      should.not.exist(err);
      inst.id.should.match(/^[0-9a-fA-F]{24}$/);
      inst.name.should.equal('Thing');
      
      Widget.findById(inst.id, function(err, widget) {
        should.not.exist(err);
        should.not.exist(widget);
        done();
      });
    });
  });
  
  it('should generate a random number id', function(done) {
    should.exist(Item.definition.properties.id);
    should.exist(Item.definition.properties.name);
    
    Item.definition.properties.id.type.should.equal(Number);
    
    Item.create({ name: 'Example' }, function(err, inst) {
      should.not.exist(err);
      inst.name.should.equal('Example');
      
      Item.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(0);
        done();
      });
    });
  });
  
});
