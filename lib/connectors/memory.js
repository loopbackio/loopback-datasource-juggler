var util = require('util');
var Connector = require('../connector');
var geo = require('../geo');
var utils = require('../utils');
var fs = require('fs');
var async = require('async');

/**
 * Initialize the Oracle connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
  dataSource.connector = new Memory(null, dataSource.settings);
  dataSource.connector.connect(callback);
};

exports.Memory = Memory;

function Memory(m, settings) {
  if (m instanceof Memory) {
    this.isTransaction = true;
    this.cache = m.cache;
    this.ids = m.ids;
    this.constructor.super_.call(this, 'memory', settings);
    this._models = m._models;
  } else {
    this.isTransaction = false;
    this.cache = {};
    this.ids = {};
    this.constructor.super_.call(this, 'memory', settings);
  }
}

util.inherits(Memory, Connector);

Memory.prototype.getDefaultIdType = function() {
  return Number;
};

Memory.prototype.getTypes = function() {
  return ['db', 'nosql', 'memory'];
};

Memory.prototype.connect = function (callback) {
  if (this.isTransaction) {
    this.onTransactionExec = callback;
  } else {
    this.loadFromFile(callback);
  }
};

function serialize(obj) {
  if(obj === null || obj === undefined) {
    return obj;
  }
  return JSON.stringify(obj);
}

function deserialize(dbObj) {
  if(dbObj === null || dbObj === undefined) {
    return dbObj;
  }
  if(typeof dbObj === 'string') {
    return JSON.parse(dbObj);
  } else {
    return dbObj;
  }
}

Memory.prototype.loadFromFile = function(callback) {
  var self = this;
  var hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
  var localStorage = hasLocalStorage && this.settings.localStorage;

  if (self.settings.file) {
    fs.readFile(self.settings.file, {encoding: 'utf8', flag: 'r'}, function (err, data) {
      if (err && err.code !== 'ENOENT') {
        callback && callback(err);
      } else {
        parseAndLoad(data);
      }
    });
  } else if(localStorage) {
    var data = window.localStorage.getItem(localStorage);
    data = data || '{}';
    parseAndLoad(data);
  } else {
    process.nextTick(callback);
  }

  function parseAndLoad(data) {
    if (data) {
      try {
        data = JSON.parse(data.toString());
      } catch(e) {
        return callback(e);
      }

      self.ids = data.ids || {};
      self.cache = data.models || {};
    } else {
      if(!self.cache) {
        self.ids = {};
        self.cache = {};
      }
    }
    callback && callback();
  }
};

/*!
 * Flush the cache into the json file if necessary
 * @param {Function} callback
 */
Memory.prototype.saveToFile = function (result, callback) {
  var self = this;
  var file = this.settings.file;
  var hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
  var localStorage = hasLocalStorage && this.settings.localStorage;
  if (file) {
    if(!self.writeQueue) {
      // Create a queue for writes
      self.writeQueue = async.queue(function (task, cb) {
        // Flush out the models/ids
        var data = JSON.stringify({
          ids: self.ids,
          models: self.cache
        }, null, '  ');

        fs.writeFile(self.settings.file, data, function (err) {
          cb(err);
          task.callback && task.callback(err, task.data);
        });
      }, 1);
    }
    // Enqueue the write
    self.writeQueue.push({
      data: result,
      callback: callback
    });
  } else if (localStorage) {
    // Flush out the models/ids
    var data = JSON.stringify({
      ids: self.ids,
      models: self.cache
    }, null, '  ');
    window.localStorage.setItem(localStorage, data);
    process.nextTick(function () {
      callback && callback(null, result);
    });
  } else {
    process.nextTick(function () {
      callback && callback(null, result);
    });
  }
};

Memory.prototype.define = function defineModel(definition) {
  this.constructor.super_.prototype.define.apply(this, [].slice.call(arguments));
  var m = definition.model.modelName;
  if(!this.cache[m]) {
    this.cache[m] = {};
    this.ids[m] = 1;
  }
};

