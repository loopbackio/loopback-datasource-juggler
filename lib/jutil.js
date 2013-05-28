/**
 *
 * @param newClass
 * @param baseClass
 */
exports.inherits = function (newClass, baseClass) {
    Object.keys(baseClass).forEach(function (classProp) {
        newClass[classProp] = baseClass[classProp];
    });
    Object.keys(baseClass.prototype).forEach(function (instanceProp) {
        newClass.prototype[instanceProp] = baseClass.prototype[instanceProp];
    });
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
        override: true
    };

    if (options.staticProperties) {
        Object.keys(baseClass).forEach(function (classProp) {
            if (classProp !== 'super_' && (!newClass.hasOwnProperty(classProp) || options.override)) {
                newClass[classProp] = baseClass[classProp];
            }
        });
    }

    if (options.instanceProperties) {
        if (baseClass.prototype) {
            Object.keys(baseClass.prototype).forEach(function (instanceProp) {
                newClass.prototype[instanceProp] = baseClass.prototype[instanceProp];
            });
        }
    }

    if (Array.isArray(newClass._mixins)) {
        newClass._mixins.push(baseClass);
    } else {
        newClass._mixins = [baseClass];
    }
};

