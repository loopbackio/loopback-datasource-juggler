var DataSource = require('../../loopback-datasource-juggler').DataSource;
var ModelBuilder = require('../../loopback-datasource-juggler').ModelBuilder;
var ds = new DataSource('memory');

// define models
var Post = ds.define('Post', {
    title: { type: String, length: 255 },
    content: { type: DataSource.Text },
    date: { type: Date, default: function () {
        return new Date;
    } },
    timestamp: { type: Number, default: Date.now },
    published: { type: Boolean, default: false, index: true }
});

// simplier way to describe model
var User = ds.define('User', {
    name: String,
    bio: DataSource.Text,
    approved: Boolean,
    joinedAt: Date,
    age: Number
});

var Group = ds.define('Group', {name: String});

// define any custom method
User.prototype.getNameAndAge = function () {
    return this.name + ', ' + this.age;
};

var user = new User({name: 'Joe'});
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

var user2 = new User({name: 'Smith'});
user2.save(function (err) {
    console.log(user2);
    var post = user2.posts.build({title: 'Hello world'});
    post.save(function(err, data) {
       console.log(err ? err: data);
    });
});

Post.findOne({where: {published: false}, order: 'date DESC'}, function (err, data) {
    console.log(data);
});

User.create({name: 'Jeff'}, function (err, data) {
    if (err) {
        console.log(err);
        return;
    }
    console.log(data);
    var post = data.posts.build({title: 'My Post'});
    console.log(post);
});

User.create({name: 'Ray'}, function (err, data) {
    console.log(data);
});

User.scope('minors', {age: {le: 16}});
User.minors(function(err, kids) {
    console.log('Kids: ', kids);
});

var Article = ds.define('Article', {title: String});
var Tag = ds.define('Tag', {name: String});
Article.hasAndBelongsToMany('tags');

Article.create(function(e, article) {
    article.tags.create({name: 'popular'}, function (err, data) {
        Article.findOne(function(e, article) {
            article.tags(function(e, tags) {
                console.log(tags);
            });
        });
    });
});

// should be able to attach a data source to an existing model
var modelBuilder = new ModelBuilder();

Color = modelBuilder.define('Color', {
  name: String
});

// attach
ds.attach(Color);

Color.create({name: 'red'});
Color.create({name: 'green'});
Color.create({name: 'blue'});

Color.all(function (err, colors) {
  console.log(colors);
});

