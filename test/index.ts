import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import moment from 'moment';
import { Codec, Apply, Transform, Transformer } from '../src';

export default 0;

enum Foo {
  A,
  B,
}
const Encode = new Transformer('Encode');
const Decode = new Transformer('Decode');

const momentParse = (format: string) => (v: string) =>
  moment(v, format).toDate();

const CAny = new Codec('Any', Encode, Decode);
const CEpoch = new Codec('Epoch', CAny);
const CDate = new Codec('Date', CAny);
const CRedact = new Codec('Redact', CAny);

const testSchema = Type.Object({
  ts: Apply(
    Type.Date(),
    Transform(CEpoch, Decode, momentParse('x')),
    Transform(CDate, Decode, momentParse('YYYY-MM-DD')),
  ),
  foo: Apply(
    Type.Enum(Foo),
    Transform(CAny, Decode, (v: string) => (Foo as any)[v]),
    Transform(CAny, Encode, (v: Foo) => Foo[v]),
  ),
  password: Apply(
    Type.Optional(Type.String()),
    Transform(CRedact, Encode, () => '[redacted]'),
  ),
});

let decoded = CEpoch.Transform(Decode, testSchema, {
  ts: 1673870703793,
  foo: 'B',
  password: 'hunter2',
});
console.log(decoded);
console.log(Value.Check(testSchema, decoded));

let encoded = CRedact.Transform(Encode, testSchema, decoded);
console.log(encoded);

const CEmpty = new Codec('Empty', Decode);
console.log(CEmpty.Transform(Decode, testSchema, decoded));

decoded = CDate.Transform(Decode, testSchema, { ts: '2023-01-16', foo: 'A' });
console.log(decoded);
console.log(Value.Check(testSchema, decoded));

console.log(
  Value.Check(testSchema, {
    ts: new Date(),
  }),
);
