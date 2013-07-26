module.exports = function (Types) {

    var List = require('./list.js');
    var GeoPoint = require('./geo').GeoPoint;

    /**
     * Schema types
     */
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

    Types.schemaTypes = {};
    Types.registerType = function (type, names) {
        names = names || [];
        names = names.concat([type.name]);
        for (var n = 0; n < names.length; n++) {
            this.schemaTypes[names[n].toLowerCase()] = type;
        }
    };

    Types.registerType(Types.Text);
    Types.registerType(Types.JSON);
    Types.registerType(Types.Any);

    Types.registerType(String);
    Types.registerType(Number);
    Types.registerType(Boolean);
    Types.registerType(Date);
    Types.registerType(Buffer, ['Binary']);
    Types.registerType(Array);
    Types.registerType(GeoPoint);
    Types.registerType(Object);
}