// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test is written in mocha+should.js

'use strict';

const should = require('./init.js');
const assert = require('assert');

const jdb = require('../');
const ModelBuilder = jdb.ModelBuilder;
const DataSource = jdb.DataSource;
const Memory = require('../lib/connectors/memory');

const ModelDefinition = require('../lib/model-definition');

describe('Model class inheritance', function() {
  let memory;
  beforeEach(function() {
    memory = new DataSource({connector: Memory});
  });

  describe('ModelBaseClass.getMergePolicy()', function() {
    const legacyMergePolicy = {
      description: {replace: true},
      properties: {patch: true},
      hidden: {replace: false},
      protected: {replace: false},
      relations: {patch: true},
      acls: {rank: true},
    };

    const recommendedMergePolicy = {
      description: {replace: true},
      options: {patch: true},
      hidden: {replace: false},
      protected: {replace: false},
      indexes: {patch: true},
      methods: {patch: true},
      mixins: {patch: true},
      relations: {patch: true},
      scope: {replace: true},
      scopes: {patch: true},
      acls: {rank: true},
      __delete: null,
      __default: {replace: true},
    };

    let modelBuilder, base;

    beforeEach(function() {
      modelBuilder = memory.modelBuilder;
      base = modelBuilder.define('base');
    });

    it('returns legacy merge policy by default', function() {
      const mergePolicy = base.getMergePolicy();
      should.deepEqual(mergePolicy, legacyMergePolicy);
    });

    it('returns recommended merge policy when called with option ' +
      '`{configureModelMerge: true}`', function() {
      const mergePolicy = base.getMergePolicy({configureModelMerge: true});
      should.deepEqual(mergePolicy, recommendedMergePolicy);
    });

    it('handles custom merge policy defined via model.settings', function() {
      let mergePolicy;
      const newMergePolicy = {
        relations: {patch: true},
      };

        // saving original getMergePolicy method
      let originalGetMergePolicy = base.getMergePolicy;

        // the injected getMergePolicy method captures the provided configureModelMerge option
      base.getMergePolicy = function(options) {
        mergePolicy = options && options.configureModelMerge;
        return originalGetMergePolicy(options);
      };

        // calling extend() on base model calls base.getMergePolicy() internally
        // child model settings are passed as 3rd parameter
      const child = base.extend('child', {}, {configureModelMerge: newMergePolicy});

      should.deepEqual(mergePolicy, newMergePolicy);

        // restoring original getMergePolicy method
      base.getMergePolicy = originalGetMergePolicy;
    });

    it('can be extended by user', function() {
      const alteredMergePolicy = Object.assign({}, recommendedMergePolicy, {
        __delete: false,
      });
        // extending the builtin getMergePolicy function
      base.getMergePolicy = function(options) {
        const origin = base.base.getMergePolicy(options);
        return Object.assign({}, origin, {
          __delete: false,
        });
      };
      const mergePolicy = base.getMergePolicy({configureModelMerge: true});
      should.deepEqual(mergePolicy, alteredMergePolicy);
    });

    it('is inherited by child model', function() {
      const child = base.extend('child', {}, {configureModelMerge: true});
        // get mergePolicy from child
      const mergePolicy = child.getMergePolicy({configureModelMerge: true});
      should.deepEqual(mergePolicy, recommendedMergePolicy);
    });
  });

  describe('Merge policy WITHOUT flag `configureModelMerge`', function() {
    it('inherits prototype using option.base', function() {
      const modelBuilder = memory.modelBuilder;
      const parent = memory.createModel('parent', {}, {
        relations: {
          children: {
            type: 'hasMany',
            model: 'anotherChild',
          },
        },
      });
      const baseChild = modelBuilder.define('baseChild');
      baseChild.attachTo(memory);
        // the name of this must begin with a letter < b
        // for this test to fail
      const anotherChild = baseChild.extend('anotherChild');

      assert(anotherChild.prototype instanceof baseChild);
    });

    it('ignores inherited options.base', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base');
      const child = base.extend('child', {}, {base: 'base'});
      const grandChild = child.extend('grand-child');
      assert.equal('child', grandChild.base.modelName);
      assert(grandChild.prototype instanceof child);
    });

    it('ignores inherited options.super', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base');
      const child = base.extend('child', {}, {super: 'base'});
      const grandChild = child.extend('grand-child');
      assert.equal('child', grandChild.base.modelName);
      assert(grandChild.prototype instanceof child);
    });

    it('allows model extension', function(done) {
      var modelBuilder = new ModelBuilder();

      var User = modelBuilder.define('User', {
        name: String,
        bio: ModelBuilder.Text,
        approved: Boolean,
        joinedAt: Date,
        age: Number,
      });

      var Customer = User.extend('Customer', {customerId: {type: String, id: true}});

      var customer = new Customer({name: 'Joe', age: 20, customerId: 'c01'});

      customer.should.be.type('object').and.have.property('name', 'Joe');
      customer.should.have.property('name', 'Joe');
      customer.should.have.property('age', 20);
      customer.should.have.property('customerId', 'c01');
      customer.should.have.property('bio', undefined);

        // The properties are defined at prototype level
      assert.equal(Object.keys(customer).filter(function(k) {
          // Remove internal properties
        return k.indexOf('__') === -1;
      }).length, 0);
      var count = 0;
      for (var p in customer) {
        if (p.indexOf('__') === 0) {
          continue;
        }
        if (typeof customer[p] !== 'function') {
          count++;
        }
      }
      assert.equal(count, 7); // Please note there is an injected id from User prototype
      assert.equal(Object.keys(customer.toObject()).filter(function(k) {
          // Remove internal properties
        return k.indexOf('__') === -1;
      }).length, 6);

      done(null, customer);
    });

    it('allows model extension with merged settings', function(done) {
      var modelBuilder = new ModelBuilder();

      var User = modelBuilder.define('User', {
        name: String,
      }, {
        defaultPermission: 'ALLOW',
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            permission: 'ALLOW',
          },
        ],
        relations: {
          posts: {
            type: 'hasMany',
            model: 'Post',
          },
        },
      });

      var Customer = User.extend('Customer',
          {customerId: {type: String, id: true}}, {
            defaultPermission: 'DENY',
            acls: [
              {
                principalType: 'ROLE',
                principalId: '$unauthenticated',
                permission: 'DENY',
              },
            ],
            relations: {
              orders: {
                type: 'hasMany',
                model: 'Order',
              },
            },
          }
        );

      assert.deepEqual(User.settings, {
        defaultPermission: 'ALLOW',
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            permission: 'ALLOW',
          },
        ],
        relations: {
          posts: {
            type: 'hasMany',
            model: 'Post',
          },
        },
        strict: false,
      });

      assert.deepEqual(Customer.settings, {
        defaultPermission: 'DENY',
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            permission: 'ALLOW',
          },
          {
            principalType: 'ROLE',
            principalId: '$unauthenticated',
            permission: 'DENY',
          },
        ],
        relations: {
          posts: {
            type: 'hasMany',
            model: 'Post',
          },
          orders: {
            type: 'hasMany',
            model: 'Order',
          },
        },
        strict: false,
        base: User,
      });

      done();
    });

    it('defines rank of ACLs according to model\'s inheritance rank', function() {
        // a simple test is enough as we already fully tested option `{rank: true}`
        // in tests with flag `configureModelMerge`
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          property: 'oneMethod',
          permission: 'ALLOW',
        },
      ]});
      const childRank1 = modelBuilder.define('childRank1', {}, {
        base: base,
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
          },
        ],
      });

      const expectedSettings = {
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'ALLOW',
            __rank: 1,
          },
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
            __rank: 2,
          },
        ],
      };
      should.deepEqual(childRank1.settings.acls, expectedSettings.acls);
    });

    it('replaces baseClass relations with matching subClass relations', function() {
        // merge policy of settings.relations is {patch: true}
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            model: 'User',
            foreignKey: 'userId',
          },
        },
      });
      const child = base.extend('child', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
      });

      const expectedSettings = {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
      };

      should.deepEqual(child.settings.relations, expectedSettings.relations);
    });
  });

  describe('Merge policy WITH flag `configureModelMerge: true`', function() {
    it('`{__delete: null}` allows deleting base model settings by assigning ' +
        'null value at sub model level', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        anyParam: {oneKey: 'this should be removed'},
      });
      const child = base.extend('child', {}, {
        anyParam: null,
        configureModelMerge: true,
      });

      const expectedSettings = {};

      should.deepEqual(child.settings.description, expectedSettings.description);
    });

    it('`{rank: true}` defines rank of array elements ' +
        'according to model\'s inheritance rank', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          property: 'oneMethod',
          permission: 'ALLOW',
        },
      ]});
      const childRank1 = modelBuilder.define('childRank1', {}, {
        base: base,
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$owner',
            property: 'anotherMethod',
            permission: 'ALLOW',
          },
        ],
        configureModelMerge: true,
      });
      const childRank2 = childRank1.extend('childRank2', {}, {});
      const childRank3 = childRank2.extend('childRank3', {}, {
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
          },
        ],
        configureModelMerge: true,
      });

      const expectedSettings = {
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'ALLOW',
            __rank: 1,
          },
          {
            principalType: 'ROLE',
            principalId: '$owner',
            property: 'anotherMethod',
            permission: 'ALLOW',
            __rank: 2,
          },
          {
            principalType: 'ROLE',
            principalId: '$everyone',
            property: 'oneMethod',
            permission: 'DENY',
            __rank: 4,
          },
        ],
      };
      should.deepEqual(childRank3.settings.acls, expectedSettings.acls);
    });

    it('`{replace: true}` replaces base model array with sub model matching ' +
        'array', function() {
          // merge policy of settings.description is {replace: true}
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        description: ['base', 'model', 'description'],
      });
      const child = base.extend('child', {}, {
        description: ['this', 'is', 'child', 'model', 'description'],
        configureModelMerge: true,
      });

      const expectedSettings = {
        description: ['this', 'is', 'child', 'model', 'description'],
      };

      should.deepEqual(child.settings.description, expectedSettings.description);
    });

    it('`{replace:true}` is applied on array parameters not defined in merge policy', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        unknownArrayParam: ['this', 'should', 'be', 'replaced'],
      });
      const child = base.extend('child', {}, {
        unknownArrayParam: ['this', 'should', 'remain', 'after', 'merge'],
        configureModelMerge: true,
      });

      const expectedSettings = {
        unknownArrayParam: ['this', 'should', 'remain', 'after', 'merge'],
      };

      should.deepEqual(child.settings.description, expectedSettings.description);
    });

    it('`{replace:true}` is applied on object {} parameters not defined in mergePolicy', function() {
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        unknownObjectParam: {oneKey: 'this should be replaced'},
      });
      const child = base.extend('child', {}, {
        unknownObjectParam: {anotherKey: 'this should remain after merge'},
        configureModelMerge: true,
      });

      const expectedSettings = {
        unknownObjectParam: {anotherKey: 'this should remain after merge'},
      };

      should.deepEqual(child.settings.description, expectedSettings.description);
    });

    it('`{replace: false}` adds distinct members of matching arrays from ' +
        'base model and sub model', function() {
          // merge policy of settings.hidden is {replace: false}
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        hidden: ['firstProperty', 'secondProperty'],
      });
      const child = base.extend('child', {}, {
        hidden: ['secondProperty', 'thirdProperty'],
        configureModelMerge: true,
      });

      const expectedSettings = {
        hidden: ['firstProperty', 'secondProperty', 'thirdProperty'],
      };

      should.deepEqual(child.settings.hidden, expectedSettings.hidden);
    });

    it('`{patch: true}` adds distinct inner properties of matching objects ' +
        'from base model and sub model', function() {
          // merge policy of settings.relations is {patch: true}
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        relations: {
          someOtherRelation: {
            type: 'hasMany',
            model: 'someOtherModel',
            foreignKey: 'otherModelId',
          },
        },
      });
      const child = base.extend('child', {}, {
        relations: {
          someRelation: {
            type: 'belongsTo',
            model: 'someModel',
            foreignKey: 'modelId',
          },
        },
        configureModelMerge: true,
      });

      const expectedSettings = {
        relations: {
          someRelation: {
            type: 'belongsTo',
            model: 'someModel',
            foreignKey: 'modelId',
          },
          someOtherRelation: {
            type: 'hasMany',
            model: 'someOtherModel',
            foreignKey: 'otherModelId',
          },
        },
      };

      should.deepEqual(child.settings.relations, expectedSettings.relations);
    });

    it('`{patch: true}` replaces baseClass inner properties with matching ' +
        'subClass inner properties', function() {
          // merge policy of settings.relations is {patch: true}
      const modelBuilder = memory.modelBuilder;
      const base = modelBuilder.define('base', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            model: 'User',
            foreignKey: 'userId',
          },
        },
      });
      const child = base.extend('child', {}, {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
        configureModelMerge: true,
      });

      const expectedSettings = {
        relations: {
          user: {
            type: 'belongsTo',
            idName: 'id',
            polymorphic: {
              idType: 'string',
              foreignKey: 'userId',
              discriminator: 'principalType',
            },
          },
        },
      };

      should.deepEqual(child.settings.relations, expectedSettings.relations);
    });
  });
});
