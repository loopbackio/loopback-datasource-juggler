// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');

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

        modelBuilder.models.should.be.a('object').and.have.property('User', User);
        modelBuilder.definitions.should.be.a('object').and.have.property('User');

        var user = new User({name: 'Joe', age: 20});

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
        done(null, User);
    });

    it('should not take unknown properties in strict mode', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = modelBuilder.define('User', {name: String, bio: String}, {strict: true});

        var user = new User({name: 'Joe', age: 20});

        User.modelName.should.equal('User');
        user.should.be.a('object');
        assert(user.name === 'Joe');
        assert(user.age === undefined);
        assert(user.toObject().age === undefined);
        assert(user.toObject(true).age === undefined);
        assert(user.bio === undefined);
        done(null, User);
    });

    it('should throw when unknown properties are used if strict=throw', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = modelBuilder.define('User', {name: String, bio: String}, {strict: 'throw'});

        try {
            var user = new User({name: 'Joe', age: 20});
            assert(false, 'The code should have thrown an error');
        } catch(e) {
            assert(true, 'The code is expected to throw an error');
        }
        done(null, User);
    });

    it('should be able to define open models', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = modelBuilder.define('User', {}, {strict: false});

        var user = new User({name: 'Joe', age: 20});

        User.modelName.should.equal('User');
        user.should.be.a('object').and.have.property('name', 'Joe');
        user.should.have.property('name', 'Joe');
        user.should.have.property('age', 20);
        user.should.not.have.property('bio');
        done(null, User);
    });

    it('should use false as the default value for strict', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = modelBuilder.define('User', {});

        var user = new User({name: 'Joe', age: 20});

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
                return new Date();
            } },
            timestamp: { type: Number, default: Date.now },
            published: { type: Boolean, default: false, index: true }
        });

// simpler way to describe model
        var User = ds.define('User', {
            name: String,
            bio: DataSource.Text,
            approved: Boolean,
            joinedAt: Date,
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

    it('should not take unknown properties in strict mode', function (done) {
        var ds = new DataSource('memory');

        var User = ds.define('User', {name: String, bio: String}, {strict: true});

        User.create({name: 'Joe', age: 20}, function (err, user) {

            User.modelName.should.equal('User');
            user.should.be.a('object');
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
        } catch(e) {
            assert(true, 'The code is expected to throw an error');
        }
        done(null, User);
    });

    it('should be able to define open models', function (done) {
        var ds = new DataSource('memory');

        var User = ds.define('User', {}, {strict: false});
        User.modelName.should.equal('User');

        User.create({name: 'Joe', age: 20}, function (err, user) {

            user.should.be.a('object').and.have.property('name', 'Joe');
            user.should.have.property('name', 'Joe');
            user.should.have.property('age', 20);
            user.should.not.have.property('bio');

            User.findById(user.id, function(err, user) {
                user.should.be.a('object').and.have.property('name', 'Joe');
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
            user.should.be.a('object').and.have.property('name', 'Joe');
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
        user.should.be.a('object');
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
        } catch(e) {
            assert(true, 'The code is expected to throw an error');
        }
        done(null, User);
    });


    it('should change the property value for save if strict=false', function (done) {
        var ds = new DataSource('memory');// define models
        var Post = ds.define('Post');

        Post.create({price: 900}, function(err, post) {
            assert.equal(post.price, 900);
            post.price = 1000;
            post.save(function(err, result) {
               assert.equal(1000, result.price);
               done(err, result);
            });
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

        customer.should.be.a('object').and.have.property('name', 'Joe');
        customer.should.have.property('name', 'Joe');
        customer.should.have.property('age', 20);
        customer.should.have.property('customerId', 'c01');
        customer.should.not.have.property('bio');

        // The properties are defined at prototype level
        assert.equal(Object.keys(customer).length, 0);
        var count = 0;
        for(var p in customer) {
            if(typeof customer[p] !== 'function') {
                count++;
            }
        }
        assert.equal(count, 7); // Please note there is an injected id from User prototype
        assert.equal(Object.keys(customer.toObject()).length, 6);

        done(null, customer);
    });
});

describe('DataSource constructor', function(){
    it('Takes url as the settings', function() {
        var ds = new DataSource('memory://localhost/mydb?x=1');
        assert.equal(ds.connector.name, 'memory');
    });

    it('Takes connector name', function() {
        var ds = new DataSource('memory');
        assert.equal(ds.connector.name, 'memory');
    });

    it('Takes settings object', function() {
        var ds = new DataSource({connector: 'memory'});
        assert.equal(ds.connector.name, 'memory');
    });

    it('Takes settings object and name', function() {
        var ds = new DataSource('x', {connector: 'memory'});
        assert.equal(ds.connector.name, 'memory');
    });
});

