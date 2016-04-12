var debug = require('debug')('test');
var fs = require('fs');
var path = require('path');

module.exports = function(dataSource, should, connectorCapabilities) {
  var operations = fs.readdirSync(__dirname);
  operations = operations.filter(function(it) {
    return it !== path.basename(__filename) &&
      !!require.extensions[path.extname(it).toLowerCase()];
  });
  for (var ix in operations) {
    var name = operations[ix];
    var fullPath = require.resolve('./' + name);
    debug('Loading test suite %s (%s)', name, fullPath);
    require(fullPath).apply(this, arguments);
  }
};
