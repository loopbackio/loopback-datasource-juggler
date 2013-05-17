var DataSource = require('../../jugglingdb').Schema;
var dataSource = new DataSource();
// define models
var Post = dataSource.define('Post', {
    title:     { type: String, length: 255 },
    content:   { type: DataSource.Text },
    date:      { type: Date,    default: function () { return new Date;} },
    timestamp: { type: Number,  default: Date.now },
    published: { type: Boolean, default: false, index: true }
});

// simplier way to describe model
var User = dataSource.define('User', {
    name:         String,
    bio:          DataSource.Text,
    approved:     Boolean,
    joinedAt:     Date,
    age:          Number
});

var Group = dataSource.define('Group', {name: String});

// define any custom method
User.prototype.getNameAndAge = function () {
    return this.name + ', ' + this.age;
};

var user = new User({name: 'Joe'});
console.log(user);

console.log(dataSource.models);
console.log(dataSource.definitions);

var user2 = User.create({name: 'Joe'});
console.log(user2);



