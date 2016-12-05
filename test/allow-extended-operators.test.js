// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const DataSource = require('..').DataSource;
const should = require('should');

describe('Model.settings.allowExtendedOperators', () => {
  context('DAO.find()', () => {
    it('converts extended operators to string value by default', () => {
      const TestModel = createTestModel();
      return TestModel.find(extendedQuery()).then((results) => {
        should(results[0].value).eql('[object Object]');
      });
    });

    it('preserves extended operators wit allowExtendedOperators set', () => {
      const TestModel = createTestModel({allowExtendedOperators: true});
      return TestModel.find(extendedQuery()).then((results) => {
        should(results[0].value).eql({$exists: true});
      });
    });

    function extendedQuery() {
      // datasource modifies the query,
      // we have to build a new object for each test
      return {where: {value: {$exists: true}}};
    }
  });

  function createTestModel(connectorSettings) {
    const ds = createTestDataSource(connectorSettings);
    return ds.createModel('TestModel', {value: String});
  }

  function createTestDataSource(connectorSettings) {
    connectorSettings = connectorSettings || {};
    connectorSettings.connector = {
      initialize: (dataSource, cb) => {
        dataSource.connector = new TestConnector(dataSource);
      },
    };

    return new DataSource(connectorSettings);
  }

  class TestConnector {
    constructor(dataSource) {
    }

    all(model, filter, options, callback) {
      // return the raw "value" query
      var instanceFound = {
        value: filter.where.value,
      };
      callback(null, [instanceFound]);
    }
  }
});
