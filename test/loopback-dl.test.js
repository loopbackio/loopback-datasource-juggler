// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');
var async = require('async');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;

describe('ModelBuilder define model', function () {

  it('should be able to define plain models', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    // define any custom method
    User.prototype.getNameAndAge = function () {
      return this.name + ', ' + this.age;
    };

    modelBuilder.models.should.be.type('object').and.have.property('User').exactly(User);
    modelBuilder.definitions.should.be.type('object').and.have.property('User');

    var user = new User({name: 'Joe', age: 20, xyz: false});

    User.modelName.should.equal('User');
    user.should.be.type('object').and.have.property('name', 'Joe');
    user.should.have.property('name', 'Joe');
    user.should.have.property('age', 20);
    user.should.have.property('xyz', false);
    user.should.have.property('bio', undefined);
    done(null, User);
  });

  it('should not take unknown properties in strict mode', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {name: String, bio: String}, {strict: true});

    var user = new User({name: 'Joe', age: 20});

    User.modelName.should.equal('User');
    user.should.be.type('object');
    user.should.have.property('name', 'Joe');
    user.should.not.have.property('age');
    user.toObject().should.not.have.property('age');
    user.toObject(true).should.not.have.property('age');
    user.should.have.property('bio', undefined);
    done(null, User);
  });

  it('should ignore non-predefined properties in strict mode', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {name: String, bio: String}, {strict: true});

    var user = new User({name: 'Joe'});
    user.age = 10;
    user.bio = 'me';

    user.should.have.property('name', 'Joe');
    user.should.have.property('bio', 'me');

    // Non predefined property age should be ignored in strict mode if schemaOnly parameter is not false
    user.toObject().should.not.have.property('age');
    user.toObject(true).should.not.have.property('age');
    user.toObject(false).should.have.property('age', 10);

    // Predefined property bio should be kept in strict mode
    user.toObject().should.have.property('bio', 'me');
    user.toObject(true).should.have.property('bio', 'me');
    user.toObject(false).should.have.property('bio', 'me');
    done(null, User);
  });

  it('should throw when unknown properties are used if strict=throw', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {name: String, bio: String}, {strict: 'throw'});

    try {
      var user = new User({name: 'Joe', age: 20});
      assert(false, 'The code should have thrown an error');
    } catch (e) {
      assert(true, 'The code is expected to throw an error');
    }
    done(null, User);
  });

  it('should be able to define open models', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {}, {strict: false});

    var user = new User({name: 'Joe', age: 20});

    User.modelName.should.equal('User');
    user.should.be.type('object').and.have.property('name', 'Joe');
    user.should.have.property('name', 'Joe');
    user.should.have.property('age', 20);
    user.should.not.have.property('bio');
    done(null, User);
  });

  it('should take non-predefined properties in non-strict mode', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {name: String, bio: String}, {strict: false});

    var user = new User({name: 'Joe'});
    user.age = 10;
    user.bio = 'me';

    user.should.have.property('name', 'Joe');
    user.should.have.property('bio', 'me');

    // Non predefined property age should be kept in non-strict mode
    user.toObject().should.have.property('age', 10);
    user.toObject(true).should.have.property('age', 10);
    user.toObject(false).should.have.property('age', 10);

    // Predefined property bio should be kept
    user.toObject().should.have.property('bio', 'me');
    user.toObject(true).should.have.property('bio', 'me');
    user.toObject(false).should.have.property('bio', 'me');

    done(null, User);
  });

  it('should use false as the default value for strict', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {});

    var user = new User({name: 'Joe', age: 20});

    User.modelName.should.equal('User');
    user.should.be.type('object').and.have.property('name', 'Joe');
    user.should.have.property('name', 'Joe');
    user.should.have.property('age', 20);
    user.should.not.have.property('bio');
    done(null, User);
  });

  it('should be able to define nesting models', function (done) {
    var modelBuilder = new ModelBuilder();

    // simplier way to describe model
    var User = modelBuilder.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: Date,
      age: Number,
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
      },
      emails: [
        {
          label: String,
          email: String
        }
      ],
      friends: [String]
    });

    // define any custom method
    User.prototype.getNameAndAge = function () {
      return this.name + ', ' + this.age;
    };

    modelBuilder.models.should.be.type('object').and.have.property('User', User);
    modelBuilder.definitions.should.be.type('object').and.have.property('User');

    var user = new User({
      name: 'Joe', age: 20,
      address: {street: '123 Main St', 'city': 'San Jose', state: 'CA'},
      emails: [
        {label: 'work', email: 'xyz@sample.com'}
      ],
      friends: ['Mary', 'John']
    });

    User.modelName.should.equal('User');
    user.should.be.type('object').and.have.property('name', 'Joe');
    user.should.have.property('name', 'Joe');
    user.should.have.property('age', 20);
    user.should.have.property('bio', undefined);
    user.should.have.property('address');
    user.address.should.have.property('city', 'San Jose');
    user.address.should.have.property('state', 'CA');

    user = user.toObject();
    user.emails.should.have.property('length', 1);
    user.emails[0].should.have.property('label', 'work');
    user.emails[0].should.have.property('email', 'xyz@sample.com');
    user.friends.should.have.property('length', 2);
    assert.equal(user.friends[0], 'Mary');
    assert.equal(user.friends[1], 'John');
    done(null, User);
  });

  it('should be able to reference models by name before they are defined', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {name: String, address: 'Address'});

    var user;
    try {
      user = new User({name: 'Joe', address: {street: '123 Main St', 'city': 'San Jose', state: 'CA'}});
      assert(false, 'An exception should have been thrown');
    } catch (e) {
      // Ignore
    }

    var Address = modelBuilder.define('Address', {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    });

    user = new User({name: 'Joe', address: {street: '123 Main St', 'city': 'San Jose', state: 'CA'}});

    User.modelName.should.equal('User');
    User.definition.properties.address.should.have.property('type', Address);
    user.should.be.type('object');
    assert(user.name === 'Joe');
    user.address.should.have.property('city', 'San Jose');
    user.address.should.have.property('state', 'CA');
    done(null, User);
  });

  it('should define an id property for composite ids', function () {
    var modelBuilder = new ModelBuilder();
    var Follow = modelBuilder.define('Follow', {
      followerId: { type: String, id: 1 },
      followeeId: { type: String, id: 2 },
      followAt: Date
    });
    var follow = new Follow({ followerId: 1, followeeId: 2 });

    follow.should.have.property('id');
    assert.deepEqual(follow.id, { followerId: 1, followeeId: 2 });
  });

});

