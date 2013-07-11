var ModelBuilder = require('../../jugglingdb').ModelBuilder;
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
    }
});

var user = new User({name: 'Joe', age: 20, address: {street: '123 Main St', 'city': 'San Jose', state: 'CA'}});
console.log(user);
