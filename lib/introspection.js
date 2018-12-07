// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function getIntrospector(ModelBuilder) {
  function introspectType(value) {
    // Unknown type, using Any
    if (value === null || value === undefined) {
      return ModelBuilder.Any;
    }

    // Check registered schemaTypes
    for (const t in ModelBuilder.schemaTypes) {
      const st = ModelBuilder.schemaTypes[t];
      if (st !== Object && st !== Array && (value instanceof st)) {
        return t;
      }
    }

    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return type;
    }

    if (value instanceof Date) {
      return 'date';
    }

    let itemType;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] === null || value[i] === undefined) {
          continue;
        }
        itemType = introspectType(value[i]);
        if (itemType) {
          return [itemType];
        }
      }
      return 'array';
    }

    if (type === 'function') {
      return value.constructor.name;
    }

    const properties = {};
    for (const p in value) {
      itemType = introspectType(value[p]);
      if (itemType) {
        properties[p] = itemType;
      }
    }
    if (Object.keys(properties).length === 0) {
      return 'object';
    }
    return properties;
  }

  ModelBuilder.introspect = introspectType;
  return introspectType;
};
