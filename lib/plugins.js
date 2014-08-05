var fs = require('fs');
var path = require('path');
var debug = require('debug')('loopback:plugin');

var registry = {};

exports.apply = function applyPlugin(name, modelClass, options) {
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
    debug('Invalid plugin: %s', name);
  }
};

var definePlugin = exports.define = function definePlugin(name, fn) {
  if (typeof fn === 'function') {
    if (registry[name]) {
      debug('Duplicate plugin: %s', name);
    } else {
      debug('Defining plugin: %s', name);
    }
    registry[name] = fn;
  } else {
    debug('Invalid plugin function: %s', name);
  }
};

var loadPlugin = exports.load = function loadPlugin(dir) {
  var files = tryReadDir(path.resolve(dir));
  files.forEach(function(filename) {
    var filepath = path.resolve(path.join(dir, filename));
    var ext = path.extname(filename);
    var name = path.basename(filename, ext);
    var stats = fs.statSync(filepath);
    if (stats.isFile()) {
      if (ext in require.extensions) {
        var plugin = tryRequire(filepath);
        if (typeof plugin === 'function') {
          definePlugin(name, plugin);
        }
      }
    }
  });
};

loadPlugin(path.join(__dirname, 'plugins'));

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

