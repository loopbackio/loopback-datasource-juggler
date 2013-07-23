var path = require('path'),
    fs = require('fs'),
    DataSource = require('../lib/datasource').DataSource;

/**
 * Load LDL schemas from a json doc
 * @param schemaFile The dataSource json file
 * @returns A map of schemas keyed by name
 */
function loadSchemasSync(schemaFile, dataSource) {
    // Set up the data source
    if(!dataSource) {
        dataSource = new DataSource('memory');
    }

    // Read the dataSource JSON file
    var schemas = JSON.parse(fs.readFileSync(schemaFile));

    return dataSource.buildModels(schemas);

}

var models = loadSchemasSync(path.join(__dirname, 'jdb-schemas.json'));

for (var s in models) {
    var m = models[s];
    console.log(m.modelName, new m());
}

models = loadSchemasSync(path.join(__dirname, 'schemas.json'));
for (var s in models) {
    var m = models[s];
    console.log(m.modelName, new m());
}
