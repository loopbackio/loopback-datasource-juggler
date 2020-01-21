// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const g = require('strong-globalize')();
const util = require('util');
const extend = util._extend;

/*!
 * Module exports
 */
exports.ValidationError = ValidationError;
exports.Validatable = Validatable;

/**
 * This class provides methods that add validation cababilities to models.
 * Each of the validations runs when the `obj.isValid()` method is called.
 *
 * All of the methods have an options object parameter that has a
 * `message` property.  When there is only a single error message, this property is just a string;
 * for example: `Post.validatesPresenceOf('title', { message: 'can not be blank' });`
 *
 * In more complicated cases it can be a set of messages, for each possible error condition; for example:
 * `User.validatesLengthOf('password', { min: 6, max: 20, message: {min: 'too short', max: 'too long'}});`
 * @class Validatable
 */
function Validatable() {
}

/**
 * Validate presence of one or more specified properties.
 *
 * Requires a model to include a property to be considered valid; fails when validated field is blank.
 *
 * For example, validate presence of title
 * ```
 * Post.validatesPresenceOf('title');
 * ```
 * Validate that model has first, last, and age properties:
 * ```
 * User.validatesPresenceOf('first', 'last', 'age');
 * ```
 * Example with custom message
 * ```
 * Post.validatesPresenceOf('title', {message: 'Cannot be blank'});
 * ```
 *
 * @param {String} propertyName  One or more property names.
 * @options {Object} options Configuration parameters; see below.
 * @property {String} message Error message to use instead of default.
 * @property {String} if Validate only if `if` exists.
 * @property {String} unless Validate only if `unless` exists.
 */
Validatable.validatesPresenceOf = getConfigurator('presence');

/**
 * Validate absence of one or more specified properties.
 *
 * A model should not include a property to be considered valid; fails when validated field is not blank.
 *
 * For example, validate absence of reserved
 * ```
 * Post.validatesAbsenceOf('reserved', { unless: 'special' });
 * ```
 *
 * @param {String} propertyName  One or more property names.
 * @options {Object} options Configuration parameters; see below.
 * @property {String} message Error message to use instead of default.
 * @property {String} if Validate only if `if` exists.
 * @property {String} unless Validate only if `unless` exists.
 */
Validatable.validatesAbsenceOf = getConfigurator('absence');

/**
 * Validate length.
 *
 * Require a property length to be within a specified range.
 *
 * There are three kinds of validations: min, max, is.
 *
 * Default error messages:
 *
 * - min: too short
 * - max: too long
 * - is: length is wrong
 *
 * Example: length validations
 * ```
 * User.validatesLengthOf('password', {min: 7});
 * User.validatesLengthOf('email', {max: 100});
 * User.validatesLengthOf('state', {is: 2});
 * User.validatesLengthOf('nick', {min: 3, max: 15});
 * ```
 * Example: length validations with custom error messages
 * ```
 * User.validatesLengthOf('password', {min: 7, message: {min: 'too weak'}});
 * User.validatesLengthOf('state', {is: 2, message: {is: 'is not valid state name'}});
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {Number} is Value that property must equal to validate.
 * @property {Number} min Value that property must be less than to be valid.
 * @property {Number} max Value that property must be less than to be valid.
 * @property {Object} message Optional object with string properties for custom error message for each validation: is, min, or max.
 */
Validatable.validatesLengthOf = getConfigurator('length');

/**
 * Validate numericality.
 *
 * Requires a value for property to be either an integer or number.
 *
 * Example
 * ```
 * User.validatesNumericalityOf('age', { message: { number: 'is not a number' }});
 * User.validatesNumericalityOf('age', {int: true, message: { int: 'is not an integer' }});
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {Boolean} int If true, then property must be an integer to be valid.
 * @property {Boolean} allowBlank Allow property to be blank.
 * @property {Boolean} allowNull Allow property to be null.
 * @property {Object} message Optional object with string properties for 'int' for integer validation. Default error messages:
 * - number: is not a number
 * - int: is not an integer
 */
Validatable.validatesNumericalityOf = getConfigurator('numericality');

/**
 * Validate inclusion in set.
 *
 * Require a value for property to be in the specified array.
 *
 * Example:
 * ```
 * User.validatesInclusionOf('gender', {in: ['male', 'female']});
 * User.validatesInclusionOf('role', {
 *     in: ['admin', 'moderator', 'user'], message: 'is not allowed'
 * });
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {Array} in Property must match one of the values in the array to be valid.
 * @property {String} message Optional error message if property is not valid.
 * Default error message: "is not included in the list".
 * @property {Boolean} allowNull Whether null values are allowed.
 */
