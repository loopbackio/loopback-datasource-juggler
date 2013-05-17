var DataSource = require('../../jugglingdb').DataSource;
var ds = new DataSource('memory');
// define models
var Post = ds.define('Post', {
    title:     { type: String, length: 255 },
    content:   { type: DataSource.Text },
    date:      { type: Date,    default: function () { return new Date;} },
    timestamp: { type: Number,  default: Date.now },
    published: { type: Boolean, default: false, index: true }
});

// simplier way to describe model
var User = ds.define('User', {
    name:         String,
    bio:          DataSource.Text,
    approved:     Boolean,
    joinedAt:     Date,
    age:          Number
});

var Group = ds.define('Group', {name: String});

// define any custom method
User.prototype.getNameAndAge = function () {
    return this.name + ', ' + this.age;
};

var user = new User({name: 'Joe'});
console.log(user);

console.log(ds.models);
console.log(ds.definitions);




