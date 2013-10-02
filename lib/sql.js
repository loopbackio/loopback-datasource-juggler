var util = require('util');
var Connector = require('./connector');

module.exports = BaseSQL;

/**
 * Base class for connectors that are backed by relational databases/SQL
 * @constructor
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

BaseSQL.prototype.query = function () {
    throw new Error('query method should be declared in connector');
};

BaseSQL.prototype.command = function (sql, params, callback) {
    return this.query(sql, params, callback);
};

BaseSQL.prototype.queryOne = function (sql, callback) {
    return this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(err, data[0]);
    });
};


/**
 * Get the table name for a given model
 * @param {String} model The model name
 * @returns {String} The table name
 */
BaseSQL.prototype.table = function (model) {
    var name = this.getDataSource(model).tableName(model);
    var dbName = this.dbName;
    if(typeof dbName === 'function') {
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
    if(typeof dbName === 'function') {
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
    for(var p in props) {
        if(this.column(model, p) === column) {
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
    var name = this.getDataSource(model).idColumnName(model);;
    var dbName = this.dbName;
    if(typeof dbName === 'function') {
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

/**
 * Save the model instance into the backend store
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE ' + this.tableEscaped(model) + ' SET '
        + this.toFields(model, data) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + Number(data.id);

    this.query(sql, function (err) {
        callback(err);
    });
};


/**
 * Check if a model instance exists for the given id value
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.exists = function (model, id, callback) {
    var sql = 'SELECT 1 FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + Number(id) + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.length === 1);
    });
};

/**
 * Find a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.find = function find(model, id, callback) {
    var sql = 'SELECT * FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + id + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (data && data.length === 1) {
            data[0].id = id;
        } else {
            data = [null];
        }
        callback(err, this.fromDatabase(model, data[0]));
    }.bind(this));
};

/**
 * Delete a model instance by id value
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.delete = BaseSQL.prototype.destroy = function destroy(model, id, callback) {
    var sql = 'DELETE FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + id;

    this.command(sql, function (err) {
        callback(err);
    });
};

/**
 * Delete all model instances
 *
 * @param {String} model The model name
 * @param {Function} callback The callback function
 */
BaseSQL.prototype.deleteAll = BaseSQL.prototype.destroyAll = function destroyAll(model, callback) {
    this.command('DELETE FROM ' + this.tableEscaped(model), function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
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

    this.queryOne('SELECT count(*) as cnt FROM ' +
        this.tableEscaped(model) + ' ' + buildWhere(where), function (err, res) {
        if (err) return callback(err);
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
    data.id = id;
    this.save(model, data, cb);
};

/**
 * Disconnect from the connector
 */
BaseSQL.prototype.disconnect = function disconnect() {
    this.client.end();
};

/**
 * Recreate the tables for the given models
 * @param {[String]|String} [models] A model name or an array of model names, if not present, apply to all models defined in the connector
 * @param {Function} [cb] The callback function
 */
BaseSQL.prototype.automigrate = function (models, cb) {
    var self = this;
    var wait = 0;
    if ((!cb) && ('function' === typeof models)) {
        cb = models;
        models = undefined;
    }
    // First argument is a model name
    if ('string' === typeof models) {
        models = [models];
    }

    models = models || Object.keys(this._models);
    models.forEach(function (model) {
        if (model in self._models) {
            wait++;
            self.dropTable(model, function () {
                // console.log('drop', model);
                self.createTable(model, function (err) {
                    // console.log('create', model);
                    if (err) console.log(err);
                    done();
                });
            });
        }
    });
    if (wait === 0) cb();

    function done() {
        if (--wait === 0 && cb) {
            cb();
        }
    }
};

/**
 * Drop the table for the given model
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

