// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const inspect = require('util').inspect;

module.exports = DateString;

/**
 * A String whose value is a valid representation of a Date.
 * Use this type if you need to preserve the format of the value and still
 * check if it's valid.
 * Example:
 * ```js
 * var loopback = require('loopback');
 * var dt = new loopback.DateString('2001-01-01');
 *
 * dt.toString();
 * // '2001-01-01'
 * dt._date.toISOString();
 * // '2001-01-01T00:00:00.000Z'
 * ```
 *
 * You can use this definition on your models as well:
 * ```json
 * {
 *   "name": "Person",
 *   "base": "PersistedModel",
 *   "properties": {
 *     "name": {
 *       "type": "string"
 *     },
 *     "dob": {
 *       "type": "DateString",
 *       "required": true
 *     },
 *   },
 *   "validations": [],
 *   "relations": {},
 *   "acls": [],
 *   "methods": {}
 * }
 * ```
 * @class DateString
 * @param {String} value
 * @constructor
 */
function DateString(value) {
  if (!(this instanceof DateString)) {
    return new DateString(value);
  }

  if (value instanceof DateString) {
    value = value.when;
  }

  if (typeof(value) !== 'string') {
    throw new Error('Input must be a string');
  }

  Object.defineProperty(this, 'when', {
    get: () => { return this._when; },
    set: (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        throw new Error('Invalid date');
      } else {
        this._when = val;
        this._date = d;
      }
    },
  });

  this.when = value;
}

/**
 * Returns the value of DateString in its original form.
 * @returns {String} The Date as a String.
 */
DateString.prototype.toString = function() {
  return this.when;
};

/**
 * Returns the JSON representation of the DateString object.
 * @returns {String} A JSON string.
 */
DateString.prototype.toJSON = function() {
  return JSON.stringify({
    when: this.when,
  });
};

DateString.prototype.inspect = function(depth, options) {
  return 'DateString ' + inspect({
    when: this.when,
    _date: this._date,
  });
};

if (inspect.custom) {
  // Node.js 12+ no longer recognizes "inspect" method,
  // it uses "inspect.custom" symbol as the key instead
  // TODO(semver-major) always use the symbol key only (requires Node.js 8+).
  DateString.prototype[inspect.custom] = DateString.prototype.inspect;
}
