export interface InheritsOptions {
  staticProperties?: boolean;
  override?: boolean;
}

export interface MixIntoOptions {
  override?: boolean
}

export interface MixinOptions extends InheritsOptions, MixIntoOptions {
  instanceProperties?: boolean;
  proxyFunctions?: boolean;
}

export function inherits<T extends object>(
  newClass: T,
  baseClass: object,
  options: InheritsOptions,
): T;

export function mixin<
  NT extends object & {prototype?: object},
  MT extends object & {prototype?: object},
  OT extends MixinOptions>(
  newClass: NT,
  mixinClass: MT,
  options: OT,
): (OT['staticProperties'] extends undefined | false ? {} :
    ReturnType<typeof mixInto>) &
  (OT['instanceProperties'] extends undefined | false ? {} :
    NT['prototype'] extends undefined ? {} :
      ReturnType<typeof mixInto<MT['prototype'], NT['prototype'], OT>>);

declare function mixInto<
  ST extends object | undefined,
  TT extends object | undefined,
  OT extends MixIntoOptions,
>(
  sourceScope: ST,
  targetScope: TT,
  options: OT,
): OT['override'] extends true
  ? ST & Exclude<TT, keyof ST>
  : TT & Exclude<ST, keyof TT>;

declare function mergeMixins(source: object[], target: object[]): object[];
