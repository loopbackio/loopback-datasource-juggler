# loopback-data-validations

Built-in validators, creating custom validations, syncronous and asyncronous object validation.

    // Setup validations
    User.validatesPresenceOf('name', 'email')
    User.validatesLengthOf('password', {min: 5, message: {min: 'Password is too short'}});
    User.validatesInclusionOf('gender', {in: ['male', 'female']});
    User.validatesExclusionOf('domain', {in: ['www', 'billing', 'admin']});
    User.validatesNumericalityOf('age', {int: true});
    User.validatesUniquenessOf('email', {message: 'email is not unique'});

    user.isValid(function (valid) {
        if (!valid) {
            user.errors // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        }
    })

