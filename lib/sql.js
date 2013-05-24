module.exports = BaseSQL;

/**
 * Base SQL class
 */
function BaseSQL() {
}

BaseSQL.prototype.query = function () {
    throw new Error('query method should be declared in adapter');
};

BaseSQL.prototype.command = function (sql, callback) {
    return this.query(sql, callback);
};

BaseSQL.prototype.queryOne = function (sql, callback) {
    return this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(err, data[0]);
    });
};

/**
 * Look up the data source by model name
 * @param model The model name
 * @returns {DataSource} The data source
 */
BaseSQL.prototype.dataSource = function(model) {
    var m = this._models[model];
    if(!m) {
        console.log(new Error('Model not found: ' + model).stack);
    }
    return m.model.schema;
}

/**
 * Get the table name for a given model
 * @param model The model name
 * @returns {String} The table name
 */
BaseSQL.prototype.table = function (model) {
    var name = this.dataSource(model).tableName(model);
    var dbName = this.dbName;
    if(typeof dbName === 'function') {
        name = dbName(name);
    }
    return name;
};

/**
 * Get the column name for given model property
 * @param model The model name
 * @param property The property name
 * @returns {String} The column name
 */
BaseSQL.prototype.column = function (model, property) {
    var name = this.dataSource(model).columnName(model, property);
    var dbName = this.dbName;
    if(typeof dbName === 'function') {
        name = dbName(name);
    }
    return name;
};

/**
 * Get the corresponding property name for a given column name
 * @param model The model name
 * @param column The column name
 * @returns {*}
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
 * Get the id property name
 * @param model The model name
 * @returns {String} The id property name
 */
BaseSQL.prototype.idName = function (model) {
    return this.dataSource(model).idName(model);
};

/**
 * Get the id column name
 * @param model The model name
 * @returns {String} The column name
 */
BaseSQL.prototype.idColumn = function (model) {
    var name = this.dataSource(model).idColumnName(model);;
    var dbName = this.dbName;
    if(typeof dbName === 'function') {
        name = dbName(name);
    }
    return name;
};

/**
 * Get the escaped id column name
 * @param model The model name
 * @returns {String} the escaped id column name
 */
BaseSQL.prototype.idColumnEscaped = function (model) {
    return this.escapeName(this.dataSource(model).idColumnName(model));
};

/**
 * Get the id index (sequence number, starting from 1)
 * @param model The model name
 * @param prop The property name
 * @returns {Number} The id index, undefined if the property is not part of the primary key
 */
BaseSQL.prototype.id = function (model, prop) {
    var p = this._models[model].properties[prop];
    if(!p) {
        console.log(new Error('Property not found: ' + model +'.' + prop).stack);
    }
    return p.id;
};

/**
 * Escape the name for the underlying database
 * @param name The name
 */
BaseSQL.prototype.escapeName = function (name) {
    throw new Error('escapeName method should be declared in adapter');
};

/**
 * Get the escaped table name
 * @param model The model name
 * @returns {String} the escaped table name
 */
BaseSQL.prototype.tableEscaped = function (model) {
    return this.escapeName(this.table(model));
};

/**
 * Get the escaped column name for a given model property
 * @param model The model name
 * @param property The property name
 * @returns {String} The escaped column name
 */
BaseSQL.prototype.columnEscaped = function (model, property) {
    return this.escapeName(this.column(model, property));
};

BaseSQL.prototype.define = function (descr) {
    if (!descr.settings) descr.settings = {};
    this._models[descr.model.modelName] = descr;
};

BaseSQL.prototype.defineProperty = function (model, prop, params) {
    this._models[model].properties[prop] = params;
};

BaseSQL.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE ' + this.tableEscaped(model) + ' SET '
        + this.toFields(model, data) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + Number(data.id);

    this.query(sql, function (err) {
        callback(err);
    });
};


BaseSQL.prototype.exists = function (model, id, callback) {
    var sql = 'SELECT 1 FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + Number(id) + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.length === 1);
    });
};

BaseSQL.prototype.find = function find(model, id, callback) {
    var idNumber = Number(id);
    if (isNaN(idNumber)) {
        callback(new Error('id is not a number'));
    }
    var sql = 'SELECT * FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.idColumnEscaped(model) + ' = ' + idNumber + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (data && data.length === 1) {
            data[0].id = id;
        } else {
            data = [null];
        }
        callback(err, this.fromDatabase(model, data[0]));
    }.bind(this));
};

BaseSQL.prototype.destroy = function destroy(model, id, callback) {
    var sql = 'DELETE FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + Number(id);

    this.command(sql, function (err) {
        callback(err);
    });
};

BaseSQL.prototype.destroyAll = function destroyAll(model, callback) {
    this.command('DELETE FROM ' + this.tableEscaped(model), function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
};

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
            var keyEscaped = self.columnEscaped(key);
            if (conds[key] === null) {
                cs.push(keyEscaped + ' IS NULL');
            } else {
                cs.push(keyEscaped + ' = ' + self.toDatabase(props[key], conds[key]));
            }
        });
        return cs.length ? ' WHERE ' + cs.join(' AND ') : '';
    }
};

BaseSQL.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    data.id = id;
    this.save(model, data, cb);
};

BaseSQL.prototype.disconnect = function disconnect() {
    this.client.end();
};

BaseSQL.prototype.automigrate = function (cb) {
    var self = this;
    var wait = 0;
    Object.keys(this._models).forEach(function (model) {
        wait += 1;
        self.dropTable(model, function () {
            // console.log('drop', model);
            self.createTable(model, function (err) {
                // console.log('create', model);
                if (err) console.log(err);
                done();
            });
        });
    });
    if (wait === 0) cb();

    function done() {
        if (--wait === 0 && cb) {
            cb();
        }
    }
};

BaseSQL.prototype.dropTable = function (model, cb) {
    this.command('DROP TABLE IF EXISTS ' + this.tableEscaped(model), cb);
};

BaseSQL.prototype.createTable = function (model, cb) {
    this.command('CREATE TABLE ' + this.tableEscaped(model) +
        ' (\n  ' + this.propertiesSQL(model) + '\n)', cb);
};

