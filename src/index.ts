import { TSchema, Type } from '@sinclair/typebox';
import { Codec } from './codec';
import { AnyToStatic, StaticToAny, Transformer } from './transformer';
import { Traverser, NodeType } from './traverse';
import { Apply, isObject, Transform } from './util';

export { Codec } from './codec';
export { Transformer } from './transformer';
export { Apply, Transform } from './util';

const XEncode = new Transformer('Encode');
const XDecode = new Transformer('Decode');

export const Encode = <T extends any>(
  transformer: Transformer,
  fn: StaticToAny<T>,
) => Transform(All, transformer, fn);

export const Decode = <T extends any>(
  transformer: Transformer,
  fn: AnyToStatic<T>,
) => Transform(All, transformer, fn);

export const All = new Codec('All', XEncode, XDecode);

export const CreateCodec = (name: string) => {
  const codec = new Codec(name, All);

  type EncodeOverload = {
    <T extends any>(fn: StaticToAny<T>): ReturnType<
      typeof Transform<StaticToAny<T>>
    >;
    (schema: TSchema, value: any): any;
  };
  const Encode: EncodeOverload = <T extends any>(
    ...args: [StaticToAny<T>] | [TSchema, any]
  ): any => {
    if (args.length === 1) {
      return Transform(codec, XEncode, args[0]);
    } else {
      return codec.Transform(XEncode, args[0], args[1]);
    }
  };

  type DecodeOverload = {
    <T extends any>(fn: AnyToStatic<T>): ReturnType<
      typeof Transform<AnyToStatic<T>>
    >;
    (schema: TSchema, value: any): any;
  };
  const Decode: DecodeOverload = <T extends any>(
    ...args: [AnyToStatic<T>] | [TSchema, any]
  ): any => {
    if (args.length === 1) {
      return Transform(codec, XDecode, args[0]);
    } else {
      return codec.Transform(XDecode, args[0], args[1]);
    }
  };

  return { Encode, Decode };
};

const { Encode: encode, Decode: decode } = CreateCodec('foo');

enum Foo {
  A,
  B,
}

const $defs = {
  test: Type.String({ $id: '#/$defs/test' }),
};
const testSchema = Type.Object(
  {
    ts: Apply(
      Type.Date(),
      encode((v: Date) => v.toISOString()),
      decode(v => new Date(v)),
    ),
    foo: Apply(
      Type.Enum(Foo),
      encode((v: Foo) => Foo[v]),
      decode((v: string) => (Foo as any)[v]),
    ),
    arr: Type.Array(Type.Object({ arrayProp: Type.Boolean() })),
    bar: Type.Object({
      baz: Type.Object({
        quux: Type.Number(),
      }),
    }),
    refEmbedded: Type.Any({ $ref: '#/properties/bar' }),
    refDefs: Type.Ref($defs.test),
  },
  { $defs },
);

import { inspect } from 'node:util';
// console.log(inspect(testSchema, { depth: null }));
const t = new Traverser(testSchema);
t.traverse((schema, nodeType, path, $ref, hasChildren) => {
  if (hasChildren) return;
  const type = ($ref ? t.ref($ref) : schema)?.type;
  console.log(path, type, $ref);
});
t.traverseRefs((schema, nodeType, path, $ref, hasChildren) => {
  const seenAs = t.refSources(schema);
  console.log(path, schema.type, $ref, seenAs, hasChildren);
});

// console.log(
//   inspect(
//     Type.Object({
//       tuple: Type.Tuple([Type.String(), Type.Number()]),
//       array: Type.Array(Type.String()),
//       object: Type.Object({}),
//       record: Type.Record(Type.Number(), Type.Boolean()),
//     }),
//     { depth: null },
//   ),
// );

// var encoded = encode(testSchema, { ts: new Date(), foo: Foo.A });
// console.log(encoded);
// var decoded = decode(testSchema, encoded);
// console.log(decoded);

// const xflatten = new Transformer('flatten', true);
// const describe = new Codec('describe', xflatten);
// const flatten = Transform<StaticToAny<[string, string]>>(describe, xflatten, (v: any, p) => {
//   if (isObject(v)) {
//     return Object.entries(([k, v]) => [
//       []
//     ]);
//   }
//   return Object.entries(v)
// });
// const test = Annotate(
//   Type.Object({
//     name: Type.String(),
//     props: Apply()
//   }),
//   transform(describe, flatten, (v: any) => Object.entries(v).map(([k, v]) => Array.isArray(v) ? [] : [k,v]));
// )