Validatable.validatesInclusionOf = getConfigurator('inclusion');

/**
 * Validate exclusion in a set.
 *
 * Require a property value not be in the specified array.
 *
 * Example: `Company.validatesExclusionOf('domain', {in: ['www', 'admin']});`
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {Array} in Property must not match any of the values in the array to be valid.
 * @property {String} message Optional error message if property is not valid. Default error message: "is reserved".
 * @property {Boolean} allowNull Whether null values are allowed.
 */
Validatable.validatesExclusionOf = getConfigurator('exclusion');

/**
 * Validate format.
 *
 * Require a model to include a property that matches the given format.
 *
 * Example: `User.validatesFormatOf('name', {with: /\w+/});`
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {RegExp} with Regular expression to validate format.
 * @property {String} message Optional error message if property is not valid. Default error message: " is invalid".
 * @property {Boolean} allowNull Whether null values are allowed.
 */
Validatable.validatesFormatOf = getConfigurator('format');

/**
 * Validate using custom validation function.
 *
 * Example:
 *```javascript
 *     User.validate('name', customValidator, {message: 'Bad name'});
 *     function customValidator(err) {
 *         if (this.name === 'bad') err();
 *     });
 *     var user = new User({name: 'Peter'});
 *     user.isValid(); // true
 *     user.name = 'bad';
 *     user.isValid(); // false
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @param {Function} validatorFn Custom validation function.
 * @options {Object} options Configuration parameters; see below.
 * @property {String} message Optional error message if property is not valid. Default error message: " is invalid".
 * @property {Boolean} allowNull Whether null values are allowed.
 */
Validatable.validate = getConfigurator('custom');

/**
 * Validate using custom asynchronous validation function.
 *
 * Example:
 *```js
 *     User.validateAsync('name', customValidator, {message: 'Bad name'});
 *     function customValidator(err, done) {
 *         process.nextTick(function () {
 *             if (this.name === 'bad') err();
 *             done();
 *         });
 *     });
 *     var user = new User({name: 'Peter'});
 *     user.isValid(); // false (because async validation setup)
 *     user.isValid(function (isValid) {
 *         isValid; // true
 *     })
 *     user.name = 'bad';
 *     user.isValid(); // false
 *     user.isValid(function (isValid) {
 *         isValid; // false
 *     })
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @param {Function} validatorFn Custom validation function.
 * @options {Object} options Configuration parameters; see below.
 * @property {String} message Optional error message if property is not valid. Default error message: " is invalid".
 * @property {Boolean} allowNull Whether null values are allowed.
 */
Validatable.validateAsync = getConfigurator('custom', {async: true});

/**
 * Validate uniqueness of the value for a property in the collection of models.
 *
 * Not available for all connectors. Currently supported with these connectors:
 *  - In Memory
 *  - Oracle
 *  - MongoDB
 *
 * ```
 * // The login must be unique across all User instances.
 * User.validatesUniquenessOf('login');
 *
 * // Assuming SiteUser.belongsTo(Site)
 * // The login must be unique within each Site.
 * SiteUser.validateUniquenessOf('login', { scopedTo: ['siteId'] });
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {RegExp} with Regular expression to validate format.
 * @property {Array.<String>} scopedTo List of properties defining the scope.
 * @property {String} message Optional error message if property is not valid. Default error message: "is not unique".
 * @property {Boolean} allowNull Whether null values are allowed.
 * @property {String} ignoreCase Make the validation case insensitive.
 * @property {String} if Validate only if `if` exists.
 * @property {String} unless Validate only if `unless` exists.
 */
Validatable.validatesUniquenessOf = getConfigurator('uniqueness', {async: true});

/**
 * Validate if a value for a property is a Date.
 *
 * Example
 * ```
 * User.validatesDateOf('today', {message: 'today is not a date!'});
 * ```
 *
 * @param {String} propertyName  Property name to validate.
 * @options {Object} options Configuration parameters; see below.
 * @property {String} message Error message to use instead of default.
 */
Validatable.validatesDateOf = getConfigurator('date');

// implementation of validators

/*!
 * Presence validator
 */
