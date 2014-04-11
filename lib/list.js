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
      throw new Error('could not create List from JSON string: ', items);
    }
  }

  var arr = [];
  arr.__proto__ = List.prototype;

  items = items || [];
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array: ' + items);
  }

  if(!itemType) {
    itemType = items[0] && items[0].constructor;
  }

  if (Array.isArray(itemType)) {
    itemType = itemType[0];
  }

  if(itemType === Array) {
    itemType = Any;
  }

  Object.defineProperty(arr, 'itemType', {
    writable: true,
    enumerable: false,
    value: itemType
  });

  if (parent) {
    Object.defineProperty(arr, 'parent', {
      writable: true,
      enumerable: false,
      value: parent
    });
  }

  items.forEach(function (item, i) {
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

List.prototype.push = function (obj) {
  var item = this.itemType && (obj instanceof this.itemType) ? obj : this.itemType(obj);
  _push.call(this, item);
  return item;
};

List.prototype.toObject = function (onlySchema, removeHidden) {
  var items = [];
  this.forEach(function (item) {
    if (item.toObject) {
      items.push(item.toObject(onlySchema, removeHidden));
    } else {
      items.push(item);
    }
  });
  return items;
};

List.prototype.toJSON = function () {
  return this.toObject(true);
};

List.prototype.toString = function () {
  return JSON.stringify(this.toJSON());
};

/*
 var strArray = new List(['1', 2], String);
 strArray.push(3);
 console.log(strArray);
 console.log(strArray.length);

 console.log(strArray.toJSON());
 console.log(strArray.toString());
 */
