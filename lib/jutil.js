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
 * Mix in the base class into the new class
 * @param newClass
 * @param baseClass
 * @param options
 */
exports.mixin = function (newClass, baseClass, options) {
    options = options || {
        staticProperties: true,
        instanceProperties: true,
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

    if (options.instanceProperties) {
        if (baseClass.prototype) {
            Object.keys(baseClass.prototype).forEach(function (instanceProp) {
                if (!newClass.hasOwnProperty(instanceProp) || options.override) {
                    var pd = Object.getOwnPropertyDescriptor(baseClass.prototype, instanceProp);
                    Object.defineProperty(newClass.prototype, instanceProp, pd);
                }
            });
        }
    }

    if (Array.isArray(newClass._mixins)) {
        newClass._mixins.push(baseClass);
    } else {
        newClass._mixins = [baseClass];
    }

    return newClass;
};