function validatePresence(attr, conf, err, options) {
  if (blank(this[attr])) {
    err();
  }
}

/*!
 * Absence validator
 */
function validateAbsence(attr, conf, err, options) {
  if (!blank(this[attr])) {
    err();
  }
}

/*!
 * Length validator
 */
function validateLength(attr, conf, err, options) {
  if (nullCheck.call(this, attr, conf, err)) return;

  const len = this[attr].length;
  if (conf.min && len < conf.min) {
    err('min');
  }
  if (conf.max && len > conf.max) {
    err('max');
  }
  if (conf.is && len !== conf.is) {
    err('is');
  }
}

/*!
 * Numericality validator
 */
function validateNumericality(attr, conf, err, options) {
  if (nullCheck.call(this, attr, conf, err)) return;

  if (typeof this[attr] !== 'number' || isNaN(this[attr])) {
    return err('number');
  }
  if (conf.int && this[attr] !== Math.round(this[attr])) {
    return err('int');
  }
}

/*!
 * Inclusion validator
 */
function validateInclusion(attr, conf, err, options) {
  if (nullCheck.call(this, attr, conf, err)) return;

  if (!~conf.in.indexOf(this[attr])) {
    err();
  }
}

/*!
 * Exclusion validator
 */
function validateExclusion(attr, conf, err, options) {
  if (nullCheck.call(this, attr, conf, err)) return;

  if (~conf.in.indexOf(this[attr])) {
    err();
  }
}

/*!
 * Format validator
 */
function validateFormat(attr, conf, err, options) {
  if (nullCheck.call(this, attr, conf, err)) return;

  if (typeof this[attr] === 'string' || typeof this[attr] === 'number') {
    const regex = new RegExp(conf['with']);
    if (!regex.test(this[attr])) {
      err();
    }
  } else {
    err();
  }
}

/*!
 * Custom validator
 */
function validateCustom(attr, conf, err, options, done) {
  if (typeof options === 'function') {
    done = options;
    options = {};
  }
  if (!done) {
    // called from a sync validator, stick options on end
    conf.customValidator.call(this, err, options);
  } else {
    if (conf.customValidator.length === 3) {
      // if they declared the validator with 3 args, they are expecting options
      conf.customValidator.call(this, err, options, done);
    } else {
      // otherwise just pass the expected two (no context)
      conf.customValidator.call(this, err, done);
    }
  }
}

function escapeStringRegexp(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }
  const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
  return str.replace(matchOperatorsRe, '\\$&');
}

/*!
 * Uniqueness validator
 */
function validateUniqueness(attr, conf, err, options, done) {
  if (typeof options === 'function') {
    done = options;
    options = {};
  }
  if (blank(this[attr])) {
    return process.nextTick(done);
  }
  const cond = {where: {}};

  if (conf && conf.ignoreCase) {
    cond.where[attr] = new RegExp('^' + escapeStringRegexp(this[attr]) + '$', 'i');
  } else {
    cond.where[attr] = this[attr];
  }

  if (conf && conf.scopedTo) {
    conf.scopedTo.forEach(function(k) {
      const val = this[k];
      if (val !== undefined)
        cond.where[k] = this[k];
    }, this);
  }

  const idName = this.constructor.definition.idName();
  const isNewRecord = this.isNewRecord();
  this.constructor.find(cond, options, function(error, found) {
    if (error) {
      err(error);
    } else if (found.length > 1) {
      err();
    } else if (found.length === 1 && idName === attr && isNewRecord) {
      err();
    } else if (found.length === 1 && (
      !this.id || !found[0].id || found[0].id.toString() != this.id.toString()
    )) {
      err();
    }
    done();
  }.bind(this));
}

/*!
 * Date validator
 */
function validateDate(attr, conf, err) {
  if (this[attr] === null || this[attr] === undefined) return;

  const date = new Date(this[attr]);
  if (isNaN(date.getTime())) return err();
}

const validators = {
  presence: validatePresence,
  absence: validateAbsence,
  length: validateLength,
  numericality: validateNumericality,
  inclusion: validateInclusion,
  exclusion: validateExclusion,
  format: validateFormat,
  custom: validateCustom,
  uniqueness: validateUniqueness,
  date: validateDate,
};

function getConfigurator(name, opts) {
  return function() {
    const args = Array.prototype.slice.call(arguments);
    args[1] = args[1] || {};
    configure(this, name, args, opts);
  };
}

