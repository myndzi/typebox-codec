import { expectation, kitchenSink, ksExpectations } from '../fixtures/kitchensink';

export default {};

import { expect } from '@jest/globals';
import { defaultLookupFn, Node, NodeType, SchemaReader } from './schemareader';
import { dataPathBuilder } from './util';

expect.extend({
  toBeCorrectSchema: (actual, expected, path) =>
    actual === expected
      ? {
          pass: true,
          message: () =>
            `expected ${path} not to match schema ${JSON.stringify(actual)} but got ${JSON.stringify(expected)}`,
        }
      : {
          pass: false,
          message: () =>
            `expected ${path} to match schema ${JSON.stringify(actual)} but got ${JSON.stringify(expected)}`,
        },
});

// optionally add a type declaration, e.g. it enables autocompletion in IDEs
declare module 'expect' {
  interface AsymmetricMatchers {
    toBeCorrectSchema(expected: any, path: string): void;
  }
  interface Matchers<R> {
    toBeCorrectSchema(expected: any, path: string): R;
  }
}

describe('defaultLookupFn', () => {
  type valueTestCase<T extends NodeType> = [any, T, string, Node<T>[]];

  const valueTests: valueTestCase<NodeType>[] = [
    [{ $ref: 'foo' }, -1 as NodeType, 'hi', []],
    [
      { properties: { hi: 'there' } },
      NodeType.ObjectProperty,
      'hi',
      [['there', NodeType.ObjectProperty, 'properties', 'hi']],
    ],
    [{ properties: { hi: 'there' } }, NodeType.ObjectAdditionalProperties, 'hi', []],
    [{ properties: { hi: 'there' } }, NodeType.ObjectPatternProperties, 'hi', []],
    [{ properties: { hi: 'there' } }, NodeType.ObjectProperty, 'nope', []],
    [{ $defs: { hi: 'there' } }, NodeType.DefProperty, 'hi', [['there', NodeType.DefProperty, '$defs', 'hi']]],
    [{ $defs: { hi: 'there' } }, NodeType.DefProperty, 'nope', []],
    [
      { definitions: { hi: 'there' } },
      NodeType.DefProperty,
      'hi',
      [['there', NodeType.DefProperty, 'definitions', 'hi']],
    ],
    [{ definitions: { hi: 'there' } }, NodeType.DefProperty, 'nope', []],
    [
      { patternProperties: { hi: 'there' } },
      NodeType.ObjectPatternProperties,
      'hi',
      [['there', NodeType.ObjectPatternProperties, 'patternProperties', 'hi']],
    ],
    [{ patternProperties: { hi: 'there' } }, NodeType.ObjectPatternProperties, 'nope', []],
    [{ items: ['one', 'two'] }, NodeType.TupleItem, '0', [['one', NodeType.TupleItem, 'items', '0']]],
    [{ items: ['one', 'two'] }, NodeType.TupleItem, '1', [['two', NodeType.TupleItem, 'items', '1']]],
    [{ items: ['one', 'two'] }, NodeType.TupleItem, '2', []],
    [{ items: { foo: 'bar' } }, NodeType.TupleItem, '0', []],
    [{ prefixItems: ['one', 'two'] }, NodeType.TupleItem, '0', [['one', NodeType.TupleItem, 'prefixItems', '0']]],
    [{ prefixItems: ['one', 'two'] }, NodeType.TupleItem, '1', [['two', NodeType.TupleItem, 'prefixItems', '1']]],
    [{ prefixItems: ['one', 'two'] }, NodeType.TupleItem, '2', []],
    [{ prefixItems: { foo: 'bar' } }, NodeType.TupleItem, '0', []],
    [
      { prefixItems: ['hi'], items: ['nope'] },
      NodeType.TupleItem,
      '0',
      [['hi', NodeType.TupleItem, 'prefixItems', '0']],
    ],
  ];
  it.each(valueTests)('%s %s key=%s', (schema, nodeType, key, expected) => {
    expect(defaultLookupFn(schema, nodeType, key)).toStrictEqual(expected);
  });

  type listTestCase<T extends NodeType> = [any, T, Node<T>[]];
  const listTests: listTestCase<NodeType>[] = [
    [{ properties: {} }, NodeType.ObjectProperty, []],
    [
      { properties: { hi: 'there' } },
      NodeType.ObjectProperty,
      [['there', NodeType.ObjectProperty, 'properties', 'hi']],
    ],
    [
      { properties: { hi: 'there', other: 'value' } },
      NodeType.ObjectProperty,
      [
        ['there', NodeType.ObjectProperty, 'properties', 'hi'],
        ['value', NodeType.ObjectProperty, 'properties', 'other'],
      ],
    ],
    [{ properties: { hi: 'there' } }, NodeType.ObjectPatternProperties, []],
    [{ patternProperties: {} }, NodeType.ObjectPatternProperties, []],
    [
      { patternProperties: { hi: 'there' } },
      NodeType.ObjectPatternProperties,
      [['there', NodeType.ObjectPatternProperties, 'patternProperties', 'hi']],
    ],
    [
      { patternProperties: { hi: 'there', other: 'value' } },
      NodeType.ObjectPatternProperties,
      [
        ['there', NodeType.ObjectPatternProperties, 'patternProperties', 'hi'],
        ['value', NodeType.ObjectPatternProperties, 'patternProperties', 'other'],
      ],
    ],
    [{ properties: { hi: 'there' } }, NodeType.DefProperty, []],
    [{ $defs: {} }, NodeType.DefProperty, []],
    [{ $defs: { hi: 'there' } }, NodeType.DefProperty, [['there', NodeType.DefProperty, '$defs', 'hi']]],
    [
      { $defs: { hi: 'there', other: 'value' } },
      NodeType.DefProperty,
      [
        ['there', NodeType.DefProperty, '$defs', 'hi'],
        ['value', NodeType.DefProperty, '$defs', 'other'],
      ],
    ],
    [{ definitions: {} }, NodeType.DefProperty, []],
    [{ definitions: { hi: 'there' } }, NodeType.DefProperty, [['there', NodeType.DefProperty, 'definitions', 'hi']]],
    [
      { definitions: { hi: 'there', other: 'value' } },
      NodeType.DefProperty,
      [
        ['there', NodeType.DefProperty, 'definitions', 'hi'],
        ['value', NodeType.DefProperty, 'definitions', 'other'],
      ],
    ],
    [{}, NodeType.ObjectAdditionalProperties, []],
    [
      { additionalProperties: 'foo' },
      NodeType.ObjectAdditionalProperties,
      [['foo', NodeType.ObjectAdditionalProperties, 'additionalProperties']],
    ],
    [{}, NodeType.TupleItem, []],
    [{ items: [] }, NodeType.TupleItem, []],
    [{ items: { foo: 'bar' } }, NodeType.TupleItem, []],
    [{ items: ['one'] }, NodeType.TupleItem, [['one', NodeType.TupleItem, 'items', '0']]],
    [
      { items: ['one', 'two'] },
      NodeType.TupleItem,
      [
        ['one', NodeType.TupleItem, 'items', '0'],
        ['two', NodeType.TupleItem, 'items', '1'],
      ],
    ],
    [{ prefixItems: [] }, NodeType.TupleItem, []],
    [{ prefixItems: { foo: 'bar' } }, NodeType.TupleItem, []],
    [{ prefixItems: ['one'] }, NodeType.TupleItem, [['one', NodeType.TupleItem, 'prefixItems', '0']]],
    [
      { prefixItems: ['one', 'two'] },
      NodeType.TupleItem,
      [
        ['one', NodeType.TupleItem, 'prefixItems', '0'],
        ['two', NodeType.TupleItem, 'prefixItems', '1'],
      ],
    ],
    [{ items: [] }, NodeType.ArrayItems, []],
    [{ items: false }, NodeType.ArrayItems, []],
    [{ items: 'hi' }, NodeType.ArrayItems, [['hi', NodeType.ArrayItems, 'items']]],
    [{ prefixItems: {} }, NodeType.ArrayItems, []],
    [{ prefixItems: false }, NodeType.ArrayItems, []],
    [{ prefixItems: 'hi' }, NodeType.ArrayItems, []],
    [{ additionalItems: 'hi', items: [] }, NodeType.ArrayItems, [['hi', NodeType.ArrayItems, 'additionalItems']]],
    [{ items: 'hi', prefixItems: [] }, NodeType.ArrayItems, [['hi', NodeType.ArrayItems, 'items']]],
  ];

  it.each(listTests)('%s', (schema, nodeType, expected) => {
    expect(defaultLookupFn(schema, nodeType)).toStrictEqual(expected);
  });
});

