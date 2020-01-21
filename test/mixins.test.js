// Copyright IBM Corp. 2014,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
'use strict';
const should = require('./init.js');

const jdb = require('../');
const ModelBuilder = jdb.ModelBuilder;
const DataSource = jdb.DataSource;
const Memory = require('../lib/connectors/memory');

const modelBuilder = new ModelBuilder();
const mixins = modelBuilder.mixins;

function timestamps(Model, options) {
  Model.defineProperty('createdAt', {type: Date});
  Model.defineProperty('updatedAt', {type: Date});

  const originalBeforeSave = Model.beforeSave;
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

describe('Model class', function() {
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
    const Address = modelBuilder.define('Address', {
      street: {type: 'string', required: true},
      city: {type: 'string', required: true},
    });

    const memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    const Item = memory.createModel('Item', {name: 'string'}, {
      mixins: {Address: true},
    });

    const properties = Item.definition.properties;

    properties.street.should.eql({type: String, required: true});
    properties.city.should.eql({type: String, required: true});
  });

  it('should fail to apply an undefined mixin class', function() {
    const memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    function applyMixin() {
      memory.createModel('Item', {name: 'string'}, {
        mixins: {UndefinedMixin: true},
      });
    }
    should.throws(applyMixin, 'failed to apply undefined mixin class');
  });

  it('should apply mixins', function(done) {
    const memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    const Item = memory.createModel('Item', {name: 'string'}, {
      mixins: {
        TimeStamp: true,
        Demo: {value: true},
        Multi: [
          {key: 'foo', value: 'bar'},
          {key: 'fox', value: 'baz'},
        ],
      },
    });

    Item.mixin('Example', {foo: 'bar'});

    Item.demoMixin.should.be.true;

    Item.multiMixin.foo.should.equal('bar');
    Item.multiMixin.fox.should.equal('baz');

    const properties = Item.definition.properties;
    properties.createdAt.should.eql({type: Date});
    properties.updatedAt.should.eql({type: Date});

    Item.create({name: 'Item 1'}, function(err, inst) {
      inst.createdAt.should.be.a.date;
      inst.updatedAt.should.be.a.date;
      inst.example().should.eql({foo: 'bar'});
      done();
    });
  });

  it('should fail to apply undefined mixin', function() {
    const memory = new DataSource('mem', {connector: Memory}, modelBuilder);
    const Item = memory.createModel('Item', {name: 'string'});

    function applyMixin() {
      Item.mixin('UndefinedMixin', {foo: 'bar'});
    }
    should.throws(applyMixin, 'failed to apply undefined mixin');
  });

  describe('#mixin()', function() {
    let Person, Author, Address;

    beforeEach(function() {
      Address = modelBuilder.define('Address', {
        street: {type: 'string', required: true},
        city: {type: 'string', required: true},
      });
      const memory = new DataSource('mem', {connector: Memory}, modelBuilder);
      Person = memory.createModel('Person', {name: 'string'});
      Author = memory.createModel('Author', {name: 'string'});
    });

    it('should register mixin class into _mixins', function() {
      Person.mixin(Address);
      Person._mixins.should.containEql(Address);
    });

    it('should NOT share mixins registry', function() {
      Person.mixin(Address);
      Author._mixins.should.not.containEql(Address);
    });

    it('should able to mixin same class', function() {
      Person.mixin(Address);
      Author.mixin(Address);
      Author._mixins.should.containEql(Address);
    });
  });
});
