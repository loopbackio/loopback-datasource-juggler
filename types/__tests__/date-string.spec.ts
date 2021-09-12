import { inspect } from 'util';
import {DateString} from '../date-string';

let stringTypeGuard: string;

const dateString = new DateString('2020-01-01');
DateString('2020-01-01');
DateString(dateString);
stringTypeGuard = dateString.toJSON().when;
stringTypeGuard = dateString.toString();
stringTypeGuard = dateString.inspect();
stringTypeGuard = dateString[inspect.custom]();