Memory.prototype.create = function create(model, data, callback) {
  // FIXME: [rfeng] We need to generate unique ids based on the id type
  // FIXME: [rfeng] We don't support composite ids yet
  var currentId = this.ids[model];
  if (currentId === undefined) {
    // First time
    this.ids[model] = 1;
    currentId = 1;
  }
  var id = this.getIdValue(model, data) || currentId;
  if (id > currentId) {
    // If the id is passed in and the value is greater than the current id
    currentId = id;
  }
  this.ids[model] = Number(currentId) + 1;

  var props = this._models[model].properties;
  var idName = this.idName(model);
  id = (props[idName] && props[idName].type && props[idName].type(id)) || id;
  this.setIdValue(model, data, id);
  if(!this.cache[model]) {
    this.cache[model] = {};
  }
  this.cache[model][id] = serialize(data);
  this.saveToFile(id, callback);
};

Memory.prototype.updateOrCreate = function (model, data, callback) {
  var self = this;
  this.exists(model, self.getIdValue(model, data), function (err, exists) {
    if (exists) {
      self.save(model, data, callback);
    } else {
      self.create(model, data, function (err, id) {
        self.setIdValue(model, data, id);
        callback(err, data);
      });
    }
  });
};

Memory.prototype.save = function save(model, data, callback) {
  var id = this.getIdValue(model, data);
  var cachedModels = this.cache[model];
  var modelData = cachedModels && this.cache[model][id];
  modelData = modelData && deserialize(modelData);
  if (modelData) {
    data = merge(modelData, data);
  }
  this.cache[model][id] = serialize(data);
  this.saveToFile(data, callback);
};

Memory.prototype.exists = function exists(model, id, callback) {
  process.nextTick(function () {
    callback(null, this.cache[model] && this.cache[model].hasOwnProperty(id));
  }.bind(this));
};

Memory.prototype.find = function find(model, id, callback) {
  process.nextTick(function () {
    callback(null, id in this.cache[model] && this.fromDb(model, this.cache[model][id]));
  }.bind(this));
};

Memory.prototype.destroy = function destroy(model, id, callback) {
  delete this.cache[model][id];
  this.saveToFile(null, callback);
};

Memory.prototype.fromDb = function (model, data) {
  if (!data) return null;
  data = deserialize(data);
  var props = this._models[model].properties;
  for (var key in data) {
    var val = data[key];
    if (val === undefined || val === null) {
      continue;
    }
    if (props[key]) {
      switch (props[key].type.name) {
        case 'Date':
          val = new Date(val.toString().replace(/GMT.*$/, 'GMT'));
          break;
        case 'Boolean':
          val = Boolean(val);
          break;
        case 'Number':
          val = Number(val);
          break;
      }
    }
    data[key] = val;
  }
  return data;
};

Memory.prototype.all = function all(model, filter, callback) {
  var self = this;
  var nodes = Object.keys(this.cache[model]).map(function (key) {
    return this.fromDb(model, this.cache[model][key]);
  }.bind(this));

  if (filter) {
    // do we need some sorting?
    if (filter.order) {
      var orders = filter.order;
      if (typeof filter.order === "string") {
        orders = [filter.order];
      }
      orders.forEach(function (key, i) {
        var reverse = 1;
        var m = key.match(/\s+(A|DE)SC$/i);
        if (m) {
          key = key.replace(/\s+(A|DE)SC/i, '');
          if (m[1].toLowerCase() === 'de') reverse = -1;
        }
        orders[i] = {"key": key, "reverse": reverse};
      });
      nodes = nodes.sort(sorting.bind(orders));
    }

    var nearFilter = geo.nearFilter(filter.where);

    // geo sorting
    if (nearFilter) {
      nodes = geo.filter(nodes, nearFilter);
    }

    // do we need some filtration?
    if (filter.where) {
      nodes = nodes ? nodes.filter(applyFilter(filter)) : nodes;
    }

    // field selection
    if (filter.fields) {
      nodes = nodes.map(utils.selectFields(filter.fields));
    }

    // limit/skip
    filter.skip = filter.skip || 0;
    filter.limit = filter.limit || nodes.length;
    nodes = nodes.slice(filter.skip, filter.skip + filter.limit);
  }

  process.nextTick(function () {
    if (filter && filter.include) {
      self._models[model].model.include(nodes, filter.include, callback);
    } else {
      callback(null, nodes);
    }
  });

  function sorting(a, b) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (a[this[i].key] > b[this[i].key]) {
        return 1 * this[i].reverse;
      } else if (a[this[i].key] < b[this[i].key]) {
        return -1 * this[i].reverse;
      }
    }
    return 0;
  }
};

