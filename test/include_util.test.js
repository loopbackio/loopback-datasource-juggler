var assert = require("assert");
var should = require("should");

var includeUtils = require("../lib/include_utils");

describe('include_util', function(){
  describe('#buildOneToOneIdentityMap', function(){
    it('should return an object with keys', function(){
      var objs = [
          {id: 11, letter: "A"},
          {id: 22, letter: "B"}
      ];
      var result = includeUtils.buildOneToOneIdentityMap(objs, "id");
      result.should.be.an.instanceOf(Object);
      result.should.have.property("11");
      result.should.have.property("22");
    });

    it('should overwrite keys in case of collision', function(){
        var objs = [
            {id: 11, letter: "A"},
            {id: 22, letter: "B"},
            {id: 33, letter: "C"},
            {id: 11, letter: "HA!"}
        ];

        var result = includeUtils.buildOneToOneIdentityMap(objs, "id");
        result.should.be.an.instanceOf(Object);
        result.should.have.keys("11", "22", "33");
        result["11"]["letter"].should.equal("HA!");
        result["33"]["letter"].should.equal("C");
    });
  });

  describe('#buildOneToOneIdentityMapWithOrigKeys', function(){
    it('should return an object with keys', function(){
      var objs = [
        {id: 11, letter: "A"},
        {id: 22, letter: "B"}
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, "id");
      result.should.be.an.instanceOf(Object);
      result.should.have.property("11");
      result.should.have.property("22");
      Object.keys(result).should.have.lengthOf(2);  // no additional properties
    });
    it('should return all stringized keys with .keys method', function(){
      var objs = [
        {id: 11, letter: "A"},
        {id: 22, letter: "B"},
        {id: "cc", letter: "C"}
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, "id");
      var keys = result.keys;
      keys.should.be.instanceOf(Array);
      keys.should.have.lengthOf(3);
      keys.should.be.eql(['11', '22', 'cc']);
    });
    it("should return all original keys with .originalKeys method", function(){
      var objs = [
        {id: 11, letter: "A"},
        {id: 22, letter: "B"},
        {id: "vv", letter: "V"}
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, "id");
      var origKeys = result.originalKeys;
      origKeys.should.be.instanceOf(Array);
      origKeys.should.have.lengthOf(3);
      origKeys.should.be.eql([11, 22, 'vv']);
    });
    it('should have .keys and .originalKeys in same order', function(){
      var objs = [
        {id: 11, letter: "A"},
        {id: 22, letter: "B"},
        {id: "vv", letter: "V"}
      ];
      var result = includeUtils.buildOneToOneIdentityMapWithOrigKeys(objs, "id");
      var keys = result.keys;
      var origKeys = result.originalKeys;
      origKeys.map(function(a){return a.toString();}).should.be.eql(keys);
    });
  });
    describe('#buildOneToManyIdentityMap', function(){
        it('should return an object with keys', function(){
            var objs = [
                {id: 11, letter: "A"},
                {id: 22, letter: "B"}
            ];
            var result = includeUtils.buildOneToManyIdentityMap(objs, "id");
            result.should.be.an.instanceOf(Object);
            result.should.have.keys("11", "22");
        });

        it('should collect keys in case of collision', function(){
            var objs = [
                {fk_id: 11, letter: "A"},
                {fk_id: 22, letter: "B"},
                {fk_id: 33, letter: "C"},
                {fk_id: 11, letter: "HA!"}
            ];

            var result = includeUtils.buildOneToManyIdentityMap(objs, "fk_id");
            result.should.be.an.instanceOf(Object);
            result.should.have.keys("11", "22", "33");
            result["11"][0]["letter"].should.equal("A");
            result["11"][1]["letter"].should.equal("HA!");
            result["33"][0]["letter"].should.equal("C");
        });
    });
});
