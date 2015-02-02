var util = require('util');
var Connector = require('loopback-connector').Connector;
var geo = require('../geo');
var utils = require('../utils');
var fs = require('fs');
var async = require('async');

/**
 * Initialize the Memory connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
  dataSource.connector = new Memory(null, dataSource.settings);
  dataSource.connector.connect(callback);
};

exports.Memory = Memory;
exports.applyFilter = applyFilter;

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

Memory.prototype.getCollection = function(model) {
  var modelClass = this._models[model];
  if (modelClass && modelClass.settings.memory) {
    model = modelClass.settings.memory.collection || model;
  }
  return model;
}

Memory.prototype.initCollection = function(model) {
  this.collection(model, {});
  this.collectionSeq(model, 1);
}

Memory.prototype.collection = function(model, val) {
  model = this.getCollection(model);
  if (arguments.length > 1) this.cache[model] = val;
  return this.cache[model];
};

Memory.prototype.collectionSeq = function(model, val) {
  model = this.getCollection(model);
  if (arguments.length > 1) this.ids[model] = val;
  return this.ids[model];
};

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
  if(!this.collection(m)) this.initCollection(m);
};

Memory.prototype.create = function create(model, data, callback) {
  // FIXME: [rfeng] We need to generate unique ids based on the id type
  // FIXME: [rfeng] We don't support composite ids yet
  var currentId = this.collectionSeq(model);
  if (currentId === undefined) { // First time
    currentId = this.collectionSeq(model, 1);
  }
  var id = this.getIdValue(model, data) || currentId;
  if (id > currentId) {
    // If the id is passed in and the value is greater than the current id
    currentId = id;
  }
  this.collectionSeq(model, Number(currentId) + 1);

  var props = this._models[model].properties;
  var idName = this.idName(model);
  id = (props[idName] && props[idName].type && props[idName].type(id)) || id;
  this.setIdValue(model, data, id);
  if(!this.collection(model)) {
    this.collection(model, {});
  }
  this.collection(model)[id] = serialize(data);
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
  var cachedModels = this.collection(model);
  var modelData = cachedModels && this.collection(model)[id];
  modelData = modelData && deserialize(modelData);
  if (modelData) {
    data = merge(modelData, data);
  }
  this.collection(model)[id] = serialize(data);
  this.saveToFile(data, callback);
};

Memory.prototype.exists = function exists(model, id, callback) {
  process.nextTick(function () {
    callback(null, this.collection(model) && this.collection(model).hasOwnProperty(id));
  }.bind(this));
};

Memory.prototype.find = function find(model, id, callback) {
  process.nextTick(function () {
    callback(null, id in this.collection(model) && this.fromDb(model, this.collection(model)[id]));
  }.bind(this));
};

Memory.prototype.destroy = function destroy(model, id, callback) {
  delete this.collection(model)[id];
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
  var nodes = Object.keys(this.collection(model)).map(function (key) {
    return this.fromDb(model, this.collection(model)[key]);
  }.bind(this));

  if (filter) {
    if (!filter.order) {
      var idNames = this.idNames(model);
      if (idNames && idNames.length) {
        filter.order = idNames;
      }
    }
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
    var skip = filter.skip || filter.offset || 0;
    var limit = filter.limit || nodes.length;
    nodes = nodes.slice(skip, skip + limit);
  }

  process.nextTick(function () {
    if (filter && filter.include) {
      self._models[model].model.include(nodes, filter.include, callback);
    } else {
      callback(null, nodes);
    }
  });

  function sorting(a, b) {
    var undefinedA, undefinedB;

    for (var i = 0, l = this.length; i < l; i++) {
      undefinedB = b[this[i].key] === undefined && a[this[i].key] !== undefined;
      undefinedA = a[this[i].key] === undefined && b[this[i].key] !== undefined;

      if (undefinedB || a[this[i].key] > b[this[i].key]) {
        return 1 * this[i].reverse;
      } else if (undefinedA || a[this[i].key] < b[this[i].key]) {
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

  function toRegExp(pattern) {
    if (pattern instanceof RegExp) {
      return pattern;
    }
    var regex = '';
    // Escaping user input to be treated as a literal string within a regular expression
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Writing_a_Regular_Expression_Pattern
    pattern = pattern.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    for (var i = 0, n = pattern.length; i < n; i++) {
      var char = pattern.charAt(i);
      if (char === '\\') {
        i++; // Skip to next char
        if (i < n) {
          regex += pattern.charAt(i);
        }
        continue;
      } else if (char === '%') {
        regex += '.*';
      } else if (char === '_') {
        regex += '.';
      } else if (char === '.') {
        regex += '\\.';
      } else if (char === '*') {
        regex += '\\*';
      }
      else {
        regex += char;
      }
    }
    return regex;
  }

  function test(example, value) {
    if (typeof value === 'string' && (example instanceof RegExp)) {
      return value.match(example);
    }
    if (example === undefined) {
      return undefined;
    }

    if (typeof example === 'object' && example !== null) {
      // ignore geo near filter
      if (example.near) {
        return true;
      }

      if (example.inq) {
        // if (!value) return false;
        for (var i = 0; i < example.inq.length; i++) {
          if (example.inq[i] == value) {
            return true;
          }
        }
        return false;
      }

      if ('neq' in example) {
        return compare(example.neq, value) !== 0;
      }

      if (example.like || example.nlike) {

        var like = example.like || example.nlike;
        if (typeof like === 'string') {
          like = toRegExp(like);
        }
        if (example.like) {
          return !!new RegExp(like).test(value);
        }

        if (example.nlike) {
          return !new RegExp(like).test(value);
        }
      }

      if (testInEquality(example, value)) {
        return true;
      }
    }
    // not strict equality
    return (example !== null ? example.toString() : example)
      == (value != null ? value.toString() : value);
  }

  /**
   * Compare two values
   * @param {*} val1 The 1st value
   * @param {*} val2 The 2nd value
   * @returns {number} 0: =, positive: >, negative <
   * @private
   */
  function compare(val1, val2) {
    if(val1 == null || val2 == null) {
      // Either val1 or val2 is null or undefined
      return val1 == val2 ? 0 : NaN;
    }
    if (typeof val1 === 'number') {
      return val1 - val2;
    }
    if (typeof val1 === 'string') {
      return (val1 > val2) ? 1 : ((val1 < val2) ? -1 : (val1 == val2) ? 0 : NaN);
    }
    if (typeof val1 === 'boolean') {
      return val1 - val2;
    }
    if (val1 instanceof Date) {
      var result = val1 - val2;
      return result;
    }
    // Return NaN if we don't know how to compare
    return (val1 == val2) ? 0 : NaN;
  }

  function testInEquality(example, val) {
    if ('gt' in example) {
      return compare(val, example.gt) > 0;
    }
    if ('gte' in example) {
      return compare(val, example.gte) >= 0;
    }
    if ('lt' in example) {
      return compare(val, example.lt) < 0;
    }
    if ('lte' in example) {
      return compare(val, example.lte) <= 0;
    }
    return false;
  }
}

