var hooks = require('hooks');
/*!
 * Module exports
 */
module.exports = Hookable;

for (var k in hooks) {
  Hookable[k] = hooks[k];
}

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
 * List of hook
 */
Hookable.prototype._initialize =
  Hookable.prototype._validate =
    Hookable.prototype._create =
      Hookable.prototype._update =
        Hookable.prototype._save =
          Hookable.prototype._destroy =
            function (data, callback) {
              if (callback)callback();
            };

// TODO: Evaluate https://github.com/bnoguchi/hooks-js/
Hookable.prototype.trigger = function trigger(actionName, work, data, callback) {
  var inst = this;
  var fn = function () {
    var capitalizedName = capitalize(actionName);
    var beforeHook = inst.constructor["before" + capitalizedName]
      || this.constructor["pre" + capitalizedName];
    var afterHook = inst.constructor["after" + capitalizedName]
      || this.constructor["post" + capitalizedName];
    if (actionName === 'validate') {
      beforeHook = beforeHook || inst.constructor.beforeValidation;
      afterHook = afterHook || inst.constructor.afterValidation;
    }
    // we only call "before" hook when we have actual action (work) to perform
    if (work) {
      if (beforeHook) {
        // before hook should be called on instance with two parameters: next and data
        beforeHook.call(inst, function () {
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
  //add a warp for enable hooks
  inst['_' + actionName](data, fn);
};

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