/**
 * This method performs validation and triggers validation hooks.
 * Before validation the `obj.errors` collection is cleaned.
 * Each validation can add errors to `obj.errors` collection.
 * If collection is not blank, validation failed.
 *
 * NOTE: This method can be called as synchronous only when no asynchronous validation is
 * configured. It's strongly recommended to run all validations as asyncronous.
 *
 * Example: ExpressJS controller - render user if valid, show flash otherwise
 * ```javascript
 * user.isValid(function (valid) {
 *     if (valid) res.render({user: user});
 *     else res.flash('error', 'User is not valid'), console.log(user.errors), res.redirect('/users');
 * });
 * ```
 * Another example:
 * ```javascript
 * user.isValid(function (valid) {
 *     if (!valid) {
 *           console.log(user.errors);
 *         // => hash of errors
 *         // => {
 *         // => username: [errmessage, errmessage, ...],
 *         // => email: ...
 *         // => }
 *     }
 * });
 * ```
 * @callback {Function} callback Called with (valid).
 * @param {Object} data Data to be validated.
 * @param {Object} options Options to be specified upon validation.
 * @returns {Boolean} True if no asynchronous validation is configured and all properties pass validation.
 */
Validatable.prototype.isValid = function(callback, data, options) {
  options = options || {};
  let valid = true, wait = 0, async = false;
  const inst = this;
  const validations = this.constructor.validations;

  const reportDiscardedProperties = this.__strict &&
    this.__unknownProperties && this.__unknownProperties.length;

  // exit with success when no errors
  if (typeof validations !== 'object' && !reportDiscardedProperties) {
    cleanErrors(this);
    if (callback) {
      this.trigger('validate', function(validationsDone) {
        validationsDone.call(inst, function() {
          callback(valid);
        });
      }, data, callback);
    }
    return valid;
  }

  Object.defineProperty(this, 'errors', {
    enumerable: false,
    configurable: true,
    value: new Errors,
  });

  this.trigger('validate', function(validationsDone) {
    const inst = this;
    let asyncFail = false;

    const attrs = Object.keys(validations || {});

    attrs.forEach(function(attr) {
      const attrValidations = validations[attr] || [];
      attrValidations.forEach(function(v) {
        if (v.options && v.options.async) {
          async = true;
          wait += 1;
          process.nextTick(function() {
            validationFailed(inst, attr, v, options, done);
          });
        } else {
          if (validationFailed(inst, attr, v, options)) {
            valid = false;
          }
        }
      });
    });

    if (reportDiscardedProperties) {
      for (const ix in inst.__unknownProperties) {
        const key = inst.__unknownProperties[ix];
        const code = 'unknown-property';
        const msg = defaultMessages[code];
        inst.errors.add(key, msg, code);
        valid = false;
      }
    }

    if (!async) {
      validationsDone.call(inst, function() {
        if (valid) cleanErrors(inst);
        if (callback) {
          callback(valid);
        }
      });
    }

    function done(fail) {
      asyncFail = asyncFail || fail;
      if (--wait === 0) {
        validationsDone.call(inst, function() {
          if (valid && !asyncFail) cleanErrors(inst);
          if (callback) {
            callback(valid && !asyncFail);
          }
        });
      }
    }
  }, data, callback);

  if (async) {
    // in case of async validation we should return undefined here,
    // because not all validations are finished yet
    return;
  } else {
    return valid;
  }
};

function cleanErrors(inst) {
  Object.defineProperty(inst, 'errors', {
    enumerable: false,
    configurable: true,
    value: false,
  });
}

function validationFailed(inst, attr, conf, options, cb) {
  const opts = conf.options || {};

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  if (typeof attr !== 'string') return false;

  // here we should check skip validation conditions (if, unless)
  // that can be specified in conf
  if (skipValidation(inst, conf, 'if') ||
      skipValidation(inst, conf, 'unless')) {
    if (cb) cb(false);
    return false;
  }

  let fail = false;
  const validator = validators[conf.validation];
  const validatorArguments = [];
  validatorArguments.push(attr);
  validatorArguments.push(conf);
  validatorArguments.push(function onerror(kind) {
    let message, code = conf.code || conf.validation;
    if (conf.message) {
      message = conf.message;
    }
    if (!message && defaultMessages[conf.validation]) {
      message = defaultMessages[conf.validation];
    }
    if (!message) {
      message = 'is invalid';
    }
    if (kind) {
      code += '.' + kind;
      if (message[kind]) {
        // get deeper
        message = message[kind];
      } else if (defaultMessages.common[kind]) {
        message = defaultMessages.common[kind];
      } else {
        message = 'is invalid';
      }
    }
    if (kind !== false) inst.errors.add(attr, message, code);
    fail = true;
  });
  validatorArguments.push(options);
  if (cb) {
    validatorArguments.push(function() {
      cb(fail);
    });
  }
  validator.apply(inst, validatorArguments);
  return fail;
}