describe('DataSource ping', function() {
  var ds = new DataSource('memory');
  ds.settings.connectionTimeout = 50; // ms
  ds.connector.connect = function(cb) {
    // Mock up the long delay
    setTimeout(cb, 100);
  };
  ds.connector.ping = function(cb) {
    cb(new Error('bad connection 2'));
  }

  it('should report connection errors during ping', function(done) {
    ds.ping(function(err) {
      (!!err).should.be.true;
      err.message.should.be.eql('bad connection 2');
      done();
    });
  });

  it('should cancel invocation after timeout', function(done) {
    ds.connected = false; // Force connect
    var Post = ds.define('Post', {
      title: { type: String, length: 255 }
    });
    Post.create(function(err) {
      (!!err).should.be.true;
      err.message.should.be.eql('Timeout in connecting after 50 ms');
      done();
    });
  });
});

describe('DataSource define model', function () {
  it('should be able to define plain models', function () {
    var ds = new DataSource('memory');

// define models
    var Post = ds.define('Post', {
      title: { type: String, length: 255 },
      content: { type: ModelBuilder.Text },
      date: { type: Date, default: function () {
        return new Date();
      } },
      timestamp: { type: Number, default: Date.now },
      published: { type: Boolean, default: false, index: true }
    });

// simpler way to describe model
    var User = ds.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: {type: Date, default: Date},
      age: Number
    });

    var Group = ds.define('Group', {group: String});
    User.mixin(Group);

// define any custom method
    User.prototype.getNameAndAge = function () {
      return this.name + ', ' + this.age;
    };

    var user = new User({name: 'Joe', group: 'G1'});
    assert.equal(user.name, 'Joe');
    assert.equal(user.group, 'G1');

    assert(user.joinedAt instanceof Date);

    // setup relationships
    User.hasMany(Post, {as: 'posts', foreignKey: 'userId'});

    Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});

    User.hasAndBelongsToMany('groups');

    var user2 = new User({name: 'Smith'});
    user2.save(function (err) {
      var post = user2.posts.build({title: 'Hello world'});
      post.save(function (err, data) {
        // console.log(err ? err : data);
      });
    });

    Post.findOne({where: {published: false}, order: 'date DESC'}, function (err, data) {
      // console.log(data);
    });

    User.create({name: 'Jeff'}, function (err, data) {
      if (err) {
        console.log(err);
        return;
      }
      var post = data.posts.build({title: 'My Post'});
    });

    User.create({name: 'Ray'}, function (err, data) {
      // console.log(data);
    });

    var Article = ds.define('Article', {title: String});
    var Tag = ds.define('Tag', {name: String});
    Article.hasAndBelongsToMany('tags');

    Article.create(function (e, article) {
      article.tags.create({name: 'popular'}, function (err, data) {
        Article.findOne(function (e, article) {
          article.tags(function (e, tags) {
            // console.log(tags);
          });
        });
      });
    });

// should be able to attach a data source to an existing model
    var modelBuilder = new ModelBuilder();

    var Color = modelBuilder.define('Color', {
      name: String
    });

    Color.should.not.have.property('create');

