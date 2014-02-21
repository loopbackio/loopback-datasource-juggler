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
      if (classProp !== 'super_' && (!newClass.hasOwnProperty(classProp)
        || options.override)) {
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
    if (newClass._mixins.indexOf(mixinClass) !== -1) {
      return;
    }
    newClass._mixins.push(mixinClass);
  } else {
    newClass._mixins = [mixinClass];
  }

  options = options || {
    staticProperties: true,
    instanceProperties: true,
    override: false,
    proxyFunctions: false
  };

  if (options.staticProperties === undefined) {
    options.staticProperties = true;
  }

  if (options.instanceProperties === undefined) {
    options.instanceProperties = true;
  }

  if (options.staticProperties) {
    mixInto(mixinClass, newClass, options);
  }

  if (options.instanceProperties && mixinClass.prototype) {
    mixInto(mixinClass.prototype, newClass.prototype, options);
  }
  
  return newClass;
};

function mixInto(sourceScope, targetScope, options) {
  var proxies = [];

  Object.keys(sourceScope).forEach(function (propertyName, options) {
    var targetPropertyExists = targetScope.hasOwnProperty(propertyName);
    var sourceProperty = Object.getOwnPropertyDescriptor(sourceScope, propertyName);
    var targetProperty = targetPropertyExists && Object.getOwnPropertyDescriptor(targetScope, propertyName);
    var sourceIsFunc = typeof sourceProperty.value === 'function';
    var isFunc = targetPropertyExists && typeof targetProperty.value === 'function';
    var isDelegate = isFunc && targetProperty.value._delegate;
    var shouldOverride = options.override || !targetPropertyExists || isDelegate;

    if (shouldOverride) {
      if (sourceIsFunc) {
        sourceProperty.value = exports.proxy(sourceProperty.value, proxies);
      }
      
      Object.defineProperty(targetScope, propertyName, sourceProperty);
    }
  });
}

exports.proxy = function createProxy(fn, proxies) {
  // Make sure same methods referenced by different properties have the same proxy
  // For example, deleteById is an alias of removeById
  proxies = proxies || [];
  for (var i = 0; i < proxies.length; i++) {
    if (proxies[i]._delegate === fn) {
      return proxies[i];
    }
  }
  var f = function () {
    return fn.apply(this, arguments);
  };
  f._delegate = fn;
  proxies.push(f);
  Object.keys(fn).forEach(function (x) {
    f[x] = fn[x];
  });
  return f;
};

