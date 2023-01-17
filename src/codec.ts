import { Kind, TSchema } from '@sinclair/typebox';
import { Transformer, TransformFn } from './transformer';
import { AtLeastOne, isArray, isObject } from './util';

// Codec handles concurrent traversal of a schema and a value in the context
// of a given Transformer. It can also be configured to fall back to a parent
// Codec, and will call out to that parent if it doesn't already know about
// a function for a specific schema / Transformer pair
export class Codec {
  // Codec's constructor type needs to distinguish between Codecs and Transformers,
  // so we use nominal typing to prevent one from matching the other...
  private readonly __brand?: 'codec';

  protected transformFns: Map<Transformer, Map<TSchema, TransformFn<any>>> =
    new Map();
  protected transformers: Set<Transformer> = new Set();
  protected parentCodec: Codec | undefined;

  constructor(name: string, ...transformers: AtLeastOne<Transformer>);
  constructor(name: string, parentCodec: Codec);
  constructor(
    name: string,
    parentCodec: Codec,
    ...transformers: AtLeastOne<Transformer>
  );
  constructor(
    public readonly name: string,
    ...args:
      | [Codec]
      | AtLeastOne<Transformer>
      | [Codec, ...AtLeastOne<Transformer>]
  ) {
    for (const arg of args) {
      if (arg instanceof Codec) this.parentCodec = arg;
      else this.transformers.add(arg);
    }

    // support the same transformers as defined by the parent
    if (this.parentCodec) {
      for (const transformer of this.parentCodec.transformers.values()) {
        this.transformers.add(transformer);
      }
    }
  }

  AddTransformation<T extends TSchema, U extends TransformFn<T>>(
    transformer: Transformer,
    schema: T,
    fn: U,
  ) {
    const fns = this.transformFns.get(transformer) ?? new Map();
    fns.set(schema, fn);
    this.transformFns.set(transformer, fns);
  }

  Transform<T extends TSchema>(
    transformer: Transformer,
    schema: T,
    value: unknown,
    references: TSchema[] = [],
  ): unknown {
    if (!this.transformers.has(transformer)) {
      throw new Error(
        `Cannot find the transformer '${transformer.name}'. Be sure to include it in the Codec's constructor.`,
      );
    }

    const newRefs =
      schema.$id === undefined ? references : [schema, ...references];

    switch (schema[Kind]) {
      // dereference schema, call again
      case 'Ref':
      case 'Self':
        const reference = references.find(
          reference => reference.$id === schema['$ref'],
        );
        if (reference === undefined)
          throw new Error(`Cannot find schema with $id '${schema['$ref']}'.`);
        return this.Transform(transformer, reference, value, newRefs);

      // map items
      case 'Array':
      case 'Tuple':
        if (!isArray(value)) throw new Error('Value is not an array');
        return value.map((iVal, iKey) => {
          return this.Transform(transformer, schema['items'], iVal, newRefs);
        });

      // map properties
      case 'Object':
      case 'Record':
        if (!isObject(value)) throw new Error('Value is not an object');
        return Object.fromEntries(
          Object.entries(value).map(([pKey, pVal]) =>
            schema['properties'][pKey] === undefined
              ? [pKey, pVal] // keep unknown properties; TODO: optionally discard?
              : [
                  pKey,
                  this.Transform(
                    transformer,
                    schema['properties'][pKey],
                    pVal,
                    newRefs,
                  ),
                ],
          ),
        );

      // map values
      default:
        const transformFn = this.transformFns.get(transformer)?.get(schema);

        // this codec directly has an assigned mapping function for
        // this schema element
        if (transformFn) {
          return transformFn(value);
        }

        // Codecs optionally have a parent codec, for example when
        // certain schema elements don't vary by codec but still
        // need processing. call out to that if present
        if (this.parentCodec) {
          return this.parentCodec.Transform(
            transformer,
            schema,
            value,
            references,
          );
        }

        // all mapping functions are optional, just return the value
        // as-is if we don't want to do anything with it
        return value;
    }
  }
}
