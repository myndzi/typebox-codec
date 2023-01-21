import {
  dataPathBuilder,
  NodeType,
  strictVal,
  Visitor,
  unescapeJsonPointer,
  VisitorCallback,
  escapeJsonPointer,
} from './visitor';

import { expectation, kitchenSink, ksExpectations } from '../fixtures/kitchensink';

export default {};

import { expect } from '@jest/globals';

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

describe('defaultPathBuilder', () => {
  const testCases: [keyof typeof NodeType, string, string, string][] = [
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

describe('strictVal', () => {
  const testCases: [any, string, 'string' | 'object' | undefined, string | object | undefined][] = [
    [{ foo: 'bar' }, 'foo', 'string', 'bar'],
    [{ foo: { bar: 'baz' } }, 'foo', 'object', { bar: 'baz' }],
    [{ foo: { bar: 'baz' } }, 'foo', 'string', undefined],
    [{ foo: 'bar' }, 'foo', undefined, 'bar'],
    [{ foo: { bar: 'baz' } }, 'foo', undefined, { bar: 'baz' }],
    [{ foo: 'bar' }, 'baz', 'string', undefined],
    ['bar', 'baz', 'string', undefined],
    [Object.assign(Object.create({ foo: 'bar' }), { prototypeFoo: 'bar' }), 'foo', 'string', undefined],
  ];
  it.each(testCases)('strictVal(%s, %s, %s) -> %s', (obj, key, type, expected) => {
    expect(strictVal(obj, key, type)).toEqual(expected);
  });
});
describe('Visitor', () => {
  describe('constructor', () => {
    const nonPlainObjects = [new Date(), null, undefined, 1, 1n, 'foo', []];
    it.each(nonPlainObjects)('requires an object root', v => {
      expect(() => new Visitor(v)).toThrow(/must be a plain.*object/);
    });

    it('supports custom path construction', () => {
      const t = new Visitor(kitchenSink, () => 'ok');
      t.visit(({ dataPath }) => {
        expect(dataPath).toEqual('ok');
      });
    });
  });

  describe('#ref', () => {
    const externalPaths = ['/foo', 'https://example.com#bar'];
    it.each(externalPaths)(`fails on external references (%s)`, path => {
      const t = new Visitor({});
      expect(() => t.ref(path)).toThrow(/not supported/);
    });

    const testCases: [string, any, string | undefined, string | undefined][] = [
      ['property access', { foo: 'bar' }, '#/foo', 'bar'],
      ['deep property access', { foo: { bar: 'baz' } }, '#/foo/bar', 'baz'],
      ['array access', { foo: ['bar', 'baz'] }, '#/foo/0', 'bar'],
      ['undefined access', {}, undefined, undefined],
      ['undefined value', {}, '#/foo', undefined],
    ];
    it.each(testCases)('looks up ref (%s)', (_, schema, path, expected) => {
      const t = new Visitor(schema);
      expect(t.ref(path)).toBe(expected);
    });

    it('memoizes ref lookups', () => {
      const schema = { foo: 'bar' };
      const t = new Visitor(schema);
      expect(t.ref('#/foo')).toBe('bar');
      schema.foo = 'baz';
      expect(t.ref('#/foo')).toBe('bar');
    });

    it('normalizes ref lookups', () => {
      const schema = { foo: 'bar' };
      const t = new Visitor(schema);
      expect(t.ref('#/foo')).toBe('bar');
      schema.foo = 'baz';
      expect(t.ref('#/f%6fo')).toBe('bar');
    });
  });

  describe('visitDefs', () => {
    it.each(['$defs', 'definitions'])('visits %s', key => {
      const schema = {
        [key]: {
          foo: { type: 'string' },
          bar: { type: 'object', properties: { baz: { type: 'string' } } },
        },
      };

      const schemaVal = schema[key];
      if (!schemaVal) throw new Error('wat');

      const t = new Visitor(schema);

      // prettier-ignore
      const unresolved: Map<string, expectation> = new Map([
        ['.foo',     [`#/${key}/foo`,                schemaVal.foo,                NodeType.ObjectProperty, undefined, false]],
        ['.bar',     [`#/${key}/bar`,                schemaVal.bar,                NodeType.ObjectProperty, undefined, true ]],
        ['.bar.baz', [`#/${key}/bar/properties/baz`, schemaVal.bar.properties.baz, NodeType.ObjectProperty, undefined, false]],
      ]);

      t.visitDefs(({ schema, nodeType, dataPath, jsonPath, $ref, hasChildren }) => {
        const exp = unresolved.get(dataPath);
        if (!exp) {
          throw new Error(`visit encountered an unexpected path: ${dataPath}`);
        }
        expect(jsonPath).toBe(exp[0]);
        expect(schema).toBeCorrectSchema(exp[1], dataPath);
        expect(NodeType[nodeType]).toBe(NodeType[exp[2]]);
        expect($ref).toBe(exp[3]);
        expect(hasChildren).toBe(exp[4]);

        unresolved.delete(dataPath);
      });
      expect([...unresolved.keys()]).toEqual([]);
    });
  });

  describe('visit', () => {
    it('handles object properties', () => {
      const t = new Visitor(kitchenSink);
      const unresolved = new Map(ksExpectations);
      t.visit(({ schema, nodeType, dataPath, jsonPath, $ref, hasChildren }) => {
        const exp = unresolved.get(dataPath);
        if (!exp) {
          throw new Error(`visit encountered an unexpected path: ${dataPath}`);
        }
        expect(jsonPath).toBe(exp[0]);
        expect(schema).toBeCorrectSchema(exp[1], dataPath);
        expect(NodeType[nodeType]).toBe(NodeType[exp[2]]);
        expect($ref).toBe(exp[3]);
        expect(hasChildren).toBe(exp[4]);

        unresolved.delete(dataPath);
      });
      expect([...unresolved.keys()]).toEqual([]);
    });
  });

  describe('refSources', () => {
    it(`throws if visit hasn't been called`, () => {
      const t = new Visitor({});
      expect(() => t.refSources('foo')).toThrow(/can't be called before/);
    });

    const testCases: [any, string[]][] = [
      [kitchenSink.$defs.foo, ['.refStr']],
      [kitchenSink.$defs.bar, ['.refObj']],
      [{}, []],
    ];
    it.each(testCases)('returns ref sources for %s', (obj, expected) => {
      const t = new Visitor(kitchenSink);
      t.visit(() => {});
      expect(t.refSources(obj)).toEqual(expected);
    });
  });
});
