import { NodeType } from '../src/visitor';

const str = { type: 'string' };
const num = { type: 'number' };
const bool = { type: 'boolean' };
const obj = (properties: any) => ({ properties });
const newTuple = (prefixItems: any[], items: any) => ({ prefixItems, items });
const oldTuple = (items: any[], additionalItems: any) => ({
  items,
  additionalItems,
});

export const kitchenSink = {
  properties: {
    str,
    num,
    child: obj({ str, num }),
    oldTuple: oldTuple([str, num], bool),
    newTuple: newTuple([str, num], bool),
    oldTupleNoExtra: oldTuple([str], false),
    newTupleNoExtra: newTuple([str], false),
    refStr: { $ref: '#/$defs/foo' },
    refObj: { $ref: '#/$defs/bar' },
    'foo~1bar~0baz': str,
  },
  patternProperties: {
    '^_pat.*': str,
    'foo~1bar': str,
  },
  additionalProperties: num,
  $defs: {
    foo: str,
    bar: obj({ str, num }),
  },
};

const ks = kitchenSink.properties as any;

export type expectation = [string, any, NodeType, string | undefined, boolean];
// prettier-ignore
export const ksExpectations: Map<string, expectation> = new Map([
  ['.str',                ['#/properties/str',                           str,                NodeType.ObjectProperty,             undefined,     false ]],
  ['.num',                ['#/properties/num',                           num,                NodeType.ObjectProperty,             undefined,     false ]],
  ['./^_pat.*/',          ['#/patternProperties/^_pat.*',                str,                NodeType.ObjectPatternProperties,    undefined,     false ]],
  ['./foo/bar/',          ['#/patternProperties/foo~1bar',               str,                NodeType.ObjectPatternProperties,    undefined,     false ]],
  ['.*',                  ['#/additionalProperties',                     num,                NodeType.ObjectAdditionalProperties, undefined,     false ]],
  ['.refStr',             ['#/properties/refStr',                        ks.refStr,          NodeType.ObjectProperty,             '#/$defs/foo', false ]],
  ['.refObj',             ['#/properties/refObj',                        ks.refObj,          NodeType.ObjectProperty,             '#/$defs/bar', false ]],
  ['.foo/bar~baz',        ['#/properties/foo~1bar~0baz',                 str,                NodeType.ObjectProperty,             undefined,     false ]],
  ['.child',              ['#/properties/child',                         ks.child,           NodeType.ObjectProperty,             undefined,     true  ]],
  ['.child.str',          ['#/properties/child/properties/str',          str,                NodeType.ObjectProperty,             undefined,     false ]],
  ['.child.num',          ['#/properties/child/properties/num',          num,                NodeType.ObjectProperty,             undefined,     false ]],
  ['.oldTuple',           ['#/properties/oldTuple',                      ks.oldTuple,        NodeType.ObjectProperty,             undefined,     true  ]],
  ['.oldTuple[0]',        ['#/properties/oldTuple/items/0',              str,                NodeType.TupleItem,                  undefined,     false ]],
  ['.oldTuple[1]',        ['#/properties/oldTuple/items/1',              num,                NodeType.TupleItem,                  undefined,     false ]],
  ['.oldTuple[*]',        ['#/properties/oldTuple/additionalItems',      bool,               NodeType.ArrayItems,                 undefined,     false ]],
  ['.oldTupleNoExtra',    ['#/properties/oldTupleNoExtra',               ks.oldTupleNoExtra, NodeType.ObjectProperty,             undefined,     true  ]],
  ['.oldTupleNoExtra[0]', ['#/properties/oldTupleNoExtra/items/0',       str,                NodeType.TupleItem,                  undefined,     false ]],
  ['.newTuple',           ['#/properties/newTuple',                      ks.newTuple,        NodeType.ObjectProperty,             undefined,     true  ]],
  ['.newTuple[0]',        ['#/properties/newTuple/prefixItems/0',        str,                NodeType.TupleItem,                  undefined,     false ]],
  ['.newTuple[1]',        ['#/properties/newTuple/prefixItems/1',        num,                NodeType.TupleItem,                  undefined,     false ]],
  ['.newTuple[*]',        ['#/properties/newTuple/items',                bool,               NodeType.ArrayItems,                 undefined,     false ]],
  ['.newTupleNoExtra',    ['#/properties/newTupleNoExtra',               ks.newTupleNoExtra, NodeType.ObjectProperty,             undefined,     true  ]],
  ['.newTupleNoExtra[0]', ['#/properties/newTupleNoExtra/prefixItems/0', str,                NodeType.TupleItem,                  undefined,     false ]],
]);