Memory.prototype.destroyAll = function destroyAll(model, where, callback) {
  if (!callback && 'function' === typeof where) {
    callback = where;
    where = undefined;
  }
  var cache = this.collection(model);
  var filter = null;
  if (where) {
    filter = applyFilter({where: where});
    Object.keys(cache).forEach(function (id) {
      if (!filter || filter(this.fromDb(model, cache[id]))) {
        delete cache[id];
      }
    }.bind(this));
  } else {
    this.collection(model, {});
  }
  this.saveToFile(null, callback);
};

Memory.prototype.count = function count(model, callback, where) {
  var cache = this.collection(model);
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

Memory.prototype.update =
  Memory.prototype.updateAll = function updateAll(model, where, data, cb) {
    var self = this;
    var cache = this.collection(model);
    var filter = null;
    where = where || {};
    filter = applyFilter({where: where});

    var ids = Object.keys(cache);
    async.each(ids, function (id, done) {
      var inst = self.fromDb(model, cache[id]);
      if (!filter || filter(inst)) {
        // The id value from the cache is string
        // Get the real id from the inst
        id = self.getIdValue(model, inst);
        self.updateAttributes(model, id, data, done);
      } else {
        process.nextTick(done);
      }
    }, function (err) {
      if (!err) {
        self.saveToFile(null, cb);
      }
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

  // Do not modify the data object passed in arguments
  data = Object.create(data);

  this.setIdValue(model, data, id);

  var cachedModels = this.collection(model);
  var modelData = cachedModels && this.collection(model)[id];

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

Memory.prototype.automigrate = function (models, cb) {
  var self = this;

  if ((!cb) && ('function' === typeof models)) {
    cb = models;
    models = undefined;
  }
  // First argument is a model name
  if ('string' === typeof models) {
    models = [models];
  }

  models = models || Object.keys(self._models);
  if (models.length === 0) {
    return process.nextTick(cb);
  }

  var invalidModels = models.filter(function(m) {
    return !(m in self._models);
  });

  if (invalidModels.length) {
    return process.nextTick(function() {
      cb(new Error('Cannot migrate models not attached to this datasource: ' +
        invalidModels.join(' ')));
    });
  }

  models.forEach(function(m) {
    self.initCollection(m);
  });
  if (cb) process.nextTick(cb);
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