describe('SchemaReader', () => {
  it('requires an object', () => {
    expect(() => new SchemaReader(null as any)).toThrow(/must be a plain JavaScript object/);
  });

  describe('baseURI', () => {
    it('accepts a retrievalURI in the constructor', () => {
      const sr = new SchemaReader({}, { retrievalURI: 'https://example.com/' });
      expect(sr.baseURI).toBe('https://example.com/#');
    });
    it('accepts an $id in the schema', () => {
      const sr = new SchemaReader({ $id: 'https://example.com/' });
      expect(sr.baseURI).toBe('https://example.com/#');
    });
    it('prefers $id to retrieval uri', () => {
      const sr = new SchemaReader({ $id: 'https://example.com/foo' }, { retrievalURI: 'https://example.com/' });
      expect(sr.baseURI).toBe('https://example.com/foo#');
    });
    it('defaults to #', () => {
      const sr = new SchemaReader({});
      expect(sr.baseURI).toBe('#');
    });
    it.each([
      [{ $id: 'https://example.com/#' }, {}],
      [{}, { retrievalURI: 'https://example.com/#' }],
      [{ $id: 'https://example.com/#' }, { retrievalURI: 'https://example.com/#' }],
    ])('rejects base URI with a fragment', (schema, opts) => {
      expect(() => new SchemaReader(schema, opts)).toThrow(/cannot have a base URI with a fragment/);
    });
    it('accepts an alternate lookup function', () => {
      const mock: Node[] = [];
      const sr = new SchemaReader({}, { lookupFn: () => mock });
      sr.try(v => expect(v).toBe(mock), NodeType.ObjectAdditionalProperties);
    });
  });
  describe('dereference', () => {
    it('rejects invalid refs', () => {
      const sr = new SchemaReader({});
      expect(sr.dereference(null as any)).toBeUndefined();
    });

    it('accepts a json pointer and returns the result', () => {
      const sr = new SchemaReader({ hi: [{ there: 'foo' }] });
      expect(sr.dereference('#/hi/0/there')).toStrictEqual('foo');
      expect(sr.dereference('#/hi/0')).toStrictEqual({ there: 'foo' });
      expect(sr.dereference('#/hi')).toStrictEqual([{ there: 'foo' }]);
      expect(sr.dereference('#')).toStrictEqual(sr.root);
    });

    it('returns undefined for unknown documents', () => {
      const sr = new SchemaReader({ hi: 'there' });
      expect(sr.dereference('foo#/hi')).toBeUndefined();
    });

    it('allows addition of other documents', () => {
      const sr = new SchemaReader({ hi: 'there' });
      sr.addDocument({ hi: 'other' }, 'foo');
      expect(sr.dereference('foo#/hi')).toBe('other');
    });

    it('disallows overwriting existing documents with different schemas', () => {
      const sr = new SchemaReader({ hi: 'there' });
      const other = { hi: 'other' };
      expect(() => sr.addDocument(other, 'foo')).not.toThrow();
      expect(() => sr.addDocument(other, 'foo')).not.toThrow();
      expect(() => sr.addDocument({ hi: 'other' }, 'foo')).toThrow(/refusing to replace/);
    });

    it('memoizes ref lookups', () => {
      const sr = new SchemaReader({ hi: [{ there: 'foo' }] });
      expect(sr.dereference('#/hi/0/there')).toStrictEqual('foo');
      expect(sr.dereference('#/hi/0')).toStrictEqual({ there: 'foo' });
      expect(sr.dereference('#/hi')).toStrictEqual([{ there: 'foo' }]);
      expect(sr.dereference('#')).toStrictEqual(sr.root);

      delete (sr.root as any).hi; // don't try this at home

      expect(sr.dereference('#/hi/0/there')).toStrictEqual('foo');
      expect(sr.dereference('#/hi/0')).toStrictEqual({ there: 'foo' });
      expect(sr.dereference('#/hi')).toStrictEqual([{ there: 'foo' }]);
      expect(sr.dereference('#')).toStrictEqual(sr.root);
    });

    it('returns the root with no fragment', () => {
      const sr = new SchemaReader({ hi: 'there' });
      expect(sr.dereference('')).toStrictEqual(sr.root);
    });

    it('unescapes json pointers', () => {
      const sr = new SchemaReader({ 'hi~/': 'there' });
      expect(sr.dereference('#/hi~0~1')).toBe('there');
    });
  });

  describe('try', () => {
    it.each([
      [{ properties: { hi: { items: ['foo'] } } }, NodeType.ObjectProperty, 'hi', NodeType.ArrayItems, 'foo'],
      [
        { additionalProperties: { hi: { additionalItems: ['foo'] } } },
        NodeType.ObjectPatternProperties,
        'hi',
        NodeType.ArrayItems,
        'foo',
      ],
      [{ $defs: { hi: { something: 'foo' } } }, NodeType.DefProperty, 'hi', NodeType.ObjectAdditionalProperties, 'foo'],
      [{}, NodeType.DefProperty, 'hi', NodeType.ObjectAdditionalProperties, undefined],
    ])('recurses into a schema when nested', (sch, nt1, nk1, nt2, exp) => {
      const sr = new SchemaReader(sch);
      sr.try(
        () => {
          sr.try(([v]) => {
            expect(v).toBe(exp);
          }, nt2);
        },
        nt1,
        nk1,
      );
    });
  });
  describe('each', () => {
    it.each([
      [
        { properties: { hi: 'one', there: 'two' } },
        NodeType.ObjectProperty,
        [
          ['one', NodeType.ObjectProperty, 'properties', 'hi'],
          ['two', NodeType.ObjectProperty, 'properties', 'there'],
        ],
      ],
      [
        { items: ['one', 'two'] },
        NodeType.TupleItem,
        [
          ['one', NodeType.TupleItem, 'items', '0'],
          ['two', NodeType.TupleItem, 'items', '1'],
        ],
      ],
    ])('calls with each child schema', (sch, nt, exp) => {
      const sr = new SchemaReader(sch);
      const results: Node[] = [];
      sr.each(node => results.push(node), nt);
      expect(results).toStrictEqual(exp);
    });
  });

  describe('depth', () => {
    it('reports current "data" depth', () => {
      const sr = new SchemaReader({ properties: { hi: { items: 'there' } } });
      expect(sr.depth()).toBe(0);
      sr.try(
        () => {
          expect(sr.depth()).toBe(1);
          sr.try(() => {
            expect(sr.depth()).toBe(2);
          }, NodeType.ArrayItems);
        },
        NodeType.ObjectProperty,
        'hi',
      );
      expect(sr.depth()).toBe(0);
    });
  });

  describe('traverse', () => {
    type testCases = [string, any, any, [any, any, string][]];
    const tests: testCases[] = [
      ['object without schema', {}, { hi: 'data' }, []],
      ['properties', { properties: { hi: { type: 'string' } } }, { hi: 'data' }, [[{ type: 'string' }, 'data', '.hi']]],
      [
        'pattern properties',
        { patternProperties: { foo: { type: 'string' }, '^$': { type: 'never' } } },
        { foo: 'data' },
        [[{ type: 'string' }, 'data', './foo/']],
      ],
      [
        'overlapping pattern properties',
        { properties: { foo: { type: 'number' } }, patternProperties: { foo: { type: 'string' } } },
        { foo: 'data' },
        [
          [{ type: 'number' }, 'data', '.foo'],
          [{ type: 'string' }, 'data', './foo/'],
        ],
      ],
      [
        'additional properties',
        { additionalProperties: { type: 'string' } },
        { foo: 'data' },
        [[{ type: 'string' }, 'data', '.*']],
      ],
      ['array values', { items: { type: 'string' } }, ['data'], [[{ type: 'string' }, 'data', '[*]']]],
      [
        'array values',
        { items: [], additionalItems: { type: 'string' } },
        ['data'],
        [[{ type: 'string' }, 'data', '[*]']],
      ],
      [
        'tuples (new)',
        { prefixItems: [{ type: 'string' }, { type: 'number' }] },
        ['data', 1],
        [
          [{ type: 'string' }, 'data', '[0]'],
          [{ type: 'number' }, 1, '[1]'],
        ],
      ],
      [
        'tuples (old)',
        { items: [{ type: 'string' }, { type: 'number' }] },
        ['data', 1],
        [
          [{ type: 'string' }, 'data', '[0]'],
          [{ type: 'number' }, 1, '[1]'],
        ],
      ],
      [
        'tuples (new) and rest',
        { prefixItems: [{ type: 'string' }, { type: 'number' }], items: { type: 'boolean' } },
        ['data', 1, true],
        [
          [{ type: 'string' }, 'data', '[0]'],
          [{ type: 'number' }, 1, '[1]'],
          [{ type: 'boolean' }, true, '[*]'],
        ],
      ],
      [
        'tuples (old) and rest',
        { items: [{ type: 'string' }, { type: 'number' }], additionalItems: { type: 'boolean' } },
        ['data', 1, true],
        [
          [{ type: 'string' }, 'data', '[0]'],
          [{ type: 'number' }, 1, '[1]'],
          [{ type: 'boolean' }, true, '[*]'],
        ],
      ],
      [
        'recursive properties',
        { properties: { foo: { type: 'number' }, children: { $ref: '#' } } },
        { foo: 0, children: { foo: 1 } },
        [
          [{ type: 'number' }, 0, '.foo'],
          [{ type: 'number' }, 1, '.children.foo'],
        ],
      ],
    ];
    it.each(tests)('traverses %s', (_, sch, d, exps) => {
      const sr = new SchemaReader(sch);
      let i = 0;
      sr.traverse(d, (schema, data, path) => {
        const exp = exps[i];
        expect(exp).not.toBeUndefined();
        if (exp !== undefined) {
          expect(schema).toStrictEqual(exp[0]);
          expect(data).toBe(exp[1]);
          const dataPath = path.reduce((acc, [_1, nodeType, _2, key]) => dataPathBuilder(nodeType, acc, key), '');
          expect(dataPath).toBe(exp[2]);
        }
        i++;
      });
      expect(i).toBe(exps.length);
    });
  });
});
