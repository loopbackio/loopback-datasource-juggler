// Copyright IBM Corp. 2017,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  const supportsDelete = 'delete' in dataSourceFactory().connector;

  bdd.describeIf(supportsDelete, 'delete', () => {
    let CacheItem;
    beforeEach(setupCacheItem);

    it('removes the key-value pair for the given key', () => {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.delete('key1'))
        .then(() => CacheItem.keys())
        .then((keys) => {
          keys.should.eql(['key2']);
        });
    });

    function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor);
    }
  });
};
