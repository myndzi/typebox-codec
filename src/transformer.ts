export type AnyToStatic<T extends any> = (val: any) => T;
export type StaticToAny<T extends any> = (val: T) => any;
export type StaticToStatic<T extends any> = (val: T) => T;

export type TransformFn<T extends any> =
  | AnyToStatic<T>
  | StaticToAny<T>
  | StaticToStatic<T>;

// Transformer is just something that can be a unique key in a map,
// that ties Codecs and schemas together. We give it a name for use
// in error messages.
export class Transformer {
  private readonly __brand?: 'transformer';

  constructor(public readonly name: string) {}
}