function skipValidation(inst, conf, kind) {
  let doValidate = true;
  if (typeof conf[kind] === 'function') {
    doValidate = conf[kind].call(inst);
    if (kind === 'unless') doValidate = !doValidate;
  } else if (typeof conf[kind] === 'string') {
    if (typeof inst[conf[kind]] === 'function') {
      doValidate = inst[conf[kind]].call(inst);
      if (kind === 'unless') doValidate = !doValidate;
    } else if (inst.__data.hasOwnProperty(conf[kind])) {
      doValidate = inst[conf[kind]];
      if (kind === 'unless') doValidate = !doValidate;
    } else {
      doValidate = kind === 'if';
    }
  }
  return !doValidate;
}

const defaultMessages = {
  presence: 'can\'t be blank',
  absence: 'can\'t be set',
  'unknown-property': 'is not defined in the model',
  length: {
    min: 'too short',
    max: 'too long',
    is: 'length is wrong',
  },
  common: {
    blank: 'is blank',
    'null': 'is null',
  },
  numericality: {
    'int': 'is not an integer',
    'number': 'is not a number',
  },
  inclusion: 'is not included in the list',
  exclusion: 'is reserved',
  uniqueness: 'is not unique',
  date: 'is not a valid date',
};

/**
 * Checks if attribute is undefined or null. Calls err function with 'blank' or 'null'.
 * See defaultMessages. You can affect this behaviour with conf.allowBlank and conf.allowNull.
 * @private
 * @param {String} attr Property name of attribute
 * @param {Object} conf conf object for validator
 * @param {Function} err
 * @return {Boolean} returns true if attribute is null or blank
 */
function nullCheck(attr, conf, err) {
  // First determine if attribute is defined
  if (typeof this[attr] === 'undefined' || this[attr] === '') {
    if (!conf.allowBlank) {
      err('blank');
    }
    return true;
  } else {
    // Now check if attribute is null
    if (this[attr] === null) {
      if (!conf.allowNull) {
        err('null');
      }
      return true;
    }
  }
  return false;
}

/*!
 * Return true when v is undefined, blank array, null or empty string
 * otherwise returns false
 *
 * @param {Mix} v
 * Returns true if `v` is blank.
 */
function blank(v) {
  if (typeof v === 'undefined') return true;
  if (v instanceof Array && v.length === 0) return true;
  if (v === null) return true;
  if (typeof v === 'number' && isNaN(v)) return true;
  if (typeof v == 'string' && v === '') return true;
  return false;
}

function configure(cls, validation, args, opts) {
  if (!cls.validations) {
    Object.defineProperty(cls, 'validations', {
      writable: true,
      configurable: true,
      enumerable: false,
      value: {},
    });
  }
  args = [].slice.call(args);
  let conf;
  if (typeof args[args.length - 1] === 'object') {
    conf = args.pop();
  } else {
    conf = {};
  }
  if (validation === 'custom' && typeof args[args.length - 1] === 'function') {
    conf.customValidator = args.pop();
  }
  conf.validation = validation;
  args.forEach(function(attr) {
    if (typeof attr === 'string') {
      const validation = extend({}, conf);
      validation.options = opts || {};
      cls.validations[attr] = cls.validations[attr] || [];
      cls.validations[attr].push(validation);
    }
  });
}

function Errors() {
  Object.defineProperty(this, 'codes', {
    enumerable: false,
    configurable: true,
    value: {},
  });
}

Errors.prototype.add = function(field, message, code) {
  code = code || 'invalid';
  if (!this[field]) {
    this[field] = [];
    this.codes[field] = [];
  }
  this[field].push(message);
  this.codes[field].push(code);
};

function ErrorCodes(messages) {
  const c = this;
  Object.keys(messages).forEach(function(field) {
    c[field] = messages[field].codes;
  });
}

