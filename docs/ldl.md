# LoopBack Definition Language (LDL)

LoopBack Definition Language (LDL) is simple DSL to define data models in JavaScript or plain JSON. With LoopBack, we often
start with a model definition which describes the structure and types of data. The model establishes common knowledge of
data in LoopBack.

## Describing a simple model

Let's start with a simple example in plain JSON.

    {
        "id": "number",
        "firstName": "string",
        "lastName": "string"
    }

The model simply defines a `user` model that consists of three properties:

* id - The user id. It's a number.
* firstName - The first name. It's a string.
* lastName - The last name. It's a string.

Each key in the JSON object defines a property in our model which will be cast to its associated type. The simplest form of
a property definition is `propertyName: type`. The key is the name of the property and the value is the type of the property.
We'll cover more advanced form later in this guide.

LDL supports a list of built-in types, including the basic types from JSON:

* String
* Number
* Boolean
* Array
* Object

**Note**: The type name is case-insensitive, i.e., either "Number" or "number" can be used.

The same model can also be described in JavaScript code:

    var UserDefinition = {
        id: Number,
        firstName: String,
        lastName: String
    }

As we can see, the JavaScript version is less verbose as it doesn't require quotes for property names. The types are
described using JavaScript constructors, for example, `Number` for `"Number"`. String literals are also supported.

Now we have the definition of a model, how do we use it in LoopBack Node.js code? It's easy, LoopBack will build a
JavaScript constructor (or class) for you.

## Creating a model constructor

LDL compiles the model definition into a JavaScript constructor using `ModelBuilder.define` APIs. ModelBuilder is the
basic factory to create model constructors.

ModelBuilder.define() method takes the following arguments:

- name: The model name
- properties: An object of property definitions
- options: An object of options, optional

Here is an example,

    var ModelBuilder = require('loopback-datasource-juggler').ModelBuilder;

    // Create an instance of the ModelBuilder
    var modelBuilder = new ModelBuilder();

    // Describe the user model
    var UserDefinition = {
        id: Number,
        firstName: String,
        lastName: String
    }

    // Compile the user model definition into a JavaScript constructor
    var User = modelBuilder.define('User', UserDefinition);

    // Create a new instance of User
    var user = new User({id: 1, firstName: 'John', lastName: 'Smith'});

    console.log(user.id); // 1
    console.log(user.firstName); // 'John'
    console.log(user.lastName); // 'Smith'


That's it. Now you have a User constructor representing the user model.

At this point, the constructor only has a set of accessors to model properties. No behaviors have been introduced yet.

## Adding logic to a model

Models describe the shape of data. To leverage the data, we'll add logic to the model for various purposes, such as:

- Interact with the data store for CRUD
- Add behavior around a model instance
- Add service operations using the model as the context

There are a few ways to add methods to a model constructor:

