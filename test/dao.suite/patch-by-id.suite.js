// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function(dataSource, should, connectorCapabilities) {
  describe('patchById', function() {
    var personId, Person, StubUser;
    before(function setupDatabase(done) {
      Person = dataSource.define('Person', {
        name: String,
        age: { type: Number, index: true },
      }, { forceId: true, strict: true });
      // A simplified implementation of LoopBack's User model
      StubUser = dataSource.createModel('StubUser', { password: String }, { forceId: true });
      StubUser.setter.password = function(plain) {
        var hashed = false;
        if (!plain) return;
        var pos = plain.indexOf('-');
        if (pos !== -1) {
          var head = plain.substr(0, pos);
          var tail = plain.substr(pos + 1, plain.length);
          hashed = head.toUpperCase() === tail;
        }
        if (hashed) return;
        this.$password = plain + '-' + plain.toUpperCase();
      };

      dataSource.automigrate(['Person', 'StubUser'], done);
    });

    beforeEach(function setupData(done) {
      Person.destroyAll(function() {
        Person.create({ name: 'Mary', age: 15 }, function(err, p) {
          if (err) return done(err);
          personId = p.id;
          done();
        });
      });
    });

    // TODO: Please see loopback-datasource-juggler/issues#912
    it.skip('should have updated password hashed with patchById',
    function(done) {
      StubUser.create({ password: 'foo' }, function(err, created) {
        if (err) return done(err);
        StubUser.patchById(created.id, { 'password': 'test' }, function(err, info) {
          if (err) return done(err);
          StubUser.findById(created.id, function(err, found) {
            if (err) return done(err);
            found.password.should.equal('test-TEST');
            done();
          });
        });
      });
    });

    it('should ignore undefined values on patchById', function(done) {
      Person.patchById(personId, { 'name': 'John', age: undefined },
        function(err, info) {
          if (err) return done(err);
          Person.findById(personId, function(e, p) {
            if (e) return done(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should ignore unknown attributes when strict: true', function(done) {
      Person.patchById(personId, { name: 'John', foo: 'bar' },
        function(err, p) {
          if (err) return done(err);
          should.not.exist(p.foo);
          Person.findById(personId, function(e, p) {
            if (e) return done(e);
            should.not.exist(p.foo);
            done();
          });
        });
    });

    // TODO: skiping for now; for some reason`var strict = this.__strict;`
    // in patch-by-id.js is not working in `patch-by-id.js`
    it('should throw error on unknown attributes when strict: throw', function(done) {
      Person.definition.settings.strict = 'throw';
      Person.findById(personId, function(err, p) {
        Person.patchById(personId, { foo: 'bar' },
          function(err, info) {
            should.exist(err);
            err.name.should.equal('Error');
            err.message.should.equal('Unknown property: foo');
            should.not.exist(info);
            Person.findById(personId, function(e, p) {
              if (e) return done(e);
              should.not.exist(p.foo);
              done();
            });
          });
      });
    });

    it('should throw error on unknown attributes when strict: validate', function(done) {
      Person.definition.settings.strict = 'validate';
      Person.findById(personId, function(err, p) {
        Person.patchById(personId, { foo: 'bar' },
          function(err, info) {
            should.exist(err);
            err.name.should.equal('ValidationError');
            err.message.should.containEql('`foo` is not defined in the model');
            Person.findById(personId, function(e, p) {
              if (e) return done(e);
              should.not.exist(p.foo);
              done();
            });
          });
      });
    });

    it('should allow same id value on patchById', function(done) {
      Person.patchById(personId, { id: personId, name: 'John' },
        function(err, info) {
          if (err) return done(err);
          Person.findById(personId, function(e, p) {
            if (e) return done(e);
            p.name.should.equal('John');
            p.age.should.equal(15);
            done();
          });
        });
    });

    it('should allow same stringified id value on patchById',
      function(done) {
        var pid = personId;
        if (typeof pid === 'object' || typeof pid === 'number') {
          // For example MongoDB ObjectId
          pid = pid.toString();
        }
        Person.patchById(pid, { id: pid, name: 'John' },
          function(err, info) {
            if (err) return done(err);
            Person.findById(personId, function(e, p) {
              if (e) return done(e);
              p.name.should.equal('John');
              p.age.should.equal(15);
              done();
            });
          });
      });

    it('should fail if an id value is to be changed on patchById',
      function(done) {
        Person.patchById(personId, { id: personId + 1, name: 'John' },
        function(err, info) {
          should.exist(err);
          done();
        });
      });

    it.skip('should allow model instance on patchById', function(done) {
      // QUESTION-test[1]: Can we pass undefined here and should we remove undefined in the method?
      // Please see the other comment in patch-by-id.js
      Person.patchById(personId, new Person({ 'name': 'John', age: undefined }),
       function(err, info) {
         if (err) return done(err);
         Person.findById(personId, function(e, p) {
           if (e) return done(e);
           p.name.should.equal('John');
           p.age.should.equal(15);
           done();
         });
       });
    });

    it('should allow model instance on patchById (promise variant)', function(done) {
      Person.patchById(personId, { 'name': 'Jane' })
        .then(function(info) {
          return Person.findById(personId)
            .then(function(p) {
              p.name.should.equal('Jane');
              p.age.should.equal(15);
              done();
            });
        })
        .catch(done);
    });
  });
};
