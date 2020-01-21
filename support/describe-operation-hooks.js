// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

/*
 * Describe context objects of operation hooks in comprehensive HTML table.
 * Usage:
 *  $ node support/describe-operation-hooks.js > hooks.html
 *  $ open hooks.hml
 *
 */
const Promise = global.Promise = require('bluebird');
const DataSource = require('../').DataSource;
const Memory = require('../lib/connectors/memory').Memory;

const HOOK_NAMES = [
  'access',
  'before save', 'persist', 'loaded', 'after save',
  'before delete', 'after delete',
];

const dataSources = [
  createOptimizedDataSource(),
  createUnoptimizedDataSource(),
];

const observedContexts = [];
let lastId = 0;

Promise.onPossiblyUnhandledRejection(function(err) {
  console.error('POSSIBLY UNHANDLED REJECTION', err.stack);
});

/* eslint-disable camelcase */
const operations = [
  function find(ds) {
    return ds.TestModel.find({where: {id: '1'}});
  },

  function count(ds) {
    return ds.TestModel.count({id: ds.existingInstance.id});
  },

  function create(ds) {
    return ds.TestModel.create({name: 'created'});
  },

  function findOrCreate_found(ds) {
    return ds.TestModel.findOrCreate(
      {where: {name: ds.existingInstance.name}},
      {name: ds.existingInstance.name},
    );
  },

  function findOrCreate_create(ds) {
    return ds.TestModel.findOrCreate(
      {where: {name: 'new-record'}},
      {name: 'new-record'},
    );
  },

  function updateOrCreate_create(ds) {
    return ds.TestModel.updateOrCreate({id: 'not-found', name: 'not found'});
  },

  function updateOrCreate_update(ds) {
    return ds.TestModel.updateOrCreate(
      {id: ds.existingInstance.id, name: 'new name'},
    );
  },

  function replaceOrCreate_create(ds) {
    return ds.TestModel.replaceOrCreate({id: 'not-found', name: 'not found'});
  },

  function replaceOrCreate_update(ds) {
    return ds.TestModel.replaceOrCreate(
      {id: ds.existingInstance.id, name: 'new name'},
    );
  },

  function replaceById(ds) {
    return ds.TestModel.replaceById(
      ds.existingInstance.id,
      {name: 'new name'},
    );
  },

  function updateAll(ds) {
    return ds.TestModel.updateAll({name: 'searched'}, {name: 'updated'});
  },

  function prototypeSave(ds) {
    ds.existingInstance.name = 'changed';
    return ds.existingInstance.save();
  },

  function prototypeUpdateAttributes(ds) {
    return ds.existingInstance.updateAttributes({name: 'changed'});
  },

  function prototypeDelete(ds) {
    return ds.existingInstance.delete();
  },

  function deleteAll(ds) {
    return ds.TestModel.deleteAll({name: ds.existingInstance.name});
  },
];
/* eslint-enable camelcase */

let p = setupTestModels();
operations.forEach(function(op) {
  p = p.then(runner(op));
});

p.then(report, function(err) { console.error(err.stack); });

function createOptimizedDataSource() {
  const ds = new DataSource({connector: Memory});
  ds.name = 'Optimized';
  return ds;
}

function createUnoptimizedDataSource() {
  const ds = new DataSource({connector: Memory});
  ds.name = 'Unoptimized';

  // disable optimized methods
  ds.connector.updateOrCreate = false;
  ds.connector.findOrCreate = false;
  ds.connector.replaceOrCreate = false;

  return ds;
}

function setupTestModels() {
  dataSources.forEach(function setupOnDataSource(ds) {
    const TestModel = ds.TestModel = ds.createModel('TestModel', {
      id: {type: String, id: true, default: uid},
      name: {type: String, required: true},
      extra: {type: String, required: false},
    });
  });
  return Promise.resolve();
}

function uid() {
  lastId += 1;
  return '' + lastId;
}

function runner(fn) {
  return function() {
    let res = Promise.resolve();
    dataSources.forEach(function(ds) {
      res = res.then(function() {
        return resetStorage(ds);
      }).then(function() {
        observedContexts.push({
          operation: fn.name,
          connector: ds.name,
          hooks: {},
        });
        return fn(ds);
      });
    });
    return res;
  };
}

function resetStorage(ds) {
  const TestModel = ds.TestModel;
  HOOK_NAMES.forEach(function(hook) {
    TestModel.clearObservers(hook);
  });
  return TestModel.deleteAll()
    .then(function() {
      return TestModel.create({name: 'first'});
    })
    .then(function(instance) {
      // Look it up from DB so that default values are retrieved
      return TestModel.findById(instance.id);
    })
    .then(function(instance) {
      ds.existingInstance = instance;
      return TestModel.create({name: 'second'});
    })
    .then(function() {
      HOOK_NAMES.forEach(function(hook) {
        TestModel.observe(hook, function(ctx, next) {
          const row = observedContexts[observedContexts.length - 1];
          row.hooks[hook] = Object.keys(ctx);
          next();
        });
      });
    });
}

function report() {
  console.log('<style>');
  console.log('td { font-family: "monospace": }');
  console.log('td, th {');
  console.log('  vertical-align: text-top;');
  console.log('  padding: 0.5em;');
  console.log('  border-bottom: 1px solid gray;');
  console.log('</style>');

  // merge rows where Optimized and Unoptimized produce the same context
  observedContexts.forEach(function(row, ix) {
    if (!ix) return;
    const last = observedContexts[ix - 1];
    if (row.operation != last.operation) return;
    if (JSON.stringify(row.hooks) !== JSON.stringify(last.hooks)) return;
    last.merge = true;
    row.skip = true;
  });

  console.log('<!-- ==== BEGIN DATA ==== -->\n');
  console.log('<table><thead><tr>\n  <th></th>');
  HOOK_NAMES.forEach(function(h) { console.log('  <th>' + h + '</th>'); });
  console.log('</tr></thead><tbody>');

  observedContexts.forEach(function(row) {
    if (row.skip) return;
    let caption = row.operation;
    if (!row.merge) caption += ' (' + row.connector + ')';
    console.log('<tr><th>' + caption + '</th>');
    HOOK_NAMES.forEach(function(h) {
      const text = row.hooks[h] ? row.hooks[h].join('<br/>') : '';
      console.log('  <td>' + text + '</td>');
    });
    console.log('</tr>');
  });
  console.log('</table>');
}
