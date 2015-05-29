// This test written in mocha+should.js
var should = require('./init.js');
var async = require('async');
var assert = require('assert');

var DataSource = require('../').DataSource;

var db, User, Profile, AccessToken, Post, Passport, City, Street, Building, Assembly, Part;

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
          owner.id.should.eql(p.ownerId);
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
          p.userId.should.eql(u.id);
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
          user.id.should.eql(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.should.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp) {
            pp.userId.should.eql(user.id);
          });
        }
      });
      done();
    });
  });

  it('should fetch Passport - Owner - Posts - alternate syntax', function (done) {
    Passport.find({include: {owner: {relation: 'posts'}}}, function (err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      var posts = passports[0].owner().posts();
      posts.should.have.length(3);
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
          user.id.should.eql(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp) {
            pp.should.have.property('id');
            pp.userId.should.eql(user.id);
            pp.should.have.property('author');
            pp.__cachedRelations.should.have.property('author');
            var author = pp.__cachedRelations.author;
            author.id.should.eql(user.id);
          });
        }
      });
      done();
    });
  });

  it('should fetch Passports with include scope on Posts', function (done) {
    Passport.find({
      include: {owner: {relation: 'posts', scope:{
        fields: ['title'], include: ['author'],
        order: 'title DESC'
      }}}
    }, function (err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.equal(3);

      var passport = passports[0];
      passport.number.should.equal('1');
      passport.owner().name.should.equal('User A');
      var owner = passport.owner().toObject();

      var posts = passport.owner().posts();
      posts.should.be.an.array;
      posts.should.have.length(3);

      posts[0].title.should.equal('Post C');
      posts[0].should.have.property('id', undefined); // omitted
      posts[0].author().should.be.instanceOf(User);
      posts[0].author().name.should.equal('User A');

      posts[1].title.should.equal('Post B');
      posts[1].author().name.should.equal('User A');

      posts[2].title.should.equal('Post A');
      posts[2].author().name.should.equal('User A');

      done();
    });
  });

  it('should fetch Users with include scope on Posts - belongsTo', function (done) {
      Post.find({
        include: { relation: 'author', scope:{ fields: ['name'] }}
      }, function (err, posts) {
        should.not.exist(err);
        should.exist(posts);
        posts.length.should.equal(5);

        var author = posts[0].author();
        author.name.should.equal('User A');
        author.should.have.property('id');
        author.should.have.property('age', undefined);

        done();
      });
    });

  it('should fetch Users with include scope on Posts - hasMany', function (done) {
    User.find({
      include: {relation: 'posts', scope:{
        order: 'title DESC'
      }}
    }, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.equal(5);

      users[0].name.should.equal('User A');
      users[1].name.should.equal('User B');

      var posts = users[0].posts();
      posts.should.be.an.array;
      posts.should.have.length(3);

      posts[0].title.should.equal('Post C');
      posts[1].title.should.equal('Post B');
      posts[2].title.should.equal('Post A');

      var posts = users[1].posts();
      posts.should.be.an.array;
      posts.should.have.length(1);
      posts[0].title.should.equal('Post D');

      done();
    });
  });

  it('should fetch Users with include scope on Passports - hasMany', function (done) {
    User.find({
      include: {relation: 'passports', scope:{
        where: { number: '2' }
      }}
    }, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.equal(5);

      users[0].name.should.equal('User A');
      users[0].passports().should.be.empty;

      users[1].name.should.equal('User B');
      var passports = users[1].passports();
      passports[0].number.should.equal('2');

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
          p.userId.should.eql(user.id);
        });
        user.__cachedRelations.passports.forEach(function (pp) {
          pp.ownerId.should.eql(user.id);
        });
      });
      done();
    });
  });

  it('should fetch User - Posts AND Passports in relation syntax',
    function(done) {
      User.find({include: [
        {relation: 'posts', scope: {
          where: {title: 'Post A'}
        }},
        'passports'
      ]}, function(err, users) {
        should.not.exist(err);
        should.exist(users);
        users.length.should.be.ok;
        users.forEach(function(user) {
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
          user.__cachedRelations.posts.forEach(function(p) {
            p.userId.should.eql(user.id);
            p.title.should.be.equal('Post A');
          });
          user.__cachedRelations.passports.forEach(function(pp) {
            pp.ownerId.should.eql(user.id);
          });
        });
        done();
      });
    });

  it('should not fetch User - AccessTokens', function (done) {
    User.find({include: ['accesstokens']}, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function (user) {
        var userObj = user.toJSON();
        userObj.should.not.have.property('accesstokens');
      });
      done();
    });
  });

  it('should support hasAndBelongsToMany', function (done) {
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
                assemblies[0].parts().length.should.equal(2);
                done();
              });

            });
          });
        });
      });
    });
  });

  it('should fetch User - Profile (HasOne)', function (done) {
    User.find({include: ['profile']}, function (err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      var usersWithProfile = 0;
      users.forEach(function (user) {
        // The relation should be promoted as the 'owner' property
        user.should.have.property('profile');
        var userObj = user.toJSON();
        var profile = user.profile();
        if (profile) {
          profile.should.be.an.instanceOf(Profile);
          usersWithProfile++;
        }
        else {
          (profile === null).should.be.true;
        }
        // The __cachedRelations should be removed from json output
        userObj.should.not.have.property('__cachedRelations');
        user.__cachedRelations.should.have.property('profile');
        if (user.__cachedRelations.profile) {
          user.__cachedRelations.profile.userId.should.eql(user.id);
          usersWithProfile++;
        }
      });
      usersWithProfile.should.equal(2 * 2);
      done();
    });
  });


  // Not implemented correctly, see: loopback-datasource-juggler/issues/166
  // fixed by DB optimization
  it('should support include scope on hasAndBelongsToMany', function (done) {
    Assembly.find({include: { relation: 'parts', scope: {
     where: { partNumber: 'engine' }
    }}}, function (err, assemblies) {
      assemblies.length.should.equal(1);
      var parts = assemblies[0].parts();
      parts.should.have.length(1);
      parts[0].partNumber.should.equal('engine');
      done();
    });
  });

  describe('performance', function () {
    var all;
    beforeEach(function() {
      this.called = 0;
      var self = this;
      all = db.connector.all;
      db.connector.all = function(model, filter, options, cb) {
        self.called++;
        return all.apply(db.connector, arguments);
      };
    });
    afterEach(function() {
      db.connector.all = all;
    });
    it('including belongsTo should make only 2 db calls', function (done) {
      var self = this;
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
            owner.id.should.eql(p.ownerId);
          }
        });
        self.called.should.eql(2);
        done();
      });
    });

    it('including hasManyThrough should make only 3 db calls', function (done) {
      var self = this;
      Assembly.create([{name: 'sedan'}, {name: 'hatchback'},
          {name: 'SUV'}],
        function (err, assemblies) {
          Part.create([{partNumber: 'engine'}, {partNumber: 'bootspace'},
              {partNumber: 'silencer'}],
            function (err, parts) {
              async.each(parts, function (part, next) {
                async.each(assemblies, function (assembly, next) {
                  if (assembly.name === 'SUV') {
                    return next();
                  }
                  if (assembly.name === 'hatchback' &&
                    part.partNumber === 'bootspace') {
                    return next();
                  }
                  assembly.parts.add(part, function (err, data) {
                    next();
                  });
                }, next);
              }, function (err) {
                self.called = 0;
                Assembly.find({
                  where: {
                    name: {
                      inq: ['sedan', 'hatchback', 'SUV']
                    }
                  },
                  include: 'parts'
                }, function (err, result) {
                  should.not.exist(err);
                  should.exists(result);
                  result.length.should.equal(3);
                  // Please note the order of assemblies is random
                  var assemblies = {};
                  result.forEach(function(r) {
                    assemblies[r.name] = r;
                  });
                  //sedan
                  assemblies.sedan.parts().should.have.length(3);
                  //hatchback
                  assemblies.hatchback.parts().should.have.length(2);
                  //SUV
                  assemblies.SUV.parts().should.have.length(0);
                  self.called.should.eql(3);
                  done();
                });
              });
            });
        });
    });

    it('including hasMany should make only 2 db calls', function (done) {
      var self = this;
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
            p.userId.should.eql(user.id);
          });
          user.__cachedRelations.passports.forEach(function (pp) {
            pp.ownerId.should.eql(user.id);
          });
        });
        self.called.should.eql(3);
        done();
      });
    });


    it('should not make n+1 db calls in relation syntax',
      function (done) {
        var self = this;
        User.find({include: [{ relation: 'posts', scope: {
              where: {title: 'Post A'}
            }}, 'passports']}, function (err, users) {
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
              p.userId.should.eql(user.id);
              p.title.should.be.equal('Post A');
            });
            user.__cachedRelations.passports.forEach(function (pp) {
              pp.ownerId.should.eql(user.id);
            });
          });
          self.called.should.eql(3);
          done();
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
  Profile = db.define('Profile', {
    profileName: String
  });
  AccessToken = db.define('AccessToken', {
    token: String
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
  User.hasMany('accesstokens', {
    foreignKey: 'userId',
    options: {disableInclude: true}
  });
  Profile.belongsTo('user', {model: User});
  User.hasOne('profile', {foreignKey: 'userId'});
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
    var createdProfiles = [];
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
          createAccessTokens();
        }
      );
    }

    function createAccessTokens() {
      clearAndCreate(
        AccessToken,
        [
          {token: '1', userId: createdUsers[0].id},
          {token: '2', userId: createdUsers[1].id}
        ],
        function (items) {}
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

    function createProfiles() {
      clearAndCreate(
        Profile,
        [
          {profileName: 'Profile A', userId: createdUsers[0].id},
          {profileName: 'Profile B', userId: createdUsers[1].id},
          {profileName: 'Profile Z'}
        ],
        function (items) {
          createdProfiles = items
          done();
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
          createProfiles();
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

describe('Model instance with included relation .toJSON()', function() {
  var db, ChallengerModel, GameParticipationModel, ResultModel;

  before(function(done) {
    db = new DataSource({connector: 'memory'});
    ChallengerModel = db.createModel('Challenger',
      {
        name: String
      },
      {
        relations: {
          gameParticipations: {
            type: 'hasMany',
            model: 'GameParticipation',
            foreignKey: ''
          }
        }
      }
    );
    GameParticipationModel = db.createModel('GameParticipation',
      {
        date: Date
      },
      {
        relations: {
          challenger: {
            type: 'belongsTo',
            model: 'Challenger',
            foreignKey: ''
          },
          results: {
            type: 'hasMany',
            model: 'Result',
            foreignKey: ''
          }
        }
      }
    );
    ResultModel = db.createModel('Result', {
      points: Number,
    }, {
      relations: {
        gameParticipation: {
          type: 'belongsTo',
          model: 'GameParticipation',
          foreignKey: ''
        }
      }
    });

    async.waterfall([
      createChallengers,
      createGameParticipations,
      createResults],
      function(err) {
        done(err);
      });

  });

  function createChallengers(callback) {
    ChallengerModel.create([{name: 'challenger1'}, {name: 'challenger2'}], callback);
  }

  function createGameParticipations(challengers, callback) {
    GameParticipationModel.create([
      {challengerId: challengers[0].id, date: Date.now()},
      {challengerId: challengers[0].id, date: Date.now()}
    ], callback);
  }

  function createResults(gameParticipations, callback) {
    ResultModel.create([
      {gameParticipationId: gameParticipations[0].id, points: 10},
      {gameParticipationId: gameParticipations[0].id, points: 20}
    ], callback);
  }

  it('should recursively serialize objects', function(done) {
    var filter = {include: {gameParticipations: 'results'}};
    ChallengerModel.find(filter, function(err, challengers) {

      var levelOneInclusion = challengers[0].toJSON().gameParticipations[0];
      assert(levelOneInclusion.__data === undefined, '.__data of a level 1 inclusion is undefined.');

      var levelTwoInclusion = challengers[0].toJSON().gameParticipations[0].results[0];
      assert(levelTwoInclusion.__data === undefined, '__data of a level 2 inclusion is undefined.');
      done();
    });
  });
});
