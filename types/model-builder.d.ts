import { EventEmitter } from 'events';
import { AnyObject, Options } from './common';
import { BuiltModelTypes, Types } from './types';
import { ModelBase, ModelDefinition, ModelProperties, ModelSettings, ModelBaseClass } from './model';

export declare class ModelClass extends ModelBase {

}

export declare class ModelBuilder extends EventEmitter {
  static defaultInstance: ModelBuilder;

  models: { [name: string]: typeof ModelBase; };
  definitions: { [name: string]: ModelDefinition; };
  settings: {
    /**
     * @defaultValue `false`
     */
    strictEmbeddedModels?: boolean;
  };

  defaultModelBaseClass: typeof ModelBase;

  getModel(name: string, forceCreate?: boolean): typeof ModelBase;

  getModelDefinition(name: string): ModelDefinition | undefined;

  define(
    className: string,
    properties?: ModelProperties,
    settings?: ModelSettings,
    parent?: ModelBaseClass
  ): ModelBaseClass;

  defineProperty(
    modelName: string,
    propertyName: string,
    propertyDefinition: AnyObject
  ): void;

  defineValueType(type: string, aliases?: string[]): void;

  extendModel(modelName: string, properties: AnyObject): void;

  getSchemaName(name?: string): string;

  resolveType(type: any): any;

  buildModels(
    schemas: AnyObject,
    createModel?: Function
  ): { [name: string]: ModelBaseClass; };

  buildModelFromInstance(
    name: string,
    json: AnyObject,
    options: Options
  ): ModelBaseClass;

  // START mixin-ed extensions from BuiltModelTypes
  static Text: Types.Text;
  static JSON: Types.JSON;
  static Any: Types.Any;
  static registerType: BuiltModelTypes['registerType'];
  static schemaTypes: BuiltModelTypes['schemaTypes'];
}
