// This test written in mocha+should.js
var should = require('./init.js');
var assert = require('assert');

var jdb = require('../');
var ModelBuilder = jdb.ModelBuilder;
var DataSource = jdb.DataSource;

var ModelDefinition = require('../lib/model-definition');

describe('ModelDefinition class', function () {

    it('should be able to define plain models', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = new ModelDefinition(modelBuilder, 'User', {
            name: String,
            bio: ModelBuilder.Text,
            approved: Boolean,
            joinedAt: Date,
            age: Number
        });

        // console.log(User.toJSON());

        done();


    });


    it('should be able to define nesting models', function (done) {
        var modelBuilder = new ModelBuilder();

        var User = new ModelDefinition(modelBuilder, 'User', {
            name: String,
            bio: ModelBuilder.Text,
            approved: Boolean,
            joinedAt: Date,
            age: Number,
            address: {
                street: String,
                city: String,
                zipCode: String,
                state: String
            }
        });

        // console.log(JSON.stringify(User.toJSON(), null, '  '));

        done();


    });


    it('should be able to define referencing models', function (done) {
        var modelBuilder = new ModelBuilder();

        var Address = modelBuilder.define('Address', {
            street: String,
            city: String,
            zipCode: String,
            state: String
        });
        var User = new ModelDefinition(modelBuilder, 'User', {
            name: String,
            bio: ModelBuilder.Text,
            approved: Boolean,
            joinedAt: Date,
            age: Number,
            address: Address

        });

        // console.log(JSON.stringify(User.toJSON(), null, '  '));

        done();


    });
});

