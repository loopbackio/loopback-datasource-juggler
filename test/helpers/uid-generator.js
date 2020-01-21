// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

let lastId = 0;

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

exports.fromConnector = function(db) {
  return (db && db.connector && db.connector.generateUniqueId) ?
    db.connector.generateUniqueId() : null;
};
