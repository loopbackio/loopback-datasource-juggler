var util = require('util');
/**
 *
 * @param newClass
 * @param baseClass
 */
exports.inherits = function (newClass, baseClass, options) {
    util.inherits(newClass, baseClass);

    options = options || {
        staticProperties: true,
        override: false
    };

    if (options.staticProperties) {
        Object.keys(baseClass).forEach(function (classProp) {
            if (classProp !== 'super_' && (!newClass.hasOwnProperty(classProp) || options.override)) {
                var pd = Object.getOwnPropertyDescriptor(baseClass, classProp);
                Object.defineProperty(newClass, classProp, pd);
            }
        });
    }
};


/**
 * Mix in the a class into the new class
 * @param newClass The target class to receive the mixin
 * @param mixinClass The class to be mixed in
 * @param options
 */
exports.mixin = function (newClass, mixinClass, options) {
    if (Array.isArray(newClass._mixins)) {
        if(newClass._mixins.indexOf(mixinClass) !== -1) {
            return;
        }
        newClass._mixins.push(mixinClass);
    } else {
        newClass._mixins = [mixinClass];
    }

    options = options || {
        staticProperties: true,
        instanceProperties: true,
        override: false
    };

    if (options.staticProperties) {
        Object.keys(mixinClass).forEach(function (classProp) {
            if (classProp !== 'super_' && classProp !== '_mixins' && (!newClass.hasOwnProperty(classProp) || options.override)) {
                var pd = Object.getOwnPropertyDescriptor(mixinClass, classProp);
                if(pd.writable && typeof pd.value === 'function' && pd.value.shared) {
                  pd.value = exports.proxy(pd.value);
                }
                Object.defineProperty(newClass, classProp, pd);
            }
        });
    }

    if (options.instanceProperties) {
        if (mixinClass.prototype) {
            Object.keys(mixinClass.prototype).forEach(function (instanceProp) {
                if (!newClass.prototype.hasOwnProperty(instanceProp) || options.override) {
                    var pd = Object.getOwnPropertyDescriptor(mixinClass.prototype, instanceProp);
                    if(pd.writable && typeof pd.value === 'function' && pd.value.shared) {
                      pd.value = exports.proxy(pd.value);
                    }
                    Object.defineProperty(newClass.prototype, instanceProp, pd);
                }
            });
        }
    }

    return newClass;
};

exports.proxy = function(fn) {
  var f = function() {
    return fn.apply(this, arguments);
  };
  Object.keys(fn).forEach(function(x) {
    f[x] = fn[x];
  });
  return f;
};

