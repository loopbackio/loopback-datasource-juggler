var DataSource = require('../index').DataSource;
var ds = new DataSource('memory');

var Order = ds.createModel('Order', {
    customerId: Number,
    orderDate: Date
});

var Customer = ds.createModel('Customer', {
    name: String
});

Order.belongsTo(Customer);

Customer.create({name: 'John'}, function (err, customer) {
    Order.create({customerId: customer.id, orderDate: new Date()}, function (err, order) {
        order.customer(console.log);
        order.customer(true, console.log);

        Customer.create({name: 'Mary'}, function (err, customer2) {
            order.customer(customer2);
            order.customer(console.log);
        });
    });
});


Customer.hasMany(Order, {as: 'orders', foreignKey: 'customerId'});

Customer.create({name: 'Ray'}, function (err, customer) {
    Order.create({customerId: customer.id, orderDate: new Date()}, function (err, order) {
        customer.orders(console.log);
        customer.orders.create({orderDate: new Date()}, console.log);
        customer.orders.findById('2', console.log);
        customer.orders.destroy('2', console.log);
    });
});


var Physician = ds.createModel('Physician', {
    name: String
});

var Patient = ds.createModel('Patient', {
    name: String
});

var Appointment = ds.createModel('Appointment', {
    physicianId: Number,
    patientId: Number,
    appointmentDate: Date
});

Appointment.belongsTo(Patient);
Appointment.belongsTo(Physician);

Physician.hasMany(Patient, {through: Appointment});
Patient.hasMany(Physician, {through: Appointment});

Physician.create({name: 'Smith'}, function (err, physician) {
    Patient.create({name: 'Mary'}, function (err, patient) {
        Appointment.create({appointmentDate: new Date(), physicianId: physician.id, patientId: patient.id},
            function (err, appt) {
                physician.patients(console.log);
                patient.physicians(console.log);
        });
    });
});


var Assembly = ds.createModel('Assembly', {
    name: String
});

var Part = ds.createModel('Part', {
    partNumber: String
});

Assembly.hasAndBelongsToMany(Part);
Part.hasAndBelongsToMany(Assembly);

Assembly.create({name: 'car'}, function (err, assembly) {
    Part.create({partNumber: 'engine'}, function (err, part) {
        assembly.parts.add(part, function(err) {
            assembly.parts(console.log);
        });

    });
});

