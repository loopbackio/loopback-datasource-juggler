// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

var Types = {};
/**
 * Schema types
 */
Types.Text = function Text(value) {
  if (!(this instanceof Text)) {
    return value;
  }
  this.value = value;
}; // Text type

Types.Text.prototype.toObject = Types.Text.prototype.toJSON = function() {
  return this.value;
};

Types.JSON = function JSON(value) {
  if (!(this instanceof JSON)) {
    return value;
  }
  this.value = value;
}; // JSON Object
Types.JSON.prototype.toObject = Types.JSON.prototype.toJSON = function() {
  return this.value;
};

Types.Any = function Any(value) {
  if (!(this instanceof Any)) {
    return value;
  }
  this.value = value;
}; // Any Type
Types.Any.prototype.toObject = Types.Any.prototype.toJSON = function() {
  return this.value;
};

module.exports = function(modelTypes) {
  var DateString = require('./date-string');
  var GeoPoint = require('./geo').GeoPoint;

  for (var t in Types) {
    modelTypes[t] = Types[t];
  }

  modelTypes.schemaTypes = {};
  modelTypes.registerType = function(type, names) {
    names = names || [];
    names = names.concat([type.name]);
    for (var n = 0; n < names.length; n++) {
      this.schemaTypes[names[n].toLowerCase()] = type;
    }
  };

  modelTypes.registerType(Types.Text);
  modelTypes.registerType(Types.JSON);
  modelTypes.registerType(Types.Any);

  modelTypes.registerType(String);
  modelTypes.registerType(Number);
  modelTypes.registerType(Boolean);
  modelTypes.registerType(Date);
  modelTypes.registerType(DateString);
  modelTypes.registerType(Buffer, ['Binary']);
  modelTypes.registerType(Array);
  modelTypes.registerType(GeoPoint);
  modelTypes.registerType(Object);
};

module.exports.Types = Types;
