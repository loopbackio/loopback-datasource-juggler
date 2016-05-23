// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var DataSource = require('../index').DataSource;
var ds = new DataSource('memory');

var Order = ds.createModel('Order', {
  items: [String],
  orderDate: Date,
  qty: Number,
});

var Customer = ds.createModel('Customer', {
  name: String,
});

Order.belongsTo(Customer);

var order1, order2, order3;

Customer.create({ name: 'John' }, function(err, customer) {
  Order.create({ customerId: customer.id, orderDate: new Date(), items: ['Book'] }, function(err, order) {
    order1 = order;
    order.customer(console.log);
    order.customer(true, console.log);

    Customer.create({ name: 'Mary' }, function(err, customer2) {
      order.customer(customer2);
      order.customer(console.log);
    });
  });

  Order.create({ orderDate: new Date(), items: ['Phone'] }, function(err, order) {
    order.customer.create({ name: 'Smith' }, function(err, customer2) {
      console.log(order, customer2);
      order.save(function(err, order) {
        order2 = order;
      });
    });

    var customer3 = order.customer.build({ name: 'Tom' });
    console.log('Customer 3', customer3);
  });
});

Customer.hasMany(Order, { as: 'orders', foreignKey: 'customerId' });

Customer.create({ name: 'Ray' }, function(err, customer) {
  Order.create({ customerId: customer.id, qty: 3, orderDate: new Date() }, function(err, order) {
    order3 = order;
    customer.orders(console.log);
    customer.orders.create({ orderDate: new Date(), qty: 4 }, function(err, order) {
      console.log(order);
      Customer.include([customer], 'orders', function(err, results) {
        console.log('Results: ', results);
      });
      customer.orders({ where: { qty: 4 }}, function(err, results) {
        console.log('customer.orders', results);
      });
      customer.orders.findById(order3.id, console.log);
      customer.orders.destroy(order3.id, console.log);
    });
  });
});

var Physician = ds.createModel('Physician', {
  name: String,
});

var Patient = ds.createModel('Patient', {
  name: String,
});

var Appointment = ds.createModel('Appointment', {
  physicianId: Number,
  patientId: Number,
  appointmentDate: Date,
});

Appointment.belongsTo(Patient);
Appointment.belongsTo(Physician);

Physician.hasMany(Patient, { through: Appointment });
Patient.hasMany(Physician, { through: Appointment });

Physician.create({ name: 'Dr John' }, function(err, physician1) {
  Physician.create({ name: 'Dr Smith' }, function(err, physician2) {
    Patient.create({ name: 'Mary' }, function(err, patient1) {
      Patient.create({ name: 'Ben' }, function(err, patient2) {
        Appointment.create({
          appointmentDate: new Date(),
          physicianId: physician1.id,
          patientId: patient1.id,
        }, function(err, appt1) {
          Appointment.create({
            appointmentDate: new Date(),
            physicianId: physician1.id,
            patientId: patient2.id,
          }, function(err, appt2) {
            physician1.patients(console.log);
            physician1.patients({ where: { name: 'Mary' }}, console.log);
            patient1.physicians(console.log);

            // Build an appointment?
            var patient3 = patient1.physicians.build({ name: 'Dr X' });
            console.log(
              'Physician 3: ',
              patient3,
              patient3.constructor.modelName
            );

            // Create a physician?
            patient1.physicians.create(
              { name: 'Dr X' },
              function(err, patient4) {
                console.log(
                  'Physician 4: ',
                  patient4,
                  patient4.constructor.modelName
                );
              }
            );
          });
        });
      });
    });
  });
});

var Assembly = ds.createModel('Assembly', {
  name: String,
});

var Part = ds.createModel('Part', {
  partNumber: String,
});

Assembly.hasAndBelongsToMany(Part);
Part.hasAndBelongsToMany(Assembly);

Assembly.create({ name: 'car' }, function(err, assembly) {
  Part.create({ partNumber: 'engine' }, function(err, part) {
    assembly.parts.add(part, function(err) {
      assembly.parts(function(err, parts) {
        console.log('Parts: ', parts);
      });

      // Build an part?
      var part3 = assembly.parts.build({ partNumber: 'door' });
      console.log('Part3: ', part3, part3.constructor.modelName);

      // Create a part?
      assembly.parts.create({ partNumber: 'door' }, function(err, part4) {
        console.log('Part4: ', part4, part4.constructor.modelName);

        Assembly.find({ include: 'parts' }, function(err, assemblies) {
          console.log('Assemblies: ', assemblies);
        });
      });
    });
  });
});

