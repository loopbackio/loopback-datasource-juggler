// This test written in mocha+should.js
var should = require('./init.js');

var db, User, Post, Passport, City, Street, Building, Assembly, Part;

describe('include', function () {

  before(setup);

  it('should fetch belongsTo relation', function (done) {
    Passport.find({include: 'owner'}, function (err, passports) {
      passports.length.should.be.ok;
      passports.forEach(function (p) {
        p.__cachedRelations.should.have.property('owner');

        // The relation should be promoted as the 'owner' property
        p.should.have.property('owner');
        // The __cachedRelations should be removed from json output
        p.toJSON().should.not.have.property('__cachedRelations');

        var owner = p.__cachedRelations.owner;
        if (!p.ownerId) {
          should.not.exist(owner);
        } else {
          should.exist(owner);
          owner.id.should.equal(p.ownerId);
        }
      });
      done();
    });
  });

  it('should fetch hasMany relation', function (done) {
    User.find({include: 'posts'}, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function (u) {
        // The relation should be promoted as the 'owner' property
        u.should.have.property('posts');
        // The __cachedRelations should be removed from json output
        u.toJSON().should.not.have.property('__cachedRelations');

        u.__cachedRelations.should.have.property('posts');
        u.__cachedRelations.posts.forEach(function (p) {
          p.userId.should.equal(u.id);
        });
      });
      done();
    });
  });

  it('should fetch Passport - Owner - Posts', function (done) {
    Passport.find({include: {owner: 'posts'}}, function (err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      passports.forEach(function (p) {
        p.__cachedRelations.should.have.property('owner');

        // The relation should be promoted as the 'owner' property
        p.should.have.property('owner');
        // The __cachedRelations should be removed from json output
        p.toJSON().should.not.have.property('__cachedRelations');

        var user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          should.not.exist(user);
        } else {
          should.exist(user);
          user.id.should.equal(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.should.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp) {
            pp.userId.should.equal(user.id);
          });
        }
      });
      done();
    });
  });

  it('should fetch Passports - User - Posts - User', function (done) {
    Passport.find({
      include: {owner: {posts: 'author'}}
    }, function (err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      passports.forEach(function (p) {
        p.__cachedRelations.should.have.property('owner');
        var user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          should.not.exist(user);
        } else {
          should.exist(user);
          user.id.should.equal(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp) {
            pp.userId.should.equal(user.id);
            pp.should.have.property('author');
            pp.__cachedRelations.should.have.property('author');
            var author = pp.__cachedRelations.author;
            author.id.should.equal(user.id);
          });
        }
      });
      done();
    });
  });

  it('should fetch User - Posts AND Passports', function (done) {
    User.find({include: ['posts', 'passports']}, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function (user) {
        // The relation should be promoted as the 'owner' property
        user.should.have.property('posts');
        user.should.have.property('passports');

        var userObj = user.toJSON();
        userObj.should.have.property('posts');
        userObj.should.have.property('passports');
        userObj.posts.should.be.an.instanceOf(Array);
        userObj.passports.should.be.an.instanceOf(Array);

        // The __cachedRelations should be removed from json output
        userObj.should.not.have.property('__cachedRelations');

        user.__cachedRelations.should.have.property('posts');
        user.__cachedRelations.should.have.property('passports');
        user.__cachedRelations.posts.forEach(function (p) {
          p.userId.should.equal(user.id);
        });
        user.__cachedRelations.passports.forEach(function (pp) {
          pp.ownerId.should.equal(user.id);
        });
      });
      done();
    });
  });

  it('should support hasAndBelongsToMany', function (done) {

    Assembly.destroyAll(function(err) {
      Part.destroyAll(function(err) {
        Assembly.relations.parts.modelThrough.destroyAll(function(err) {
        Assembly.create({name: 'car'}, function (err, assembly) {
          Part.create({partNumber: 'engine'}, function (err, part) {
            assembly.parts.add(part, function (err, data) {
              assembly.parts(function (err, parts) {
                should.not.exist(err);
                should.exists(parts);
                parts.length.should.equal(1);
                parts[0].partNumber.should.equal('engine');

                // Create a part
                assembly.parts.create({partNumber: 'door'}, function (err, part4) {

                  Assembly.find({include: 'parts'}, function (err, assemblies) {
                    assemblies.length.should.equal(1);
                    assemblies[0].parts.length.should.equal(2);
                    done();
                  });

                });
              });
            });
          });
        });
        });
      });
    });
  });

});

function setup(done) {
  db = getSchema();
  City = db.define('City');
  Street = db.define('Street');
  Building = db.define('Building');
  User = db.define('User', {
    name: String,
    age: Number
  });
  Passport = db.define('Passport', {
    number: String
  });
  Post = db.define('Post', {
    title: String
  });

  Passport.belongsTo('owner', {model: User});
  User.hasMany('passports', {foreignKey: 'ownerId'});
  User.hasMany('posts', {foreignKey: 'userId'});
  Post.belongsTo('author', {model: User, foreignKey: 'userId'});

  Assembly = db.define('Assembly', {
    name: String
  });

  Part = db.define('Part', {
    partNumber: String
  });

  Assembly.hasAndBelongsToMany(Part);
  Part.hasAndBelongsToMany(Assembly);

  db.automigrate(function () {
    var createdUsers = [];
    var createdPassports = [];
    var createdPosts = [];
    createUsers();
    function createUsers() {
      clearAndCreate(
        User,
        [
          {name: 'User A', age: 21},
          {name: 'User B', age: 22},
          {name: 'User C', age: 23},
          {name: 'User D', age: 24},
          {name: 'User E', age: 25}
        ],
        function (items) {
          createdUsers = items;
          createPassports();
        }
      );
    }

    function createPassports() {
      clearAndCreate(
        Passport,
        [
          {number: '1', ownerId: createdUsers[0].id},
          {number: '2', ownerId: createdUsers[1].id},
          {number: '3'}
        ],
        function (items) {
          createdPassports = items;
          createPosts();
        }
      );
    }

    function createPosts() {
      clearAndCreate(
        Post,
        [
          {title: 'Post A', userId: createdUsers[0].id},
          {title: 'Post B', userId: createdUsers[0].id},
          {title: 'Post C', userId: createdUsers[0].id},
          {title: 'Post D', userId: createdUsers[1].id},
          {title: 'Post E'}
        ],
        function (items) {
          createdPosts = items;
          done();
        }
      );
    }

  });
}

function clearAndCreate(model, data, callback) {
  var createdItems = [];
  model.destroyAll(function () {
    nextItem(null, null);
  });

  var itemIndex = 0;

  function nextItem(err, lastItem) {
    if (lastItem !== null) {
      createdItems.push(lastItem);
    }
    if (itemIndex >= data.length) {
      callback(createdItems);
      return;
    }
    model.create(data[itemIndex], nextItem);
    itemIndex++;
  }
}
