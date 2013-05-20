var path = require('path');

var loadSchemasSync = require('../lib/adl-loader').loadSchemasSync;


var models = loadSchemasSync(path.join(__dirname, 'jdb-schemas.json'));

for (var s in models) {
    var m = models[s];
    // console.dir(m);
    console.log(new m());
}

models = loadSchemasSync(path.join(__dirname, 'schemas.json'));
for (var s in models) {
    var m = models[s];
    // console.dir(m);
    console.log(new m());
}