function applyFilter(filter) {
  var where = filter.where;
  if (typeof where === 'function') {
    return where;
  }
  var keys = Object.keys(where);
  return function (obj) {
    var pass = true;
    keys.forEach(function (key) {
      if(key === 'and' || key === 'or') {
        if(Array.isArray(where[key])) {
          if(key === 'and') {
            pass = where[key].every(function(cond) {
              return applyFilter({where: cond})(obj);
            });
            return pass;
          }
          if(key === 'or') {
            pass = where[key].some(function(cond) {
              return applyFilter({where: cond})(obj);
            });
            return pass;
          }
        }
      }
      if (!test(where[key], obj && obj[key])) {
        pass = false;
      }
    });
    return pass;
  }

  function test(example, value) {
    if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
      return value.match(example);
    }
    if (example === undefined || value === undefined) {
      return undefined;
    }
    if (typeof example === 'object') {
      // ignore geo near filter
      if (example.near) {
        return true;
      }

      if (example.inq) {
        if (!value) return false;
        for (var i = 0; i < example.inq.length; i += 1) {
          if (example.inq[i] == value) return true;
        }
        return false;
      }

      if (isNum(example.gt) && example.gt < value) return true;
      if (isNum(example.gte) && example.gte <= value) return true;
      if (isNum(example.lt) && example.lt > value) return true;
      if (isNum(example.lte) && example.lte >= value) return true;
    }
    // not strict equality
    return (example !== null ? example.toString() : example) == (value !== null ? value.toString() : value);
  }

  function isNum(n) {
    return typeof n === 'number';
  }
}

Memory.prototype.destroyAll = function destroyAll(model, where, callback) {
  if (!callback && 'function' === typeof where) {
    callback = where;
    where = undefined;
  }
  var cache = this.cache[model];
  var filter = null;
  if (where) {
    filter = applyFilter({where: where});
  }
  Object.keys(cache).forEach(function (id) {
    if (!filter || filter(this.fromDb(model, cache[id]))) {
      delete cache[id];
    }
  }.bind(this));
  if (!where) {
    this.cache[model] = {};
  }
  this.saveToFile(null, callback);
};

Memory.prototype.count = function count(model, callback, where) {
  var cache = this.cache[model];
  var data = Object.keys(cache);
  if (where) {
    var filter = {where: where};
    data = data.map(function (id) {
      return this.fromDb(model, cache[id]);
    }.bind(this));
    data = data.filter(applyFilter(filter));
  }
  process.nextTick(function () {
    callback(null, data.length);
  });
};

Memory.prototype.updateAttributes = function updateAttributes(model, id, data, cb) {
  if (!id) {
    var err = new Error('You must provide an id when updating attributes!');
    if (cb) {
      return cb(err);
    } else {
      throw err;
    }
  }

  this.setIdValue(model, data, id);

  var cachedModels = this.cache[model];
  var modelData = cachedModels && this.cache[model][id];

  if (modelData) {
    this.save(model, data, cb);
  } else {
    cb(new Error('Could not update attributes. Object with id ' + id + ' does not exist!'));
  }
};

Memory.prototype.transaction = function () {
  return new Memory(this);
};

Memory.prototype.exec = function (callback) {
  this.onTransactionExec();
  setTimeout(callback, 50);
};

Memory.prototype.buildNearFilter = function (filter) {
  // noop
}

function merge(base, update) {
  if (!base) {
    return update;
  }
  // We cannot use Object.keys(update) if the update is an instance of the model
  // class as the properties are defined at the ModelClass.prototype level
  for(var key in update) {
    var val = update[key];
    if(typeof val === 'function') {
      continue; // Skip methods
    }
    base[key] = val;
  }
  return base;
}
