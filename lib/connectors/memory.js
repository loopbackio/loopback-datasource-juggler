// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

/* global window:false */
const g = require('strong-globalize')();
const util = require('util');
const Connector = require('loopback-connector').Connector;
const geo = require('../geo');
const utils = require('../utils');
const fs = require('fs');
const async = require('async');
const debug = require('debug')('loopback:connector:memory');

/**
 * Initialize the Memory connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
  dataSource.connector = new Memory(null, dataSource.settings);
  // Use dataSource.connect to avoid duplicate file reads from cache
  dataSource.connect(callback);
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

Memory.prototype.multiInsertSupported = true;

Memory.prototype.getDefaultIdType = function() {
  return Number;
};

Memory.prototype.getTypes = function() {
  return ['db', 'nosql', 'memory'];
};

Memory.prototype.connect = function(callback) {
  if (this.isTransaction) {
    this.onTransactionExec = callback;
  } else {
    this.loadFromFile(callback);
  }
};

function serialize(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.stringify(obj);
}

function deserialize(dbObj) {
  if (dbObj === null || dbObj === undefined) {
    return dbObj;
  }
  if (typeof dbObj === 'string') {
    return JSON.parse(dbObj);
  } else {
    return dbObj;
  }
}

Memory.prototype.getCollection = function(model) {
  const modelClass = this._models[model];
  if (modelClass && modelClass.settings.memory) {
    model = modelClass.settings.memory.collection || model;
  }
  return model;
};

Memory.prototype.initCollection = function(model) {
  this.collection(model, {});
  this.collectionSeq(model, 1);
};

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

/**
 * Create a queue to serialize file read/write operations
 * @returns {*} The file operation queue
 */
Memory.prototype.setupFileQueue = function() {
  const self = this;
  if (!this.fileQueue) {
    // Create a queue for writes
    this.fileQueue = async.queue(function(task, done) {
      const callback = task.callback || function() {};
      const file = self.settings.file;
      if (task.operation === 'write') {
        // Flush out the models/ids
        const data = JSON.stringify({
          ids: self.ids,
          models: self.cache,
        }, null, '  ');
        debug('Writing cache to %s: %s', file, data);
        fs.writeFile(file, data, function(err) {
          debug('Cache has been written to %s', file);
          done(err);
          callback(err, task.data);
        });
      } else if (task.operation === 'read') {
        debug('Reading cache from %s', file);
        fs.readFile(file, {
          encoding: 'utf8',
          flag: 'r',
        }, function(err, data) {
          if (err && err.code !== 'ENOENT') {
            done(err);
            callback(err);
          } else {
            debug('Cache has been read from %s: %s', file, data);
            self.parseAndLoad(data, function(err) {
              done(err);
              callback(err);
            });
          }
        });
      } else {
        const err = new Error('Unknown type of task');
        done(err);
        callback(err);
      }
    }, 1);
  }
  return this.fileQueue;
};

Memory.prototype.parseAndLoad = function(data, callback) {
  if (data) {
    try {
      data = JSON.parse(data.toString());
    } catch (e) {
      return callback && callback(e);
    }

    this.ids = data.ids || {};
    this.cache = data.models || {};
  } else {
    if (!this.cache) {
      this.ids = {};
      this.cache = {};
    }
  }
  callback && callback();
};

Memory.prototype.loadFromFile = function(callback) {
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
  const localStorage = hasLocalStorage && this.settings.localStorage;

  if (this.settings.file) {
    debug('Queueing read %s', this.settings.file);
    this.setupFileQueue().push({
      operation: 'read',
      callback: callback,
    });
  } else if (localStorage) {
    let data = window.localStorage.getItem(localStorage);
    data = data || '{}';
    this.parseAndLoad(data, callback);
  } else {
    process.nextTick(callback);
  }
};

/*!
 * Flush the cache into the json file if necessary
 * @param {Function} callback
 */
Memory.prototype.saveToFile = function(result, callback) {
  const file = this.settings.file;
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
  const localStorage = hasLocalStorage && this.settings.localStorage;
  if (file) {
    debug('Queueing write %s', this.settings.file);
    // Enqueue the write
    this.setupFileQueue().push({
      operation: 'write',
      data: result,
      callback: callback,
    });
  } else if (localStorage) {
    // Flush out the models/ids
    const data = JSON.stringify({
      ids: this.ids,
      models: this.cache,
    }, null, '  ');
    window.localStorage.setItem(localStorage, data);
    process.nextTick(function() {
      callback && callback(null, result);
    });
  } else {
    process.nextTick(function() {
      callback && callback(null, result);
    });
  }
};

