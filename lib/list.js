// Copyright IBM Corp. 2012,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var util = require('util');
var Any = require('./types').Types.Any;

module.exports = List;

function List(items, itemType, parent) {
  var list = this;
  if (!(list instanceof List)) {
    return new List(items, itemType, parent);
  }

  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      var err = new Error(util.format('could not create List from JSON string: %j', items));
      err.statusCode = 400;
      throw err;
    }
  }

  var arr = [];
  arr.__proto__ = List.prototype;

  items = items || [];
  if (!Array.isArray(items)) {
    var err = new Error(util.format('Items must be an array: %j', items));
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
    Object.defineProperty(arr, 'parent', {
      writable: true,
      enumerable: false,
      value: parent,
    });
  }

  items.forEach(function(item, i) {
    if (itemType && !(item instanceof itemType)) {
      arr[i] = itemType(item);
    } else {
      arr[i] = item;
    }
  });

  return arr;
}

util.inherits(List, Array);

var _push = List.prototype.push;

List.prototype.push = function(obj) {
  var item = this.itemType && (obj instanceof this.itemType) ? obj : this.itemType(obj);
  _push.call(this, item);
  return item;
};

List.prototype.toObject = function(onlySchema, removeHidden, removeProtected) {
  var items = [];
  this.forEach(function(item) {
    if (item && typeof item === 'object' && item.toObject) {
      items.push(item.toObject(onlySchema, removeHidden, removeProtected));
    } else {
      items.push(item);
    }
  });
  return items;
};

List.prototype.toJSON = function() {
  return this.toObject(true);
};

List.prototype.toString = function() {
  return JSON.stringify(this.toJSON());
};

