var util = require('util');
var Connector = require('../connector');
var geo = require('../geo');
var utils = require('../utils');

/**
 * Initialize the Oracle connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
    dataSource.connector = new Memory();
    dataSource.connector.connect(callback);
};

exports.Memory = Memory;

function Memory(m) {
    if (m) {
        this.isTransaction = true;
        this.cache = m.cache;
        this.ids = m.ids;
        this.constructor.super_.call(this, 'memory');
        this._models = m._models;
    } else {
        this.isTransaction = false;
        this.cache = {};
        this.ids = {};
        this.constructor.super_.call(this, 'memory');
    }
}

util.inherits(Memory, Connector);

Memory.prototype.connect = function(callback) {
    if (this.isTransaction) {
        this.onTransactionExec = callback;
    } else {
        process.nextTick(callback);
    }
};

Memory.prototype.define = function defineModel(definition) {
    this.constructor.super_.prototype.define.apply(this, [].slice.call(arguments));
    var m = definition.model.modelName;
    this.cache[m] = {};
    this.ids[m] = 1;
};

Memory.prototype.create = function create(model, data, callback) {
    // FIXME: [rfeng] We need to generate unique ids based on the id type
    // FIXME: [rfeng] We don't support composite ids yet
    var currentId = this.ids[model];
    if(currentId === undefined) {
        // First time
        this.ids[model] = 1;
        currentId = 1;
    }
    var id = this.getIdValue(model, data) || currentId;
    if(id > currentId) {
        // If the id is passed in and the value is greater than the current id
        currentId = id;
    }
    this.ids[model] = Number(currentId) + 1;

    var props = this._models[model].properties;
    var idName = this.idName(model);
    id = (props[idName] && props[idName].type && props[idName].type(id)) || id;
    this.setIdValue(model, data, id);
    this.cache[model][id] = JSON.stringify(data);
    process.nextTick(function() {
        callback(null, id);
    });
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
    this.cache[model][this.getIdValue(model, data)] = JSON.stringify(data);
    process.nextTick(function () {
        callback(null, data);
    });
};

Memory.prototype.exists = function exists(model, id, callback) {
    process.nextTick(function () {
        callback(null, this.cache[model] && this.cache[model].hasOwnProperty(id));
    }.bind(this));
};

Memory.prototype.find = function find(model, id, callback) {
    var self = this;
    process.nextTick(function () {
        callback(null, id in this.cache[model] && this.fromDb(model, this.cache[model][id]));
    }.bind(this));
};

Memory.prototype.destroy = function destroy(model, id, callback) {
    delete this.cache[model][id];
    process.nextTick(callback);
};

Memory.prototype.fromDb = function(model, data) {
    if (!data) return null;
    data = JSON.parse(data);
    var props = this._models[model].properties;
    for(var key in data) {
        var val = data[key];
        if (val === undefined || val === null) {
            continue;
        }
        if (props[key]) {
            switch(props[key].type.name) {
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
        if(nearFilter) {
            nodes = geo.filter(nodes, nearFilter);
        }
        
        // do we need some filtration?
        if (filter.where) {
            nodes = nodes ? nodes.filter(applyFilter(filter)) : nodes;
        }
        
        // field selection
        if(filter.fields) {
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
        for (var i=0, l=this.length; i<l; i++) {
            if (a[this[i].key] > b[this[i].key]) {
                return 1*this[i].reverse;
            } else  if (a[this[i].key] < b[this[i].key]) {
                return -1*this[i].reverse;
            }
        }
        return 0;
    }
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
    }
    var keys = Object.keys(filter.where);
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter.where[key], obj && obj[key])) {
                pass = false;
            }
        });
        return pass;
    }

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        if (typeof example === 'undefined') return undefined;
        if (typeof value === 'undefined') return undefined;
        if (typeof example === 'object') {
            // ignore geo near filter
            if(example.near) return true;
            
            if (example.inq) {
                if (!value) return false;
                for (var i = 0; i < example.inq.length; i += 1) {
                    if (example.inq[i] == value) return true;
                }
                return false;
            }
            
            if(isNum(example.gt) && example.gt < value) return true;
            if(isNum(example.gte) && example.gte <= value) return true;
            if(isNum(example.lt) && example.lt > value) return true;
            if(isNum(example.lte) && example.lte >= value) return true;
        }
        // not strict equality
        return (example !== null ? example.toString() : example) == (value !== null ? value.toString() : value);
    }
    
    function isNum(n) {
        return typeof n === 'number';
    }
}

Memory.prototype.destroyAll = function destroyAll(model, where, callback) {
    if(!callback && 'function' === typeof where) {
        callback = where;
        where = undefined;
    }
    var cache = this.cache[model];
    var filter = null;
    if (where) {
        filter = applyFilter({where: where});
    }
    Object.keys(cache).forEach(function (id) {
        if(!filter || filter(this.fromDb(model, cache[id]))) {
            delete cache[id];
        }
    }.bind(this));
    if(!where) {
        this.cache[model] = {};
    }
    process.nextTick(callback);
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
    if(!id) {
      var err = new Error('You must provide an id when updating attributes!');
      if(cb) {
        return cb(err);
      } else {
        throw err;
      }
    }
  
    this.setIdValue(model, data, id);
    
    var cachedModels = this.cache[model];
    var modelAsString = cachedModels && this.cache[model][id];
    var modelData = modelAsString && JSON.parse(modelAsString);
    
    if(modelData) {
      this.save(model, merge(modelData, data), cb);
    } else {
      cb(new Error('Could not update attributes. Object with id ' + id + ' does not exist!'));
    }
};

Memory.prototype.transaction = function () {
    return new Memory(this);
};

Memory.prototype.exec = function(callback) {
    this.onTransactionExec();
    setTimeout(callback, 50);
};

Memory.prototype.buildNearFilter = function (filter) {
  // noop
}

function merge(base, update) {
    if (!base) return update;
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}