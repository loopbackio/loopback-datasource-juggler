'use strict';

describe('DataAccessObject.find with referencesMany relations', function() {
  let db, Post, Tag;

  before(function() {
    /* global getSchema:false, connectorCapabilities:false */
    db = getSchema();

    Tag = db.define('Tag', {
      id: {type: Number, id: true},
      name: String,
    });

    Post = db.define('Post', {
      id: {type: Number, id: true},
      title: String,
      tagIds: {type: Array, sqliteType: 'JSON'},
    }, {
      relations: {
        tags: {
          type: 'referencesMany',
          model: 'Tags',
          keyFrom: 'tagIds',
        },
      },
    });
  });

  beforeEach(async function() {
    await db.automigrate();
  });

  it('mutates {inq: [...] } to {jsonContains: [...] } for referencesMany keyFrom fields', async function() {
    const connector = db.connector;
    let interceptedQuery;

    // Stub connector.all to inspect the processed query
    connector.all = function(model, query, options, cb) {
      interceptedQuery = query;
      cb(null, []);
    };

    const query = {where: {tagIds: {inq: [1, 2]}}};

    await Post.find(query, {model: Post});
    interceptedQuery.should.deepEqual({where: {tagIds: {jsonContains: [1, 2]}}});
  });

  it('does not mutate non-inq operators on referencesMany keyFrom fields', async function() {
    const connector = db.connector;
    let interceptedQuery;

    connector.all = function(model, query, options, cb) {
      interceptedQuery = query;
      cb(null, []);
    };

    const query = {where: {tagIds: {eq: [1, 2]}}};

    await Post.find(query, {model: Post});

    interceptedQuery.should.deepEqual({where: {tagIds: {eq: [1, 2]}}});
  });

  it('handles queries without options.model gracefully without throwing', async function() {
    const connector = db.connector;
    let interceptedQuery;

    connector.all = function(model, query, options, cb) {
      interceptedQuery = query;
      cb(null, []);
    };

    const query = {where: {tagIds: {inq: [1, 2]}}};

    // Calling without options.model
    await Post.find(query);

    interceptedQuery.should.deepEqual({where: {tagIds: {jsonContains: [1, 2]}}});
  });
});
