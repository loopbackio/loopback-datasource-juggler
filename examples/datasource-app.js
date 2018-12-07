// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const DataSource = require('../../loopback-datasource-juggler').DataSource;
const ModelBuilder = require('../../loopback-datasource-juggler').ModelBuilder;
const ds = new DataSource('memory');

// define models
const Post = ds.define('Post', {
  title: {type: String, length: 255},
  content: {type: DataSource.Text},
  date: {type: Date, default: function() {
    return new Date;
  }},
  timestamp: {type: Number, default: Date.now},
  published: {type: Boolean, default: false, index: true},
});

// simplier way to describe model
const User = ds.define('User', {
  name: String,
  bio: DataSource.Text,
  approved: Boolean,
  joinedAt: Date,
  age: Number,
});

const Group = ds.define('Group', {name: String});

// define any custom method
User.prototype.getNameAndAge = function() {
  return this.name + ', ' + this.age;
};

const user = new User({name: 'Joe'});
console.log(user);

// console.log(ds.models);
// console.log(ds.definitions);

// setup relationships
User.hasMany(Post, {as: 'posts', foreignKey: 'userId'});

// creates instance methods:
// user.posts(conds)
// user.posts.build(data) // like new Post({userId: user.id});
// user.posts.create(data) // build and save

Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
// creates instance methods:
// post.author(callback) -- getter when called with function
// post.author() -- sync getter when called without params
// post.author(user) -- setter when called with object

User.hasAndBelongsToMany('groups');

const user2 = new User({name: 'Smith', age: 14});
user2.save(function(err) {
  console.log(user2);
  const post = user2.posts.build({title: 'Hello world'});
  post.save(function(err, data) {
    console.log(err ? err : data);
  });
});

Post.findOne({where: {published: false}, order: 'date DESC'}, function(err, data) {
  console.log(data);
});

User.create({name: 'Jeff', age: 12}, function(err, data) {
  if (err) {
    console.log(err);
    return;
  }
  console.log(data);
  const post = data.posts.build({title: 'My Post'});
  console.log(post);
});

User.create({name: 'Ray'}, function(err, data) {
  console.log(data);
});

User.scope('minors', {where: {age: {lte: 16}}, include: 'posts'});
User.minors(function(err, kids) {
  console.log('Kids: ', kids);
});

const Article = ds.define('Article', {title: String});
const Tag = ds.define('Tag', {name: String});
Article.hasAndBelongsToMany('tags');

Article.create(function(e, article) {
  article.tags.create({name: 'popular'}, function(err, data) {
    Article.findOne(function(e, article) {
      article.tags(function(e, tags) {
        console.log(tags);
      });
    });
  });
});

// should be able to attach a data source to an existing model
const modelBuilder = new ModelBuilder();

const Color = modelBuilder.define('Color', {
  name: String,
});

// attach
ds.attach(Color);

Color.create({name: 'red'});
Color.create({name: 'green'});
Color.create({name: 'blue'});

Color.all(function(err, colors) {
  console.log(colors);
});

