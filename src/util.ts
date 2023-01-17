import type {
  Static,
  TArray,
  TObject,
  TRecord,
  TSchema,
  TTuple,
} from '@sinclair/typebox';
import { Codec } from './codec';
import { Transformer, TransformFn } from './transformer';

export type AtLeastOne<T> = { 0: T } & Array<T>;

type TXTuple<T> = [Codec, Transformer, T];

export const Annotate = <TS extends TSchema>(
  // we traverse the _shape_ of the schema and map the _individual values_
  // therefore, we prevent annotating the types we handle specially
  schema: TS,
  ...xfs: AtLeastOne<TXTuple<TransformFn<Static<TS>>>>
): TS => {
  for (const [codec, transformer, fn] of xfs) {
    codec.AddTransformation(transformer, schema, fn);
  }
  return schema;
};

type NonCollections<TS extends TSchema> = Exclude<
  TS,
  TArray | TTuple | TObject | TRecord
>;
export const Apply = <TS extends TSchema>(
  // we traverse the _shape_ of the schema and map the _individual values_
  // therefore, we prevent annotating the types we handle specially
  schema: NonCollections<TS>,
  ...xfs: AtLeastOne<TXTuple<TransformFn<Static<TS>>>>
): TS => {
  for (const [codec, transformer, fn] of xfs) {
    codec.AddTransformation(transformer, schema, fn);
  }
  return schema;
};

export const Transform = <T extends TransformFn<any>>(
  codec: Codec,
  transformer: Transformer,
  fn: T,
): [Codec, Transformer, T] => [codec, transformer, fn];

export const isObject = (object: any): object is Record<string | symbol, any> =>
  typeof object === 'object' && object !== null && !Array.isArray(object);
export const isArray = (object: any): object is any[] =>
  typeof object === 'object' && object !== null && Array.isArray(object);
