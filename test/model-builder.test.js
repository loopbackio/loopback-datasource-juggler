// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');

const juggler = require('../');
const ModelBuilder = juggler.ModelBuilder;
const {StrongGlobalize} = require('strong-globalize');
const parentRefHelper = require('./helpers/setup-parent-ref');

describe('ModelBuilder', () => {
  describe('define()', () => {
    let builder;

    beforeEach(givenModelBuilderInstance);

    it('sets correct "modelName" property', () => {
      const MyModel = builder.define('MyModel');
      MyModel.should.have.property('modelName', 'MyModel');
    });

    it('sets correct "name" property on model constructor', () => {
      const MyModel = builder.define('MyModel');
      MyModel.should.have.property('name', 'MyModel');
    });

    describe('model class name sanitization', () => {
      it('converts "-" to "_"', () => {
        const MyModel = builder.define('Grand-child');
        MyModel.should.have.property('name', 'Grand_child');
      });

      it('converts "." to "_"', () => {
        const MyModel = builder.define('Grand.child');
        MyModel.should.have.property('name', 'Grand_child');
      });

      it('converts ":" to "_"', () => {
        const MyModel = builder.define('local:User');
        MyModel.should.have.property('name', 'local_User');
      });

      it('falls back to legacy "ModelConstructor" in other cases', () => {
        const MyModel = builder.define('Grand\tchild');
        MyModel.should.have.property('name', 'ModelConstructor');
      });
    });

    describe('model with nested properties as function', () => {
      const Role = function(roleName) {};
      it('sets correct nested properties', () => {
        const User = builder.define('User', {
          role: {
            type: typeof Role,
            default: null,
          },
        });
        should.equal(User.getPropertyType('role'), 'ModelConstructor');
      });
    });

    describe('model with nested properties as class', () => {
      class Role {
        constructor(roleName) {}
      }
      it('sets correct nested properties', () => {
        const User = builder.define('UserWithClass', {
          role: {
            type: Role,
            default: null,
          },
        });
        User.registerProperty('role');
        should.equal(User.getPropertyType('role'), 'Role');
      });
    });

    describe('model with nested properties as embedded model', () => {
      let Address, Person;
      const originalWarn = StrongGlobalize.prototype.warn;
      parentRefHelper(() => builder);
      before('create stub for warning check', () => {
        StrongGlobalize.prototype.warn = function gWarnWrapper(...args) {
          StrongGlobalize.prototype.warn.called++;
          return originalWarn.apply(this, args);
        };
        StrongGlobalize.prototype.warn.called = 0;
      });
      beforeEach('Define models', () => {
        Address = builder.define('Address', {
          street: {type: 'string'},
          number: {type: 'number'},
        });
        Person = builder.define('Person', {
          name: {type: 'string'},
          address: {type: 'Address'},
          other: {type: 'object'},
        });
      });
      after('restore warning stub', () => {
        StrongGlobalize.prototype.warn = originalWarn;
      });
      it('should properly add the __parent relationship when instantiating parent model', () => {
        const person = new Person({
          name: 'Mitsos',
          address: {street: 'kopria', number: 11},
        });
        person.should.have.propertyByPath('address', '__parent').which.equals(person);
      });
      it('should add _parent property when setting embedded model after instantiation', () => {
        const person = new Person({
          name: 'Mitsos',
        });
        person.address = {street: 'kopria', number: 11};
        person.should.have.propertyByPath('address', '__parent').which.equals(person);
      });
      it('should handle nullish embedded property values', () => {
        const person = new Person({
          name: 'Mitsos',
          address: null,
        });
        person.should.have.property('address').which.equals(null);
      });
      it('should change __parent reference and WARN when moving a child instance to an other parent', () => {
        const person1 = new Person({
          name: 'Mitsos',
          address: {street: 'kopria', number: 11},
        });
        const {address} = person1;
        address.should.be.instanceof(Address).and.have.property('__parent').which.equals(person1);
        StrongGlobalize.prototype.warn.should.have.property('called', 0); // check that no warn yet
        const person2 = new Person({
          name: 'Allos',
          address,
        });
        address.should.have.property('__parent').which.equals(person2);
        StrongGlobalize.prototype.warn.should.have.property('called', 1); // check we had a warning
      });
      it('should NOT provide the __parent property to any serialization of the instance', () => {
        const person = new Person({
          name: 'Mitsos',
          address: {street: 'kopria', number: 11},
        });
        person.toJSON().should.not.have.propertyByPath('address', '__parent');
        person.toObject().should.not.have.propertyByPath('address', '__parent');
      });
      it('should NOT provide __parent property in plain object properties', () => {
        const person = new Person({
          name: 'Mitsos',
          address: {street: 'kopria', number: 11},
          other: {some: 'object'},
        });
        person.should.have.property('other').which.eql({some: 'object'}).and.not.has
          .property('__parent');
      });
    });

    describe('Model with properties as list of embedded models', () => {
      let Person, Address;
      beforeEach('Define models', () => {
        Address = builder.define('Address', {
          street: {type: 'string'},
          number: {type: 'number'},
        });
        Person = builder.define('Person', {
          name: {type: 'string'},
          addresses: {type: ['Address']}, // array of addresses
        });
      });
      it('should pass the container model instance as parent to the list item', () => {
        const person = new Person({
          name: 'mitsos',
          addresses: [{
            street: 'kapou oraia',
            number: 100,
          }],
        });
        person.should.have.property('addresses').which.has.property('parent')
          .which.is.instanceof(Person).and.equals(person);
      });
      it('should pass the container model instance as parent to the list, when assigning to ' +
        'the list property', () => {
        const person = new Person({
          name: 'mitsos',
        });
        person.addresses = [{
          street: 'kapou oraia',
          number: 100,
        }];
        person.should.have.property('addresses').which.has.property('parent')
          .which.is.instanceof(Person).and.equals(person);
      });
    });

    function givenModelBuilderInstance() {
      builder = new ModelBuilder();
    }
  });
});
