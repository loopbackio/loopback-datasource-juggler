// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

const debug = require('debug')('loopback:mixin');
const assert = require('assert');
const DefaultModelBaseClass = require('./model.js');

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof DefaultModelBaseClass;
}

module.exports = MixinProvider;

function MixinProvider(modelBuilder) {
  this.modelBuilder = modelBuilder;
  this.mixins = {};
}

/**
 * Apply named mixin to the model class
 * @param {Model} modelClass
 * @param {String} name
 * @param {Object} options
 */
MixinProvider.prototype.applyMixin = function applyMixin(modelClass, name, options) {
  const fn = this.mixins[name];
  if (typeof fn === 'function') {
    if (modelClass.dataSource) {
      fn(modelClass, options || {});
    } else {
      modelClass.once('dataSourceAttached', function() {
        fn(modelClass, options || {});
      });
    }
  } else {
    // Try model name
    const model = this.modelBuilder.getModel(name);
    if (model) {
      debug('Mixin is resolved to a model: %s', name);
      modelClass.mixin(model, options);
    } else {
      const errMsg = 'Model "' + modelClass.modelName + '" uses unknown mixin: ' + name;
      debug(errMsg);
      throw new Error(errMsg);
    }
  }
};

/**
 * Define a mixin with name
 * @param {String} name Name of the mixin
 * @param {*) mixin The mixin function or a model
 */
MixinProvider.prototype.define = function defineMixin(name, mixin) {
  assert(typeof mixin === 'function', 'The mixin must be a function or model class');
  if (this.mixins[name]) {
    debug('Duplicate mixin: %s', name);
  } else {
    debug('Defining mixin: %s', name);
  }
  if (isModelClass(mixin)) {
    this.mixins[name] = function(Model, options) {
      Model.mixin(mixin, options);
    };
  } else if (typeof mixin === 'function') {
    this.mixins[name] = mixin;
  }
};
