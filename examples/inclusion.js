var jdb = require('../index');

var User, Post, Passport, City, Street, Building;
var nbSchemaRequests = 0;

setup(function () {

  Passport.find({include: 'owner'}, function (err, passports) {
    console.log('passports.owner', passports);
  });

  User.find({include: 'posts'}, function (err, users) {
    console.log('users.posts', users);
  });

  Passport.find({include: {owner: 'posts'}}, function (err, passports) {
    console.log('passports.owner.posts', passports);
  });

  Passport.find({
    include: {owner: {posts: 'author'}}
  }, function (err, passports) {
    console.log('passports.owner.posts.author', passports);
  });

  User.find({include: ['posts', 'passports']}, function (err, users) {
    console.log('users.passports && users.posts', users);
  });

});

function setup(done) {
  var db = new jdb.DataSource({connector: 'memory'});
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
