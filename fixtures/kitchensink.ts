import { NodeType } from '../src/traverse';

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
  },
  patternProperties: {
    '^_pat.*': str,
  },
  additionalProperties: num,
  $defs: {
    foo: str,
    bar: obj({ str, num }),
  },
};

const ks = kitchenSink.properties as any;

type expectation = [any, NodeType, string | undefined, boolean];
export const ksExpectations: Map<string, expectation> = new Map([
  ['.str', [str, NodeType.ObjectProperty, undefined, false]],
  ['.num', [num, NodeType.ObjectProperty, undefined, false]],
  ['./^_pat.*/', [str, NodeType.ObjectPatternProperties, undefined, false]],
  ['.*', [num, NodeType.ObjectAdditionalProperties, undefined, false]],
  ['.child', [ks.child, NodeType.ObjectProperty, undefined, true]],
  ['.child.str', [str, NodeType.ObjectProperty, undefined, false]],
  ['.child.num', [num, NodeType.ObjectProperty, undefined, false]],
  ['.oldTuple', [ks.oldTuple, NodeType.ObjectProperty, undefined, true]],
  ['.oldTuple[0]', [str, NodeType.TupleItem, undefined, false]],
  ['.oldTuple[1]', [num, NodeType.TupleItem, undefined, false]],
  ['.oldTuple[*]', [bool, NodeType.ArrayItems, undefined, false]],
  ['.oldTupleNoExtra', [ks.oldTupleNoExtra, NodeType.ObjectProperty, undefined, true]],
  ['.oldTupleNoExtra[0]', [str, NodeType.TupleItem, undefined, false]],
  ['.newTuple', [ks.newTuple, NodeType.ObjectProperty, undefined, true]],
  ['.newTuple[0]', [str, NodeType.TupleItem, undefined, false]],
  ['.newTuple[1]', [num, NodeType.TupleItem, undefined, false]],
  ['.newTuple[*]', [bool, NodeType.ArrayItems, undefined, false]],
  ['.newTupleNoExtra', [ks.newTupleNoExtra, NodeType.ObjectProperty, undefined, true]],
  ['.newTupleNoExtra[0]', [str, NodeType.TupleItem, undefined, false]],
]);