### 1) Create the model constructor from a data source
A LoopBack data source injects methods on the model.


    var DataSource = require('loopback-datasource-juggler').DataSource;
    var ds = new DataSource('memory');

    // Compile the user model definition into a JavaScript constructor
    var User = ds.define('User', UserDefinition);

    // Create a new instance of User
    User.create({id: 1, firstName: 'John', lastName: 'Smith'}, function(err, user) {
        console.log(user); // The newly created user instance
        User.findById(1, function(err, user) {
            console.log(user); // The user instance for id 1
            user.firstName = 'John1'; // Change the property
            user.save(function(err, user) {
                console.log(user); // The modified user instance for id 1
            });
        };
    });


### 2) Attach the model to a data source
A plain model constructor created from `ModelBuilder` can be attached a `DataSource`.


    var DataSource = require('loopback-datasource-juggler').DataSource;
    var ds = new DataSource('memory');

    User.attachTo(ds); // The CRUD methods will be mixed into the User constructor

### 3) Manually declare methods to the model constructor
We can add static and prototype methods to a model constructor.


    // Define a static method
    User.greet = function(msg) {
        console.log('Hello ', msg);
    };

    // Define a prototype method
    User.prototype.getFullName = function () {
        return this.firstName + ' ' + this.lastName;
    };

    User.greet('world'); // prints 'Hello world'
    var user = new User({id: 1, firstName: 'John', lastName: 'Smith'});
    console.log(user.getFullName()); // 'John Smith'


## Exploring advanced LDL features

As we mentioned before, a complete model definition is an object with three properties:

- name: The model name
- options: An object of options, optional
- properties: An object of property definitions

### Model level options
There are a set of options to control the model definition.

- strict:
    - true: Only properties defined in the model are accepted. This is the default.
    - false: The model will be an open model. Unknown properties are accepted as well.

- idInjection:
    - true: An `id` property will be added to the model automatically
    - false: No `id` property will be added to the model

- Data source specific mappings
The model can be decorated with connector-specific options to customize the mapping between the model and the connector.
For example, we can define the corresponding schema/table names for Oracle as follows:

        {
          "name": "Location",
          "options": {
            "idInjection": false,
            "oracle": {
              "schema": "BLACKPOOL",
              "table": "LOCATION"
            }
          },
          ...
        }

### Property definitions
The basic example use `propertyName: type` to describe a property.

Properties can have options in addition to the type. LDL uses a JSON object to describe such properties, for example:

    "id": {"type": "number", "id": true, "doc": "User ID"}

    "firstName": {"type": "string", "required": true, "oracle": {"column": "FIRST_NAME", "type": "VARCHAR(32)"}}

Common options for a property are:

#### Data types

* type: The property type
  - String/Text
  - Number
  - Date
  - Boolean
  - Buffer/Binary
  - Array
  - Any/Object/JSON
  - GeoPoint

##### Array types

LDL supports array types as follows:

- `{emails: [String]}`
- `{"emails": ["String"]}`
- `{emails: [{type: String, length: 64}]}`

##### Object types

A model often has properties that consist of other properties. For example, the user model can have an `address` property
that in turn has properties such as `street`, `city`, `state`, and `zipCode`.

LDL allows inline declaration of such properties, for example,

    var UserModel = {
        firstName: String,
        lastName: String,
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String
        },
        ...
    }

The value of the address is the definition of the `address` type, which can be also considered as an anonymous model.

If you intend to reuse the address model, we can define it independently and reference it in the user model. For example,

    var AddressModel = {
        street: String,
        city: String,
        state: String,
        zipCode: String
    };

    var Address = ds.define('Address', AddressModel);

    var UserModel = {
            firstName: String,
            lastName: String,
            address: 'Address',  // or address: Address
            ...
    }

    var User = ds.define('User', UserModel);

**Note**: The user model has to reference the Address constructor or the model name - `'Address'`.


#### ID(s) for a model

* id: Indicate if the property is an `id` of the model. The value can be true, false, or a number
    - true: It's an id
    - false: It's not an id
    - 0: It's not an id
    - 1: It's the first part of the composite id

LDL supports the definition of a composite id that has more than one properties. For example,

    var InventoryDefinition =
    {
        productId: {type: String, id: 1},
        locationId: {type: String, id: 2},
        qty: Number
    }

The composite id is (productId, locationId) for an inventory model.

##### Injecting ID

#### Property documentation
* doc: Documentation of the property

* default: The default value of the property

#### Constraints
Constraints are modeled as options, for example:

* required: Indicate if the property is required
* pattern: A regular expression pattern that a string should match
* min/max: The minimal and maximal value
* length: The maximal length of a string


#### Conversion and formatting
Format conversions can also be declared as options, for example:

* trim: Trim the string
* lowercase: Convert the string to be lowercase
* uppercase: Convert the string to be uppercase
* format: Format a Date

#### Mapping
Data source specific mappings can be added to the property options, for example, to map a property to be a column in
Oracle database table, you can use the following syntax:

    "oracle": {"column": "FIRST_NAME", "type": "VARCHAR", "length": 32}


#### Advanced example

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



### Relations between models

    // setup relationships
    User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'});

    Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});

    User.hasAndBelongsToMany('groups');

### Extend from a base model
### Mix in model definitions

    var Group = modelBuilder.define('Group', {group: String});

    User.mixin(Group);