// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const DataSource = require('..').DataSource;
const should = require('should');

describe('allowExtendedOperators', () => {
  function createTestModel(connectorSettings, modelSettings) {
    const ds = createTestDataSource(connectorSettings);
    const TestModel = ds.createModel('TestModel', {value: String}, modelSettings);

    TestModel.observe('persist', function(ctx, next) {
      ctx.Model.lastPersistedData = ctx.data;
      next();
    });

    return TestModel;
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

  function extendedQuery() {
    // datasource modifies the query,
    // we have to build a new object for each test
    return {where: {value: {$exists: true}}};
  }

  function setCustomData() {
    return {$set: {value: 'changed'}};
  }

  function updateShouldHaveFailed() {
    throw new Error('updateAttributes() should have failed.');
  }

  class TestConnector {
    constructor(dataSource) {
    }

    create(model, data, options, callback) {
      callback();
    }

    updateAttributes(model, id, data, options, callback) {
      callback();
    }

    all(model, filter, options, callback) {
      // return the raw "value" query
      let instanceFound = {
        value: filter.where.value,
      };
      callback(null, [instanceFound]);
    }
  }

  describe('dataSource.settings.allowExtendedOperators', () => {
    context('DAO.find()', () => {
      it('converts extended operators to string value by default', () => {
        const TestModel = createTestModel();
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('preserves extended operators with allowExtendedOperators set', () => {
        const TestModel = createTestModel({allowExtendedOperators: true});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`Model.settings.allowExtendedOperators` override data source settings - ' +
        'converts extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: true}, {allowExtendedOperators: false});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`Model.settings.allowExtendedOperators` override data source settings - ' +
        'preserves extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: false}, {allowExtendedOperators: true});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`options.allowExtendedOperators` override data source settings - ' +
        'converts extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: true});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: false}).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`options.allowExtendedOperators` override data source settings - ' +
        'preserves extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: false});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: true}).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });
    });

    context('DAO.updateAttributes()', () => {
      it('`options.allowExtendedOperators` override data source settings - disable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: false}, {strict: true});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData(), {allowExtendedOperators: true})
            .then(() => {
              should(TestModel.lastPersistedData).eql(setCustomData());
            });
        });
      });

      it('`options.allowExtendedOperators` override data source settings - enable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: true}, {strict: true});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData(), {allowExtendedOperators: false})
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });

      it('`Model.settings.allowExtendedOperators` override data source settings - ' +
        'disable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: false},
          {strict: true, allowExtendedOperators: true});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData()).then(() => {
            should(TestModel.lastPersistedData).eql(setCustomData());
          });
        });
      });

      it('`Model.settings.allowExtendedOperators` override data source settings - ' +
        'enable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: true},
          {strict: true, allowExtendedOperators: false});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData())
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });
    });
  });

  describe('Model.settings.allowExtendedOperators', () => {
    context('DAO.find()', () => {
      it('preserves extended operators with allowExtendedOperators set', () => {
        const TestModel = createTestModel({}, {allowExtendedOperators: true});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor Model settings - ' +
        'converts extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: true}, {allowExtendedOperators: false});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor Model settings - ' +
        'preserves extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: false}, {allowExtendedOperators: true});
        return TestModel.find(extendedQuery()).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`options.allowExtendedOperators` override Model settings - converts extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: true});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: false}).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`options.allowExtendedOperators` Model settings - preserves extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: false});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: true}).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });
    });

    context('DAO.updateAttributes()', () => {
      it('`options.allowExtendedOperators` override Model settings - disable strict check', () => {
        const TestModel = createTestModel({}, {strict: true, allowExtendedOperators: false});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData(), {allowExtendedOperators: true})
            .then(() => {
              should(TestModel.lastPersistedData).eql(setCustomData());
            });
        });
      });

      it('`options.allowExtendedOperators` override Model settings - enabled strict check', () => {
        const TestModel = createTestModel({}, {strict: true, allowExtendedOperators: true});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData(), {allowExtendedOperators: false})
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor Model settings - disable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: false},
          {strict: true, allowExtendedOperators: true});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData()).then(() => {
            should(TestModel.lastPersistedData).eql(setCustomData());
          });
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor Model settings - ' +
        'enable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: true},
          {strict: true, allowExtendedOperators: false});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData())
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });
    });
  });

  describe('options.allowExtendedOperators', () => {
    context('DAO.find()', () => {
      it('preserves extended operators with allowExtendedOperators set', () => {
        const TestModel = createTestModel();
        return TestModel.find(extendedQuery(), {allowExtendedOperators: true}).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor options settings - ' +
        'converts extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: true});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: false}).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor options settings - ' +
        'preserves extended operators', () => {
        const TestModel = createTestModel({allowExtendedOperators: false});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: true}).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });

      it('`Model.settings.allowExtendedOperators` honor options settings - ' +
        'converts extended operators', () => {
        const TestModel = createTestModel({}, {allowExtendedOperators: true});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: false}).then((results) => {
          should(results[0].value).eql('[object Object]');
        });
      });

      it('`Model.settings.allowExtendedOperators` honor options settings - ' +
        'preserves extended operators', () => {
        const TestModel = createTestModel({}, {allowExtendedOperators: false});
        return TestModel.find(extendedQuery(), {allowExtendedOperators: true}).then((results) => {
          should(results[0].value).eql({$exists: true});
        });
      });
    });

    context('DAO.updateAttributes()', () => {
      it('`Model.settings.allowExtendedOperators` honor options settings - disable strict check', () => {
        const TestModel = createTestModel({}, {strict: true, allowExtendedOperators: false});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData(), {allowExtendedOperators: true})
            .then(() => {
              should(TestModel.lastPersistedData).eql(setCustomData());
            });
        });
      });

      it('`Model.settings.allowExtendedOperators` honor options settings - enable strict check', () => {
        const TestModel = createTestModel({}, {strict: true, allowExtendedOperators: true});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData(), {allowExtendedOperators: false})
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor options settings - disable strict check', () => {
        const TestModel = createTestModel({}, {strict: true});
        return TestModel.create({value: 'test'}).then((instance) => {
          return instance.updateAttributes(setCustomData(), {allowExtendedOperators: true})
            .then(() => {
              should(TestModel.lastPersistedData).eql(setCustomData());
            });
        });
      });

      it('`dataSource.settings.allowExtendedOperators` honor options settings - enable strict check', () => {
        const TestModel = createTestModel({allowExtendedOperators: true}, {strict: true});
        return TestModel.create({value: 'test'}).then((inst) => {
          return inst.updateAttributes(setCustomData(), {allowExtendedOperators: false})
            .then(updateShouldHaveFailed, function onError(err) {
              should.exist(err);
              should(err.name).equal('ValidationError');
            });
        });
      });
    });
  });
});
