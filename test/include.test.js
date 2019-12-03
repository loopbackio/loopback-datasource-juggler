// Copyright IBM Corp. 2013,2019. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

/* global getSchema:false, connectorCapabilities:false */
const assert = require('assert');
const async = require('async');
const bdd = require('./helpers/bdd-if');
const should = require('./init.js');

const DataSource = require('../').DataSource;

let db, User, Profile, AccessToken, Post, Passport, City, Street, Building, Assembly, Part;

const knownUsers = ['User A', 'User B', 'User C', 'User D', 'User E'];
const knownPassports = ['1', '2', '3', '4'];
const knownPosts = ['Post A', 'Post B', 'Post C', 'Post D', 'Post E'];
const knownProfiles = ['Profile A', 'Profile B', 'Profile Z'];

describe('include', function() {
  before(setup);

  it('should fetch belongsTo relation', function(done) {
    Passport.find({include: 'owner'}, function(err, passports) {
      passports.length.should.be.ok;
      passports.forEach(function(p) {
        p.__cachedRelations.should.have.property('owner');

        // The relation should be promoted as the 'owner' property
        p.should.have.property('owner');
        // The __cachedRelations should be removed from json output
        p.toJSON().should.not.have.property('__cachedRelations');

        const owner = p.__cachedRelations.owner;
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

  it('does not return included item if FK is excluded', function(done) {
    Passport.find({include: 'owner', fields: 'number'}, function(err, passports) {
      if (err) return done(err);
      const owner = passports[0].toJSON().owner;
      should.not.exist(owner);
      done();
    });
  });

  it('should fetch hasMany relation', function(done) {
    User.find({include: 'posts'}, function(err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function(u) {
        // The relation should be promoted as the 'owner' property
        u.should.have.property('posts');
        // The __cachedRelations should be removed from json output
        u.toJSON().should.not.have.property('__cachedRelations');

        u.__cachedRelations.should.have.property('posts');
        u.__cachedRelations.posts.forEach(function(p) {
          // FIXME There are cases that p.userId is string
          p.userId.toString().should.eql(u.id.toString());
        });
      });
      done();
    });
  });

  it('should report errors if the PK is excluded', function(done) {
    User.find({include: 'posts', fields: 'name'}, function(err) {
      should.exist(err);
      err.message.should.match(/ID property "id" is missing/);
      done();
    });
  });

  it('should not have changed the __strict flag of the model', function(done) {
    const originalStrict = User.definition.settings.strict;
    User.definition.settings.strict = true; // Change to test regression for issue #1252
    const finish = (err) => {
      // Restore original user strict property
      User.definition.settings.strict = originalStrict;
      done(err);
    };
    User.find({include: 'posts'}, function(err, users) {
      if (err) return finish(err);
      users.forEach(user => {
        user.should.have.property('__strict', true); // we changed it
      });
      finish();
    });
  });

  bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
    'should not save in db included models, in query returned models',
    function(done) {
      const originalStrict = User.definition.settings.strict;
      User.definition.settings.strict = true; // Change to test regression for issue #1252
      const finish = (err) => {
        // Restore original user strict property
        User.definition.settings.strict = originalStrict;
        done(err);
      };
      User.findOne({where: {name: 'User A'}, include: 'posts'}, function(err, user) {
        if (err) return finish(err);
        if (!user) return finish(new Error('User Not found to check relation not saved'));
        user.save(function(err) { // save the returned user
          if (err) return finish(err);
          // should not store in db the posts
          const dsName = User.dataSource.name;
          if (dsName === 'memory') {
            JSON.parse(User.dataSource.adapter.cache.User[1]).should.not.have.property('posts');
            finish();
          } else if (dsName === 'mongodb') { //  Check native mongodb connector
          // get hold of native mongodb collection
            const dbCollection = User.dataSource.connector.collection(User.modelName);
            dbCollection.findOne({_id: user.id})
              .then(function(foundUser) {
                if (!foundUser) {
                  finish(new Error('User not found to check posts not saved'));
                }
                foundUser.should.not.have.property('posts');
                finish();
              })
              .catch(finish);
          } else { // TODO make native checks for other connectors as well
            finish();
          }
        });
      });
    });

  it('should fetch Passport - Owner - Posts', function(done) {
    Passport.find({include: {owner: 'posts'}}, function(err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      passports.forEach(function(p) {
        p.__cachedRelations.should.have.property('owner');

        // The relation should be promoted as the 'owner' property
        p.should.have.property('owner');
        // The __cachedRelations should be removed from json output
        p.toJSON().should.not.have.property('__cachedRelations');

        const user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          should.not.exist(user);
        } else {
          should.exist(user);
          user.id.should.eql(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.should.have.property('posts');
          user.toJSON().should.have.property('posts').and.be.an.Array;
          user.__cachedRelations.posts.forEach(function(pp) {
            // FIXME There are cases that pp.userId is string
            pp.userId.toString().should.eql(user.id.toString());
          });
        }
      });
      done();
    });
  });

  it('should fetch Passport - Owner - empty Posts', function(done) {
    Passport.findOne({where: {number: '4'}, include: {owner: 'posts'}}, function(err, passport) {
      should.not.exist(err);
      should.exist(passport);
      passport.__cachedRelations.should.have.property('owner');

      // The relation should be promoted as the 'owner' property
      passport.should.have.property('owner');
      // The __cachedRelations should be removed from json output
      passport.toJSON().should.not.have.property('__cachedRelations');

      const user = passport.__cachedRelations.owner;
      should.exist(user);
      user.id.should.eql(passport.ownerId);
      user.__cachedRelations.should.have.property('posts');
      user.should.have.property('posts');
      user.toJSON().should.have.property('posts').and.be.an.Array().with
        .length(0);
      done();
    });
  });

  it('should fetch Passport - Owner - Posts - alternate syntax', function(done) {
    Passport.find({include: {owner: {relation: 'posts'}}}, function(err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      let posts;
      if (connectorCapabilities.adhocSort !== false) {
        posts = passports[0].owner().posts();
        posts.should.have.length(3);
      } else {
        if (passports[0].owner()) {
          posts = passports[0].owner().posts();
          posts.length.should.be.belowOrEqual(3);
        }
      }
      done();
    });
  });

  it('should fetch Passports - User - Posts - User', function(done) {
    Passport.find({
      include: {owner: {posts: 'author'}},
    }, function(err, passports) {
      should.not.exist(err);
      should.exist(passports);
      passports.length.should.be.ok;
      passports.forEach(function(p) {
        p.__cachedRelations.should.have.property('owner');
        const user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          should.not.exist(user);
        } else {
          should.exist(user);
          user.id.should.eql(p.ownerId);
          user.__cachedRelations.should.have.property('posts');
          user.__cachedRelations.posts.forEach(function(pp) {
            pp.should.have.property('id');
            // FIXME There are cases that pp.userId is string
            pp.userId.toString().should.eql(user.id.toString());
            pp.should.have.property('author');
            pp.__cachedRelations.should.have.property('author');
            const author = pp.__cachedRelations.author;
            author.id.should.eql(user.id);
          });
        }
      });
      done();
    });
  });

  it('should fetch Passports with include scope on Posts', function(done) {
    Passport.find({
      include: {owner: {relation: 'posts', scope: {
        fields: ['title'], include: ['author'],
        order: 'title DESC',
      }}},
    }, function(err, passports) {
      should.not.exist(err);
      should.exist(passports);
      let passport, owner, posts;
      if (connectorCapabilities.adhocSort !== false) {
        passports.length.should.equal(4);

        passport = passports[0];
        passport.number.should.equal('1');
        passport.owner().name.should.equal('User A');
        owner = passport.owner().toObject();

        posts = passport.owner().posts();
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
      } else {
        passports.length.should.be.belowOrEqual(4);

        passport = passports[0];
        passport.number.should.be.oneOf(knownPassports);
        if (passport.owner()) {
          passport.owner().name.should.be.oneOf(knownUsers);
          owner = passport.owner().toObject();

          posts = passport.owner().posts();
          posts.should.be.an.array;
          posts.length.should.be.belowOrEqual(3);

          if (posts[0]) {
            posts[0].title.should.be.oneOf(knownPosts);
            posts[0].author().should.be.instanceOf(User);
            posts[0].author().name.should.be.oneOf(knownUsers);
          }
        }
      }

      done();
    });
  });

  bdd.itIf(connectorCapabilities.adhocSort !== false,
    'should support limit', function(done) {
      Passport.find({
        include: {
          owner: {
            relation: 'posts', scope: {
              fields: ['title'], include: ['author'],
              order: 'title DESC',
              limit: 1,
            },
          },
        },
        limit: 2,
      }, function(err, passports) {
        if (err) return done(err);
        passports.length.should.equal(2);
        const posts1 = passports[0].toJSON().owner.posts;
        posts1.length.should.equal(1);
        posts1[0].title.should.equal('Post C');
        const posts2 = passports[1].toJSON().owner.posts;
        posts2.length.should.equal(1);
        posts2[0].title.should.equal('Post D');

        done();
      });
    });

  bdd.itIf(connectorCapabilities.cloudantCompatible !== false,
    'should support limit - no sort', function(done) {
      Passport.find({
        include: {
          owner: {
            relation: 'posts', scope: {
              fields: ['title'], include: ['author'],
              order: 'title DESC',
              limit: 1,
            },
          },
        },
        limit: 2,
      }, function(err, passports) {
        if (err) return done(err);
        passports.length.should.equal(2);
        let owner = passports[0].toJSON().owner;
        if (owner) {
          const posts1 = owner.posts;
          posts1.length.should.belowOrEqual(1);
          if (posts1.length === 1) {
            posts1[0].title.should.be.oneOf(knownPosts);
          }
        }
        owner = passports[1].toJSON().owner;
        if (owner) {
          const posts2 = owner.posts;
          posts2.length.should.belowOrEqual(1);
          if (posts2.length === 1) {
            posts2[0].title.should.be.oneOf(knownPosts);
          }
        }
        done();
      });
    });

  bdd.describeIf(connectorCapabilities.adhocSort !== false,
    'inq limit', function() {
      before(function() {
        Passport.dataSource.settings.inqLimit = 2;
      });

      after(function() {
        delete Passport.dataSource.settings.inqLimit;
      });

      it('should support include by pagination', function(done) {
      // `pagination` in this case is inside the implementation and set by
      // `inqLimit = 2` in the before block. This will need to be reworked once
      // we decouple `findWithForeignKeysByPage`.
      //
      // --superkhau
        Passport.find({
          include: {
            owner: {
              relation: 'posts',
              scope: {
                fields: ['title'], include: ['author'],
                order: 'title ASC',
              },
            },
          },
        }, function(err, passports) {
          if (err) return done(err);

          passports.length.should.equal(4);
          const posts1 = passports[0].toJSON().owner.posts;
          posts1.length.should.equal(3);
          posts1[0].title.should.equal('Post A');
          const posts2 = passports[1].toJSON().owner.posts;
          posts2.length.should.equal(1);
          posts2[0].title.should.equal('Post D');

          done();
        });
      });
    });

  bdd.describeIf(connectorCapabilities.adhocSort !== false,
    'findWithForeignKeysByPage', function() {
      context('filter', function() {
        it('works when using a `where` with a foreign key', function(done) {
          User.findOne({
            include: {
              relation: 'passports',
            },
          }, function(err, user) {
            if (err) return done(err);

            const passport = user.passports()[0];
            // eql instead of equal because mongo uses object id type
            passport.id.should.eql(createdPassports[0].id);
            passport.ownerId.should.eql(createdPassports[0].ownerId);
            passport.number.should.eql(createdPassports[0].number);

            done();
          });
        });

        it('works when using a `where` with `and`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                where: {
                  and: [
                    {id: createdPosts[0].id},
                    // Remove the duplicate userId to avoid Cassandra failure
                    // {userId: createdPosts[0].userId},
                    {title: 'Post A'},
                  ],
                },
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            user.name.should.equal('User A');
            user.age.should.equal(21);
            user.id.should.eql(createdUsers[0].id);
            const posts = user.posts();
            posts.length.should.equal(1);
            const post = posts[0];
            post.title.should.equal('Post A');
            // eql instead of equal because mongo uses object id type
            post.userId.should.eql(createdPosts[0].userId);
            post.id.should.eql(createdPosts[0].id);

            done();
          });
        });

        it('works when using `where` with `limit`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                limit: 1,
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            user.posts().length.should.equal(1);

            done();
          });
        });

        it('works when using `where` with `skip`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                skip: 1,
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            const ids = user.posts().map(function(p) { return p.id; });
            ids.should.eql([createdPosts[1].id, createdPosts[2].id]);

            done();
          });
        });

        it('works when using `where` with `offset`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                offset: 1,
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            const ids = user.posts().map(function(p) { return p.id; });
            ids.should.eql([createdPosts[1].id, createdPosts[2].id]);

            done();
          });
        });

        it('works when using `where` without `limit`, `skip` or `offset`',
          function(done) {
            User.findOne({include: {relation: 'posts'}}, function(err, user) {
              if (err) return done(err);

              const posts = user.posts();
              const ids = posts.map(function(p) { return p.id; });
              ids.should.eql([
                createdPosts[0].id,
                createdPosts[1].id,
                createdPosts[2].id,
              ]);

              done();
            });
          });
      });

      context('pagination', function() {
        it('works with the default page size (0) and `inqlimit` is exceeded',
          function(done) {
            // inqLimit modifies page size in the impl (there is no way to modify
            // page size directly as it is hardcoded (once we decouple the func,
            // we can use ctor injection to pass in whatever page size we want).
            //
            // --superkhau
            Post.dataSource.settings.inqLimit = 2;

            User.find({include: {relation: 'posts'}}, function(err, users) {
              if (err) return done(err);

              users.length.should.equal(5);

              delete Post.dataSource.settings.inqLimit;

              done();
            });
          });

        it('works when page size is set to 0', function(done) {
          Post.dataSource.settings.inqLimit = 0;

          User.find({include: {relation: 'posts'}}, function(err, users) {
            if (err) return done(err);

            users.length.should.equal(5);

            delete Post.dataSource.settings.inqLimit;

            done();
          });
        });
      });

      context('relations', function() {
      // WARNING
      // The code paths for in this suite of tests were verified manually due to
      // the tight coupling of the `findWithForeignKeys` in `include.js`.
      //
      // TODO
      // Decouple the utility functions into their own modules and export each
      // function individually to allow for unit testing via DI.
      //
      // --superkhau

        it('works when hasOne is called', function(done) {
          User.findOne({include: {relation: 'profile'}}, function(err, user) {
            if (err) return done(err);

            user.name.should.equal('User A');
            user.age.should.equal(21);
            // eql instead of equal because mongo uses object id type
            user.id.should.eql(createdUsers[0].id);
            const profile = user.profile();
            profile.profileName.should.equal('Profile A');
            // eql instead of equal because mongo uses object id type
            profile.userId.should.eql(createdProfiles[0].userId);
            profile.id.should.eql(createdProfiles[0].id);

            done();
          });
        });

        it('does not return included item if hasOne is missing the id property', function(done) {
          User.findOne({include: {relation: 'profile'}, fields: 'name'}, function(err, user) {
            if (err) return done(err);
            should.exist(user);
            // Convert to JSON as the user instance has `profile` as a relational method
            should.not.exist(user.toJSON().profile);
            done();
          });
        });

        it('works when hasMany is called', function(done) {
          User.findOne({include: {relation: 'posts'}}, function(err, user) {
            if (err) return done();

            user.name.should.equal('User A');
            user.age.should.equal(21);
            // eql instead of equal because mongo uses object id type
            user.id.should.eql(createdUsers[0].id);
            user.posts().length.should.equal(3);

            done();
          });
        });

        it('works when hasManyThrough is called', function(done) {
          const Physician = db.define('Physician', {name: String});
          const Patient = db.define('Patient', {name: String});
          const Appointment = db.define('Appointment', {
            date: {
              type: Date,
              default: function() {
                return new Date();
              },
            },
          });
          const Address = db.define('Address', {name: String});

          Physician.hasMany(Patient, {through: Appointment});
          Patient.hasMany(Physician, {through: Appointment});
          Patient.belongsTo(Address);
          Appointment.belongsTo(Patient);
          Appointment.belongsTo(Physician);

          db.automigrate(['Physician', 'Patient', 'Appointment', 'Address'],
            function() {
              Physician.create(function(err, physician) {
                physician.patients.create({name: 'a'}, function(err, patient) {
                  Address.create({name: 'z'}, function(err, address) {
                    patient.address(address);
                    patient.save(function() {
                      physician.patients({include: 'address'},
                        function(err, patients) {
                          if (err) return done(err);

                          patients.should.have.length(1);
                          const p = patients[0];
                          p.name.should.equal('a');
                          p.addressId.should.eql(patient.addressId);
                          p.address().id.should.eql(address.id);
                          p.address().name.should.equal('z');

                          done();
                        });
                    });
                  });
                });
              });
            });
        });

        it('works when belongsTo is called', function(done) {
          Profile.findOne({include: 'user'}, function(err, profile) {
            if (err) return done(err);

            profile.profileName.should.equal('Profile A');
            profile.userId.should.eql(createdProfiles[0].userId);
            profile.id.should.eql(createdProfiles[0].id);
            const user = profile.user();
            user.name.should.equal('User A');
            user.age.should.equal(21);
            user.id.should.eql(createdUsers[0].id);

            done();
          });
        });
      });
    });

  bdd.describeIf(connectorCapabilities.adhocSort === false,
    'findWithForeignKeysByPage', function() {
      // eslint-disable-next-line mocha/no-identical-title
      context('filter', function() {
        it('works when using a `where` with a foreign key', function(done) {
          User.findOne({
            include: {
              relation: 'passports',
            },
          }, function(err, user) {
            if (err) return done(err);

            const passport = user.passports()[0];
            if (passport) {
              const knownPassportIds = [];
              const knownOwnerIds = [];
              createdPassports.forEach(function(p) {
                if (p.id) knownPassportIds.push(p.id);
                if (p.ownerId) knownOwnerIds.push(p.ownerId.toString());
              });
              passport.id.should.be.oneOf(knownPassportIds);
              // FIXME passport.ownerId may be string
              passport.ownerId.toString().should.be.oneOf(knownOwnerIds);
              passport.number.should.be.oneOf(knownPassports);
            }
            done();
          });
        });

        it('works when using a `where` with `and`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                where: {
                  and: [
                    {id: createdPosts[0].id},
                    // Remove the duplicate userId to avoid Cassandra failure
                    // {userId: createdPosts[0].userId},
                    {title: createdPosts[0].title},
                  ],
                },
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            let posts, post;
            if (connectorCapabilities.adhocSort !== false) {
              user.name.should.equal('User A');
              user.age.should.equal(21);
              user.id.should.eql(createdUsers[0].id);
              posts = user.posts();
              posts.length.should.equal(1);
              post = posts[0];
              post.title.should.equal('Post A');
              // eql instead of equal because mongo uses object id type
              post.userId.should.eql(createdPosts[0].userId);
              post.id.should.eql(createdPosts[0].id);
            } else {
              user.name.should.be.oneOf(knownUsers);
              const knownUserIds = [];
              createdUsers.forEach(function(u) {
                knownUserIds.push(u.id.toString());
              });
              user.id.toString().should.be.oneOf(knownUserIds);
              posts = user.posts();
              if (posts && posts.length > 0) {
                post = posts[0];
                post.title.should.be.oneOf(knownPosts);
                post.userId.toString().should.be.oneOf(knownUserIds);
                const knownPostIds = [];
                createdPosts.forEach(function(p) {
                  knownPostIds.push(p.id);
                });
                post.id.should.be.oneOf(knownPostIds);
              }
            }
            done();
          });
        });

        it('works when using `where` with `limit`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                limit: 1,
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            user.posts().length.should.belowOrEqual(1);

            done();
          });
        });

        it('works when using `where` with `skip`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                skip: 1, // will be ignored
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            const ids = user.posts().map(function(p) { return p.id; });
            if (ids.length > 0) {
              const knownPosts = [];
              createdPosts.forEach(function(p) {
                if (p.id) knownPosts.push(p.id);
              });
              ids.forEach(function(id) {
                if (id) id.should.be.oneOf(knownPosts);
              });
            }

            done();
          });
        });

        it('works when using `where` with `offset`', function(done) {
          User.findOne({
            include: {
              relation: 'posts',
              scope: {
                offset: 1, // will be ignored
              },
            },
          }, function(err, user) {
            if (err) return done(err);

            const ids = user.posts().map(function(p) { return p.id; });
            if (ids.length > 0) {
              const knownPosts = [];
              createdPosts.forEach(function(p) {
                if (p.id) knownPosts.push(p.id);
              });
              ids.forEach(function(id) {
                if (id) id.should.be.oneOf(knownPosts);
              });
            }

            done();
          });
        });

        it('works when using `where` without `limit`, `skip` or `offset`',
          function(done) {
            User.findOne({include: {relation: 'posts'}}, function(err, user) {
              if (err) return done(err);

              const posts = user.posts();
              const ids = posts.map(function(p) { return p.id; });
              if (ids.length > 0) {
                const knownPosts = [];
                createdPosts.forEach(function(p) {
                  if (p.id) knownPosts.push(p.id);
                });
                ids.forEach(function(id) {
                  if (id) id.should.be.oneOf(knownPosts);
                });
              }

              done();
            });
          });
      });

      // eslint-disable-next-line mocha/no-identical-title
      context('pagination', function() {
        it('works with the default page size (0) and `inqlimit` is exceeded',
          function(done) {
            // inqLimit modifies page size in the impl (there is no way to modify
            // page size directly as it is hardcoded (once we decouple the func,
            // we can use ctor injection to pass in whatever page size we want).
            //
            // --superkhau
            Post.dataSource.settings.inqLimit = 2;

            User.find({include: {relation: 'posts'}}, function(err, users) {
              if (err) return done(err);

              users.length.should.equal(5);

              delete Post.dataSource.settings.inqLimit;

              done();
            });
          });

        it('works when page size is set to 0', function(done) {
          Post.dataSource.settings.inqLimit = 0;

          User.find({include: {relation: 'posts'}}, function(err, users) {
            if (err) return done(err);

            users.length.should.equal(5);

            delete Post.dataSource.settings.inqLimit;

            done();
          });
        });
      });

      // eslint-disable-next-line mocha/no-identical-title
      context('relations', function() {
      // WARNING
      // The code paths for in this suite of tests were verified manually due to
      // the tight coupling of the `findWithForeignKeys` in `include.js`.
      //
      // TODO
      // Decouple the utility functions into their own modules and export each
      // function individually to allow for unit testing via DI.
      //
      // --superkhau

        it('works when hasOne is called', function(done) {
          User.findOne({include: {relation: 'profile'}}, function(err, user) {
            if (err) return done(err);

            const knownUserIds = [];
            const knownProfileIds = [];
            createdUsers.forEach(function(u) {
            // FIXME user.id below might be string, so knownUserIds should match
              knownUserIds.push(u.id.toString());
            });
            createdProfiles.forEach(function(p) {
            // knownProfileIds.push(p.id ? p.id.toString() : '');
              knownProfileIds.push(p.id);
            });
            if (user) {
              user.name.should.be.oneOf(knownUsers);
              // eql instead of equal because mongo uses object id type
              user.id.toString().should.be.oneOf(knownUserIds);
              const profile = user.profile();
              if (profile) {
                profile.profileName.should.be.oneOf(knownProfiles);
                // eql instead of equal because mongo uses object id type
                if (profile.userId) profile.userId.toString().should.be.oneOf(knownUserIds);
                profile.id.should.be.oneOf(knownProfileIds);
              }
            }

            done();
          });
        });

        it('works when hasMany is called', function(done) {
          User.findOne({include: {relation: 'posts'}}, function(err, user) {
            if (err) return done();

            const knownUserIds = [];
            createdUsers.forEach(function(u) {
              knownUserIds.push(u.id);
            });
            user.name.should.be.oneOf(knownUsers);
            // eql instead of equal because mongo uses object id type
            user.id.should.be.oneOf(knownUserIds);
            user.posts().length.should.be.belowOrEqual(3);

            done();
          });
        });

        it('works when hasManyThrough is called', function(done) {
          const Physician = db.define('Physician', {name: String});
          const Patient = db.define('Patient', {name: String});
          const Appointment = db.define('Appointment', {
            date: {
              type: Date,
              default: function() {
                return new Date();
              },
            },
          });
          const Address = db.define('Address', {name: String});

          Physician.hasMany(Patient, {through: Appointment});
          Patient.hasMany(Physician, {through: Appointment});
          Patient.belongsTo(Address);
          Appointment.belongsTo(Patient);
          Appointment.belongsTo(Physician);

          db.automigrate(['Physician', 'Patient', 'Appointment', 'Address'],
            function() {
              Physician.create(function(err, physician) {
                physician.patients.create({name: 'a'}, function(err, patient) {
                  Address.create({name: 'z'}, function(err, address) {
                    patient.address(address);
                    patient.save(function() {
                      physician.patients({include: 'address'},
                        function(err, patients) {
                          if (err) return done(err);
                          patients.should.have.length(1);
                          const p = patients[0];
                          p.name.should.equal('a');
                          p.addressId.should.eql(patient.addressId);
                          p.address().id.should.eql(address.id);
                          p.address().name.should.equal('z');

                          done();
                        });
                    });
                  });
                });
              });
            });
        });

        it('works when belongsTo is called', function(done) {
          Profile.findOne({include: 'user'}, function(err, profile) {
            if (err) return done(err);
            if (!profile) return done(); // not every user has progile

            const knownUserIds = [];
            const knownProfileIds = [];
            createdUsers.forEach(function(u) {
              knownUserIds.push(u.id.toString());
            });
            createdProfiles.forEach(function(p) {
              if (p.id) knownProfileIds.push(p.id.toString());
            });
            if (profile) {
              profile.profileName.should.be.oneOf(knownProfiles);
              if (profile.userId) profile.userId.toString().should.be.oneOf(knownUserIds);
              if (profile.id) profile.id.toString().should.be.oneOf(knownProfileIds);
              const user = profile.user();
              if (user) {
                user.name.should.be.oneOf(knownUsers);
                user.id.toString().should.be.oneOf(knownUserIds);
              }
            }

            done();
          });
        });
      });
    });

  bdd.itIf(connectorCapabilities.adhocSort !== false,
    'should fetch Users with include scope on Posts - belongsTo',
    function(done) {
      Post.find({include: {relation: 'author', scope: {fields: ['name']}}},
        function(err, posts) {
          should.not.exist(err);
          should.exist(posts);
          posts.length.should.equal(5);

          const author = posts[0].author();
          author.name.should.equal('User A');
          author.should.have.property('id');
          author.should.have.property('age', undefined);

          done();
        });
    });

  bdd.itIf(connectorCapabilities.adhocSort === false,
    'should fetch Users with include scope on Posts - belongsTo - no sort',
    function(done) {
      Post.find({include: {relation: 'author', scope: {fields: ['name']}}},
        function(err, posts) {
          should.not.exist(err);
          should.exist(posts);
          posts.length.should.be.belowOrEqual(5);

          const author = posts[0].author();
          if (author) {
            author.name.should.be.oneOf('User A', 'User B', 'User C', 'User D', 'User E');
            author.should.have.property('id');
            author.should.have.property('age', undefined);
          }

          done();
        });
    });

  it('should fetch Users with include scope on Posts - hasMany', function(done) {
    User.find({
      include: {relation: 'posts', scope: {
        order: 'title DESC',
      }},
    }, function(err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.equal(5);

      if (connectorCapabilities.adhocSort !== false) {
        users[0].name.should.equal('User A');
        users[1].name.should.equal('User B');

        let posts = users[0].posts();
        posts.should.be.an.array;
        posts.should.have.length(3);

        posts[0].title.should.equal('Post C');
        posts[1].title.should.equal('Post B');
        posts[2].title.should.equal('Post A');

        posts = users[1].posts();
        posts.should.be.an.array;
        posts.should.have.length(1);
        posts[0].title.should.equal('Post D');
      } else {
        users.forEach(function(u) {
          u.name.should.be.oneOf(knownUsers);
          const posts = u.posts();
          if (posts) {
            posts.should.be.an.array;
            posts.length.should.be.belowOrEqual(3);
            posts.forEach(function(p) {
              p.title.should.be.oneOf(knownPosts);
            });
          }
        });
      }

      done();
    });
  });

  it('should fetch User - Posts AND Passports', function(done) {
    User.find({include: ['posts', 'passports']}, function(err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function(user) {
        // The relation should be promoted as the 'owner' property
        user.should.have.property('posts');
        user.should.have.property('passports');

        const userObj = user.toJSON();
        userObj.should.have.property('posts');
        userObj.should.have.property('passports');
        userObj.posts.should.be.an.instanceOf(Array);
        userObj.passports.should.be.an.instanceOf(Array);

        // The __cachedRelations should be removed from json output
        userObj.should.not.have.property('__cachedRelations');

        user.__cachedRelations.should.have.property('posts');
        user.__cachedRelations.should.have.property('passports');
        user.__cachedRelations.posts.forEach(function(p) {
          // FIXME there are cases that p.userId is string
          p.userId.toString().should.eql(user.id.toString());
        });
        user.__cachedRelations.passports.forEach(function(pp) {
          // FIXME there are cases that p.ownerId is string
          pp.ownerId.toString().should.eql(user.id.toString());
        });
      });
      done();
    });
  });

  it('should fetch User - Posts AND Passports in relation syntax',
    function(done) {
      User.find({include: [
        {relation: 'posts', scope: {
          where: {title: 'Post A'},
        }},
        'passports',
      ]}, function(err, users) {
        should.not.exist(err);
        should.exist(users);
        users.length.should.be.ok;
        users.forEach(function(user) {
          // The relation should be promoted as the 'owner' property
          user.should.have.property('posts');
          user.should.have.property('passports');

          const userObj = user.toJSON();
          userObj.should.have.property('posts');
          userObj.should.have.property('passports');
          userObj.posts.should.be.an.instanceOf(Array);
          userObj.passports.should.be.an.instanceOf(Array);

          // The __cachedRelations should be removed from json output
          userObj.should.not.have.property('__cachedRelations');

          user.__cachedRelations.should.have.property('posts');
          user.__cachedRelations.should.have.property('passports');
          user.__cachedRelations.posts.forEach(function(p) {
            // FIXME there are cases that p.userId is string
            p.userId.toString().should.eql(user.id.toString());
            p.title.should.be.equal('Post A');
          });
          user.__cachedRelations.passports.forEach(function(pp) {
            // FIXME there are cases that p.ownerId is string
            pp.ownerId.toString().should.eql(user.id.toString());
          });
        });
        done();
      });
    });

  it('should not fetch User - AccessTokens', function(done) {
    User.find({include: ['accesstokens']}, function(err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      users.forEach(function(user) {
        const userObj = user.toJSON();
        userObj.should.not.have.property('accesstokens');
      });
      done();
    });
  });

  it('should support hasAndBelongsToMany', function(done) {
    Assembly.create({name: 'car'}, function(err, assembly) {
      Part.create({partNumber: 'engine'}, function(err, part) {
        assembly.parts.add(part, function(err, data) {
          assembly.parts(function(err, parts) {
            should.not.exist(err);
            should.exists(parts);
            parts.length.should.equal(1);
            parts[0].partNumber.should.equal('engine');

            // Create a part
            assembly.parts.create({partNumber: 'door'}, function(err, part4) {
              Assembly.find({include: 'parts'}, function(err, assemblies) {
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

  it('should fetch User - Profile (HasOne)', function(done) {
    User.find({include: ['profile']}, function(err, users) {
      should.not.exist(err);
      should.exist(users);
      users.length.should.be.ok;
      let usersWithProfile = 0;
      users.forEach(function(user) {
        // The relation should be promoted as the 'owner' property
        user.should.have.property('profile');
        const userObj = user.toJSON();
        const profile = user.profile();
        if (profile) {
          profile.should.be.an.instanceOf(Profile);
          usersWithProfile++;
        } else {
          (profile === null).should.be.true;
        }
        // The __cachedRelations should be removed from json output
        userObj.should.not.have.property('__cachedRelations');
        user.__cachedRelations.should.have.property('profile');
        if (user.__cachedRelations.profile) {
          // FIXME there are cases that profile.userId is string
          user.__cachedRelations.profile.userId.toString().should.eql(user.id.toString());
          usersWithProfile++;
        }
      });
      usersWithProfile.should.equal(2 * 2);
      done();
    });
  });

  it('should not throw on fetch User if include is boolean equals true', function(done) {
    User.find({include: true}, function(err, users) {
      if (err) return done(err);
      should.exist(users);
      users.should.not.be.empty();
      done();
    });
  });

  it('should not throw on fetch User if include is number', function(done) {
    User.find({include: 1}, function(err, users) {
      if (err) return done(err);
      should.exist(users);
      users.should.not.be.empty();
      done();
    });
  });

  it('should not throw on fetch User if include is symbol', function(done) {
    User.find({include: Symbol('include')}, function(err, users) {
      if (err) return done(err);
      should.exist(users);
      users.should.not.be.empty();
      done();
    });
  });

  it('should not throw on fetch User if include is function', function(done) {
    const include = () => {};
    User.find({include}, function(err, users) {
      if (err) return done(err);
      should.exist(users);
      users.should.not.be.empty();
      done();
    });
  });

  // Not implemented correctly, see: loopback-datasource-juggler/issues/166
  // fixed by DB optimization
  it('should support include scope on hasAndBelongsToMany', function(done) {
    Assembly.find({include: {relation: 'parts', scope: {
      where: {partNumber: 'engine'},
    }}}, function(err, assemblies) {
      assemblies.length.should.equal(1);
      const parts = assemblies[0].parts();
      parts.should.have.length(1);
      parts[0].partNumber.should.equal('engine');
      done();
    });
  });

  it('should save related items separately', function(done) {
    User.find({
      include: 'posts',
    })
      .then(function(users) {
        const posts = users[0].posts();
        if (connectorCapabilities.adhocSort !== false) {
          posts.should.have.length(3);
        } else {
          if (posts) posts.length.should.be.belowOrEqual(3);
        }
        return users[0].save();
      })
      .then(function(updatedUser) {
        return User.findById(updatedUser.id, {
          include: 'posts',
        });
      })
      .then(function(user) {
        const posts = user.posts();
        if (connectorCapabilities.adhocSort !== false) {
          posts.should.have.length(3);
        } else {
          if (posts) posts.length.should.be.belowOrEqual(3);
        }
      })
      .then(done)
      .catch(done);
  });

  describe('performance', function() {
    let all;
    beforeEach(function() {
      this.called = 0;
      const self = this;
      all = db.connector.all;
      db.connector.all = function(model, filter, options, cb) {
        self.called++;
        return all.apply(db.connector, arguments);
      };
    });
    afterEach(function() {
      db.connector.all = all;
    });

    const nDBCalls = connectorCapabilities.supportTwoOrMoreInq !== false ? 2 : 4;
    it('including belongsTo should make only ' + nDBCalls + ' db calls', function(done) {
      const self = this;
      Passport.find({include: 'owner'}, function(err, passports) {
        passports.length.should.be.ok;
        passports.forEach(function(p) {
          p.__cachedRelations.should.have.property('owner');
          // The relation should be promoted as the 'owner' property
          p.should.have.property('owner');
          // The __cachedRelations should be removed from json output
          p.toJSON().should.not.have.property('__cachedRelations');
          const owner = p.__cachedRelations.owner;
          if (!p.ownerId) {
            should.not.exist(owner);
          } else {
            should.exist(owner);
            owner.id.should.eql(p.ownerId);
          }
        });
        self.called.should.eql(nDBCalls);
        done();
      });
    });

    it('including hasManyThrough should make only 3 db calls', function(done) {
      const self = this;
      Assembly.create([{name: 'sedan'}, {name: 'hatchback'},
        {name: 'SUV'}],
      function(err, assemblies) {
        Part.create([{partNumber: 'engine'}, {partNumber: 'bootspace'},
          {partNumber: 'silencer'}],
        function(err, parts) {
          async.each(parts, function(part, next) {
            async.each(assemblies, function(assembly, next) {
              if (assembly.name === 'SUV') {
                return next();
              }
              if (assembly.name === 'hatchback' &&
                    part.partNumber === 'bootspace') {
                return next();
              }
              assembly.parts.add(part, function(err, data) {
                next();
              });
            }, next);
          }, function(err) {
            const autos = connectorCapabilities.supportTwoOrMoreInq !== false ?
              ['sedan', 'hatchback', 'SUV'] : ['sedan'];
            const resultLength = connectorCapabilities.supportTwoOrMoreInq !== false ? 3 : 1;
            const dbCalls = connectorCapabilities.supportTwoOrMoreInq !== false ? 3 : 5;
            self.called = 0;
            Assembly.find({
              where: {
                name: {
                  inq: autos,
                },
              },
              include: 'parts',
            }, function(err, result) {
              should.not.exist(err);
              should.exists(result);
              result.length.should.equal(resultLength);
              // Please note the order of assemblies is random
              const assemblies = {};
              result.forEach(function(r) {
                assemblies[r.name] = r;
              });
              if (autos.indexOf('sedan') >= 0) assemblies.sedan.parts().should.have.length(3);
              if (autos.indexOf('hatchback') >= 0) assemblies.hatchback.parts().should.have.length(2);
              if (autos.indexOf('SUV') >= 0) assemblies.SUV.parts().should.have.length(0);
              self.called.should.eql(dbCalls);
              done();
            });
          });
        });
      });
    });

    const dbCalls = connectorCapabilities.supportTwoOrMoreInq !== false ? 3 : 11;
    it('including hasMany should make only ' + dbCalls + ' db calls', function(done) {
      const self = this;
      User.find({include: ['posts', 'passports']}, function(err, users) {
        should.not.exist(err);
        should.exist(users);
        users.length.should.be.ok;
        users.forEach(function(user) {
          // The relation should be promoted as the 'owner' property
          user.should.have.property('posts');
          user.should.have.property('passports');

          const userObj = user.toJSON();
          userObj.should.have.property('posts');
          userObj.should.have.property('passports');
          userObj.posts.should.be.an.instanceOf(Array);
          userObj.passports.should.be.an.instanceOf(Array);

          // The __cachedRelations should be removed from json output
          userObj.should.not.have.property('__cachedRelations');

          user.__cachedRelations.should.have.property('posts');
          user.__cachedRelations.should.have.property('passports');
          user.__cachedRelations.posts.forEach(function(p) {
            // FIXME p.userId is string in some cases.
            if (p.userId) p.userId.toString().should.eql(user.id.toString());
          });
          user.__cachedRelations.passports.forEach(function(pp) {
            // FIXME pp.owerId is string in some cases.
            if (pp.owerId) pp.ownerId.toString().should.eql(user.id.toString());
          });
        });
        self.called.should.eql(dbCalls);
        done();
      });
    });

    it('should not make n+1 db calls in relation syntax',
      function(done) {
        const self = this;
        User.find({include: [{relation: 'posts', scope: {
          where: {title: 'Post A'},
        }}, 'passports']}, function(err, users) {
          should.not.exist(err);
          should.exist(users);
          users.length.should.be.ok;
          users.forEach(function(user) {
            // The relation should be promoted as the 'owner' property
            user.should.have.property('posts');
            user.should.have.property('passports');

            const userObj = user.toJSON();
            userObj.should.have.property('posts');
            userObj.should.have.property('passports');
            userObj.posts.should.be.an.instanceOf(Array);
            userObj.passports.should.be.an.instanceOf(Array);

            // The __cachedRelations should be removed from json output
            userObj.should.not.have.property('__cachedRelations');

            user.__cachedRelations.should.have.property('posts');
            user.__cachedRelations.should.have.property('passports');
            user.__cachedRelations.posts.forEach(function(p) {
              // FIXME p.userId is string in some cases.
              p.userId.toString().should.eql(user.id.toString());
              p.title.should.be.equal('Post A');
            });
            user.__cachedRelations.passports.forEach(function(pp) {
              // FIXME p.userId is string in some cases.
              pp.ownerId.toString().should.eql(user.id.toString());
            });
          });
          self.called.should.eql(dbCalls);
          done();
        });
      });
  });

  it('should support disableInclude for hasAndBelongsToMany', function() {
    const Patient = db.define('Patient', {name: String});
    const Doctor = db.define('Doctor', {name: String});
    const DoctorPatient = db.define('DoctorPatient');
    Doctor.hasAndBelongsToMany('patients', {
      model: 'Patient',
      options: {disableInclude: true},
    });

    let doctor;
    return db.automigrate(['Patient', 'Doctor', 'DoctorPatient']).then(function() {
      return Doctor.create({name: 'Who'});
    }).then(function(inst) {
      doctor = inst;
      return doctor.patients.create({name: 'Lazarus'});
    }).then(function() {
      return Doctor.find({include: ['patients']});
    }).then(function(list) {
      list.should.have.length(1);
      list[0].toJSON().should.not.have.property('patients');
    });
  });
});

let createdUsers = [];
let createdPassports = [];
let createdProfiles = [];
let createdPosts = [];
function setup(done) {
  db = getSchema();
  City = db.define('City');
  Street = db.define('Street');
  Building = db.define('Building');
  User = db.define('User', {
    name: String,
    age: Number,
  });
  Profile = db.define('Profile', {
    profileName: String,
  });
  AccessToken = db.define('AccessToken', {
    token: String,
  });
  Passport = db.define('Passport', {
    number: String,
    expirationDate: Date,
  });
  Post = db.define('Post', {
    title: {type: String, index: true},
  });

  Passport.belongsTo('owner', {model: User});
  User.hasMany('passports', {foreignKey: 'ownerId'});
  User.hasMany('posts', {foreignKey: 'userId'});
  User.hasMany('accesstokens', {
    foreignKey: 'userId',
    options: {disableInclude: true},
  });
  Profile.belongsTo('user', {model: User});
  User.hasOne('profile', {foreignKey: 'userId'});
  Post.belongsTo('author', {model: User, foreignKey: 'userId'});

  Assembly = db.define('Assembly', {
    name: String,
  });

  Part = db.define('Part', {
    partNumber: String,
  });

  Assembly.hasAndBelongsToMany(Part);
  Part.hasAndBelongsToMany(Assembly);

  db.automigrate(function() {
    createUsers();
    function createUsers() {
      clearAndCreate(
        User,
        [
          {name: 'User A', age: 21},
          {name: 'User B', age: 22},
          {name: 'User C', age: 23},
          {name: 'User D', age: 24},
          {name: 'User E', age: 25},
        ],

        function(items) {
          createdUsers = items;
          createPassports();
          createAccessTokens();
        },
      );
    }
    function createAccessTokens() {
      clearAndCreate(
        AccessToken,
        [
          {token: '1', userId: createdUsers[0].id},
          {token: '2', userId: createdUsers[1].id},
        ],
        function(items) {},
      );
    }

    function createPassports() {
      clearAndCreate(
        Passport,
        [
          {number: '1', ownerId: createdUsers[0].id},
          {number: '2', ownerId: createdUsers[1].id},
          {number: '3'},
          {number: '4', ownerId: createdUsers[2].id},
        ],
        function(items) {
          createdPassports = items;
          createPosts();
        },
      );
    }

    function createProfiles() {
      clearAndCreate(
        Profile,
        [
          {profileName: 'Profile A', userId: createdUsers[0].id},
          {profileName: 'Profile B', userId: createdUsers[1].id},
          {profileName: 'Profile Z'},
        ],
        function(items) {
          createdProfiles = items;
          done();
        },
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
          {title: 'Post E'},
        ],
        function(items) {
          createdPosts = items;
          createProfiles();
        },
      );
    }
  });
}

function clearAndCreate(model, data, callback) {
  const createdItems = [];
  model.destroyAll(function() {
    nextItem(null, null);
  });

  let itemIndex = 0;

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
  let db, ChallengerModel, GameParticipationModel, ResultModel;

  before(function(done) {
    db = new DataSource({connector: 'memory'});
    ChallengerModel = db.createModel('Challenger',
      {
        name: String,
      },
      {
        relations: {
          gameParticipations: {
            type: 'hasMany',
            model: 'GameParticipation',
            foreignKey: '',
          },
        },
      });
    GameParticipationModel = db.createModel('GameParticipation',
      {
        date: Date,
      },
      {
        relations: {
          challenger: {
            type: 'belongsTo',
            model: 'Challenger',
            foreignKey: '',
          },
          results: {
            type: 'hasMany',
            model: 'Result',
            foreignKey: '',
          },
        },
      });
    ResultModel = db.createModel('Result', {
      points: Number,
    }, {
      relations: {
        gameParticipation: {
          type: 'belongsTo',
          model: 'GameParticipation',
          foreignKey: '',
        },
      },
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
      {challengerId: challengers[0].id, date: Date.now()},
    ], callback);
  }

  function createResults(gameParticipations, callback) {
    ResultModel.create([
      {gameParticipationId: gameParticipations[0].id, points: 10},
      {gameParticipationId: gameParticipations[0].id, points: 20},
    ], callback);
  }

  it('should recursively serialize objects', function(done) {
    const filter = {include: {gameParticipations: 'results'}};
    ChallengerModel.find(filter, function(err, challengers) {
      const levelOneInclusion = challengers[0].toJSON().gameParticipations[0];
      assert(levelOneInclusion.__data === undefined, '.__data of a level 1 inclusion is undefined.');

      const levelTwoInclusion = challengers[0].toJSON().gameParticipations[0].results[0];
      assert(levelTwoInclusion.__data === undefined, '__data of a level 2 inclusion is undefined.');
      done();
    });
  });
});
