import { NodeType } from '../src/schemareader';

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
    notTuple: { items: str },
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
const $defs = kitchenSink.$defs as any;

// export type expectation = [string, any, NodeType, string | undefined];
export type expectation = [NodeType, any, string | undefined, string | undefined, string | undefined];
// prettier-ignore
export const ksExpectations: Map<string, expectation> = new Map([
  ['.str',                [/*'#/properties/str',                            */ NodeType.ObjectProperty,             str,                undefined    , 'str'                 , 'properties'           ]],
  ['.num',                [/*'#/properties/num',                            */ NodeType.ObjectProperty,             num,                undefined    , 'num'                 , 'properties'           ]],
  ['./^_pat.*/',          [/*'#/patternProperties/^_pat.*',                 */ NodeType.ObjectPatternProperties,    str,                undefined    , '^_pat.*'             , 'patternProperties'    ]],
  ['./foo/bar/',          [/*'#/patternProperties/foo~1bar',                */ NodeType.ObjectPatternProperties,    str,                undefined    , 'foo/bar'             , 'patternProperties'    ]],
  ['.*',                  [/*'#/additionalProperties',                      */ NodeType.ObjectAdditionalProperties, num,                undefined    , undefined             , 'additionalProperties' ]],
  ['.refStr',             [/*'#/properties/refStr',                         */ NodeType.ObjectProperty,             $defs.foo,          '#/$defs/foo', 'refStr'              , 'properties'           ]],
  ['.refObj',             [/*'#/properties/refObj',                         */ NodeType.ObjectProperty,             $defs.bar,          '#/$defs/bar', 'refObj'              , 'properties'           ]],
  ['.foo/bar~baz',        [/*'#/properties/foo~1bar~0baz',                  */ NodeType.ObjectProperty,             str,                undefined    , 'foo/bar~baz'         , 'properties'           ]],
  ['.child',              [/*'#/properties/child',                          */ NodeType.ObjectProperty,             ks.child,           undefined    , 'child'               , 'properties'           ]],
  ['.child.str',          [/*'#/properties/child/properties/str',           */ NodeType.ObjectProperty,             str,                undefined    , 'str'                 , 'properties'           ]],
  ['.child.num',          [/*'#/properties/child/properties/num',           */ NodeType.ObjectProperty,             num,                undefined    , 'num'                 , 'properties'           ]],
  ['.notTuple',           [/*'#/properties/notTuple',                       */ NodeType.ObjectProperty,             ks.notTuple,        undefined    , 'notTuple'            , 'properties'           ]],
  ['.notTuple[*]',        [/*'#/properties/notTuple/items',                 */ NodeType.ArrayItems,                 str,                undefined    , undefined             , 'items'                ]],
  ['.oldTuple',           [/*'#/properties/oldTuple',                       */ NodeType.ObjectProperty,             ks.oldTuple,        undefined    , 'oldTuple'            , 'properties'           ]],
  ['.oldTuple[0]',        [/*'#/properties/oldTuple/items/0',               */ NodeType.TupleItem,                  str,                undefined    , '0'                   , 'items'                ]],
  ['.oldTuple[1]',        [/*'#/properties/oldTuple/items/1',               */ NodeType.TupleItem,                  num,                undefined    , '1'                   , 'items'                ]],
  ['.oldTuple[*]',        [/*'#/properties/oldTuple/additionalItems',       */ NodeType.ArrayItems,                 bool,               undefined    , undefined             , 'additionalItems'      ]],
  ['.oldTupleNoExtra',    [/*'#/properties/oldTupleNoExtra',                */ NodeType.ObjectProperty,             ks.oldTupleNoExtra, undefined    , 'oldTupleNoExtra'     , 'properties'           ]],
  ['.oldTupleNoExtra[0]', [/*'#/properties/oldTupleNoExtra/items/0',        */ NodeType.TupleItem,                  str,                undefined    , '0'                   , 'items'                ]],
  ['.newTuple',           [/*'#/properties/newTuple',                       */ NodeType.ObjectProperty,             ks.newTuple,        undefined    , 'newTuple'            , 'properties'           ]],
  ['.newTuple[0]',        [/*'#/properties/newTuple/prefixItems/0',         */ NodeType.TupleItem,                  str,                undefined    , '0'                   , 'prefixItems'          ]],
  ['.newTuple[1]',        [/*'#/properties/newTuple/prefixItems/1',         */ NodeType.TupleItem,                  num,                undefined    , '1'                   , 'prefixItems'          ]],
  ['.newTuple[*]',        [/*'#/properties/newTuple/items',                 */ NodeType.ArrayItems,                 bool,               undefined    , undefined             , 'items'                ]],
  ['.newTupleNoExtra',    [/*'#/properties/newTupleNoExtra',                */ NodeType.ObjectProperty,             ks.newTupleNoExtra, undefined    , 'newTupleNoExtra'     , 'properties'           ]],
  ['.newTupleNoExtra[0]', [/*'#/properties/newTupleNoExtra/prefixItems/0',  */ NodeType.TupleItem,                  str,                undefined    , '0'                   , 'prefixItems'          ]],
]);
