'use strict';

const bdd = require('../helpers/bdd-if');
const helpers = require('./_helpers');
const should = require('should');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  var supportsDeleteAll = 'deleteAll' in dataSourceFactory().connector;

  bdd.describeIf(supportsDeleteAll, 'deleteAll', () => {
    let CacheItem;
    beforeEach(setupCacheItem);

    it('removes all key-value pairs for the given model', () => {
      return helpers.givenKeys(CacheItem, ['key1', 'key2'])
        .then(() => CacheItem.deleteAll())
        .then(() => CacheItem.keys())
        .then(keys => should(keys).eql([]));
    });

    it('does not remove data from other existing models', () => {
      let AnotherModel;
      return helpers.givenModel(dataSourceFactory, 'AnotherModel')
        .then(ModelCtor => AnotherModel = ModelCtor)
        .then(() => helpers.givenKeys(CacheItem, ['key1', 'key2']))
        .then(() => helpers.givenKeys(AnotherModel, ['key3', 'key4']))
        .then(() => CacheItem.deleteAll())
        .then(() => AnotherModel.keys())
        .then(keys => should(keys.sort()).eql(['key3', 'key4']));
    });

    function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor);
    }
  });
};
