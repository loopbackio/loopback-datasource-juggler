// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');

const juggler = require('../');
const ModelBuilder = juggler.ModelBuilder;

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

    function givenModelBuilderInstance() {
      builder = new ModelBuilder();
    }
  });
});
