module.exports = function getIntrospector(ModelBuilder) {

  function introspectType(value) {

    // Unknown type, using Any
    if (value === null || value === undefined) {
      return ModelBuilder.Any;
    }

    // Check registered schemaTypes
    for (var t in ModelBuilder.schemaTypes) {
      var st = ModelBuilder.schemaTypes[t];
      if (st !== Object && st !== Array && (value instanceof st)) {
        return t;
      }
    }

    var type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return type;
    }

    if (value instanceof Date) {
      return 'date';
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (value[i] === null || value[i] === undefined) {
          continue;
        }
        var itemType = introspectType(value[i]);
        if (itemType) {
          return [itemType];
        }
      }
      return 'array';
    }

    if (type === 'function') {
      return value.constructor.name;
    }

    var properties = {};
    for (var p in value) {
      var itemType = introspectType(value[p]);
      if (itemType) {
        properties[p] = itemType;
      }
    }
    if (Object.keys(properties).length === 0) {
      return 'object';
    }
    return properties;
  }

  return introspectType;
}


