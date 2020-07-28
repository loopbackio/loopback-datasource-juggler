// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// A test file to verify types described by our .d.ts files.
// The code in this file is only compiled, we don't run it via Mocha.

import {
  DataSource,
  KeyValueModel,
  ModelBase,
  ModelBaseClass,
  PersistedModel,
  PersistedModelClass,
} from '..';

const db = new DataSource('db', {connector: 'memory'});

//-------
// ModelBase should provide ObserverMixin APIs as static methods
//-------
//
(function() {
  const Data = db.createModel('Data');

  // An operation hook can be installed
  Data.observe('before save', async ctx => {});

  // Context is typed and provides `Model` property
  Data.observe('before save', async ctx => {
    console.log(ctx.Model.modelName);
  });

  // ModelBaseClass can be assigned to `typeof ModelBase`
  // Please note that both `ModelBaseClass` and typeof ModelBase`
  // are different ways how to describe a class constructor of a model.
  // In this test we are verifying that the value returned by `createModel`
  // can be assigned to both types.
  const modelTypeof: typeof ModelBase = Data;
  const modelCls: ModelBaseClass = modelTypeof;
});

//-------
// PersistedModel should provide ObserverMixin APIs as static methods
//-------
(function () {
  const Product = db.createModel<PersistedModelClass>(
    'Product',
    {name: String},
    {strict: true}
  );

  // It accepts async function
  Product.observe('before save', async ctx => {});

  // It accepts callback-based function
  Product.observe('before save', (ctx, next) => {
    next(new Error('test error'));
  });

  // ctx.Model is a PersistedModel class constructor
  Product.observe('before save', async ctx => {
    await ctx.Model.findOne();
  });

  // PersistedModelClass can be assigned to `typeof PersistedModel`
  // Please note that both `PersistedModelClass` and typeof PersistedModel`
  // are different ways how to describe a class constructor of a model.
  // In this test we are verifying that the value returned by `createModel`
  // can be assigned to both types.
  const modelTypeof: typeof PersistedModel = Product;
  const modelCls: PersistedModelClass = modelTypeof;
});

//-------
// KeyValueModel should provide ObserverMixin APIs as static methods
//-------
(function () {
  const kvdb = new DataSource({connector: 'kv-memory'});
  const CacheItem = kvdb.createModel<typeof KeyValueModel>('CacheItem');

  // An operation hook can be installed
  CacheItem.observe('before save', async ctx => {});

  // ctx.Model is a KeyValueModel class constructor
  CacheItem.observe('before save', async ctx => {
    await ctx.Model.expire('key', 100);
  });
});

//-------
// DataSource supports different `execute` styles
//-------
(async function () {
  // SQL style
  const tx = await db.beginTransaction();
  await db.execute('SELECT * FROM Product WHERE count > ?', [10], {
    transaction: tx,
  });
  await tx.commit();

  // MongoDB style
  await db.execute('MyCollection', 'aggregate', [
    {$lookup: { /* ... */ }},
    {$unwind: '$data'},
    {$out: 'tempData'}
  ]);

  // Neo4J style
  await db.execute({
    query: 'MATCH (u:User {email: {email}}) RETURN u',
    params: {
      email: 'alice@example.com',
    },
  });
});
