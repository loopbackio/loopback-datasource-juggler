// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;

describe('ModelBuilder define model', function () {

    it('should be able to define plain models', function (done) {
        var modelBuilder = new ModelBuilder();

        // simplier way to describe model
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

        modelBuilder.models.should.be.a('object').and.have.property('User', User);
        modelBuilder.definitions.should.be.a('object').and.have.property('User');

        var user = new User({name: 'Joe', age: 20});
        // console.log(user);

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
        done(null, User);
    });

    it('should not take unknown properties in strict mode', function (done) {
        var modelBuilder = new ModelBuilder();

        // simplier way to describe model
        var User = modelBuilder.define('User', {name: String, bio: String}, {strict: true});

        var user = new User({name: 'Joe', age: 20});
        // console.log(user);

        User.modelName.should.equal('User');
        user.should.be.a('object');
        // console.log(user);
        assert(user.name === 'Joe');
        assert(user.age === undefined);
        assert(user.toObject().age === undefined);
        assert(user.toObject(true).age === undefined);
        assert(user.bio === undefined);
        done(null, User);
    });

    it('should be able to define open models', function (done) {
        var modelBuilder = new ModelBuilder();

        // simplier way to describe model
        var User = modelBuilder.define('User', {}, {strict: false});

        var user = new User({name: 'Joe', age: 20});
        // console.log(user);

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
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
            emails: [{
                label: String,
                email: String
            }],
            friends: [String]
        });

        // define any custom method
        User.prototype.getNameAndAge = function () {
            return this.name + ', ' + this.age;
        };

        modelBuilder.models.should.be.a('object').and.have.property('User', User);
        modelBuilder.definitions.should.be.a('object').and.have.property('User');

        var user = new User({
                name: 'Joe', age: 20,
                address: {street: '123 Main St', 'city': 'San Jose', state: 'CA'},
                emails: [{label: 'work', email: 'xyz@sample.com'}],
                friends: ['Mary', 'John']
        });
        // console.log(user);

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
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


});


describe('DataSource define model', function () {
    it('should be able to define plain models', function () {
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
        // console.log(user);

        // setup relationships
        User.hasMany(Post, {as: 'posts', foreignKey: 'userId'});

        Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});

        User.hasAndBelongsToMany('groups');

        var user2 = new User({name: 'Smith'});
        user2.save(function (err) {
            // console.log(user2);
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
            // console.log(data);
            var post = data.posts.build({title: 'My Post'});
            // console.log(post);
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
});


describe('Load models from json', function () {
    it('should be able to define models from json', function () {
        var path = require('path'),
            fs = require('fs');


        /**
         * Load LDL schemas from a json doc
         * @param schemaFile The dataSource json file
         * @returns A map of schemas keyed by name
         */
        function loadSchemasSync(schemaFile, dataSource) {
            // Set up the data source
            if (!dataSource) {
                dataSource = new DataSource('memory');
            }

            // Read the dataSource JSON file
            var schemas = JSON.parse(fs.readFileSync(schemaFile));

            return dataSource.buildModels(schemas);

        }

        var models = loadSchemasSync(path.join(__dirname, 'test1-schemas.json'));

        models.should.have.property('Anonymous');
        models.Anonymous.should.have.property('modelName', 'Anonymous');

        var m1 = new models.Anonymous({title: 'Test'});
        m1.should.have.property('title', 'Test');
        m1.should.have.property('author', 'Raymond');

        models = loadSchemasSync(path.join(__dirname, 'test2-schemas.json'));
        models.should.have.property('Address');
        models.should.have.property('Account');
        models.should.have.property('Customer');
        for (var s in models) {
            var m = models[s];
            // console.log(m.modelName, new m());
        }
    });
});

