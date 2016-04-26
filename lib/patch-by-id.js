// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var ValidationError = require('./validations').ValidationError;
var assert = require('assert');
var dao = require('./dao');
var utils = require('./utils');
var idEquals = utils.idEquals;
var removeUndefined = utils.removeUndefined;

module.exports = function patchById(id, data, options, cb) {
  var connectionPromise = dao.stillConnecting(this.getDataSource(), this, arguments);
  if (connectionPromise) {
    return connectionPromise;
  }
  assert(arguments.length >= 2, 'At least two arguments are required');

  var Model = this;
  var where = {};
  var strict = this.settings.strict;
  // TODO: the methods which we have imported from dao (idName(),
  // stillConnecting(), isWhereByGivenId(),...), may need to be
  // moved to a more appropriate file (utils.js?)
  var idPropertyName = dao.idName(Model);

  where[idPropertyName] = id;
  if (cb === undefined) {
    if (typeof options === 'function') {
      // patchById(id, data, cb)
      cb = options;
      options = {};
    }
  }

  data = data || {};
  cb = cb || utils.createPromiseCallback();
  options = options || {};

  assert((typeof data === 'object') && (data !== null),
    'The data argument must be an object');
  assert(typeof options === 'object', 'The options argument must be an object');
  assert(typeof cb === 'function', 'The cb argument must be a function');

  var connector = Model.getDataSource().connector;
  assert(typeof connector.update === 'function',
    'update() must be implemented by the connector');

  // Make sure id cannot be changed
  checkId(data[idPropertyName], id, idPropertyName, cb);

  // Question[1]:
  // Please see QUESTION-test[1] in`test\dao.suit\patch-by-id.suits.js` for failing test
  // data = data.toObject();
  // data = removeUndefined(data);

  var hookState = {};
  this.applyProperties(data);

  var context = {
    Model: Model,
    where: where,
    data: data,
    hookState: hookState,
    options: options,
  };

  Model.notifyObserversOf('before save', context, function(err, ctx) {
    if (err) return cb(err);
    var isOriginalQuery = dao.isWhereByGivenId(Model, ctx.where, id);

    if (!isOriginalQuery) {
      var err = new Error('ctx.where:' + JSON.stringify(ctx.where) + ' is not valid; the `' +
        idPropertyName + '` original value is ' + id);
      err.statusCode = 403;
      process.nextTick(function() {
        cb(err);
      });
      return cb.promise;
    }

    if (strict) {
      var instInfo = { '__unknownProperties': [] };
      dao.applyStrictCheck(Model, strict, data,
        instInfo, validateAndCallConnector);
    } else {
      validateAndCallConnector();
    }

    function validateAndCallConnector(err) {
      if (err) return cb(err);
      if (options.validate === false) {
        return doUpdate(ctx.where, ctx.data);
      }

      // only when options.validate is not set, take model-setting into consideration
      if (options.validate === undefined && Model.settings.automaticValidation === false) {
        return doUpdate(ctx.where, ctx.data);
      }

      // Make sure id is not changed in the context of `before save`
      checkId(ctx.data[idPropertyName], id, idPropertyName, cb);

      dataObj = new Model(ctx.data);
      dataObj.unsetAttribute(idPropertyName);
      // validation required
      dataObj.isValid(function(valid) {
        if (valid) {
          doUpdate(ctx.where, ctx.data);
        } else {
          cb(new ValidationError(dataObj), dataObj);
        }
      });
    }
  });

  function doUpdate(where, data) {
    try {
      data = removeUndefined(data);
      data = Model._coerce(data);
    } catch (err) {
      return process.nextTick(function() {
        cb(err);
      });
    }

    var ctx = {
      Model: Model,
      where: where,
      data: data,
      isNewInstance: false,
      hookState: hookState,
      options: options,
    };
    Model.notifyObserversOf('persist', ctx, function(err) {
      if (err) return cb (err);
      if (connector.update.length === 5) {
        connector.updateAttributes(Model.modelName, where[idPropertyName], ctx.data, options, patchCallback);
      } else {
        connector.updateAttributes(Model.modelName, where[idPropertyName], ctx.data, patchCallback);
      }
    });

    function patchCallback(err, info) {
      if (err) return cb(err);
      var ctx = {
        Model: Model,
        data: data,
        hookState: hookState,
        options: options,
      };
      Model.notifyObserversOf('loaded', ctx, function(err) {
        if (err) return cb(err);
        var context = {
          Model: Model,
          isNewInstance: false,
          hookState: hookState,
          options: options,
        };
        Model.notifyObserversOf('after save', context, function(err) {
          if (!err) Model.emit('changed', info);
          // Just for consistency we return { count: 1} for all connectors
          cb(err, { count: 1 });
        });
      });
    }
  }
  return cb.promise;
};

var idValidationFailure;
function checkId(idData, id, idPropertyName, cb) {
  if (!idValidationFailure && idData !== undefined && !idEquals(idData, id)) {
    idValidationFailure = true;
    var err = new Error('id property (' + idPropertyName + ') ' +
      'cannot be updated from ' + id + ' to ' + idData);
    // return with 403 (forbidden) error status code
    err.statusCode = 403;
    process.nextTick(function() {
      cb(err);
    });
    return cb.promise;
  } else {
    return false;
  }
};