Memory.prototype.define = function defineModel(definition) {
  this.constructor.super_.prototype.define.apply(this, [].slice.call(arguments));
  const m = definition.model.modelName;
  if (!this.collection(m)) this.initCollection(m);
};

Memory.prototype._createSync = function(model, data, fn) {
  // FIXME: [rfeng] We need to generate unique ids based on the id type
  // FIXME: [rfeng] We don't support composite ids yet
  let currentId = this.collectionSeq(model);
  if (currentId === undefined) { // First time
    currentId = this.collectionSeq(model, 1);
  }
  let id = this.getIdValue(model, data) || currentId;
  if (id > currentId) {
    // If the id is passed in and the value is greater than the current id
    currentId = id;
  }
  this.collectionSeq(model, Number(currentId) + 1);

  const props = this._models[model].properties;
  const idName = this.idName(model);
  id = (props[idName] && props[idName].type && props[idName].type(id)) || id;
  this.setIdValue(model, data, id);
  if (!this.collection(model)) {
    this.collection(model, {});
  }

  if (this.collection(model)[id]) {
    const error = new Error(g.f('Duplicate entry for %s.%s', model, idName));
    error.statusCode = error.status = 409;
    return fn(error);
  }

  this.collection(model)[id] = serialize(data);
  fn(null, id);
};

Memory.prototype.create = function create(model, data, options, callback) {
  const self = this;
  this._createSync(model, data, function(err, id) {
    if (err) {
      return process.nextTick(function() {
        callback(err);
      });
    }
    self.saveToFile(id, callback);
  });
};

Memory.prototype.createAll = function create(model, dataArray, options, callback) {
  const returnArr = [];
  async.eachSeries(
    dataArray,
    (data, cb) => {
      this._createSync(model, data, (err, id) => {
        if (err) {
          return process.nextTick(function() {
            cb(err);
          });
        }
        const returnData = Object.assign({}, data);
        this.setIdValue(model, returnData, id);
        returnArr.push(returnData);
        this.saveToFile(id, cb);
      });
    },
    (err) => {
      callback(err, returnArr);
    },
  );
};

Memory.prototype.updateOrCreate = function(model, data, options, callback) {
  const self = this;
  this.exists(model, self.getIdValue(model, data), options, function(err, exists) {
    if (exists) {
      self.save(model, data, options, function(err, data) {
        callback(err, data, {isNewInstance: false});
      });
    } else {
      self.create(model, data, options, function(err, id) {
        self.setIdValue(model, data, id);
        callback(err, data, {isNewInstance: true});
      });
    }
  });
};

Memory.prototype.patchOrCreateWithWhere =
Memory.prototype.upsertWithWhere = function(model, where, data, options, callback) {
  const self = this;
  const primaryKey = this.idName(model);
  const filter = {where: where};
  const nodes = self._findAllSkippingIncludes(model, filter);
  if (nodes.length === 0) {
    return self._createSync(model, data, function(err, id) {
      if (err) return process.nextTick(function() { callback(err); });
      self.saveToFile(id, function(err, id) {
        self.setIdValue(model, data, id);
        callback(err, self.fromDb(model, data), {isNewInstance: true});
      });
    });
  }
  if (nodes.length === 1) {
    const primaryKeyValue = nodes[0][primaryKey];
    self.updateAttributes(model, primaryKeyValue, data, options, function(err, data) {
      callback(err, data, {isNewInstance: false});
    });
  } else {
    process.nextTick(function() {
      const error = new Error('There are multiple instances found.' +
        'Upsert Operation will not be performed!');
      error.statusCode = 400;
      callback(error);
    });
  }
};

Memory.prototype.findOrCreate = function(model, filter, data, options, callback) {
  const self = this;
  const nodes = self._findAllSkippingIncludes(model, filter);
  const found = nodes[0];

  if (!found) {
    // Calling _createSync to update the collection in a sync way and to guarantee to create it in the same turn of even loop
    return self._createSync(model, data, function(err, id) {
      if (err) return callback(err);
      self.saveToFile(id, function(err, id) {
        self.setIdValue(model, data, id);
        callback(err, data, true);
      });
    });
  }

  if (!filter || !filter.include) {
    return process.nextTick(function() {
      callback(null, found, false);
    });
  }

  self._models[model].model.include(nodes[0], filter.include, options, function(err, nodes) {
    process.nextTick(function() {
      if (err) return callback(err);
      callback(null, nodes[0], false);
    });
  });
};

