// Copyright IBM Corp. 2011,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');

/**
 *
 * @param newClass
 * @param baseClass
 */
exports.inherits = function(newClass, baseClass, options) {
  util.inherits(newClass, baseClass);

  options = options || {
    staticProperties: true,
    override: false,
  };

  if (options.staticProperties) {
    Object.keys(baseClass).forEach(function(classProp) {
      if (classProp !== 'super_' && (!newClass.hasOwnProperty(classProp) ||
          options.override)) {
        const pd = Object.getOwnPropertyDescriptor(baseClass, classProp);
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
exports.mixin = function(newClass, mixinClass, options) {
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
    proxyFunctions: false,
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
  Object.keys(sourceScope).forEach(function(propertyName) {
    const targetPropertyExists = targetScope.hasOwnProperty(propertyName);
    const sourceProperty = Object.getOwnPropertyDescriptor(sourceScope, propertyName);
    const targetProperty = targetPropertyExists && Object.getOwnPropertyDescriptor(targetScope, propertyName);
    const sourceIsFunc = typeof sourceProperty.value === 'function';
    const isFunc = targetPropertyExists && typeof targetProperty.value === 'function';
    const isDelegate = isFunc && targetProperty.value._delegate;
    const shouldOverride = options.override || !targetPropertyExists || isDelegate;

    if (propertyName == '_mixins') {
      mergeMixins(sourceScope._mixins, targetScope._mixins);
      return;
    }

    if (shouldOverride) {
      Object.defineProperty(targetScope, propertyName, sourceProperty);
    }
  });
}

function mergeMixins(source, target) {
  // hand-written equivalent of lodash.union()
  for (const ix in source) {
    const mx = source[ix];
    if (target.indexOf(mx) === -1)
      target.push(mx);
  }
}
