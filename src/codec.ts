import { SchemaReader } from './schemareader';

export type Transform<From, To> = (v: From) => To;
export type CodecAddFn = (subschema: unknown) => void;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

type CodecFns<Encoded extends any, Decoded extends any> = {
  encode: (decoded: Decoded) => Encoded | undefined;
  decode: (encoded: Encoded) => Decoded | undefined;
};

type Lazy<CF extends CodecFns<any, any>, A extends any[]> = (...args: A) => CF;
type LazyKeys<T extends {}> = keyof { [K in keyof T]: T[K] extends Lazy<any, any> ? T[K] : never };
type LazyArgs<T extends (...args: any) => CodecFns<any, any>> = T extends (...args: infer P) => CodecFns<any, any>
  ? P
  : never;
// & unknown forces typescript to avoid reporting the type as Simplify<input>
type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & unknown;
type Extend<T extends {}, K extends string, NT extends any> = Simplify<T & { [NK in K]: NT }>;

export class Codec<T extends { [K in keyof T]: K extends string ? T[K] : never }> {
  private mappings = new Map<unknown, CodecFns<any, any>>();
  private codecs: T;

  private constructor(codecs: T) {
    this.codecs = codecs;
  }

  static create() {
    return new Codec({});
  }

  add<Kind extends string, Encoded extends any, Decoded extends any, Args extends any[]>(
    kind: Exclude<StringLiteral<Kind>, keyof T>,
    codec: Lazy<CodecFns<Encoded, Decoded>, Args>,
  ): Codec<Extend<T, Kind, Lazy<CodecFns<Encoded, Decoded>, Args>>>;
  add<Kind extends string, Encoded extends any, Decoded extends any>(
    kind: Exclude<StringLiteral<Kind>, keyof T>,
    codec: CodecFns<Encoded, Decoded>,
  ): Codec<Extend<T, Kind, CodecFns<Encoded, Decoded>>>;
  add<Kind extends string, Encoded extends any, Decoded extends any, Args extends any[]>(
    kind: Exclude<StringLiteral<Kind>, keyof T>,
    codec: CodecFns<Encoded, Decoded> | Lazy<CodecFns<Encoded, Decoded>, Args>,
  ) {
    return new Codec<Extend<T, Kind, typeof codec>>({
      ...this.codecs,
      [kind]: codec,
    } as Extend<T, Kind, typeof codec>);
  }

  use<Kind extends LazyKeys<T>, A extends LazyArgs<T[Kind]>>(kind: Kind, ...args: A): CodecAddFn;
  use<Kind extends Exclude<keyof T, LazyKeys<T>>>(kind: Kind): CodecAddFn;
  use<Kind extends keyof T, A extends LazyArgs<T[Kind]>>(kind: StringLiteral<Kind>, ...args: A): CodecAddFn {
    const codec = this.codecs[kind] as T[Kind];
    if (codec === undefined) throw new Error(`kind ${kind} is not registered`);
    const res: CodecFns<any, any> = typeof codec === 'function' ? codec.apply(null, args) : codec;
    return (subschema: unknown) => this.addMapping(subschema, res);
  }

  private addMapping(subschema: unknown, codec: CodecFns<any, any>): void {
    this.mappings.set(subschema, codec);
  }

  encode(subschema: unknown, data: unknown): unknown {
    const fns = this.mappings.get(subschema);
    if (fns === undefined) return data;
    return typeof fns.encode === 'function' ? fns.encode(data) : data;
  }

  decode(subschema: unknown, data: unknown): unknown {
    const fns = this.mappings.get(subschema);
    if (fns === undefined) return data;
    return typeof fns.decode === 'function' ? fns.decode(data) : data;
  }
}

export const Apply = <T extends any>(subschema: T, ...codecAddFns: CodecAddFn[]): T => {
  for (const addFn of codecAddFns) {
    addFn(subschema);
  }
  return subschema;
};

export const Encode = (schema: any, inputData: any, ...codecs: Codec<any>[]): any => {
  const sr = new SchemaReader(schema);
  return sr.map(inputData, (value, ...subschemas: any[]) => {
    let mapped: any = value;
    for (const codec of codecs) {
      for (const subschema of subschemas) {
        mapped = codec.encode(subschema, mapped);
      }
    }
    return mapped;
  });
};

export const Decode2 = (schema: any, inputData: any, ...codecs: Codec<any>[]): any => {
  const sr = new SchemaReader(schema);
  return sr.map(inputData, (value, ...subschemas: any[]) => {
    let mapped: any = value;
    for (const codec of codecs) {
      for (const subschema of subschemas) {
        mapped = codec.decode(subschema, mapped);
      }
    }
    return mapped;
  });
};