/**
 * ValidationError is raised when the application attempts to save an invalid model instance.
 * Example:
 * ```
 * {
 *   "name": "ValidationError",
 *   "status": 422,
 *   "message": "The Model instance is not valid. \
 *  See `details` property of the error object for more info.",
 *   "statusCode": 422,
 *   "details": {
 *     "context": "user",
  *    "codes": {
  *      "password": [
 *         "presence"
 *       ],
 *       "email": [
 *         "uniqueness"
 *       ]
 *    },
 *     "messages": {
 *       "password": [
 *        "can't be blank"
 *      ],
 *       "email": [
 *         "Email already exists"
 *       ]
 *     }
 *   },
 * }
 * ```
 * You might run into situations where you need to raise a validation error yourself, for example in a "before" hook or a
 * custom model method.
 * ```
 * MyModel.prototype.preflight = function(changes, callback) {
 *   // Update properties, do not save to db
 *   for (var key in changes) {
 *     model[key] = changes[key];
 *   }
 *
 *   if (model.isValid()) {
 *     return callback(null, { success: true });
 *   }
 *
 *   // This line shows how to create a ValidationError
 *   var err = new MyModel.ValidationError(model);
 *   callback(err);
 * }
 * ```
 *
 * @private
*/
function ValidationError(obj) {
  if (!(this instanceof ValidationError)) return new ValidationError(obj);

  this.name = 'ValidationError';

  const context = obj && obj.constructor && obj.constructor.modelName;
  this.message = g.f(
    'The %s instance is not valid. Details: %s.',
    context ? '`' + context + '`' : 'model',
    formatErrors(obj.errors, obj.toJSON()) || '(unknown)',
  );

  this.statusCode = 422;

  this.details = {
    context: context,
    codes: obj.errors && obj.errors.codes,
    messages: obj.errors,
  };

  if (Error.captureStackTrace) {
    // V8 (Chrome, Opera, Node)
    Error.captureStackTrace(this, this.constructor);
  } else if (errorHasStackProperty) {
    // Firefox
    this.stack = (new Error).stack;
  }
  // Safari and PhantomJS initializes `error.stack` on throw
  // Internet Explorer does not support `error.stack`
}

util.inherits(ValidationError, Error);

const errorHasStackProperty = !!(new Error).stack;

ValidationError.maxPropertyStringLength = 32;

function formatErrors(errors, propertyValues) {
  const DELIM = '; ';
  errors = errors || {};
  return Object.getOwnPropertyNames(errors)
    .filter(function(propertyName) {
      return Array.isArray(errors[propertyName]);
    })
    .map(function(propertyName) {
      const messages = errors[propertyName];
      const propertyValue = propertyValues[propertyName];
      return messages.map(function(msg) {
        return formatPropertyError(propertyName, propertyValue, msg);
      }).join(DELIM);
    })
    .join(DELIM);
}

function formatPropertyError(propertyName, propertyValue, errorMessage) {
  let formattedValue;
  const valueType = typeof propertyValue;
  if (valueType === 'string') {
    formattedValue = JSON.stringify(truncatePropertyString(propertyValue));
  } else if (propertyValue instanceof Date) {
    formattedValue = isNaN(propertyValue.getTime()) ? propertyValue.toString() : propertyValue.toISOString();
  } else if (valueType === 'object') {
    // objects and arrays
    formattedValue = util.inspect(propertyValue, {
      showHidden: false,
      color: false,
      // show top-level object properties only
      depth: Array.isArray(propertyValue) ? 1 : 0,
    });
    formattedValue = truncatePropertyString(formattedValue);
  } else {
    formattedValue = truncatePropertyString('' + propertyValue);
  }
  return '`' + propertyName + '` ' + errorMessage +
    ' (value: ' + formattedValue + ')';
}

function truncatePropertyString(value) {
  let len = ValidationError.maxPropertyStringLength;
  if (value.length <= len) return value;

  // preserve few last characters like `}` or `]`, but no more than 3
  // this way the last `} ]` in the array of objects is included in the message
  let tail;
  const m = value.match(/([ \t})\]]+)$/);
  if (m) {
    tail = m[1].slice(-3);
    len -= tail.length;
  } else {
    tail = value.slice(-3);
    len -= 3;
  }

  return value.slice(0, len - 4) + '...' + tail;
}
