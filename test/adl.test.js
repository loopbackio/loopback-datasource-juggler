// This test written in mocha+should.js
var should = require('./init.js');

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
        console.log(user);

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
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
        console.log(user);

        // setup relationships
        User.hasMany(Post, {as: 'posts', foreignKey: 'userId'});

        Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});

        User.hasAndBelongsToMany('groups');

        var user2 = new User({name: 'Smith'});
        user2.save(function (err) {
            console.log(user2);
            var post = user2.posts.build({title: 'Hello world'});
            post.save(function (err, data) {
                console.log(err ? err : data);
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

        var Article = ds.define('Article', {title: String});
        var Tag = ds.define('Tag', {name: String});
        Article.hasAndBelongsToMany('tags');

        Article.create(function (e, article) {
            article.tags.create({name: 'popular'}, function (err, data) {
                Article.findOne(function (e, article) {
                    article.tags(function (e, tags) {
                        console.log(tags);
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
         * Load ADL schemas from a json doc
         * @param schemaFile The schema json file
         * @returns A map of schemas keyed by name
         */
        function loadSchemasSync(schemaFile, dataSource) {
            // Set up the data source
            if (!dataSource) {
                dataSource = new DataSource('memory');
            }

            // Read the schema JSON file
            var schemas = JSON.parse(fs.readFileSync(schemaFile));

            return DataSource.buildModels(dataSource, schemas);

        }

        var models = loadSchemasSync(path.join(__dirname, 'test1-schemas.json'));

        models.should.have.property('anonymous');
        models.anonymous.should.have.property('modelName', 'Anonymous');

        var m1 = new models.anonymous({title: 'Test'});
        m1.should.have.property('title', 'Test');
        m1.should.have.property('author', 'Raymond');

        models = loadSchemasSync(path.join(__dirname, 'test2-schemas.json'));
        models.should.have.property('address');
        models.should.have.property('account');
        models.should.have.property('customer');
        for (var s in models) {
            var m = models[s];
            console.log(m.modelName, new m());
        }
    });
});

