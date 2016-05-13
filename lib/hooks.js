// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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

// TODO: Evaluate https://github.com/bnoguchi/hooks-js/
Hookable.prototype.trigger = function trigger(actionName, work, data, callback) {
  var capitalizedName = capitalize(actionName);
  var afterHook = this.constructor['after' + capitalizedName] ||
    this.constructor['post' + capitalizedName];

  var inst = this;
  
  if (work) {
    work.call(inst, next);
  } else {
    next(callback);
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