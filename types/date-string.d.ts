import {inspect} from 'util';

// @achrinza: One of the limitations of these definitions is that the class instance
//            isn't callable; Hence, changing the `value` class member must be done
//            directly. This is a TypeScript limitation as class constructors cannot
//            have a custom return value.
export function DateString(value: DateString | string): DateString;
export class DateString {
    private _when: string;
    private _date: Date;

    get when(): string;
    set when(val: string);

    constructor(value: string);

    toString(): DateString['when'];
    toJSON(): {when: DateString['when']};
    inspect(): string;
    [inspect.custom]: DateString['inspect'];
}
