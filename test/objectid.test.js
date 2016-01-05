var MongoObjId = require('mongodb').ObjectId;
var ObjectId = require('../lib/objectid').ObjectId;

describe('ObjectId', function() {
  context('Constructor', function() {
    it('should allow 12 byte strings', function() {
      var str = 'hello1hello1';

      var objId = new ObjectId(str);

      objId.should.be.an.instanceof(ObjectId);
      objId.toString().should.be.type('string');
      // 12 byte strings are coerced into 24 character hex strings
      objId.toString().should.have.length(24);
    });

    it('should allow 24 character hex strings', function() {
      var hexStr = '507f191e810c19729de860ea';

      var objId = new ObjectId(hexStr);

      objId.should.be.an.instanceof(ObjectId);
      objId.toHexString().should.equal(hexStr);
    });

    it('should allow ObjectId', function() {
      var existingObjId = new ObjectId();

      var objId = new ObjectId(existingObjId);

      objId.should.be.an.instanceof(ObjectId);
      objId.valueOf().should.equal(existingObjId.valueOf());
    });

    it('should allow MongoDB ObjectIds', function() {
      var objId = new ObjectId(new MongoObjId());

      objId.should.be.an.instanceof(ObjectId);
    });

    it('should not allow invalid data types', function() {
      var fn = function() {};
      [
        true,
        {},
        fn
      ].forEach(function(invalidDataType) {
        (function() {
          new ObjectId(invalidDataType);
        }).should.throw();
      });
    });
  });

  context('toString', function() {
    it('should be serializable', function() {
      var objId = new ObjectId();

      objId.toString().should.be.type('string');
    });
  });
});
