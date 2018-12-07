// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const deprecated = require('depd')('loopback-datasource-juggler');
const g = require('strong-globalize')();

/*!
 * Module exports
 */
module.exports = Hookable;

/*
 * Hooks object.
 * @class Hookable
 */

function Hookable() {
}

/**
 * List of hooks available
 */
Hookable.afterInitialize = null;
Hookable.beforeValidate = null;
Hookable.afterValidate = null;
Hookable.beforeSave = null;
Hookable.afterSave = null;
Hookable.beforeCreate = null;
Hookable.afterCreate = null;
Hookable.beforeUpdate = null;
Hookable.afterUpdate = null;
Hookable.beforeDestroy = null;
Hookable.afterDestroy = null;

/**
 * @deprecated
 * Setup a Model-based hook to trigger when the specified action occurs.
 * The trigger is broken up into three segments: `beforeHook`, `work` and
 * `afterHook`.
 * @param {string} actionName The name of the action that triggers the hook.
 * @param {Function} work The 2nd phase of the trigger.
 * @param {*} data The value(s) to provide to the 1st phase (`beforeHook`) call.
 * @callback
 * @param {Function} callback
 */
Hookable.prototype.trigger = function trigger(actionName, work, data, callback) {
  const capitalizedName = capitalize(actionName);
  let beforeHook = this.constructor['before' + capitalizedName] ||
    this.constructor['pre' + capitalizedName];
  let afterHook = this.constructor['after' + capitalizedName] ||
    this.constructor['post' + capitalizedName];
  if (actionName === 'validate') {
    beforeHook = beforeHook || this.constructor.beforeValidation;
    afterHook = afterHook || this.constructor.afterValidation;
  }
  const inst = this;

  if (actionName !== 'initialize') {
    if (beforeHook)
      deprecateHook(inst.constructor, ['before', 'pre'], capitalizedName);
    if (afterHook)
      deprecateHook(inst.constructor, ['after', 'post'], capitalizedName);
  }

  // we only call "before" hook when we have actual action (work) to perform
  if (work) {
    if (beforeHook) {
      // before hook should be called on instance with two parameters: next and data
      beforeHook.call(inst, function() {
        // Check arguments to next(err, result)
        if (arguments.length) {
          return callback && callback.apply(null, arguments);
        }
        // No err & result is present, proceed with the real work
        // actual action also have one param: callback
        work.call(inst, next);
      }, data);
    } else {
      work.call(inst, next);
    }
  } else {
    next();
  }

  function next(done) {
    if (afterHook) {
      afterHook.call(inst, done);
    } else if (done) {
      done.call(this);
    }
  }
};

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function deprecateHook(ctor, prefixes, capitalizedName) {
  const candidateNames = prefixes.map(function(p) { return p + capitalizedName; });
  if (capitalizedName === 'Validate')
    candidateNames.push(prefixes[0] + 'Validation');

  let hookName = candidateNames.filter(function(hook) { return !!ctor[hook]; })[0];
  if (!hookName) return; // just to be sure, this should never happen
  if (ctor.modelName) hookName = ctor.modelName + '.' + hookName;
  deprecated(g.f('Model hook "%s" is deprecated, ' +
    'use Operation hooks instead. ' +
    '{{http://docs.strongloop.com/display/LB/Operation+hooks}}', hookName));
}
