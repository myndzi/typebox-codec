import { defaultPathBuilder, NodeType, strictVal, Traverser, unescapeJsonPointer } from './traverse';

import { kitchenSink, ksExpectations } from '../fixtures/kitchensink';

type cbArgs = [any, NodeType, string, string | undefined, boolean];

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
    ['Root', '', 'foo', '#foo'],
  ];
  it.each(testCases)('maps %1$s -> %3$s', (nodeType, parentPath, currentKey, expected) => {
    const composed = defaultPathBuilder(NodeType[nodeType], parentPath, currentKey);
    expect(composed).toEqual(expected);
  });
});

describe('unescapeJsonPointer', () => {
  const testCases: [string, string][] = [
    ['foo', 'foo'],
    ['f~0o', 'f~o'],
    ['f~01o', 'f~1o'],
    ['f~1o', 'f/o'],
    ['f~11o', 'f/1o'],
    ['f~22o', 'f~22o'],
  ];
  it.each(testCases)('%s -> %s', (escaped, unescaped) => {
    expect(unescapeJsonPointer(escaped)).toBe(unescaped);
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
describe('Traveser', () => {
  describe('constructor', () => {
    const nonPlainObjects = [new Date(), null, undefined, 1, 1n, 'foo', []];
    it.each(nonPlainObjects)('requires an object root', v => {
      expect(() => new Traverser(v)).toThrow(/must be a plain.*object/);
    });
  });

  describe('#ref', () => {
    const externalPaths = ['/foo', 'https://example.com#bar'];
    it.each(externalPaths)(`fails on external references (%s)`, path => {
      const t = new Traverser({});
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
      const t = new Traverser(schema);
      expect(t.ref(path)).toBe(expected);
    });

    it('memoizes ref lookups', () => {
      const schema = { foo: 'bar' };
      const t = new Traverser(schema);
      expect(t.ref('#/foo')).toBe('bar');
      schema.foo = 'baz';
      expect(t.ref('#/foo')).toBe('bar');
    });

    it('normalizes ref lookups', () => {
      const schema = { foo: 'bar' };
      const t = new Traverser(schema);
      expect(t.ref('#/foo')).toBe('bar');
      schema.foo = 'baz';
      expect(t.ref('#/f%6fo')).toBe('bar');
    });
  });

  describe('traverseDefs', () => {
    it.each(['$defs', 'definitions'])('traverses %s', key => {
      const schema = {
        [key]: {
          foo: { type: 'string' },
          bar: { type: 'object', properties: { baz: { type: 'string' } } },
        },
      };
      const t = new Traverser(schema);

      const schemaVal = schema[key];
      if (!schemaVal) throw new Error('wat');

      const received: cbArgs[] = [];
      const expected: cbArgs[] = [
        [schemaVal.foo, NodeType.ObjectProperty, `#${key}.foo`, undefined, false],
        [schemaVal.bar, NodeType.ObjectProperty, `#${key}.bar`, undefined, true],
        [schemaVal.bar.properties.baz, NodeType.ObjectProperty, `#${key}.bar.baz`, undefined, false],
      ];
      t.traverseDefs((sch, nt, path, ref, hasChildren) => {
        received.push([sch, nt, path, ref, hasChildren]);
      });
      expect(received).toEqual(expected);
    });
  });

  describe('traverse', () => {
    it('handles object properties', () => {
      const t = new Traverser(kitchenSink);
      const unresolved = new Map(ksExpectations);
      t.traverse((sch, nt, path, ref, hasChildren) => {
        const exp = unresolved.get(path);
        if (!exp) {
          throw new Error(`traverse encountered an unexpected path: ${path}`);
        }
        expect(sch).toBeCorrectSchema(exp[0], path);
        expect(NodeType[nt]).toBe(NodeType[exp[1]]);
        expect(ref).toBe(exp[2]);
        expect(hasChildren).toBe(exp[3]);

        unresolved.delete(path);
      });
      expect([...unresolved.keys()]).toEqual([]);
    });
  });
});
