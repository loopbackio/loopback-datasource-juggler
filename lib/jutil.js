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
  Object.keys(sourceScope).forEach(function (propertyName) {
    var targetPropertyExists = targetScope.hasOwnProperty(propertyName);
    var sourceProperty = Object.getOwnPropertyDescriptor(sourceScope, propertyName);
    var targetProperty = targetPropertyExists && Object.getOwnPropertyDescriptor(targetScope, propertyName);
    var sourceIsFunc = typeof sourceProperty.value === 'function';
    var isFunc = targetPropertyExists && typeof targetProperty.value === 'function';
    var isDelegate = isFunc && targetProperty.value._delegate;
    var shouldOverride = options.override || !targetPropertyExists || isDelegate;

    if (shouldOverride) {
      if (sourceIsFunc) {
        sourceProperty.value = sourceProperty.value;
      }
      
      Object.defineProperty(targetScope, propertyName, sourceProperty);
    }
  });
}
