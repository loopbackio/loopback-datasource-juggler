import {GeoDistanceUnit, GeoPoint, filter, nearFilter} from '../geo';

let numberTypeGuard: number;

new GeoPoint(123, 456);
new GeoPoint('123', 456);
new GeoPoint(123, '456');
new GeoPoint('123', '456');

new GeoPoint([123, 456]);
new GeoPoint(['123', '456']);
new GeoPoint(['123', 456]);
new GeoPoint([123, '456']);

new GeoPoint({lat: 123, lng: 456});
new GeoPoint({lat: '123', lng: 456})
new GeoPoint({lat: 123, lng: '456'})
new GeoPoint({lat: '123', lng: '456'});

numberTypeGuard = GeoPoint.distanceBetwen([123, 456], [123, 456]);
numberTypeGuard = GeoPoint.distanceBetwen([123, 456], [123, 456], {type: GeoDistanceUnit.degrees});

const geoPoint = new GeoPoint(123, 456);
numberTypeGuard = geoPoint.distanceTo([123, 456])
numberTypeGuard = geoPoint.distanceTo([123, 456], {type: GeoDistanceUnit.degrees});
