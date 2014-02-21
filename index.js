exports.ModelBuilder = exports.LDL = require('./lib/model-builder.js').ModelBuilder;
exports.DataSource = exports.Schema = require('./lib/datasource.js').DataSource;
exports.ModelBaseClass = require('./lib/model.js');
exports.Connector = require('./lib/connector.js');
exports.ValidationError = require('./lib/validations.js').ValidationError;

var baseSQL = './lib/sql';

exports.__defineGetter__('BaseSQL', function () {
    return require(baseSQL);
});


exports.__defineGetter__('version', function () {
    return require('./package.json').version;
});

var commonTest = './test/common_test';
exports.__defineGetter__('test', function () {
    return require(commonTest);
});
