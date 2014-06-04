var util = require('util');
var async = require('async');
var assert = require('assert');
var Connector = require('./connector');

module.exports = BaseSQL;

/**
 * Base class for connectors that are backed by relational databases/SQL
 * @class
 */
function BaseSQL() {
  Connector.apply(this, [].slice.call(arguments));
}

util.inherits(BaseSQL, Connector);

/**
 * Set the relational property to indicate the backend is a relational DB
 * @type {boolean}
 */
BaseSQL.prototype.relational = true;

/**
 * Get types associated with the connector
 * Returns {String[]} The types for the connector
 */
 BaseSQL.prototype.getTypes = function() {
  return ['db', 'rdbms', 'sql'];
};

/*!
 * Get the default data type for ID
 * Returns {Function}
 */
BaseSQL.prototype.getDefaultIdType = function() {
  return Number;
};

BaseSQL.prototype.query = function () {
  throw new Error('query method should be declared in connector');
};

BaseSQL.prototype.command = function (sql, params, callback) {
  return this.query(sql, params, callback);
};

BaseSQL.prototype.queryOne = function (sql, callback) {
  return this.query(sql, function (err, data) {
    if (err) {
      return callback(err);
    }
    callback(err, data && data[0]);
  });
};

/**
 * Get the table name for a given model.
 * Returns the table name (String).
 * @param {String} model The model name
 */
BaseSQL.prototype.table = function (model) {
  var name = this.getDataSource(model).tableName(model);
  var dbName = this.dbName;
  if (typeof dbName === 'function') {
    name = dbName(name);
  }
  return name;
};

/**
 * Get the column name for given model property
 * @param {String} model The model name
 * @param {String} property The property name
 * @returns {String} The column name
 */
BaseSQL.prototype.column = function (model, property) {
  var name = this.getDataSource(model).columnName(model, property);
  var dbName = this.dbName;
  if (typeof dbName === 'function') {
    name = dbName(name);
  }
  return name;
};

/**
 * Get the column name for given model property
 * @param {String} model The model name
 * @param {String} property The property name
 * @returns {Object} The column metadata
 */
BaseSQL.prototype.columnMetadata = function (model, property) {
  return this.getDataSource(model).columnMetadata(model, property);
};

/**
 * Get the corresponding property name for a given column name
 * @param {String} model The model name
 * @param {String} column The column name
 * @returns {String} The property name for a given column
 */
BaseSQL.prototype.propertyName = function (model, column) {
  var props = this._models[model].properties;
  for (var p in props) {
    if (this.column(model, p) === column) {
      return p;
    }
  }
  return null;
};

/**
 * Get the id column name
 * @param {String} model The model name
 * @returns {String} The column name
 */
BaseSQL.prototype.idColumn = function (model) {
  var name = this.getDataSource(model).idColumnName(model);
  var dbName = this.dbName;
  if (typeof dbName === 'function') {
    name = dbName(name);
  }
  return name;
};

/**
 * Get the escaped id column name
 * @param {String} model The model name
 * @returns {String} the escaped id column name
 */
BaseSQL.prototype.idColumnEscaped = function (model) {
  return this.escapeName(this.getDataSource(model).idColumnName(model));
};

/**
 * Escape the name for the underlying database
 * @param {String} name The name
 */
BaseSQL.prototype.escapeName = function (name) {
  throw new Error('escapeName method should be declared in connector');
};

/**
 * Get the escaped table name
 * @param {String} model The model name
 * @returns {String} the escaped table name
 */
BaseSQL.prototype.tableEscaped = function (model) {
  return this.escapeName(this.table(model));
};

/**
 * Get the escaped column name for a given model property
 * @param {String} model The model name
 * @param {String} property The property name
 * @returns {String} The escaped column name
 */
BaseSQL.prototype.columnEscaped = function (model, property) {
  return this.escapeName(this.column(model, property));
};

