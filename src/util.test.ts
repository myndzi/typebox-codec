import { NodeType } from './schemareader';
import { unescapeJsonPointer, escapeJsonPointer, hasChildren, ownProperties, dataPathBuilder } from './util';

describe('hasChildren', () => {
  const tests: [boolean, any][] = [
    [false, {}],
    [true, { properties: null }],
    [true, { patternProperties: null }],
    [true, { additionalProperties: null }],
    [true, { items: null }],
    [true, { additionalItems: null }],
    [true, { prefixItems: null }],
    [true, { properties: null, items: null }],
  ];
  it.each(tests)('returns %s for %s', (expected, d) => {
    expect(hasChildren(d)).toBe(expected);
  });
});

describe('ownProperties', () => {
  it('returns deeply nested property values', () => {
    const d = { foo: [{ bar: 'baz' }] };
    expect(ownProperties(d, 'foo', '0', 'bar')).toBe('baz');
  });

  it('returns undefined if a key is missing', () => {
    const d = { foo: [{ bar: 'baz' }] };
    expect(ownProperties(d, 'a', '0', 'bar')).toBeUndefined();
    expect(ownProperties(d, 'foo', '1', 'bar')).toBeUndefined();
  });

  it('returns undefined on non-object values', () => {
    expect(ownProperties(null, 'foo')).toBeUndefined();
    expect(ownProperties(undefined, 'bar')).toBeUndefined();
  });

  it('only traverses own properties', () => {
    const d = { foo: [{ bar: 'baz' }] };
    const child = Object.create(d);
    expect(ownProperties(child, 'foo', '0', 'baz')).toBeUndefined();
  });
});

describe('dataPathBuilder', () => {
  const testCases: [Exclude<keyof typeof NodeType, 'DefProperty'>, string, string, string][] = [
    ['ObjectProperty', '', 'foo', '.foo'],
    ['ObjectPatternProperties', '', '[a-z]+', './[a-z]+/'],
    ['ObjectAdditionalProperties', '', '', '.*'],
    ['TupleItem', '', '1', '[1]'],
    ['ArrayItems', '', '', '[*]'],
    ['Root', '', '', ''],
  ];
  it.each(testCases)('maps %1$s -> %3$s', (nodeType, parentPath, currentKey, expected) => {
    const composed = dataPathBuilder(NodeType[nodeType], parentPath, currentKey);
    expect(composed).toEqual(expected);
  });
});

describe('unescapeJsonPointer', () => {
  // prettier-ignore
  const testCases: [string, string][] = [
    ['foo'    , 'foo'  ],
    ['f~0o'   , 'f~o'  ],
    ['f~01o'  , 'f~1o' ],
    ['f~1o'   , 'f/o'  ],
    ['f~11o'  , 'f/1o' ],
    ['f~22o'  , 'f~22o'],
    ['f~0o~1o', 'f~o/o'],
  ];
  it.each(testCases)('%s -> %s', (escaped, unescaped) => {
    expect(unescapeJsonPointer(escaped)).toBe(unescaped);
  });
});

describe('escapeJsonPointer', () => {
  // prettier-ignore
  const testCases: [string, string][] = [
    ['foo'  , 'foo'    ],
    ['f~o'  , 'f~0o'   ],
    ['f~1o' , 'f~01o'  ],
    ['f/o'  , 'f~1o'   ],
    ['f/1o' , 'f~11o'  ],
    ['f~o/o', 'f~0o~1o'],
  ];
  it.each(testCases)('%s -> %s', (unescaped, escaped) => {
    expect(escapeJsonPointer(unescaped)).toBe(escaped);
  });
});