// attach
    ds.attach(Color);
    Color.should.have.property('create');

    Color.create({name: 'red'});
    Color.create({name: 'green'});
    Color.create({name: 'blue'});

    Color.all(function (err, colors) {
      colors.should.have.lengthOf(3);
    });

  });

  it('should emit events during attach', function() {
    var ds = new DataSource('memory');
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String
    });

    var seq = 0;
    var dataAccessConfigured = -1;
    var dataSourceAttached = -1;

    User.on('dataAccessConfigured', function (model) {
      dataAccessConfigured = seq++;
      assert(User.create);
      assert(User.hasMany);
    });

    User.on('dataSourceAttached', function (model) {
      assert(User.dataSource instanceof DataSource);
      dataSourceAttached = seq++;
    });

    ds.attach(User);
    assert.equal(dataAccessConfigured, 0);
    assert.equal(dataSourceAttached, 1);
  });

  it('should not take unknown properties in strict mode', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String, bio: String}, {strict: true});

    User.create({name: 'Joe', age: 20}, function (err, user) {

      User.modelName.should.equal('User');
      user.should.be.type('object');
      assert(user.name === 'Joe');
      assert(user.age === undefined);
      assert(user.toObject().age === undefined);
      assert(user.toObject(true).age === undefined);
      assert(user.bio === undefined);
      done(null, User);
    });
  });

  it('should throw when unknown properties are used if strict=throw', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String, bio: String}, {strict: 'throw'});

    try {
      var user = new User({name: 'Joe', age: 20});
      assert(false, 'The code should have thrown an error');
    } catch (e) {
      assert(true, 'The code is expected to throw an error');
    }
    done(null, User);
  });

  it('should be able to define open models', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {}, {strict: false});
    User.modelName.should.equal('User');

    User.create({name: 'Joe', age: 20}, function (err, user) {

      user.should.be.type('object').and.have.property('name', 'Joe');
      user.should.have.property('name', 'Joe');
      user.should.have.property('age', 20);
      user.should.not.have.property('bio');

      User.findById(user.id, function (err, user) {
        user.should.be.type('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
        done(null, User);
      });
    });
  });

  it('should use false as the default value for strict', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {});

    User.create({name: 'Joe', age: 20}, function (err, user) {

      User.modelName.should.equal('User');
      user.should.be.type('object').and.have.property('name', 'Joe');
      user.should.have.property('name', 'Joe');
      user.should.have.property('age', 20);
      user.should.not.have.property('bio');
      done(null, User);
    });
  });

  it('should use true as the default value for strict for relational DBs', function (done) {
    var ds = new DataSource('memory');
    ds.connector.relational = true; // HACK

    var User = ds.define('User', {name: String, bio: String}, {strict: true});

    var user = new User({name: 'Joe', age: 20});

    User.modelName.should.equal('User');
    user.should.be.type('object');
    assert(user.name === 'Joe');
    assert(user.age === undefined);
    assert(user.toObject().age === undefined);
    assert(user.toObject(true).age === undefined);
    assert(user.bio === undefined);
    done(null, User);
  });

  it('should throw when unknown properties are used if strict=false for relational DBs', function (done) {
    var ds = new DataSource('memory');
    ds.connector.relational = true; // HACK

    var User = ds.define('User', {name: String, bio: String}, {strict: 'throw'});

    try {
      var user = new User({name: 'Joe', age: 20});
      assert(false, 'The code should have thrown an error');
    } catch (e) {
      assert(true, 'The code is expected to throw an error');
    }
    done(null, User);
  });

  it('should change the property value for save if strict=false', function (done) {
    var ds = new DataSource('memory');// define models
    var Post = ds.define('Post');

    Post.create({price: 900}, function (err, post) {
      assert.equal(post.price, 900);
      post.price = 1000;
      post.save(function (err, result) {
        assert.equal(1000, result.price);
        done(err, result);
      });
    });
  });

  it('supports instance level strict mode', function () {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String, bio: String}, {strict: true});

    var user = new User({name: 'Joe', age: 20}, {strict: false});

    user.should.have.property('__strict', false);
    user.should.be.type('object');
    user.should.have.property('name', 'Joe');
    user.should.have.property('age', 20);
    user.toObject().should.have.property('age', 20);
    user.toObject(true).should.have.property('age', 20);

    user.setStrict(true);
    user.toObject().should.not.have.property('age');
    user.toObject(true).should.not.have.property('age');
    user.toObject(false).should.have.property('age', 20);

  });

  it('should update the instance with unknown properties', function (done) {
    var ds = new DataSource('memory');// define models
    Post = ds.define('Post', {
      title: { type: String, length: 255, index: true },
      content: { type: String }
    });

    Post.create({title: 'a', content: 'AAA'}, function (err, post) {
      post.updateAttributes({title: 'b', xyz: 'xyz'}, function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        p.xyz.should.be.equal('xyz');

        Post.findById(post.id, function (err, p) {
          p.id.should.be.equal(post.id);
          p.content.should.be.equal(post.content);
          p.xyz.should.be.equal('xyz');
          p.title.should.be.equal('b');
          done();
        });
      });

    });
  });

  it('injects id by default', function (done) {
    var ds = new ModelBuilder();

    var User = ds.define('User', {});
    assert.deepEqual(User.definition.properties.id,
      {type: Number, id: 1, generated: true});

    done();
  });

  it('disables idInjection if the value is false', function (done) {
    var ds = new ModelBuilder();

    var User1 = ds.define('User', {}, {idInjection: false});
    assert(!User1.definition.properties.id);
    done();
  });

  it('updates generated id type by the connector', function (done) {
    var builder = new ModelBuilder();

    var User = builder.define('User', {id: {type: String, generated: true, id: true}});
    assert.deepEqual(User.definition.properties.id,
      {type: String, id: 1, generated: true});

    var ds = new DataSource('memory');// define models
    User.attachTo(ds);

    assert.deepEqual(User.definition.properties.id,
      {type: Number, id: 1, generated: true});

    done();
  });

  it('should allow an explicit remoting path', function () {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String, bio: String}, {
      http: { path: 'accounts' }
    });
    User.http.path.should.equal('/accounts');
  });

});

