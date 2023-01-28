import type { Static, TArray, TObject, TRecord, TSchema, TTuple } from '@sinclair/typebox';
import { Codec } from './codec';
import { NodeType } from './schemareader';
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

type NonCollections<TS extends TSchema> = Exclude<TS, TArray | TTuple | TObject | TRecord>;
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

const escapedRegex = /~[01]/g;
export const unescapeJsonPointer = (ptr: string) => ptr.replace(escapedRegex, v => (v[1] === '0' ? '~' : '/'));

const unescapedRegex = /[~/]/g;
export const escapeJsonPointer = (ptr: string) => ptr.replace(unescapedRegex, v => (v === '~' ? '~0' : '~1'));

export const jsonPathJoin = (escaped: string, ...unescaped: string[]): string =>
  [escaped, ...unescaped.map(escapeJsonPointer)].join('/');

const HOP = Object.prototype.hasOwnProperty;
export const ownProperties = (obj: any, ...keys: PropertyKey[]): unknown | undefined =>
  keys.reduce((obj, key) => (obj && HOP.call(obj, key) ? obj[key] : undefined), obj);

export const hasChildren = (obj: unknown): boolean =>
  obj !== null &&
  typeof obj === 'object' &&
  ['properties', 'patternProperties', 'additionalProperties', 'items', 'additionalItems', 'prefixItems'].some(key =>
    HOP.call(obj, key),
  );

export interface PathBuilder {
  (nodeType: NodeType, parentPath: string, currentKey?: string): string;
}

export const dataPathBuilder: PathBuilder = (nodeType, parentPath, currentKey) => {
  const unescaped = typeof currentKey === 'string' ? unescapeJsonPointer(currentKey) : undefined;

  switch (nodeType) {
    case NodeType.DefProperty:
      return `.${unescaped}`;
    case NodeType.ObjectProperty:
      return `${parentPath}.${unescaped}`;
    case NodeType.ObjectPatternProperties:
      return `${parentPath}./${unescaped}/`;
    case NodeType.ObjectAdditionalProperties:
      return `${parentPath}.*`;
    case NodeType.TupleItem:
      return `${parentPath}[${unescaped}]`;
    case NodeType.ArrayItems:
      return `${parentPath}[*]`;
    case NodeType.Root:
      return '';
  }
};

export const isObjectLike = (v: unknown): v is object => typeof v === 'object' && v != null && !Array.isArray(v);
