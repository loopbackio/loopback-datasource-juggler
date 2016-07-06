// Copyright IBM Corp. 2011,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

exports.ModelBuilder = exports.LDL = require('./lib/model-builder.js').ModelBuilder;
exports.DataSource = exports.Schema = require('./lib/datasource.js').DataSource;
exports.ModelBaseClass = require('./lib/model.js');
exports.GeoPoint = require('./lib/geo.js').GeoPoint;
exports.ValidationError = require('./lib/validations.js').ValidationError;

Object.defineProperty(exports, 'version', {
  get: function() { return require('./package.json').version; },
});

var commonTest = './test/common_test';
Object.defineProperty(exports, 'test', {
  get: function() { return require(commonTest); },
});

exports.Transaction = require('loopback-connector').Transaction;