describe('Load models with base', function () {
  it('should set up base class via base option', function () {
    var ds = new ModelBuilder();

    var User = ds.define('User', {name: String});

    User.staticMethod = function staticMethod() {
    };
    User.prototype.instanceMethod = function instanceMethod() {
    };

    var Customer = ds.define('Customer', {vip: Boolean}, {base: 'User'});

    assert(Customer.prototype instanceof User);
    assert(Customer.staticMethod === User.staticMethod);
    assert(Customer.prototype.instanceMethod === User.prototype.instanceMethod);
    assert.equal(Customer.base, User);
    assert.equal(Customer.base, Customer.super_);

    try {
      var Customer1 = ds.define('Customer1', {vip: Boolean}, {base: 'User1'});
    } catch (e) {
      assert(e);
    }
  });

  it('should inherit properties from base option', function () {
    var ds = new ModelBuilder();

    var User = ds.define('User', {name: String});

    var Customer = ds.define('Customer', {vip: Boolean}, {base: 'User'});

    Customer.definition.properties.should.have.property('name');
    Customer.definition.properties.name.should.have.property('type', String);
  });

  it('should revert properties from base model', function() {
    var ds = new ModelBuilder();

    var User = ds.define('User', {username: String, email: String});

    var Customer = ds.define('Customer',
      {name: String, username: null, email: false},
      {base: 'User'});

    Customer.definition.properties.should.have.property('name');
    // username/email are now shielded
    Customer.definition.properties.should.not.have.property('username');
    Customer.definition.properties.should.not.have.property('email');
    var c = new Customer({name: 'John'});
    c.should.have.property('username', undefined);
    c.should.have.property('email', undefined);
    c.should.have.property('name', 'John');
    var u = new User({username: 'X', email: 'x@y.com'});
    u.should.not.have.property('name');
    u.should.have.property('username', 'X');
    u.should.have.property('email', 'x@y.com');
  });


  it('should set up base class via parent arg', function () {
    var ds = new ModelBuilder();

    var User = ds.define('User', {name: String});

    User.staticMethod = function staticMethod() {
    };
    User.prototype.instanceMethod = function instanceMethod() {
    };

    var Customer = ds.define('Customer', {vip: Boolean}, {}, User);

    Customer.definition.properties.should.have.property('name');
    Customer.definition.properties.name.should.have.property('type', String);

    assert(Customer.prototype instanceof User);
    assert(Customer.staticMethod === User.staticMethod);
    assert(Customer.prototype.instanceMethod === User.prototype.instanceMethod);
    assert.equal(Customer.base, User);
    assert.equal(Customer.base, Customer.super_);
  });
});

describe('Models attached to a dataSource', function() {
  var Post;
  before(function() {
    var ds = new DataSource('memory');// define models
    Post = ds.define('Post', {
      title: { type: String, length: 255, index: true },
      content: { type: String },
      comments: [String]
    });
  });

  beforeEach(function(done) {
    Post.destroyAll(done);
  });

  it('updateOrCreate should update the instance', function (done) {
    Post.create({title: 'a', content: 'AAA'}, function (err, post) {
      post.title = 'b';
      Post.updateOrCreate(post, function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        should.not.exist(p._id);

        Post.findById(post.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal('b');

          done();
        });
      });

    });
  });

  it('updateOrCreate should update the instance without removing existing properties', function (done) {
    Post.create({title: 'a', content: 'AAA', comments: ['Comment1']}, function (err, post) {
      post = post.toObject();
      delete post.title;
      delete post.comments;
      Post.updateOrCreate(post, function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        should.not.exist(p._id);

        Post.findById(post.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal('a');
          p.comments.length.should.be.equal(1);
          p.comments[0].should.be.equal('Comment1');
          done();
        });
      });

    });
  });

  it('updateOrCreate should create a new instance if it does not exist', function (done) {
    var post = {id: 123, title: 'a', content: 'AAA'};
    Post.updateOrCreate(post, function (err, p) {
      should.not.exist(err);
      p.title.should.be.equal(post.title);
      p.content.should.be.equal(post.content);
      p.id.should.be.equal(post.id);

      Post.findById(p.id, function (err, p) {
        p.id.should.be.equal(post.id);
        should.not.exist(p._id);
        p.content.should.be.equal(post.content);
        p.title.should.be.equal(post.title);
        p.id.should.be.equal(post.id);

        done();
      });
    });

  });

  it('save should update the instance with the same id', function (done) {
    Post.create({title: 'a', content: 'AAA'}, function (err, post) {
      post.title = 'b';
      post.save(function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        should.not.exist(p._id);

        Post.findById(post.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal('b');

          done();
        });
      });

    });
  });

  it('save should update the instance without removing existing properties', function (done) {
    Post.create({title: 'a', content: 'AAA'}, function (err, post) {
      delete post.title;
      post.save(function (err, p) {
        should.not.exist(err);
        p.id.should.be.equal(post.id);
        p.content.should.be.equal(post.content);
        should.not.exist(p._id);

        Post.findById(post.id, function (err, p) {
          p.id.should.be.equal(post.id);
          should.not.exist(p._id);
          p.content.should.be.equal(post.content);
          p.title.should.be.equal('a');

          done();
        });
      });

    });
  });

  it('save should create a new instance if it does not exist', function (done) {
    var post = new Post({id: '123', title: 'a', content: 'AAA'});
    post.save(post, function (err, p) {
      should.not.exist(err);
      p.title.should.be.equal(post.title);
      p.content.should.be.equal(post.content);
      p.id.should.be.equal(post.id);

      Post.findById(p.id, function (err, p) {
        p.id.should.be.equal(post.id);
        should.not.exist(p._id);
        p.content.should.be.equal(post.content);
        p.title.should.be.equal(post.title);
        p.id.should.be.equal(post.id);

        done();
      });
    });

  });
});

describe('DataSource connector types', function() {
  it('should return an array of types', function() {
    var ds = new DataSource('memory');
    var types = ds.getTypes();
    assert.deepEqual(types, ['db', 'nosql', 'memory']);
  });

  it('should test supported types by string', function() {
    var ds = new DataSource('memory');
    var result = ds.supportTypes('db');
    assert(result);
  });

  it('should test supported types by array', function() {
    var ds = new DataSource('memory');
    var result = ds.supportTypes(['db', 'memory']);
    assert(result);
  });

  it('should test unsupported types by string', function() {
    var ds = new DataSource('memory');
    var result = ds.supportTypes('rdbms');
    assert(!result);
  });

  it('should test unsupported types by array', function() {
    var ds = new DataSource('memory');
    var result = ds.supportTypes(['rdbms', 'memory']);
    assert(!result);

    result = ds.supportTypes(['rdbms']);
    assert(!result);
  });

});

