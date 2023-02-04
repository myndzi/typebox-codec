import { Type } from '@sinclair/typebox';
import moment from 'moment';
import { Apply, Codec, Decode2, Encode } from '../src/codec';
import { NodeType, SchemaReader } from '../src/schemareader';

export default 0;

enum Foo {
  A,
  B,
}
const momentParse = (format: string) => (s: string) => moment(s, format).toDate();
const momentFormat = (format: string) => (d: Date) => moment(d).format(format);
const momentCodec = (format: string) => ({ encode: momentFormat(format), decode: momentParse(format) });

// notes to self
// a transformation is an "intent":
//   "i want to load the data from <source>"
//   "i want to display the contents on screen" <- should be a codec?
//   "i want to generate an example config file"
// a codec is a "kind" of data we're transforming to/from(?):
//   "i want to transform data from the environment"
//   "i want to transform data from the database"

// should just always be encode/decode, the only difference is what we're transforming to/from
// we're either loading data into its canoncial form, or producing it for some other format
// generating a config file, displaying on screen, serializing to json, etc...

// now that we have full schema and schema+data traversal... do we need to take this wrapper
// interface?

const paramEnum = (_enum: any) => ({
  encode: (v: any) => _enum[v],
  decode: (v: string) => _enum[v],
});

const File = Codec.create().add('enum', paramEnum);

const Env = Codec.create().add('epoch', momentCodec('x')).add('YMD', momentCodec('YYYY-MM-DD')).add('enum', paramEnum);
const Screen = Codec.create().add('redact', { encode: (v: any) => '[redacted]', decode: () => undefined });
const Redact = Screen.use('redact');

const testSchema = Type.Object(
  {
    ts: Apply(Type.Date({ description: 'A timestamp' }), Env.use('epoch')),
    foo: Apply(Type.Enum(Foo), Env.use('enum', Foo)),
    password: Apply(Type.Optional(Type.String()), Redact),
    tuple: Type.Tuple([Apply(Type.Date({ description: 'A date' }), Env.use('YMD'))]),
  },
  { description: 'A test schema' },
);

const encoded = Encode(
  testSchema,
  {
    ts: new Date(),
    foo: Foo.B,
    password: 'hunter2',
    tuple: [new Date()],
  },
  Env,
  Screen,
);
console.log(encoded);

const decoded = Decode2(testSchema, encoded, Screen, Env);
console.log(decoded);

const sr = new SchemaReader(testSchema);
sr.traverseSchema(path => {
  const pathString = path.reduce((acc, node) => {
    const [schema, nodeType, parentKey, key] = node;
    switch (nodeType) {
      case NodeType.Root:
        return acc;
      case NodeType.DefProperty:
        return `$${key}`;
      case NodeType.ObjectProperty:
        return `${acc}.${key}`;
      case NodeType.ObjectPatternProperties:
        return `${acc}./${key}`;
      case NodeType.ObjectAdditionalProperties:
        return `${acc}.*`;
      case NodeType.ArrayItems:
        return `${acc}[*]`;
      case NodeType.TupleItem:
        return `${acc}[${key}]`;
    }
  }, '');
  const node = path[path.length - 1];

  if (node && Object.prototype.hasOwnProperty.call(node[0], 'description')) {
    console.log(`${pathString}: ${(node[0] as any).description}`);
  }
});

// let decoded = CEpoch.Transform(Decode, testSchema, {
//   ts: 1673870703793,
//   foo: 'B',
//   password: 'hunter2',
// });
// console.log(decoded);
// console.log(Value.Check(testSchema, decoded));

// let encoded = CRedact.Transform(Encode, testSchema, decoded);
// console.log(encoded);

// const CEmpty = new Codec('Empty', Decode);
// console.log(CEmpty.Transform(Decode, testSchema, decoded));

// decoded = CDate.Transform(Decode, testSchema, { ts: '2023-01-16', foo: 'A' });
// console.log(decoded);
// console.log(Value.Check(testSchema, decoded));

// console.log(
//   Value.Check(testSchema, {
//     ts: new Date(),
//   }),
// );
