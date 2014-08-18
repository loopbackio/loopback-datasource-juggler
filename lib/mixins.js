var debug = require('debug')('loopback:mixin');
var assert = require('assert');
var inflection = require('inflection');
var DefaultModelBaseClass = require('./model.js');

function isModelClass(cls) {
  if (!cls) {
    return false;
  }
  return cls.prototype instanceof DefaultModelBaseClass;
}

function normalizeName(str) {
  str = inflection.underscore(str); // pre-normalize
  str = String(str).replace(/[\W_]/g, ' ').toLowerCase();
  str = str.replace(/(?:^|\s|-)\S/g, function(c){ return c.toUpperCase(); });
  return str.replace(/\s/g, '');
}

module.exports = MixinProvider;

function MixinProvider(modelBuilder) {
  this.modelBuilder = modelBuilder;
  this.mixins = {};
}

/**
 * Get named mixin
 * @param {String} name
 * @returns {Function} mixin
 */
MixinProvider.prototype.getMixin = function getMixin(name) {
  return this.mixins[normalizeName(name)];
};

/**
 * Apply named mixin to the model class
 * @param {Model} modelClass
 * @param {String} name
 * @param {Object} options
 */
MixinProvider.prototype.applyMixin = function applyMixin(modelClass, name, options) {
  var fn = this.getMixin(name);
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
    var model = this.modelBuilder.getModel(name);
    if(model) {
      debug('Mixin is resolved to a model: %s', name);
      modelClass.mixin(model, options);
    } else {
      debug('Invalid mixin: %s', name);
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
  name = normalizeName(name);
  if (this.mixins[name]) {
    debug('Duplicate mixin: %s', name);
  } else {
    debug('Defining mixin: %s', name);
  }
  if (isModelClass(mixin)) {
    this.mixins[name] = function (Model, options) {
      Model.mixin(mixin, options);
    };
  } else if (typeof mixin === 'function') {
    this.mixins[name] = mixin;
  }
};