describe('DataSource constructor', function () {
  // Mocked require
  var loader = function (name) {
    if (name.indexOf('./connectors/') !== -1) {
      // ./connectors/<name> doesn't exist
      return null;
    }
    if (name === 'loopback-connector-abc') {
      // Assume loopback-connector-abc doesn't exist
      return null;
    }
    return {
      name: name
    };
  };

  it('should resolve connector by path', function () {
    var connector = DataSource._resolveConnector(__dirname + '/../lib/connectors/memory');
    assert(connector.connector);
  });
  it('should resolve connector by internal name', function () {
    var connector = DataSource._resolveConnector('memory');
    assert(connector.connector);
  });
  it('should try to resolve connector by module name starts with loopback-connector-', function () {
    var connector = DataSource._resolveConnector('loopback-connector-xyz', loader);
    assert(connector.connector);
  });
  it('should try to resolve connector by short module name with full name first', function () {
    var connector = DataSource._resolveConnector('xyz', loader);
    assert(connector.connector);
    assert.equal(connector.connector.name, 'loopback-connector-xyz');
  });
  it('should try to resolve connector by short module name', function () {
    var connector = DataSource._resolveConnector('abc', loader);
    assert(connector.connector);
    assert.equal(connector.connector.name, 'abc');
  });
  it('should try to resolve connector by short module name for known connectors', function () {
    var connector = DataSource._resolveConnector('oracle', loader);
    assert(connector.connector);
    assert.equal(connector.connector.name, 'loopback-connector-oracle');
  });
  it('should try to resolve connector by full module name', function () {
    var connector = DataSource._resolveConnector('loopback-xyz', loader);
    assert(connector.connector);
  });
  it('should fail to resolve connector by module name starts with loopback-connector-', function () {
    var connector = DataSource._resolveConnector('loopback-connector-xyz');
    assert(!connector.connector);
    assert(connector.error.indexOf('loopback-connector-xyz') !== -1);
  });
  it('should fail to resolve connector by short module name', function () {
    var connector = DataSource._resolveConnector('xyz');
    assert(!connector.connector);
    assert(connector.error.indexOf('loopback-connector-xyz') !== -1);
  });
  it('should fail to resolve connector by full module name', function () {
    var connector = DataSource._resolveConnector('loopback-xyz');
    assert(!connector.connector);
    assert(connector.error.indexOf('loopback-connector-loopback-xyz') !== -1);
  });
});

