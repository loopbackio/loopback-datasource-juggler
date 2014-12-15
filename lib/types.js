/**
 * Schema types
 */
var Types = {
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Array: Array,
  GeoPoint: require('./geo').GeoPoint,
  Object: Object
};

Types.Text = function Text(value) {
  if (!(this instanceof Text)) {
    return value;
  }
  this.value = value;
}; // Text type

Types.Text.prototype.toObject = Types.Text.prototype.toJSON = function () {
  return this.value;
};

Types.JSON = function JSON(value) {
  if (!(this instanceof JSON)) {
    return value;
  }
  this.value = value;
}; // JSON Object
Types.JSON.prototype.toObject = Types.JSON.prototype.toJSON = function () {
  return this.value;
};

Types.Any = function Any(value) {
  if (!(this instanceof Any)) {
    return value;
  }
  this.value = value;
}; // Any Type
Types.Any.prototype.toObject = Types.Any.prototype.toJSON = function () {
  return this.value;
};

module.exports = function (modelTypes) {

  for(var t in Types) {
    modelTypes[t] = Types[t];
  }

  modelTypes.schemaTypes = {};
  modelTypes.registerType = function (type, names) {
    for (var n = 0; n < names.length; n++) {
      this.schemaTypes[names[n].toLowerCase()] = type;
    }
  };

  for (var name in Types) {
    var T = Types[name];
    modelTypes.registerType(T, [name]);
  }

  // add this to types after iteration, as we want to register an alias
  Types.Buffer = Buffer;
  modelTypes.registerType(Buffer, ['Buffer', 'Binary']);
};

module.exports.Types = Types;
