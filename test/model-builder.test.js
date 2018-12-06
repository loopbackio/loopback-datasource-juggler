// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const should = require('./init.js');

const juggler = require('../');
var ModelBuilder = juggler.ModelBuilder;

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

      it('supports model names that match parameter names', () => {
        builder.define('data').should.not.throw();
        builder.define('options').should.not.throw();
      });
    });

    function givenModelBuilderInstance() {
      builder = new ModelBuilder();
    }
  });
});