describe('Load models with relations', function () {
  it('should set up relations', function (done) {
    var ds = new DataSource('memory');

    var Post = ds.define('Post', {userId: Number, content: String});
    var User = ds.define('User', {name: String}, {relations: {posts: {type: 'hasMany', model: 'Post'}}});

    assert(User.relations['posts']);
    done();
  });

  it('should set up belongsTo relations', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String});
    var Post = ds.define('Post', {userId: Number, content: String}, {relations: {user: {type: 'belongsTo', model: 'User'}}});

    assert(Post.relations['user']);
    done();
  });

  it('should set up referencesMany relations', function (done) {
    var ds = new DataSource('memory');

    var Post = ds.define('Post', {userId: Number, content: String});
    var User = ds.define('User', {name: String}, {relations: {posts: {type: 'referencesMany', model: 'Post'}}});

    assert(User.relations['posts']);
    done();
  });

  it('should set up embedsMany relations', function (done) {
    var ds = new DataSource('memory');

    var Post = ds.define('Post', {userId: Number, content: String});
    var User = ds.define('User', {name: String}, {relations: {posts: {type: 'embedsMany', model: 'Post' }}});

    assert(User.relations['posts']);
    done();
  });

  it('should set up polymorphic relations', function (done) {
    var ds = new DataSource('memory');

    var Author = ds.define('Author', {name: String}, {relations: {
      pictures: {type: 'hasMany', model: 'Picture', polymorphic: 'imageable'}
    }});
    var Picture = ds.define('Picture', {name: String}, {relations: {
      imageable: {type: 'belongsTo', polymorphic: true}
    }});

    assert(Author.relations['pictures']);
    assert.deepEqual(Author.relations['pictures'].toJSON(), {
      name: 'pictures',
      type: 'hasMany',
      modelFrom: 'Author',
      keyFrom: 'id',
      modelTo: 'Picture',
      keyTo: 'imageableId',
      multiple: true,
      polymorphic: {
        as: 'imageable',
        foreignKey: 'imageableId',
        discriminator: 'imageableType'
      }
    });

    assert(Picture.relations['imageable']);
    assert.deepEqual(Picture.relations['imageable'].toJSON(), {
      name: 'imageable',
      type: 'belongsTo',
      modelFrom: 'Picture',
      keyFrom: 'imageableId',
      modelTo: '<polymorphic>',
      keyTo: 'id',
      multiple: false,
      polymorphic: {
        as: 'imageable',
        foreignKey: 'imageableId',
        discriminator: 'imageableType'
      }
    });
    done();
  });

  it('should set up foreign key with the correct type', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String, id: {type: String, id: true}});
    var Post = ds.define('Post', {content: String}, {relations: {user: {type: 'belongsTo', model: 'User'}}});

    var fk = Post.definition.properties['userId'];
    assert(fk, 'The foreign key should be added');
    assert(fk.type === String, 'The foreign key should be the same type as primary key');
    assert(Post.relations['user'], 'User relation should be set');
    done();
  });

  it('should set up hasMany and belongsTo relations', function (done) {
    var ds = new DataSource('memory');

    var User = ds.define('User', {name: String}, {relations: {posts: {type: 'hasMany', model: 'Post'}, accounts: {type: 'hasMany', model: 'Account'}}});

    assert(!User.relations['posts']);
    assert(!User.relations['accounts']);

    var Post = ds.define('Post', {userId: Number, content: String}, {relations: {user: {type: 'belongsTo', model: 'User'}}});

    var Account = ds.define('Account', {userId: Number, type: String}, {relations: {user: {type: 'belongsTo', model: 'User'}}});

    assert(Post.relations['user']);
    assert.deepEqual(Post.relations['user'].toJSON(), {
      name: 'user',
      type: 'belongsTo',
      modelFrom: 'Post',
      keyFrom: 'userId',
      modelTo: 'User',
      keyTo: 'id',
      multiple: false
    });
    assert(User.relations['posts']);
    assert.deepEqual(User.relations['posts'].toJSON(), {
      name: 'posts',
      type: 'hasMany',
      modelFrom: 'User',
      keyFrom: 'id',
      modelTo: 'Post',
      keyTo: 'userId',
      multiple: true
    });
    assert(User.relations['accounts']);
    assert.deepEqual(User.relations['accounts'].toJSON(), {
      name: 'accounts',
      type: 'hasMany',
      modelFrom: 'User',
      keyFrom: 'id',
      modelTo: 'Account',
      keyTo: 'userId',
      multiple: true
    });

    done();
  });

  it('should throw if a relation is missing type', function (done) {
    var ds = new DataSource('memory');

    var Post = ds.define('Post', {userId: Number, content: String});

    try {
      var User = ds.define('User', {name: String}, {relations: {posts: {model: 'Post'}}});
    } catch (e) {
      done();
    }

  });

  it('should throw if the relation type is invalid', function (done) {
    var ds = new DataSource('memory');

    var Post = ds.define('Post', {userId: Number, content: String});

    try {
      var User = ds.define('User', {name: String}, {relations: {posts: {type: 'hasXYZ', model: 'Post'}}});
    } catch (e) {
      done();
    }

  });

  it('should handle hasMany through', function (done) {
    var ds = new DataSource('memory');
    var Physician = ds.createModel('Physician', {
      name: String
    }, {relations: {patients: {model: 'Patient', type: 'hasMany', through: 'Appointment'}}});

    var Patient = ds.createModel('Patient', {
      name: String
    }, {relations: {physicians: {model: 'Physician', type: 'hasMany', through: 'Appointment'}}});

    assert(!Physician.relations['patients']); // Appointment hasn't been resolved yet
    assert(!Patient.relations['physicians']); // Appointment hasn't been resolved yet

    var Appointment = ds.createModel('Appointment', {
      physicianId: Number,
      patientId: Number,
      appointmentDate: Date
    }, {relations: {patient: {type: 'belongsTo', model: 'Patient'}, physician: {type: 'belongsTo', model: 'Physician'}}});

    assert(Physician.relations['patients']);
    assert(Patient.relations['physicians']);
    done();
  });

  it('should handle hasMany through options', function (done) {
    var ds = new DataSource('memory');
    var Physician = ds.createModel('Physician', {
      name: String
    }, {relations: {patients: {model: 'Patient', type: 'hasMany', foreignKey: 'leftId', through: 'Appointment'}}});

    var Patient = ds.createModel('Patient', {
      name: String
    }, {relations: {physicians: {model: 'Physician', type: 'hasMany', foreignKey: 'rightId', through: 'Appointment'}}});

    var Appointment = ds.createModel('Appointment', {
      physicianId: Number,
      patientId: Number,
      appointmentDate: Date
    }, {relations: {patient: {type: 'belongsTo', model: 'Patient'}, physician: {type: 'belongsTo', model: 'Physician'}}});

    assert(Physician.relations['patients'].keyTo === 'leftId');
    assert(Patient.relations['physicians'].keyTo === 'rightId');
    done();
  });

  it('should set up relations after attach', function (done) {
    var ds = new DataSource('memory');
    var modelBuilder = new ModelBuilder();

    var Post = modelBuilder.define('Post', {userId: Number, content: String});
    var User = modelBuilder.define('User', {name: String}, {relations: {posts: {type: 'hasMany', model: 'Post'}}});

    assert(!User.relations['posts']);
    Post.attachTo(ds);
    User.attachTo(ds);
    assert(User.relations['posts']);
    done();
  });

});

describe('Model with scopes', function () {
  it('should create scopes', function (done) {
    var ds = new DataSource('memory');
    var User = ds.define('User', {name: String, vip: Boolean, age: Number},
      {scopes: {vips: {where: {vip: true}}, top5: {limit: 5, order: 'age'}}});

    var users = [];
    for (var i = 0; i < 10; i++) {
      users.push({name: 'User' + i, vip: i % 3 === 0, age: 20 + i * 2});
    }
    async.each(users, function (user, callback) {
      User.create(user, callback);
    }, function (err) {
      User.vips(function (err, vips) {
        if(err) {
          return done(err);
        }
        assert.equal(vips.length, 4);
        User.top5(function (err, top5) {
          assert.equal(top5.length, 5);
          done(err);
        });
      });
    });
  });
});

