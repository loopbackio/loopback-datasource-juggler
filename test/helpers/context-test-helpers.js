// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const traverse = require('traverse');

exports.ContextRecorder = ContextRecorder;
exports.deepCloneToObject = deepCloneToObject;
exports.aCtxForModel = aCtxForModel;

function ContextRecorder(initialValue) {
  if (!(this instanceof ContextRecorder)) {
    return new ContextRecorder(initialValue);
  }
  this.records = initialValue;
}

ContextRecorder.prototype.recordAndNext = function(transformFm) {
  const self = this;
  return function(context, next) {
    if (typeof transformFm === 'function') {
      transformFm(context);
    }

    context = deepCloneToObject(context);
    context.hookState.test = true;

    if (typeof self.records === 'string') {
      self.records = context;
      return next();
    }

    if (!Array.isArray(self.records)) {
      self.records = [self.records];
    }

    self.records.push(context);
    next();
  };
};

function deepCloneToObject(obj) {
  return traverse(obj).map(function(x) {
    if (x === undefined) {
      // RDBMSs return null
      return null;
    }
    if (x && x.toObject)
      return x.toObject(true);
    if (x && typeof x === 'function' && x.modelName)
      return '[ModelCtor ' + x.modelName + ']';
  });
}

function aCtxForModel(TestModel, ctx) {
  ctx.Model = TestModel;

  if (!ctx.hookState) {
    ctx.hookState = {};
  }

  if (!('test' in ctx.hookState)) {
    ctx.hookState.test = true;
  }

  if (!ctx.options) {
    ctx.options = {};
  }
  return deepCloneToObject(ctx);
}
