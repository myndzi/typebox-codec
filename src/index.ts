import { TSchema, Type } from '@sinclair/typebox';
import { Apply, Transform } from './annotations';
import { Codec } from './codec';
import { AnyToStatic, StaticToAny, Transformer } from './transformer';

export { Codec } from './codec';
export { Transformer } from './transformer';
export { Apply, Transform } from './annotations';

const XEncode = new Transformer('Encode');
const XDecode = new Transformer('Decode');

export const Encode = <T extends any>(transformer: Transformer, fn: StaticToAny<T>) => Transform(All, transformer, fn);

export const Decode = <T extends any>(transformer: Transformer, fn: AnyToStatic<T>) => Transform(All, transformer, fn);

export const All = new Codec('All', XEncode, XDecode);

export const CreateCodec = (name: string) => {
  const codec = new Codec(name, All);

  type EncodeOverload = {
    <T extends any>(fn: StaticToAny<T>): ReturnType<typeof Transform<StaticToAny<T>>>;
    (schema: TSchema, value: any): any;
  };
  const Encode: EncodeOverload = <T extends any>(...args: [StaticToAny<T>] | [TSchema, any]): any => {
    if (args.length === 1) {
      return Transform(codec, XEncode, args[0]);
    } else {
      return codec.Transform(XEncode, args[0], args[1]);
    }
  };

  type DecodeOverload = {
    <T extends any>(fn: AnyToStatic<T>): ReturnType<typeof Transform<AnyToStatic<T>>>;
    (schema: TSchema, value: any): any;
  };
  const Decode: DecodeOverload = <T extends any>(...args: [AnyToStatic<T>] | [TSchema, any]): any => {
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
      Type.Date({ description: `it's the timestamp, bruh` }),
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
