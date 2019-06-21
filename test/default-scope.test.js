// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

// This test written in mocha+should.js
var should = require('./init.js');
var async = require('async');

var db, Category, Product, Tool, Widget, Thing, Person, FavoriteTool;

// This test requires a connector that can
// handle a custom collection or table name

// TODO [fabien] add table for pgsql/mysql
// TODO [fabien] change model definition - see #293

var setupProducts = function(ids, done) {
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
      Tool.create({name: 'Tool A', active: false}, function(err, inst) {
        ids.toolA = inst.id;
        next();
      });
    },
    function(next) {
      Widget.create({name: 'Widget A'}, function(err, inst) {
        ids.widgetA = inst.id;
        next();
      });
    },
    function(next) {
      Widget.create({name: 'Widget B', active: false}, function(err, inst) {
        ids.widgetB = inst.id;
        next();
      });
    },
  ], done);
};

describe('default scope', function() {
  before(function(done) {
    db = getSchema();

    Category = db.define('Category', {
      name: String,
    });

    Product = db.define('Product', {
      name: String,
      kind: String,
      description: String,
      active: {type: Boolean, default: true},
    }, {
      scope: {order: 'name'},
      scopes: {active: {where: {active: true}}},
    });

    FavoriteTool = db.define('FavoriteTool', {
      name: String,
      tool: {type: 'Tool'},
    });

    Product.lookupModel = function(data) {
      var m = this.dataSource.models[data.kind];
      if (m.base === this) return m;
      return this;
    };

    Tool = db.define('Tool', Product.definition.properties, {
      base: 'Product',
      scope: {where: {kind: 'Tool'}, order: 'name'},
      scopes: {active: {where: {active: true}}},
      arangodb: {collection: 'Product'},
      mongodb: {collection: 'Product'},
      memory: {collection: 'Product'},
    });

    Widget = db.define('Widget', Product.definition.properties, {
      base: 'Product',
      properties: {kind: 'Widget'},
      scope: {where: {kind: 'Widget'}, order: 'name'},
      scopes: {active: {where: {active: true}}},
      arangodb: {collection: 'Product'},
      mongodb: {collection: 'Product'},
      memory: {collection: 'Product'},
    });

    Person = db.define('Person', {name: String}, {
      scope: {include: 'things'},
    });

    // inst is only valid for instance methods
    // like save, updateAttributes

    var scopeFn = function(target, inst) {
      return {where: {kind: this.modelName}};
    };

    var propertiesFn = function(target, inst) {
      return {kind: this.modelName};
    };

    Thing = db.define('Thing', Product.definition.properties, {
      base: 'Product',
      attributes: propertiesFn,
      scope: scopeFn,
      arangodb: {collection: 'Product'},
      mongodb: {collection: 'Product'},
      memory: {collection: 'Product'},
    });

    Category.hasMany(Product);
    Category.hasMany(Tool, {scope: {order: 'name DESC'}});
    Category.hasMany(Widget);
    Category.hasMany(Thing);

    Product.belongsTo(Category);
    Tool.belongsTo(Category);
    Widget.belongsTo(Category);
    Thing.belongsTo(Category);

    Person.hasMany(Thing);
    Thing.belongsTo(Person);

    db.automigrate(done);
  });

  describe('manipulation', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(done);
    });

    it('should return a scoped instance', function() {
      var p = new Tool({name: 'Product A', kind: 'ignored'});
      p.name.should.equal('Product A');
      p.kind.should.equal('Tool');
      p.setAttributes({kind: 'ignored'});
      p.kind.should.equal('Tool');

      p.setAttribute('kind', 'other'); // currently not enforced
      p.kind.should.equal('other');
    });

    it('should create a scoped instance - tool', function(done) {
      Tool.create({name: 'Product A', kind: 'ignored'}, function(err, p) {
        should.not.exist(err);
        p.name.should.equal('Product A');
        p.kind.should.equal('Tool');
        ids.productA = p.id;
        done();
      });
    });

    it('should create a scoped instance - widget', function(done) {
      Widget.create({name: 'Product B', kind: 'ignored'}, function(err, p) {
        should.not.exist(err);
        p.name.should.equal('Product B');
        p.kind.should.equal('Widget');
        ids.productB = p.id;
        done();
      });
    });

    it('should update a scoped instance - updateAttributes', function(done) {
      Tool.findById(ids.productA, function(err, p) {
        p.updateAttributes({description: 'A thing...', kind: 'ingored'}, function(err, inst) {
          should.not.exist(err);
          p.name.should.equal('Product A');
          p.kind.should.equal('Tool');
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
          p.kind.should.equal('Tool');
          p.description.should.equal('Something...');
          Tool.findById(ids.productA, function(err, p) {
            p.kind.should.equal('Tool');
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
        p.kind.should.equal('Tool');
        p.description.should.equal('Anything...');
        done();
      });
    });

    //
    // Prototype pollution is dangerous. If __proto__ is specified as a regular
    // key then spread over the object, you can risk overwriting Object.prototype.
    //
    // It's not possible to do this by passing an object literal, as __proto__ will not
    // be enumerable. But it *is* possible to do this when it comes in through JSON.parse()
    // (i.e. through body-parser or the equivalent), which can lead to crazy errors,
    // where the underlying ModelConstructor gets overridden and interal methods disappear.
    //
    // You'll see errors like `this.trigger is not a function`.
    //
    // At that point, anything goes. So we need to block it anywhere we might take input.
    //

    it('security: prototype pollution - updateAttributes', function(done) {
      Tool.create({name: 'Product A'}, function(err, p) {
        p.updateAttributes({__proto__: {'evil': 'foo'}, good: 'bar'}, function(err, inst) {
          should.not.exist(err);
          should.not.exist(inst.evil);
          should.not.exist(inst.__proto__.evil);
          inst.good.should.equal('bar');
          done();
        });
      });
    });

    // Really dangerous: this will overwrite ModelConstructor attributes
    // So this won't even save, it'll throw a crazy error while it attempts to validate
    it('security: prototype pollution - updateAttributes with JSON.parse()', function(done) {
      Tool.create({name: 'Product A'}, function(err, p) {
        p.updateAttributes(JSON.parse('{"__proto__": {"evil": "foo"}, "good": "bar"}'), function(err, inst) {
          should.not.exist(err);
          should.not.exist(inst.evil);
          inst.good.should.equal('bar');
          done();
        });
      });
    });

    it('security: prototype pollution - updateAttributes on nested object', function(done) {
      FavoriteTool.create({name: 'Product A', tool: {name: 'Product A'}}, function(err, p) {
        p.updateAttributes({tool: {__proto__: {evil: 'foo'}, good: 'bar'}}, function(err, inst) {
          should.not.exist(err);
          should.not.exist(inst.tool.evil);
          inst.tool.good.should.equal('bar');
          done();
        });
      });
    });

    it('security: prototype pollution - updateAttributes on nested object with JSON.parse()', function(done) {
      FavoriteTool.create({name: 'Product A', tool: {name: 'Product A'}}, function(err, p) {
        p.updateAttributes(JSON.parse('{"tool": {"__proto__": {"evil": "foo"}, "good": "bar"}}'),
        function(err, inst) {
          should.not.exist(err);
          should.not.exist(inst.tool.evil);
          inst.tool.good.should.equal('bar');
          done();
        });
      });
    });

    it('security: prototype pollution - constructor', function() {
      var p = new Tool({__proto__: {bar: 'danger'}});
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
    });

    it('security: prototype pollution - constructor with JSON.parse()', function() {
      var p = new Tool(JSON.parse('{"__proto__": {"bar": "danger"}}'));
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
    });

    it('security: prototype pollution - setAttribute', function() {
      var p = new Tool();
      p.setAttributes({__proto__: {bar: 'danger'}});
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
      p.setAttribute('__proto__', {bar: 'danger'});
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
    });

    it('security: prototype pollution - setAttribute with JSON.parse()', function() {
      var p = new Tool();
      p.setAttributes(JSON.parse('{"__proto__": {"bar": "danger"}}'));
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
    });

    it('security: prototype pollution - nested setAttribute', function() {
      var p = new Tool();
      p.setAttributes({baz: {__proto__: {bar: 'danger'}}});
      // should not leak to model prototype
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
      // But should be on nested object on prototype, as we created a raw
      // object and __proto__ is not enumerable, and thus won't be removed.
      p.baz.bar.should.equal('danger');
      p.baz.__proto__.bar.should.equal('danger');

      p.setAttribute('biff', {__proto__: {bar: 'danger'}});
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
      // But should be on nested object on prototype
      p.biff.bar.should.equal('danger');
      p.biff.__proto__.bar.should.equal('danger');
    });

    it('security: prototype pollution - nested setAttribute with JSON.parse()', function() {
      var p = new Tool();
      p.setAttributes({baz: JSON.parse('{"__proto__": {"bar": "danger"}}')});
      // should not leak to model prototype or nested object's prototype
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
      // and should not be on nested object
      should.not.exist(p.baz.bar);
      should.not.exist(p.baz.__proto__.bar);

      p.setAttribute('biff', JSON.parse('{"__proto__": {"bar": "danger"}}'));
      should.not.exist(p.__proto__.bar);
      should.not.exist(p.bar);
      // and should not be on nested object
      should.not.exist(p.biff.bar);
      should.not.exist(p.baz.__proto__.bar);
    });

    it('security: prototype pollution - create', function(done) {
      Tool.create({foo: {__proto__: {bar: 'danger'}}}, function(err, p) {
        should.not.exist(err);
        should.not.exist(p.__proto__.bar);
        should.not.exist(p.bar);
        // Will be on nested object's proto
        p.foo.bar.should.equal('danger');
        p.foo.__proto__.bar.should.equal('danger');
        done();
      });
    });

    it('security: prototype pollution - create with JSON.parse()', function(done) {
      Tool.create({foo: JSON.parse('{"__proto__": {"bar": "danger"}}')}, function(err, p) {
        should.not.exist(err);
        should.not.exist(p.__proto__.bar);
        should.not.exist(p.bar);
        // Will be on nested object's as enumerable key
        should.not.exist(p.foo.bar);
        // Removed in removeUndefined() called in create
        should.not.exist(p.foo.__proto__.bar);
        done();
      });
    });
  });

  describe('findById', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope', function(done) {
      Product.findById(ids.toolA, function(err, inst) {
        should.not.exist(err);
        inst.name.should.equal('Tool A');
        inst.should.be.instanceof(Tool);
        done();
      });
    });

    it('should apply default scope - tool', function(done) {
      Tool.findById(ids.toolA, function(err, inst) {
        should.not.exist(err);
        inst.name.should.equal('Tool A');
        done();
      });
    });

    it('should apply default scope (no match)', function(done) {
      Widget.findById(ids.toolA, function(err, inst) {
        should.not.exist(err);
        should.not.exist(inst);
        done();
      });
    });
  });

  describe('find', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope - order', function(done) {
      Product.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(5);
        products[0].name.should.equal('Tool A');
        products[1].name.should.equal('Tool Z');
        products[2].name.should.equal('Widget A');
        products[3].name.should.equal('Widget B');
        products[4].name.should.equal('Widget Z');

        products[0].should.be.instanceof(Product);
        products[0].should.be.instanceof(Tool);

        products[2].should.be.instanceof(Product);
        products[2].should.be.instanceof(Widget);

        done();
      });
    });

    it('should apply default scope - order override', function(done) {
      Product.find({order: 'name DESC'}, function(err, products) {
        should.not.exist(err);
        products.should.have.length(5);
        products[0].name.should.equal('Widget Z');
        products[1].name.should.equal('Widget B');
        products[2].name.should.equal('Widget A');
        products[3].name.should.equal('Tool Z');
        products[4].name.should.equal('Tool A');
        done();
      });
    });

    it('should apply default scope - tool', function(done) {
      Tool.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Tool A');
        products[1].name.should.equal('Tool Z');
        done();
      });
    });

    it('should apply default scope - where (widget)', function(done) {
      Widget.find({where: {active: true}}, function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Widget A');
        products[1].name.should.equal('Widget Z');
        done();
      });
    });

    it('should apply default scope - order (widget)', function(done) {
      Widget.find({order: 'name DESC'}, function(err, products) {
        should.not.exist(err);
        products.should.have.length(3);
        products[0].name.should.equal('Widget Z');
        products[1].name.should.equal('Widget B');
        products[2].name.should.equal('Widget A');
        done();
      });
    });
  });

  describe('exists', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope', function(done) {
      Product.exists(ids.widgetA, function(err, exists) {
        should.not.exist(err);
        exists.should.be.true;
        done();
      });
    });

    it('should apply default scope - tool', function(done) {
      Tool.exists(ids.toolZ, function(err, exists) {
        should.not.exist(err);
        exists.should.be.true;
        done();
      });
    });

    it('should apply default scope - widget', function(done) {
      Widget.exists(ids.widgetA, function(err, exists) {
        should.not.exist(err);
        exists.should.be.true;
        done();
      });
    });

    it('should apply default scope - tool (no match)', function(done) {
      Tool.exists(ids.widgetA, function(err, exists) {
        should.not.exist(err);
        exists.should.be.false;
        done();
      });
    });

    it('should apply default scope - widget (no match)', function(done) {
      Widget.exists(ids.toolZ, function(err, exists) {
        should.not.exist(err);
        exists.should.be.false;
        done();
      });
    });
  });

  describe('count', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope - order', function(done) {
      Product.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(5);
        done();
      });
    });

    it('should apply default scope - tool', function(done) {
      Tool.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(2);
        done();
      });
    });

    it('should apply default scope - widget', function(done) {
      Widget.count(function(err, count) {
        should.not.exist(err);
        count.should.equal(3);
        done();
      });
    });

    it('should apply default scope - where', function(done) {
      Widget.count({name: 'Widget Z'}, function(err, count) {
        should.not.exist(err);
        count.should.equal(1);
        done();
      });
    });

    it('should apply default scope - no match', function(done) {
      Tool.count({name: 'Widget Z'}, function(err, count) {
        should.not.exist(err);
        count.should.equal(0);
        done();
      });
    });
  });

  describe('removeById', function() {
    var ids = {};

    function isDeleted(id, done) {
      Product.exists(id, function(err, exists) {
        should.not.exist(err);
        exists.should.be.false;
        done();
      });
    };

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope', function(done) {
      Product.removeById(ids.widgetZ, function(err) {
        should.not.exist(err);
        isDeleted(ids.widgetZ, done);
      });
    });

    it('should apply default scope - tool', function(done) {
      Tool.removeById(ids.toolA, function(err) {
        should.not.exist(err);
        isDeleted(ids.toolA, done);
      });
    });

    it('should apply default scope - no match', function(done) {
      Tool.removeById(ids.widgetA, function(err) {
        should.not.exist(err);
        Product.exists(ids.widgetA, function(err, exists) {
          should.not.exist(err);
          exists.should.be.true;
          done();
        });
      });
    });

    it('should apply default scope - widget', function(done) {
      Widget.removeById(ids.widgetA, function(err) {
        should.not.exist(err);
        isDeleted(ids.widgetA, done);
      });
    });

    it('should apply default scope - verify', function(done) {
      Product.find(function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Tool Z');
        products[1].name.should.equal('Widget B');
        done();
      });
    });
  });

  describe('update', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope', function(done) {
      Widget.update({active: false}, {active: true, kind: 'ignored'}, function(err) {
        should.not.exist(err);
        Widget.find({where: {active: true}}, function(err, products) {
          should.not.exist(err);
          products.should.have.length(3);
          products[0].name.should.equal('Widget A');
          products[1].name.should.equal('Widget B');
          products[2].name.should.equal('Widget Z');
          done();
        });
      });
    });

    it('should apply default scope - no match', function(done) {
      Tool.update({name: 'Widget A'}, {name: 'Ignored'}, function(err) {
        should.not.exist(err);
        Product.findById(ids.widgetA, function(err, product) {
          should.not.exist(err);
          product.name.should.equal('Widget A');
          done();
        });
      });
    });

    it('should have updated within scope', function(done) {
      Product.find({where: {active: true}}, function(err, products) {
        should.not.exist(err);
        products.should.have.length(4);
        products[0].name.should.equal('Tool Z');
        products[1].name.should.equal('Widget A');
        products[2].name.should.equal('Widget B');
        products[3].name.should.equal('Widget Z');
        done();
      });
    });
  });

  describe('remove', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should apply default scope - custom where', function(done) {
      Widget.remove({name: 'Widget A'}, function(err) {
        should.not.exist(err);
        Product.find(function(err, products) {
          products.should.have.length(4);
          products[0].name.should.equal('Tool A');
          products[1].name.should.equal('Tool Z');
          products[2].name.should.equal('Widget B');
          products[3].name.should.equal('Widget Z');
          done();
        });
      });
    });

    it('should apply default scope - custom where (no match)', function(done) {
      Tool.remove({name: 'Widget Z'}, function(err) {
        should.not.exist(err);
        Product.find(function(err, products) {
          products.should.have.length(4);
          products[0].name.should.equal('Tool A');
          products[1].name.should.equal('Tool Z');
          products[2].name.should.equal('Widget B');
          products[3].name.should.equal('Widget Z');
          done();
        });
      });
    });

    it('should apply default scope - deleteAll', function(done) {
      Tool.deleteAll(function(err) {
        should.not.exist(err);
        Product.find(function(err, products) {
          products.should.have.length(2);
          products[0].name.should.equal('Widget B');
          products[1].name.should.equal('Widget Z');
          done();
        });
      });
    });

    it('should create a scoped instance - tool', function(done) {
      Tool.create({name: 'Tool B'}, function(err, p) {
        should.not.exist(err);
        Product.find(function(err, products) {
          products.should.have.length(3);
          products[0].name.should.equal('Tool B');
          products[1].name.should.equal('Widget B');
          products[2].name.should.equal('Widget Z');
          done();
        });
      });
    });

    it('should apply default scope - destroyAll', function(done) {
      Widget.destroyAll(function(err) {
        should.not.exist(err);
        Product.find(function(err, products) {
          products.should.have.length(1);
          products[0].name.should.equal('Tool B');
          done();
        });
      });
    });
  });

  describe('scopes', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(setupProducts.bind(null, ids, done));
    });

    it('should merge with default scope', function(done) {
      Product.active(function(err, products) {
        should.not.exist(err);
        products.should.have.length(3);
        products[0].name.should.equal('Tool Z');
        products[1].name.should.equal('Widget A');
        products[2].name.should.equal('Widget Z');
        done();
      });
    });

    it('should merge with default scope - tool', function(done) {
      Tool.active(function(err, products) {
        should.not.exist(err);
        products.should.have.length(1);
        products[0].name.should.equal('Tool Z');
        done();
      });
    });

    it('should merge with default scope - widget', function(done) {
      Widget.active(function(err, products) {
        should.not.exist(err);
        products.should.have.length(2);
        products[0].name.should.equal('Widget A');
        products[1].name.should.equal('Widget Z');
        done();
      });
    });
  });

  describe('scope function', function() {
    before(function(done) {
      db.automigrate(done);
    });

    it('should create a scoped instance - widget', function(done) {
      Widget.create({name: 'Product', kind: 'ignored'}, function(err, p) {
        p.name.should.equal('Product');
        p.kind.should.equal('Widget');
        done();
      });
    });

    it('should create a scoped instance - thing', function(done) {
      Thing.create({name: 'Product', kind: 'ignored'}, function(err, p) {
        p.name.should.equal('Product');
        p.kind.should.equal('Thing');
        done();
      });
    });

    it('should find a scoped instance - widget', function(done) {
      Widget.findOne({where: {name: 'Product'}}, function(err, p) {
        p.name.should.equal('Product');
        p.kind.should.equal('Widget');
        done();
      });
    });

    it('should find a scoped instance - thing', function(done) {
      Thing.findOne({where: {name: 'Product'}}, function(err, p) {
        p.name.should.equal('Product');
        p.kind.should.equal('Thing');
        done();
      });
    });

    it('should find a scoped instance - thing', function(done) {
      Product.find({where: {name: 'Product'}}, function(err, products) {
        products.should.have.length(2);
        products[0].name.should.equal('Product');
        products[1].name.should.equal('Product');
        var kinds = products.map(function(p) { return p.kind; });
        kinds.sort();
        kinds.should.eql(['Thing', 'Widget']);
        done();
      });
    });
  });

  describe('relations', function() {
    var ids = {};

    before(function(done) {
      db.automigrate(done);
    });

    before(function(done) {
      Category.create({name: 'Category A'}, function(err, cat) {
        ids.categoryA = cat.id;
        async.series([
          function(next) {
            cat.widgets.create({name: 'Widget B', kind: 'ignored'}, next);
          },
          function(next) {
            cat.widgets.create({name: 'Widget A'}, next);
          },
          function(next) {
            cat.tools.create({name: 'Tool A'}, next);
          },
          function(next) {
            cat.things.create({name: 'Thing A'}, next);
          },
        ], done);
      });
    });

    it('should apply default scope - products', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        should.not.exist(err);
        cat.products(function(err, products) {
          should.not.exist(err);
          products.should.have.length(4);
          products[0].name.should.equal('Thing A');
          products[1].name.should.equal('Tool A');
          products[2].name.should.equal('Widget A');
          products[3].name.should.equal('Widget B');

          products[0].should.be.instanceof(Product);
          products[0].should.be.instanceof(Thing);

          products[1].should.be.instanceof(Product);
          products[1].should.be.instanceof(Tool);

          products[2].should.be.instanceof(Product);
          products[2].should.be.instanceof(Widget);

          done();
        });
      });
    });

    it('should apply default scope - widgets', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        should.not.exist(err);
        cat.widgets(function(err, products) {
          should.not.exist(err);
          products.should.have.length(2);
          products[0].should.be.instanceof(Widget);
          products[0].name.should.equal('Widget A');
          products[1].name.should.equal('Widget B');
          products[0].category(function(err, inst) {
            inst.name.should.equal('Category A');
            done();
          });
        });
      });
    });

    it('should apply default scope - tools', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        should.not.exist(err);
        cat.tools(function(err, products) {
          should.not.exist(err);
          products.should.have.length(1);
          products[0].should.be.instanceof(Tool);
          products[0].name.should.equal('Tool A');
          products[0].category(function(err, inst) {
            inst.name.should.equal('Category A');
            done();
          });
        });
      });
    });

    it('should apply default scope - things', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        should.not.exist(err);
        cat.things(function(err, products) {
          should.not.exist(err);
          products.should.have.length(1);
          products[0].should.be.instanceof(Thing);
          products[0].name.should.equal('Thing A');
          products[0].category(function(err, inst) {
            inst.name.should.equal('Category A');
            done();
          });
        });
      });
    });

    it('should create related item with default scope', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        cat.tools.create({name: 'Tool B'}, done);
      });
    });

    it('should use relation scope order', function(done) {
      Category.findById(ids.categoryA, function(err, cat) {
        should.not.exist(err);
        cat.tools(function(err, products) {
          should.not.exist(err);
          products.should.have.length(2);
          products[0].name.should.equal('Tool B');
          products[1].name.should.equal('Tool A');
          done();
        });
      });
    });
  });

  describe('with include option', function() {
    before(function(done) {
      db.automigrate(done);
    });

    before(function(done) {
      Person.create({id: 1, name: 'Person A'}, function(err, person) {
        person.things.create({name: 'Thing A'}, done);
      });
    });

    it('should find a scoped instance with included relation - things', function(done) {
      Person.findById(1, function(err, person) {
        should.not.exist(err);
        should.exist(person);
        var things = person.things();
        should.exist(things);
        things.should.be.an.instanceOf(Array);
        things.should.have.length(1);
        done();
      });
    });
  });
});