describe('DataAccessObject', function () {
  var ds, model, where, error;

  before(function () {
    ds = new DataSource('memory');
    model = ds.createModel('M1', {
      id: {type: String, id: true},
      age: Number,
      vip: Boolean,
      date: Date,
      location: 'GeoPoint',
      scores: [Number]
    });
  });

  beforeEach(function () {
    error = null;
  });

  it('should be able to coerce where clause for string types', function () {
    where = model._coerce({id: 1});
    assert.deepEqual(where, {id: '1'});
    where = model._coerce({id: '1'});
    assert.deepEqual(where, {id: '1'});
  });

  it('should be able to coerce where clause for number types', function () {
    where = model._coerce({age: '10'});
    assert.deepEqual(where, {age: 10});

    where = model._coerce({age: 10});
    assert.deepEqual(where, {age: 10});

    where = model._coerce({age: {gt: 10}});
    assert.deepEqual(where, {age: {gt: 10}});

    where = model._coerce({age: {gt: '10'}});
    assert.deepEqual(where, {age: {gt: 10}});

    where = model._coerce({age: {between: ['10', '20']}});
    assert.deepEqual(where, {age: {between: [10, 20]}});
  });

  it('should be able to coerce where clause for array types', function () {
    where = model._coerce({scores: ['10', '20']});
    assert.deepEqual(where, {scores: [10, 20]});
  });

  it('should be able to coerce where clause for date types', function () {
    var d = new Date();
    where = model._coerce({date: d});
    assert.deepEqual(where, {date: d});

    where = model._coerce({date: d.toISOString()});
    assert.deepEqual(where, {date: d});
  });

  it('should be able to coerce where clause for boolean types', function () {
    where = model._coerce({vip: 'true'});
    assert.deepEqual(where, {vip: true});

    where = model._coerce({vip: true});
    assert.deepEqual(where, {vip: true});

    where = model._coerce({vip: 'false'});
    assert.deepEqual(where, {vip: false});

    where = model._coerce({vip: false});
    assert.deepEqual(where, {vip: false});

    where = model._coerce({vip: '1'});
    assert.deepEqual(where, {vip: true});

    where = model._coerce({vip: 0});
    assert.deepEqual(where, {vip: false});

    where = model._coerce({vip: ''});
    assert.deepEqual(where, {vip: false});

  });

  it('should be able to coerce where clause with and operators', function () {
    where = model._coerce({and: [{age: '10'}, {vip: 'true'}]});
    assert.deepEqual(where, {and: [{age: 10}, {vip: true}]});
  });

  it('should be able to coerce where clause with or operators', function () {
    where = model._coerce({or: [{age: '10'}, {vip: 'true'}]});
    assert.deepEqual(where, {or: [{age: 10}, {vip: true}]});
  });

  it('should throw if the where property is not an object', function () {
    try {
      // The where clause has to be an object
      model._coerce('abc');
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if the where property is an array', function () {
    try {
      // The where clause cannot be an array
      model._coerce([
        {vip: true}
      ]);
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if the and operator does not take an array', function () {
    try {
      // The and operator only takes an array of objects
      model._coerce({and: {x: 1}});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if the or operator does not take an array', function () {
    try {
      // The or operator only takes an array of objects
      model._coerce({or: {x: 1}});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if the or operator does not take an array of objects', function () {
    try {
      // The or operator only takes an array of objects
      model._coerce({or: ['x']});
    } catch(err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter property is not an object', function () {
    var filter = null;
    try {
      // The filter clause has to be an object
      filter = model._normalize('abc');
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter.limit property is not a number', function () {
    try {
      // The limit param must be a valid number
      filter = model._normalize({limit: 'x'});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter.limit property is nagative', function () {
    try {
      // The limit param must be a valid number
      filter = model._normalize({limit: -1});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter.limit property is not an integer', function () {
    try {
      // The limit param must be a valid number
      filter = model._normalize({limit: 5.8});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter.offset property is not a number', function () {
    try {
      // The limit param must be a valid number
      filter = model._normalize({offset: 'x'});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should throw if filter.skip property is not a number', function () {
    try {
      // The limit param must be a valid number
      filter = model._normalize({skip: '_'});
    } catch (err) {
      error = err;
    }
    assert(error, 'An error should have been thrown');
  });

  it('should normalize limit/offset/skip', function () {
    filter = model._normalize({limit: '10', skip: 5});
    assert.deepEqual(filter, {limit: 10, offset: 5, skip: 5});
  });

  it('should set the default value for limit', function () {
    filter = model._normalize({skip: 5});
    assert.deepEqual(filter, {limit: 100, offset: 5, skip: 5});
  });

  it('should skip GeoPoint', function () {
    where = model._coerce({location: {near: {lng: 10, lat: 20}, maxDistance: 20}});
    assert.deepEqual(where, {location: {near: {lng: 10, lat: 20}, maxDistance: 20}});
  });

  it('should skip null values', function () {
    where = model._coerce({date: null});
    assert.deepEqual(where, {date: null});
  });

  it('should skip undefined values', function () {
    where = model._coerce({date: undefined});
    assert.deepEqual(where, {date: undefined});
  });

  it('should skip conversion if a simple property produces NaN for numbers',
    function () {
      where = model._coerce({age: 'xyz'});
      assert.deepEqual(where, {age: 'xyz'});
    });

  it('should skip conversion if an array property produces NaN for numbers',
    function () {
      where = model._coerce({age: {inq: ['xyz', '12']}});
      assert.deepEqual(where, {age: {inq: ['xyz', 12]}});
    });

});

describe('Load models from json', function () {
  var path = require('path'),
    fs = require('fs');

  /**
   * Load LDL schemas from a json doc
   * @param schemaFile The dataSource json file
   * @returns A map of schemas keyed by name
   */
  function loadSchemasSync(schemaFile, dataSource) {
    var modelBuilder, createModel;
    // Set up the data source
    if (!dataSource) {
      modelBuilder = new ModelBuilder();
    } else {
      modelBuilder = dataSource.modelBuilder;
      createModel = dataSource.createModel.bind(dataSource);
    }

    // Read the dataSource JSON file
    var schemas = JSON.parse(fs.readFileSync(schemaFile));
    return modelBuilder.buildModels(schemas, createModel);
  }

  it('should be able to define models from json', function () {

    var models = loadSchemasSync(path.join(__dirname, 'test1-schemas.json'));

    models.should.have.property('AnonymousModel_0');
    models.AnonymousModel_0.should.have.property('modelName', 'AnonymousModel_0');

    var m1 = new models.AnonymousModel_0({title: 'Test'});
    m1.should.have.property('title', 'Test');
    m1.should.have.property('author', 'Raymond');

    models = loadSchemasSync(path.join(__dirname, 'test2-schemas.json'));
    models.should.have.property('Address');
    models.should.have.property('Account');
    models.should.have.property('Customer');
    for (var s in models) {
      var m = models[s];
      assert(new m());
    }
  });

  it('should be able to define models from json using dataSource', function() {
    var ds = new DataSource('memory');

    var models = loadSchemasSync(path.join(__dirname, 'test2-schemas.json'), ds);
    models.should.have.property('Address');
    models.should.have.property('Account');
    models.should.have.property('Customer');
    assert.equal(models.Address.dataSource, ds);
  });

  it('should allow customization of default model base class', function () {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    modelBuilder.defaultModelBaseClass = User;

    var Customer = modelBuilder.define('Customer', {customerId: {type: String, id: true}});
    assert(Customer.prototype instanceof User);
  });

  it('should allow model base class', function () {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    var Customer = modelBuilder.define('Customer',
      {customerId: {type: String, id: true}}, {}, User);
    assert(Customer.prototype instanceof User);
  });

  it('should be able to extend models', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String,
      bio: ModelBuilder.Text,
      approved: Boolean,
      joinedAt: Date,
      age: Number
    });

    var Customer = User.extend('Customer', {customerId: {type: String, id: true}});

    var customer = new Customer({name: 'Joe', age: 20, customerId: 'c01'});

    customer.should.be.type('object').and.have.property('name', 'Joe');
    customer.should.have.property('name', 'Joe');
    customer.should.have.property('age', 20);
    customer.should.have.property('customerId', 'c01');
    customer.should.have.property('bio', undefined);

    // The properties are defined at prototype level
    assert.equal(Object.keys(customer).filter(function (k) {
      // Remove internal properties
      return k.indexOf('__') === -1;
    }).length, 0);
    var count = 0;
    for (var p in customer) {
      if (p.indexOf('__') === 0) {
        continue;
      }
      if (typeof customer[p] !== 'function') {
        count++;
      }
    }
    assert.equal(count, 7); // Please note there is an injected id from User prototype
    assert.equal(Object.keys(customer.toObject()).filter(function (k) {
      // Remove internal properties
      return k.indexOf('__') === -1;
    }).length, 6);

    done(null, customer);
  });

  it('should be able to extend models with merged settings', function (done) {
    var modelBuilder = new ModelBuilder();

    var User = modelBuilder.define('User', {
      name: String
    }, {
      defaultPermission: 'ALLOW',
      acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW'
        }
      ],
      relations: {
        posts: {
          type: 'hasMany',
          model: 'Post'
        }
      }
    });

    var Customer = User.extend('Customer',
      {customerId: {type: String, id: true}},
      {
        defaultPermission: 'DENY',
        acls: [
          {
            principalType: 'ROLE',
            principalId: '$unauthenticated',
            permission: 'DENY'
          }
        ],
        relations: {
          orders: {
            type: 'hasMany',
            model: 'Order'
          }
        }
      }
    );

    assert.deepEqual(User.settings, {
      defaultPermission: 'ALLOW',
      acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW'
        }
      ],
      relations: {
        posts: {
          type: 'hasMany',
          model: 'Post'
        }
      },
      strict: false
    });

    assert.deepEqual(Customer.settings, {
      defaultPermission: 'DENY',
      acls: [
        {
          principalType: 'ROLE',
          principalId: '$everyone',
          permission: 'ALLOW'
        },
        {
          principalType: 'ROLE',
          principalId: '$unauthenticated',
          permission: 'DENY'
        }
      ],
      relations: {
        posts: {
          type: 'hasMany',
          model: 'Post'
        },
        orders: {
          type: 'hasMany',
          model: 'Order'
        }
      },
      strict: false,
      base: User
    });

    done();
  });
});

describe('DataSource constructor', function () {
  it('Takes url as the settings', function () {
    var ds = new DataSource('memory://localhost/mydb?x=1');
    assert.equal(ds.connector.name, 'memory');
  });

  it('Takes connector name', function () {
    var ds = new DataSource('memory');
    assert.equal(ds.connector.name, 'memory');
  });

  it('Takes settings object', function () {
    var ds = new DataSource({connector: 'memory'});
    assert.equal(ds.connector.name, 'memory');
  });

  it('Takes settings object and name', function () {
    var ds = new DataSource('x', {connector: 'memory'});
    assert.equal(ds.connector.name, 'memory');
  });
});

describe('ModelBuilder options.models', function () {
  it('should inject model classes from models', function () {
    var builder = new ModelBuilder();
    var M1 = builder.define('M1');
    var M2 = builder.define('M2', {}, {models: {
      'M1': M1
    }});

    assert.equal(M2.M1, M1, 'M1 should be injected to M2');
  });

  it('should inject model classes by name in the models', function () {
    var builder = new ModelBuilder();
    var M1 = builder.define('M1');
    var M2 = builder.define('M2', {}, {models: {
      'M1': 'M1'
    }});

    assert.equal(M2.M1, M1, 'M1 should be injected to M2');
  });

  it('should inject model classes by name in the models before the class is defined',
    function () {
      var builder = new ModelBuilder();
      var M2 = builder.define('M2', {}, {models: {
        'M1': 'M1'
      }});
      assert(M2.M1, 'M1 should be injected to M2');
      assert(M2.M1.settings.unresolved, 'M1 is still a proxy');
      var M1 = builder.define('M1');
      assert.equal(M2.M1, M1, 'M1 should be injected to M2');
    });

});

