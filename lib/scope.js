/**
 * Module exports
 */
exports.defineScope = defineScope;

function defineScope(cls, targetClass, name, params, methods) {

    // collect meta info about scope
    if (!cls._scopeMeta) {
        cls._scopeMeta = {};
    }

    // only makes sence to add scope in meta if base and target classes
    // are same
    if (cls === targetClass) {
        cls._scopeMeta[name] = params;
    } else {
        if (!targetClass._scopeMeta) {
            targetClass._scopeMeta = {};
        }
    }

    // Define a property for the scope
    Object.defineProperty(cls, name, {
        enumerable: false,
        configurable: true,
        get: function () {
            var f = function caller(condOrRefresh, cb) {
                var actualCond = {};
                var actualRefresh = false;
                var saveOnCache = true;
                if (arguments.length === 1) {
                    cb = condOrRefresh;
                } else if (arguments.length === 2) {
                    if (typeof condOrRefresh === 'boolean') {
                        actualRefresh = condOrRefresh;
                    } else {
                        actualCond = condOrRefresh;
                        actualRefresh = true;
                        saveOnCache = false;
                    }
                } else {
                    throw new Error('Method can be only called with one or two arguments');
                }

                if (!this.__cachedRelations || (typeof this.__cachedRelations[name] == 'undefined') || actualRefresh) {
                    var self = this;
                    var params = mergeParams(actualCond, caller._scope);
                    return targetClass.find(params, function(err, data) {
                        if (!err && saveOnCache) {
                            if (!self.__cachedRelations) {
                                self.__cachedRelations = {};
                            }
                            self.__cachedRelations[name] = data;
                        }
                        cb(err, data);
                    });
                } else {
                    cb(null, this.__cachedRelations[name]);
                }
            };
            f._scope = typeof params === 'function' ? params.call(this) : params;
            f.build = build;
            f.create = create;
            f.destroyAll = destroyAll;
            for (var i in methods) {
                f[i] = methods[i].bind(this);
            }

            // define sub-scopes
            Object.keys(targetClass._scopeMeta).forEach(function (name) {
                Object.defineProperty(f, name, {
                    enumerable: false,
                    get: function () {
                        mergeParams(f._scope, targetClass._scopeMeta[name]);
                        return f;
                    }
                });
            }.bind(this));
            return f;
        }
    });

    // Wrap the property into a function for remoting
    var fn = function() {
        var f = this[name];
        f.apply(this, arguments);
    };

    fn.shared = true;
    fn.http = {verb: 'get', path: '/' + name};
    fn.accepts = {arg: 'where', type: 'object'};
    fn.description = 'Fetches ' + name;
    fn.returns = {arg: name, type: 'array', root: true};

    cls['__get__' + name] = fn;

    var fn_create = function() {
        var f = this[name].create;
        f.apply(this, arguments);
    };

    fn_create.shared = true;
    fn_create.http = {verb: 'post', path: '/' + name};
    fn_create.accepts = {arg: 'data', type: 'object', source: 'body'};
    fn_create.description = 'Creates ' + name;
    fn_create.returns = {arg: 'data', type: 'object', root: true};

    cls['__create__' + name] = fn_create;

    var fn_delete = function() {
        var f = this[name].destroyAll;
        f.apply(this, arguments);
    };
    fn_delete.shared = true;
    fn_delete.http = {verb: 'delete', path: '/' + name};
    fn_delete.description = 'Deletes ' + name;
    fn_delete.returns = {arg: 'data', type: 'object', root: true};

    cls['__delete__' + name] = fn_delete;

    // and it should have create/build methods with binded thisModelNameId param
    function build(data) {
        return new targetClass(mergeParams(this._scope, {where:data || {}}).where);
    }

    function create(data, cb) {
        if (typeof data === 'function') {
            cb = data;
            data = {};
        }
        this.build(data).save(cb);
    }

    /*
        Callback
        - The callback will be called after all elements are destroyed
        - For every destroy call which results in an error
        - If fetching the Elements on which destroyAll is called results in an error
    */
    function destroyAll(cb) {
        targetClass.all(this._scope, function (err, data) {
            if (err) {
                cb(err);
            } else {
                (function loopOfDestruction (data) {
                    if(data.length > 0) {
                        data.shift().destroy(function(err) {
                            if(err && cb) cb(err);
                            loopOfDestruction(data);
                        });
                    } else {
                        if(cb) cb();
                    }
                }(data));
            }
        });
    }

    function mergeParams(base, update) {
        base = base || {};
        if (update.where) {
            base.where = merge(base.where, update.where);
        }
        if (update.include) {
            base.include = update.include;
        }
        if (update.collect) {
            base.collect = update.collect;
        }

        // overwrite order
        if (update.order) {
            base.order = update.order;
        }

        return base;

    }
}

/**
 * Merge `base` and `update` params
 * @param {Object} base - base object (updating this object)
 * @param {Object} update - object with new data to update base
 * @returns {Object} `base`
 */
function merge(base, update) {
    base = base || {};
    if (update) {
        Object.keys(update).forEach(function (key) {
            base[key] = update[key];
        });
    }
    return base;
}

