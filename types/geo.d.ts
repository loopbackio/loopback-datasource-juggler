import { Where } from "./query";

export function nearFilter(where: Where): false | GeoPointFilter[];

export function filter(rawResults: GeoPointRawResult[], filters: GeoPointFilter[]): GeoPointFilter;

export type GeoPointFilter = {
  near: GeoPoint | ConstructorParameters<typeof GeoPoint>;
  maxDistance: number;
  minDistance: number;
  unit: GeoDistanceUnit;
  mongoKey: string;
  key: string;
}

export type GeoPointRawResult = {
  [key: string]: {
    lat: number;
    lng: number;
  }
}

export class GeoPoint {
  lat: number;
  lng: number;

  /**
   * 
   * @example
   * ```typescript
   * new GeoPoint({
   *   lat: 145,
   *   lng: 96,
   * });
   * ```
   * 
   * @example
   * ```typescript
   * new GeoPoint({
   *   lat: '145',
   *   lng: '96',
   * });
   * ```
   * 
   * @param data 
   */
  constructor(data: {
    lat: string | number,
    lng: string | number,
  })

  /**
   * @example
   * ```typescript
   * new GeoPoint('145,96');
   * ```
   * 
   * @example
   * ```typescript
   * new GeoPoint('145  ,  96');
   * ```
   * 
   * @param data 
   */
  constructor(data: `${number},${number}`)

  /**
   * @example
   * ```typescript
   * new GeoPoint([145, 96]);
   * ```
   * 
   * @example
   * ```typescript
   * new GeoPoint(['145', '96']);
   * ```
   * 
   * @param data 
   */
  constructor(data: [string | number, string | number])

  /**
   * @example
   * ```typescript
   * new GeoPoint(145, 96);
   * ```
   * 
   * @example
   * ```typescript
   * new GeoPoint('145', '96');
   * ```
   * 
   * @param data 
   */
  constructor(lat: string | number, lng: string | number)

  static distanceBetwen(
    a: GeoPoint | ConstructorParameters<typeof GeoPoint>,
    b: GeoPoint | ConstructorParameters<typeof GeoPoint>,
    options?: GeoDistanceOptions,
  ): number;

  distanceTo(
    point: GeoPoint | ConstructorParameters<typeof GeoPoint>,
    options?: GeoDistanceOptions,
  ): number;

  toString(): `$${number},${number}`;
}

export type GeoDistanceOptions = {
  type: GeoDistanceUnit;
}

export enum GeoDistanceUnit {
  'kilometers',
  'meters',
  'miles',
  'feet',
  'radians',
  'degrees',
}
