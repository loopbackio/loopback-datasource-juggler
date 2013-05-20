var fs = require('fs')
    , DataSource = require('./datasource').DataSource;

// Built-in data types
var builtinTypes = {
    'string': String,
    'number': Number,
    'date': Date,
    'buffer': Buffer,
    'binary': Buffer,
    'boolean': Boolean,
    'any': DataSource.Any,
    'array': Array
}

/**
 * Resolve the type to be a function
 * @param type
 * @returns {*}
 */
function getSchemaType(type) {
    if (!type) {
        return type;
    }
    if (Array.isArray(type) && type.length > 0) {
        var itemType = getSchemaType(type[0]);
        if (typeof itemType === 'function') {
            return [itemType];
        }
        else return itemType;
    }
    if (typeof type === 'string') {
        var schemaType = builtinTypes[type.toLowerCase()];
        if (schemaType) {
            return schemaType;
        } else {
            return type;
        }
    } else if (type.constructor.name == 'Object') {
        if (type.type) {
            return getSchemaType(type.type);
        } else {
            throw new Error('Missing type property');
        }
    }
}

/**
 *
 * @param name
 * @param properties
 * @param associations
 * @returns {*}
 */
function buildSchema(name, properties, associations) {
    for (var p in properties) {
        console.log(name + "." + p + ": " + properties[p]);
        var type = getSchemaType(properties[p]);
        if (typeof type === 'string') {
            console.log('Association: ' + type);
            associations.push({
                source: name,
                target: type,
                relation: Array.isArray(properties[p]) ? 'hasMany' : 'belongsTo',
                as: p
            });
            delete properties[p];
        } else {
            properties[p] = type;
        }
    }
    return properties;
}


/**
 * Load ADL schemas from a json doc
 * @param schemaFile The schema json file
 * @returns A map of schemas keyed by name
 */
function loadSchemasSync(schemaFile, dataSource) {

    if(!dataSource) {
        dataSource = new DataSource('memory');
    }

    var models = {};

    var schemas = JSON.parse(fs.readFileSync(schemaFile));
    if (Array.isArray(schemas)) {
        // An array already
    } else if (schemas.properties && schemas.name) {
        schemas = [schemas];
    } else {
        schemas = [
            {
                name: 'Anonymous',
                properties: schemas
            }
        ];
    }

    var associations = [];
    for (var s in schemas) {
        var name = schemas[s].name;
        console.log('Loading ' + name);
        var jdbSchema = buildSchema(name, schemas[s].properties, associations);
        console.dir(jdbSchema);
        var model = dataSource.define(name, jdbSchema);
        console.dir(model);
        models[name.toLowerCase()] = model;
    }

    for (var i = 0; i < associations.length; i++) {
        var association = associations[i];
        var sourceModel = models[association.source.toLowerCase()];
        var targetModel = models[association.target.toLowerCase()];
        if (sourceModel && targetModel) {
            sourceModel[association.relation](targetModel, {as: association.as});
        }
    }
    return models;
}

exports.loadSchemasSync = loadSchemasSync;
