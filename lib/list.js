// Copyright IBM Corp. 2012,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const g = require('strong-globalize')();
const util = require('util');
const Any = require('./types').Types.Any;
const {
  applyParentProperty,
} = require('./utils');

module.exports = List;

function List(items, itemType, parent) {
  const list = this;
  if (!(list instanceof List)) {
    return new List(items, itemType, parent);
  }

  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      const err = new Error(g.f('could not create List from JSON string: %j', items));
      err.statusCode = 400;
      throw err;
    }
  }

  if (typeof items === 'number') {
    // trying to initialise empty array with a length
    items = [...new Array(items)];
  }

  const arr = [];
  arr.__proto__ = List.prototype;

  items = items || [];
  if (!Array.isArray(items)) {
    const err = new Error(g.f('Items must be an array: %j', items));
    err.statusCode = 400;
    throw err;
  }

  if (!itemType) {
    itemType = items[0] && items[0].constructor;
  }

  if (Array.isArray(itemType)) {
    itemType = itemType[0];
  }

  if (itemType === Array) {
    itemType = Any;
  }

  Object.defineProperty(arr, 'itemType', {
    writable: true,
    enumerable: false,
    value: itemType,
  });

  if (parent) {
    // List constructor now called with actual model instance
    Object.defineProperty(arr, 'parent', {
      writable: true,
      enumerable: false,
      value: parent,
    });
  }

  items.forEach(function(item, i) {
    if (itemType && !(item instanceof itemType)) {
      arr[i] = arr.toItem(item);
    } else {
      arr[i] = item;
    }
    if (parent && arr[i] && typeof arr[i] === 'object') applyParentProperty(arr[i], parent);
  });

  return arr;
}

util.inherits(List, Array);

const _push = List.prototype.push;

List.prototype.toItem = function(item) {
  if (isClass(this.itemType)) {
    return new this.itemType(item);
  } else {
    if (Array.isArray(item)) {
      return item;
    } else if (this.itemType === Date) {
      if (item === null) return null;
      return new Date(item);
    } else {
      return this.itemType(item);
    }
  }
};

List.prototype.push = function(obj) {
  const item = this.itemType && (obj instanceof this.itemType) ? obj : this.toItem(obj);
  if (item && typeof item === 'object' && this.parent) applyParentProperty(item, this.parent);
  _push.call(this, item);
  return item;
};

List.prototype.toObject = function(onlySchema, removeHidden, removeProtected) {
  const items = [];
  this.forEach(function(item) {
    if (item && Array.isArray(item) && item.toArray) {
      const subArray = item.toArray();
      items.push(subArray);
    } else if (item && typeof item === 'object' && item.toObject) {
      items.push(item.toObject(onlySchema, removeHidden, removeProtected));
    } else {
      items.push(item);
    }
  });
  return items;
};

/**
 * Convert itself to a plain array.
 *
 * Some modules such as `should` checks prototype for comparison
 */
List.prototype.toArray = function() {
  const items = [];
  this.forEach(function(item) {
    items.push(item);
  });
  return items;
};

List.prototype.toJSON = function() {
  return this.toObject(true);
};

List.prototype.toString = function() {
  return JSON.stringify(this.toJSON());
};

function isClass(fn) {
  return fn && fn.toString().indexOf('class ') === 0;
}
