// This test written in mocha+should.js
var should = require('./init.js');
var async = require('async');

var db, Product, Tool, Widget;

// This test requires a connector that can
// handle a custom collection or table name

describe('default scope', function () {
  
  before(function (done) {
    db = getSchema();

    Product = db.define('Product', {
      name: String,
      kind: String,
      description: String
    }, {
      scope: { order: 'name' },
    });
    
    Tool = db.define('Tool', { 
        name: String, 
        kind: String,
        description: String
      }, {
        base: 'Product',
        scope: { where: { kind: 'tool' }, order: 'name' },
        mongodb: { collection: 'Product' },
        memory: { collection: 'Product' }
    });
    
    Widget = db.define('Widget', { 
        name: String, 
        kind: String,
        description: String
      }, {
        base: 'Product',
        scope: { where: { kind: 'widget' }, order: 'name' },
        mongodb: { collection: 'Product' },
        memory: { collection: 'Product' }
    });

    db.automigrate(done);
  });
  
  describe('manipulation', function() {
    
    var ids = {};
    
    before(function(done) {
      db.automigrate(done);
    });
    
    it('should return a scoped instance', function() {
      var p = new Tool({name: 'Product A', kind:'ignored'});
      p.name.should.equal('Product A');
      p.kind.should.equal('tool');
      p.setAttributes({ kind: 'ignored' });
      p.kind.should.equal('tool');
      
      p.setAttribute('kind', 'other'); // currently not enforced
      p.kind.should.equal('other');
    });
    
    it('should create a scoped instance - tool', function(done) {
      Tool.create({name: 'Product A', kind: 'ignored'}, function(err, p) {
        should.not.exist(err);
        p.name.should.equal('Product A');
        p.kind.should.equal('tool');
        ids.productA = p.id;
        done();
      });
    });
    
    it('should create a scoped instance - widget', function(done) {
      Widget.create({name: 'Product B', kind: 'ignored'}, function(err, p) {
        should.not.exist(err);
        p.name.should.equal('Product B');
        p.kind.should.equal('widget');
        ids.productB = p.id;
        done();
      });
    });
  
    it('should update a scoped instance - updateAttributes', function(done) {
      Tool.findById(ids.productA, function(err, p) {
        p.updateAttributes({description: 'A thing...', kind: 'ingored'}, function(err, inst) {
          should.not.exist(err);
          p.name.should.equal('Product A');
          p.kind.should.equal('tool');
          p.description.should.equal('A thing...');
          done();
        });
      });
    });
  
    it('should update a scoped instance - save', function(done) {
      Tool.findById(ids.productA, function(err, p) {
        p.description = 'Something...';
        p.kind = 'ignored';
        p.save(function(err, inst) {
          should.not.exist(err);
          p.name.should.equal('Product A');
          p.kind.should.equal('tool');
          p.description.should.equal('Something...');
          Tool.findById(ids.productA, function(err, p) {
            p.kind.should.equal('tool');
            done();
          });
        });
      });
    });
  
    it('should update a scoped instance - updateOrCreate', function(done) {
      var data = {id: ids.productA, description: 'Anything...', kind: 'ingored'};
      Tool.updateOrCreate(data, function(err, p) {
          should.not.exist(err);
          p.name.should.equal('Product A');
          p.kind.should.equal('tool');
          p.description.should.equal('Anything...');
          done();
      });
    });
  
  });
  
  describe('queries', function() {
    
    var ids = {};
    
    before(function (done) {
      db.automigrate(function(err) {
        async.series([
          function(next) {
            Tool.create({name: 'Tool Z'}, function(err, inst) {
              ids.toolZ = inst.id;
              next();
            });
          },
          function(next) {
            Widget.create({name: 'Widget Z'}, function(err, inst) {
              ids.widgetZ = inst.id;
              next();
            });
          },
          function(next) {
            Tool.create({name: 'Tool A'}, function(err, inst) {
              ids.toolA = inst.id;
              next();
            });
          },
          function(next) {
            Widget.create({name: 'Widget A'}, function(err, inst) {
              ids.widgetA = inst.id;
              next();
            });
          }
        ], done);
      });
    });
    
    it('should apply default scope - order', function(done) {
      Product.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(4);
        products[0].name.should.equal('Tool A');
        products[1].name.should.equal('Tool Z');
        products[2].name.should.equal('Widget A');
        products[3].name.should.equal('Widget Z');
        done();
      });
    });
    
    it('should apply default scope - order override', function(done) {
      Product.find({ order: 'name DESC' }, function(err, products) {
        should.not.exist(err);
        products.should.have.length(4);
        products[0].name.should.equal('Widget Z');
        products[1].name.should.equal('Widget A');
        products[2].name.should.equal('Tool Z');
        products[3].name.should.equal('Tool A');
        done();
      });
    });
    
    it('should apply default scope - where + order (tool)', function(done) {
      Tool.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Tool A');
        products[1].name.should.equal('Tool Z');
        done();
      });
    });
    
    it('should apply default scope - where + order (widget)', function(done) {
      Widget.find({ order: 'name DESC' }, function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Widget Z');
        products[1].name.should.equal('Widget A');
        done();
      });
    });
  
  });
  
});