function isIdValuePresent(idValue, callback, returningNull) {
  try {
    assert(idValue !== null && idValue !== undefined, 'id value is required');
    return true;
  } catch (err) {
    process.nextTick(function () {
      callback && callback(returningNull ? null: err);
    });
    return false;
  }
}
/**
 * Save the model instance into the backend store
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.save = function (model, data, callback) {
  var idName = this.getDataSource(model).idName(model);
  var idValue = data[idName];

  if (!isIdValuePresent(idValue, callback)) {
    return;
  }

  idValue = this._escapeIdValue(model, idValue);
  var sql = 'UPDATE ' + this.tableEscaped(model) + ' SET '
    + this.toFields(model, data) + ' WHERE ' + this.idColumnEscaped(model) + ' = '
    + idValue;

  this.query(sql, function (err, result) {
    callback && callback(err, result);
  });
};

/**
 * Check if a model instance exists for the given id value
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.exists = function (model, id, callback) {
  if (!isIdValuePresent(id, callback, true)) {
    return;
  }
  var sql = 'SELECT 1 FROM ' +
    this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = '
    + this._escapeIdValue(model, id) + ' LIMIT 1';

  this.query(sql, function (err, data) {
    if (err) {
      return callback && callback(err);
    }
    callback && callback(null, data.length >= 1);
  });
};

/**
 * Find a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.find = function find(model, id, callback) {
  if (!isIdValuePresent(id, callback, true)) {
    return;
  }
  var self = this;
  var idQuery = this.idColumnEscaped(model) + ' = ' + this._escapeIdValue(model, id);
  var sql = 'SELECT * FROM ' +
    this.tableEscaped(model) + ' WHERE ' + idQuery + ' LIMIT 1';

  this.query(sql, function (err, data) {
    var result =  (data && data.length >= 1) ? data[0] : null;
    callback && callback(err, self.fromDatabase(model, result));
  });
};

/**
 * Delete a model instance by id value
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.delete = BaseSQL.prototype.destroy = function destroy(model, id, callback) {
  if (!isIdValuePresent(id, callback, true)) {
    return;
  }
  var sql = 'DELETE FROM ' +
    this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = '
    + this._escapeIdValue(model, id);

  this.command(sql, function (err, result) {
    callback && callback(err, result);
  });
};

BaseSQL.prototype._escapeIdValue = function(model, idValue) {
  var idProp = this.getDataSource(model).idProperty(model);
  if(typeof this.toDatabase === 'function') {
    return this.toDatabase(idProp, idValue);
  } else {
    if(idProp.type === Number) {
      return idValue;
    } else {
      return "'" + idValue + "'";
    }
  }
};

/**
 * Delete all model instances
 *
 * @param {String} model The model name
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.deleteAll = BaseSQL.prototype.destroyAll = function destroyAll(model, callback) {
  this.command('DELETE FROM ' + this.tableEscaped(model), function (err, result) {
    callback && callback(err, result);
  });
};

/**
 * Count all model instances by the where filter
 *
 * @param {String} model The model name
 * @param {Function} callback The callback function
 * @param {Object} where The where clause
 */
BaseSQL.prototype.count = function count(model, callback, where) {
  var self = this;
  var props = this._models[model].properties;

  var whereClause = '';
  if (typeof this.buildWhere === 'function') {
    whereClause = this.buildWhere(model, where);
  } else {
    whereClause = buildWhere(where);
  }
  this.queryOne('SELECT count(*) as cnt FROM ' +
    this.tableEscaped(model) + ' ' + whereClause, function (err, res) {
    if (err) {
      return callback(err);
    }
    callback(err, res && res.cnt);
  });

  function buildWhere(conds) {
    var cs = [];
    Object.keys(conds || {}).forEach(function (key) {
      var keyEscaped = self.columnEscaped(model, key);
      if (conds[key] === null) {
        cs.push(keyEscaped + ' IS NULL');
      } else {
        cs.push(keyEscaped + ' = ' + self.toDatabase(props[key], conds[key]));
      }
    });
    return cs.length ? ' WHERE ' + cs.join(' AND ') : '';
  }
};

/**
 * Update attributes for a given model instance
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Object} data The model data instance containing all properties to be updated
 * @param {Function} cb The callback function
 */
BaseSQL.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
  if (!isIdValuePresent(id, cb)) {
    return;
  }
  var idName = this.getDataSource(model).idName(model);
  data[idName] = id;
  this.save(model, data, cb);
};

/**
 * Disconnect from the connector
 */
BaseSQL.prototype.disconnect = function disconnect() {
  // No operation
};

/**
 * Recreate the tables for the given models
 * @param {[String]|String} [models] A model name or an array of model names,
 * if not present, apply to all models defined in the connector
 * @param {Function} [cb] The callback function
 */
BaseSQL.prototype.automigrate = function (models, cb) {
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
  async.each(models, function (model, callback) {
    if (model in self._models) {
      self.dropTable(model, function (err, result) {
        self.createTable(model, function (err, result) {
          if (err) {
            console.error(err);
          }
          callback(err, result);
        });
      });
    }
  }, cb);
};

/**
 * Drop the table for the given model from the database
 * @param {String} model The model name
 * @param {Function} [cb] The callback function
 */
BaseSQL.prototype.dropTable = function (model, cb) {
  this.command('DROP TABLE IF EXISTS ' + this.tableEscaped(model), cb);
};

/**
 * Create the table for the given model
 * @param {String} model The model name
 * @param {Function} [cb] The callback function
 */

BaseSQL.prototype.createTable = function (model, cb) {
  this.command('CREATE TABLE ' + this.tableEscaped(model) +
    ' (\n  ' + this.propertiesSQL(model) + '\n)', cb);
};

