// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var lastId = 0;

exports.next = function() {
  lastId++;
  return exports.last();
};

exports.last = function() {
  return '' + lastId;
};

exports.reset = function() {
  lastId = 0;
};
