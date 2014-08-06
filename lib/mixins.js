var fs = require('fs');
var path = require('path');
var extend = require('util')._extend;
var inflection = require('inflection');
var debug = require('debug')('loopback:mixin');
var ModelBuilder = require('./model-builder').ModelBuilder;

var registry = exports.registry = {};
var modelBuilder = new ModelBuilder();

exports.apply = function applyMixin(modelClass, name, options) {
  name = inflection.classify(name.replace(/-/g, '_'));
  var fn = registry[name];
  if (typeof fn === 'function') {
    if (modelClass.dataSource) {
      fn(modelClass, options || {});
    } else {
      modelClass.once('dataSourceAttached', function() {
        fn(modelClass, options || {});
      });
    }
  } else {
    debug('Invalid mixin: %s', name);
  }
};

var defineMixin = exports.define = function defineMixin(name, mixin, ldl) {
  if (typeof mixin === 'function' || typeof mixin === 'object') {
    name = inflection.classify(name.replace(/-/g, '_'));
    if (registry[name]) {
      debug('Duplicate mixin: %s', name);
    } else {
      debug('Defining mixin: %s', name);
    }
    if (typeof mixin === 'object' && ldl) {
      var model = modelBuilder.define(name, mixin);
      registry[name] = function(Model, options) {
        Model.mixin(model, options);
      };
    } else if (typeof mixin === 'object') {
      registry[name] = function(Model, options) {
        extend(Model.prototype, mixin);
      };
    } else if (typeof mixin === 'function') {
      registry[name] = mixin;
    }
  } else {
    debug('Invalid mixin function: %s', name);
  }
};

var loadMixins = exports.load = function loadMixins(dir) {
  var files = tryReadDir(path.resolve(dir));
  files.forEach(function(filename) {
    var filepath = path.resolve(path.join(dir, filename));
    var ext = path.extname(filename);
    var name = path.basename(filename, ext);
    var stats = fs.statSync(filepath);
    if (stats.isFile()) {
      if (ext in require.extensions) {
        var mixin = tryRequire(filepath);
        if (typeof mixin === 'function' 
          || typeof mixin === 'object') {
          defineMixin(name, mixin, ext === '.json');
        }
      }
    }
  });
};

loadMixins(path.join(__dirname, 'mixins'));

function tryReadDir() {
  try {
    return fs.readdirSync.apply(fs, arguments);
  } catch(e) {
    return [];
  }
};

function tryRequire(file) {
  try {
    return require(file);
  } catch(e) {
  }
};