Memory.prototype.save = function save(model, data, options, callback) {
  const self = this;
  const id = this.getIdValue(model, data);
  const cachedModels = this.collection(model);
  let modelData = cachedModels && this.collection(model)[id];
  modelData = modelData && deserialize(modelData);
  if (modelData) {
    data = merge(modelData, data);
  }
  this.collection(model)[id] = serialize(data);
  this.saveToFile(data, function(err) {
    callback(err, self.fromDb(model, data), {isNewInstance: !modelData});
  });
};

Memory.prototype.exists = function exists(model, id, options, callback) {
  process.nextTick(function() {
    callback(null, this.collection(model) && this.collection(model).hasOwnProperty(id));
  }.bind(this));
};

Memory.prototype.find = function find(model, id, options, callback) {
  process.nextTick(function() {
    callback(null, id in this.collection(model) && this.fromDb(model, this.collection(model)[id]));
  }.bind(this));
};

Memory.prototype.destroy = function destroy(model, id, options, callback) {
  const exists = this.collection(model)[id];
  delete this.collection(model)[id];
  this.saveToFile({count: exists ? 1 : 0}, callback);
};

Memory.prototype.fromDb = function(model, data) {
  if (!data) return null;
  data = deserialize(data);
  const props = this._models[model].properties;
  for (const key in data) {
    let val = data[key];
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

function getValue(obj, path) {
  if (obj == null) {
    return undefined;
  }
  const keys = path.split('.');
  let val = obj;
  for (let i = 0, n = keys.length; i < n; i++) {
    val = val[keys[i]];
    if (val == null) {
      return val;
    }
  }
  return val;
}

Memory.prototype._findAllSkippingIncludes = function(model, filter) {
  let nodes = Object.keys(this.collection(model)).map(function(key) {
    return this.fromDb(model, this.collection(model)[key]);
  }.bind(this));

  if (filter) {
    if (!filter.order) {
      const idNames = this.idNames(model);
      if (idNames && idNames.length) {
        filter.order = idNames;
      }
    }
    // do we need some sorting?
    if (filter.order) {
      let orders = filter.order;
      if (typeof filter.order === 'string') {
        orders = [filter.order];
      }
      orders.forEach(function(key, i) {
        let reverse = 1;
        const m = key.match(/\s+(A|DE)SC$/i);
        if (m) {
          key = key.replace(/\s+(A|DE)SC/i, '');
          if (m[1].toLowerCase() === 'de') reverse = -1;
        }
        orders[i] = {'key': key, 'reverse': reverse};
      });
      nodes = nodes.sort(sorting.bind(orders));
    }

    const nearFilter = geo.nearFilter(filter.where);

    // geo sorting
    if (nearFilter) {
      nodes = geo.filter(nodes, nearFilter);
    }

    // do we need some filtration?
    if (filter.where && nodes)
      nodes = nodes.filter(applyFilter(filter));

    // field selection
    if (filter.fields) {
      nodes = nodes.map(utils.selectFields(filter.fields));
    }

    // limit/skip
    const skip = filter.skip || filter.offset || 0;
    const limit = filter.limit || nodes.length;
    nodes = nodes.slice(skip, skip + limit);
  }
  return nodes;

  function sorting(a, b) {
    let undefinedA, undefinedB;

    for (let i = 0, l = this.length; i < l; i++) {
      const aVal = getValue(a, this[i].key);
      const bVal = getValue(b, this[i].key);
      undefinedB = bVal === undefined && aVal !== undefined;
      undefinedA = aVal === undefined && bVal !== undefined;

      if (undefinedB || aVal > bVal) {
        return 1 * this[i].reverse;
      } else if (undefinedA || aVal < bVal) {
        return -1 * this[i].reverse;
      }
    }

    return 0;
  }
};

Memory.prototype.all = function all(model, filter, options, callback) {
  const self = this;
  const nodes = self._findAllSkippingIncludes(model, filter);

  process.nextTick(function() {
    if (filter && filter.include) {
      self._models[model].model.include(nodes, filter.include, options, callback);
    } else {
      callback(null, nodes);
    }
  });
};

function applyFilter(filter) {
  const where = filter.where;
  if (typeof where === 'function') {
    return where;
  }
  const keys = Object.keys(where);
  return function(obj) {
    return keys.every(function(key) {
      if (key === 'and' || key === 'or') {
        if (Array.isArray(where[key])) {
          if (key === 'and') {
            return where[key].every(function(cond) {
              return applyFilter({where: cond})(obj);
            });
          }
          if (key === 'or') {
            return where[key].some(function(cond) {
              return applyFilter({where: cond})(obj);
            });
          }
        }
      }

      const value = getValue(obj, key);
      // Support referencesMany and other embedded relations
      // Also support array types. Mongo, possibly PostgreSQL
      if (Array.isArray(value)) {
        const matcher = where[key];
        // The following condition is for the case where we are querying with
        // a neq filter, and when the value is an empty array ([]).
        if (matcher.neq !== undefined && value.length <= 0) {
          return true;
        }
        return value.some(function(v, i) {
          const filter = {where: {}};
          filter.where[i] = matcher;
          return applyFilter(filter)(value);
        });
      }

      if (test(where[key], value)) {
        return true;
      }

      // If we have a composed key a.b and b would resolve to a property of an object inside an array
      // then, we attempt to emulate mongo db matching. Helps for embedded relations
      const dotIndex = key.indexOf('.');
      const subValue = obj[key.substring(0, dotIndex)];
      if (dotIndex !== -1) {
        const subFilter = {where: {}};
        const subKey = key.substring(dotIndex + 1);
        subFilter.where[subKey] = where[key];
        if (Array.isArray(subValue)) {
          return subValue.some(applyFilter(subFilter));
        } else if (typeof subValue === 'object' && subValue !== null) {
          return applyFilter(subFilter)(subValue);
        }
      }

      return false;
    });
  };

  function toRegExp(pattern) {
    if (pattern instanceof RegExp) {
      return pattern;
    }
    let regex = '';
    // Escaping user input to be treated as a literal string within a regular expression
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Writing_a_Regular_Expression_Pattern
    pattern = pattern.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    for (let i = 0, n = pattern.length; i < n; i++) {
      const char = pattern.charAt(i);
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
      } else {
        regex += char;
      }
    }
    return regex;
  }

  function test(example, value) {
    if (typeof value === 'string' && (example instanceof RegExp)) {
      return value.match(example);
    }

    if (example == null) {
      return value == null;
    }

    if (typeof example === 'object' && example !== null) {
      if (example.regexp) {
        return value ? value.match(example.regexp) : false;
      }

      // ignore geo near filter
      if (example.near) {
        return true;
      }

      let i;
      if (example.inq) {
        // if (!value) return false;
        for (i = 0; i < example.inq.length; i++) {
          if (example.inq[i] == value) {
            return true;
          }
        }
        return false;
      }

      if (example.nin) {
        for (i = 0; i < example.nin.length; i++) {
          if (example.nin[i] == value) {
            return false;
          }
        }
        return true;
      }

      if ('neq' in example) {
        return compare(example.neq, value) !== 0;
      }

      if ('between' in example) {
        return (testInEquality({gte: example.between[0]}, value) &&
        testInEquality({lte: example.between[1]}, value));
      }

      if (example.like || example.nlike || example.ilike || example.nilike) {
        let like = example.like || example.nlike || example.ilike || example.nilike;
        if (typeof like === 'string') {
          like = toRegExp(like);
        }
        if (example.like) {
          return !!new RegExp(like).test(value);
        }

        if (example.nlike) {
          return !new RegExp(like).test(value);
        }

        if (example.ilike) {
          return !!new RegExp(like, 'i').test(value);
        }

        if (example.nilike) {
          return !new RegExp(like, 'i').test(value);
        }
      }

      if (testInEquality(example, value)) {
        return true;
      }
    }

    // compare date
    if (example instanceof Date && value instanceof Date) {
      return example.getTime() === value.getTime();
    }
    // not strict equality
    return example == value;
  }

  /**
   * Compare two values
   * @param {*} val1 The 1st value
   * @param {*} val2 The 2nd value
   * @returns {number} 0: =, positive: >, negative <
   * @private
   */
  function compare(val1, val2) {
    if (val1 == null || val2 == null) {
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
      const result = val1 - val2;
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

Memory.prototype.destroyAll = function destroyAll(model, where, options, callback) {
  const cache = this.collection(model);
  let filter = null;
  let count = 0;
  if (where) {
    filter = applyFilter({where: where});
    Object.keys(cache).forEach(function(id) {
      if (!filter || filter(this.fromDb(model, cache[id]))) {
        count++;
        delete cache[id];
      }
    }.bind(this));
  } else {
    count = Object.keys(cache).length;
    this.collection(model, {});
  }
  this.saveToFile({count: count}, callback);
};

Memory.prototype.count = function count(model, where, options, callback) {
  const cache = this.collection(model);
  let data = Object.keys(cache);
  if (where) {
    const filter = {where: where};
    data = data.map(function(id) {
      return this.fromDb(model, cache[id]);
    }.bind(this));
    data = data.filter(applyFilter(filter));
  }
  process.nextTick(function() {
    callback(null, data.length);
  });
};

Memory.prototype.update =
  Memory.prototype.updateAll = function updateAll(model, where, data, options, cb) {
    const self = this;
    const cache = this.collection(model);
    let filter = null;
    where = where || {};
    filter = applyFilter({where: where});

    const ids = Object.keys(cache);
    let count = 0;
    async.each(ids, function(id, done) {
      const inst = self.fromDb(model, cache[id]);
      if (!filter || filter(inst)) {
        count++;
        // The id value from the cache is string
        // Get the real id from the inst
        id = self.getIdValue(model, inst);
        self.updateAttributes(model, id, data, options, done);
      } else {
        process.nextTick(done);
      }
    }, function(err) {
      if (err) return cb(err);
      self.saveToFile({count: count}, cb);
    });
  };

Memory.prototype.updateAttributes = function updateAttributes(model, id, data, options, cb) {
  if (!id) {
    const err = new Error(g.f('You must provide an {{id}} when updating attributes!'));
    if (cb) {
      return cb(err);
    } else {
      throw err;
    }
  }

  // Do not modify the data object passed in arguments
  data = Object.create(data);

  this.setIdValue(model, data, id);

  const cachedModels = this.collection(model);
  const modelData = cachedModels && this.collection(model)[id];

  if (modelData) {
    this.save(model, data, options, cb);
  } else {
    const msg = g.f('Could not update attributes. {{Object}} with {{id}} %s does not exist!', id);
    const error = new Error(msg);
    error.statusCode = error.status = 404;
    cb(error);
  }
};

Memory.prototype.replaceById = function(model, id, data, options, cb) {
  const self = this;
  if (!id) {
    const err = new Error(g.f('You must provide an {{id}} when replacing!'));
    return process.nextTick(function() { cb(err); });
  }
  // Do not modify the data object passed in arguments
  data = Object.create(data);
  this.setIdValue(model, data, id);
  const cachedModels = this.collection(model);
  const modelData = cachedModels && this.collection(model)[id];
  if (!modelData) {
    const msg = 'Could not replace. Object with id ' + id + ' does not exist!';
    const error = new Error(msg);
    error.statusCode = error.status = 404;
    return process.nextTick(function() { cb(error); });
  }

  const newModelData = {};
  for (const key in data) {
    const val = data[key];
    if (typeof val === 'function') {
      continue; // Skip methods
    }
    newModelData[key] = val;
  }

  this.collection(model)[id] = serialize(newModelData);
  this.saveToFile(newModelData, function(err) {
    cb(err, self.fromDb(model, newModelData));
  });
};

Memory.prototype.replaceOrCreate = function(model, data, options, callback) {
  const self = this;
  const idName = self.idNames(model)[0];
  const idValue = self.getIdValue(model, data);
  const filter = {where: {}};
  filter.where[idName] = idValue;
  const nodes = self._findAllSkippingIncludes(model, filter);
  const found = nodes[0];

  if (!found) {
    // Calling _createSync to update the collection in a sync way and
    // to guarantee to create it in the same turn of even loop
    return self._createSync(model, data, function(err, id) {
      if (err) return process.nextTick(function() { callback(err); });
      self.saveToFile(id, function(err, id) {
        self.setIdValue(model, data, id);
        callback(err, self.fromDb(model, data), {isNewInstance: true});
      });
    });
  }
  const id = self.getIdValue(model, data);
  self.collection(model)[id] = serialize(data);
  self.saveToFile(data, function(err) {
    callback(err, self.fromDb(model, data), {isNewInstance: false});
  });
};

Memory.prototype.transaction = function() {
  return new Memory(this);
};

Memory.prototype.exec = function(callback) {
  this.onTransactionExec();
  setTimeout(callback, 50);
};

Memory.prototype.buildNearFilter = function(filter) {
  // noop
};

Memory.prototype.automigrate = function(models, cb) {
  const self = this;

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

  const invalidModels = models.filter(function(m) {
    return !(m in self._models);
  });

  if (invalidModels.length) {
    return process.nextTick(function() {
      cb(new Error(g.f('Cannot migrate models not attached to this datasource: %s',
        invalidModels.join(' '))));
    });
  }

  models.forEach(function(m) {
    self.initCollection(m);
  });
  if (cb) process.nextTick(cb);
};

function merge(base, update) {
  if (!base) {
    return update;
  }
  // We cannot use Object.keys(update) if the update is an instance of the model
  // class as the properties are defined at the ModelClass.prototype level
  for (const key in update) {
    const val = update[key];
    if (typeof val === 'function') {
      continue; // Skip methods
    }
    base[key] = val;
  }
  return base;
}
