// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

const fmt = require('util').format;

exports.describeIf = function describeIf(cond, name, fn) {
  if (cond)
    describe(name, fn);
  else {
    describe.skip(fmt('[UNSUPPORTED] - %s', name), fn);
  }
};

exports.itIf = function itIf(cond, name, fn) {
  if (cond)
    it(name, fn);
  else {
    it.skip(fmt('[UNSUPPORTED] - %s', name), fn);
  }
};
