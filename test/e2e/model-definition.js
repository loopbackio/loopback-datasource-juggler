var DataSource = require('../..').DataSource;
var ObjectId = require('../../lib/objectid');
var should = require('should');

describe('model definition', function() {
  context('ObjectId definition', function() {
    var Todo;

    before(function setup() {
      var ds = new DataSource();
      Todo = ds.define('Todo', {
        id: {type: 'ObjectId', id: true}
      });
    });

    it('should allow 12 byte strings', function() {
      var todo = new Todo({id: 'hello1hello1'});

      todo.id.should.be.an.instanceof(ObjectId);
      // 12 byte strings are coerced into 24 character hex strings
      todo.id.toString().should.have.length(24);
    });

    it('should allow 24 character hex strings', function() {
      var hexStr = '507f191e810c19729de860ea';

      var todo = new Todo({id: hexStr});

      todo.id.should.be.an.instanceof(ObjectId);
      todo.id.toString().should.equal(hexStr);
    });

    it('should allow ObjectIds', function() {
      var objId = new ObjectId();

      var todo = new Todo({id: objId});

      todo.id.should.be.an.instanceof(ObjectId);
      todo.id.toString().should.equal(objId.toString());
    });
  });

  context('ObjectID (alias) definition', function() {
    var Todo;

    before(function setup() {
      var ds = new DataSource();
      Todo = ds.define('Todo', {
        id: {type: 'ObjectID', id: true}
      });
    });

    it('should work', function() {
      var todo = new Todo({id: 'hello1hello1'});

      todo.id.should.be.an.instanceof(ObjectId);
    });
  });
});
