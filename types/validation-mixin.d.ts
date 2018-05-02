// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Callback, Options, PromiseOrVoid} from './common';

/**
 * This class provides methods that add validation cababilities to models.
 * Each of the validations runs when the `obj.isValid()` method is called.
 *
 * All of the methods have an options object parameter that has a
 * `message` property.  When there is only a single error message, this
 * property is just a string;
 * for example: `Post.validatesPresenceOf('title', { message: 'can not be blank' });`
 *
 * In more complicated cases it can be a set of messages, for each possible
 * error condition; for example:
 * `User.validatesLengthOf('password', { min: 6, max: 20, message: {min: 'too short', max: 'too long'}});`
 *
 */
export interface Validatable {
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
  validatesPresenceOf(...propertyNames: string[]): void;
  validatesPresenceOf(propertyName: string, options?: Options): void;

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
  validatesAbsenceOf(...propertyNames: string[]): void;
  validatesAbsenceOf(propertyName: string, options?: Options): void;

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
  validatesLengthOf(propertyName: string, options?: Options): void;

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
  validatesNumericalityOf(propertyName: string, options?: Options): void;

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
  validatesInclusionOf(propertyName: string, options?: Options): void;

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
  validatesExclusionOf(propertyName: string, options?: Options): void;

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
  validatesFormatOf(propertyName: string, options?: Options): void;

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
  validate(
    propertyName: string,
    validatorFn: Function,
    options?: Options,
  ): void;

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
  validateAsync(
    propertyName: string,
    validatorFn: Function,
    options?: Options,
  ): void;

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
  validatesUniquenessOf(
    propertyName: string,
    validatorFn: Function,
    options?: Options,
  ): void;

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
  validatesDateOf(
    propertyName: string,
    validatorFn: Function,
    options?: Options,
  ): void;
}

/**
 * ValidationError
 */
export declare class ValidationError extends Error {
  statusCode?: number;
  details: {
    context: any;
    codes: string[];
    messages: string[];
  };
}
