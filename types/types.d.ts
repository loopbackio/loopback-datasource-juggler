import {DateString} from './date-string';

// @achrinza: The return value is a hack to inform TypeScript of function parameter mutations.
//            see: https://github.com/microsoft/TypeScript/issues/22865#issuecomment-725015710
declare function registerModelTypes(modelTypes: registerModelTypes.ModelTypes): asserts modelTypes is registerModelTypes.BuiltModelTypes;

declare namespace registerModelTypes {
  // @achrinza: One of the limitations of these definitions is that the class instance
  //            isn't callable; Hence, changing the `value` class member must be done
  //            directly. This is a TypeScript limitation as class constructors cannot
  //            have a custom return value.
  namespace Types {
    function Text<T extends unknown>(value: T): T extends Text ? void : T;
    class Text implements Type {
      value: Text;
      constructor(value: Text);
      toJSON(): Text;
      toObject(): Text;
    }

    function JSON<T extends unknown>(value: T): T extends JSON ? void : T;
    class JSON implements Type {
      value: unknown;
      constructor(value: unknown)
      toJSON(): unknown;
      toObject(): unknown;
    }


    function Any<T extends unknown>(value: T): T extends Any ? void : T;
    class Any implements Type {
      value: unknown;
      constructor(value: unknown);
      toJSON(): unknown;
      toObject(): unknown;
    }
  }

  interface ModelTypes {
    [type: string]: Type | unknown;
  }

  interface Type {
    value: unknown;
    toJSON(): unknown;
    toObject(): unknown;
  }

  interface BuiltModelTypes extends ModelTypes {
    schemaTypes: Record<string, Type> & {
      'String': String;
      'Number': Number;
      'Date': Date
      'DateString': DateString
      'Binary': Buffer;
      'Buffer': Buffer;
      'Array': Array<unknown>;
      'Object': Object;
      // 'GeoPoint': GeoPoint // Removed temporarily. See: https://github.com/loopbackio/loopback-datasource-juggler/issues/1909
    };
    registerType: (type: Type, names?: string[]) => void;
  }

}
export = registerModelTypes;
