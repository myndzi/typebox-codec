import { Visitor, VisitorCallback } from './visitor';

import { expectation, kitchenSink, ksExpectations } from '../fixtures/kitchensink';

export default {};

import { expect } from '@jest/globals';
import { NodeType } from './schemareader';
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

describe('Visitor', () => {
  describe('constructor', () => {
    const nonPlainObjects = [new Date(), null, undefined, 1, 1n, 'foo', []];
    it.each(nonPlainObjects)('requires an object root', v => {
      expect(() => new Visitor(v)).toThrow(/must be a plain.*object/);
    });

    // it('supports custom path construction', () => {
    //   const t = new Visitor(kitchenSink, () => 'ok');
    //   t.visitSchema(({ dataPath }) => {
    //     expect(dataPath).toEqual('ok');
    //   });
    // });
  });

  // describe('#ref', () => {
  //   const externalPaths = ['/foo', 'https://example.com#bar'];
  //   it.each(externalPaths)(`fails on external references (%s)`, path => {
  //     const t = new Visitor({});
  //     expect(() => t.ref(path)).toThrow(/not supported/);
  //   });

  //   const testCases: [string, any, string | undefined, string | undefined][] = [
  //     ['property access', { foo: 'bar' }, '#/foo', 'bar'],
  //     ['deep property access', { foo: { bar: 'baz' } }, '#/foo/bar', 'baz'],
  //     ['array access', { foo: ['bar', 'baz'] }, '#/foo/0', 'bar'],
  //     ['undefined access', {}, undefined, undefined],
  //     ['undefined value', {}, '#/foo', undefined],
  //   ];
  //   it.each(testCases)('looks up ref (%s)', (_, schema, path, expected) => {
  //     const t = new Visitor(schema);
  //     expect(t.ref(path)).toBe(expected);
  //   });

  //   it('memoizes ref lookups', () => {
  //     const schema = { foo: 'bar' };
  //     const t = new Visitor(schema);
  //     expect(t.ref('#/foo')).toBe('bar');
  //     schema.foo = 'baz';
  //     expect(t.ref('#/foo')).toBe('bar');
  //   });

  //   it('normalizes ref lookups', () => {
  //     const schema = { foo: 'bar' };
  //     const t = new Visitor(schema);
  //     expect(t.ref('#/foo')).toBe('bar');
  //     schema.foo = 'baz';
  //     expect(t.ref('#/f%6fo')).toBe('bar');
  //   });
  // });

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
        ['.foo',     [/*`#/${key}/foo`,                */ NodeType.DefProperty,    schemaVal.foo,                undefined, 'foo', key          ]],
        ['.bar',     [/*`#/${key}/bar`,                */ NodeType.DefProperty,    schemaVal.bar,                undefined, 'bar', key          ]],
        ['.bar.baz', [/*`#/${key}/bar/properties/baz`, */ NodeType.ObjectProperty, schemaVal.bar.properties.baz, undefined, 'baz', 'properties' ]],
      ]);

      let paths: string[] = [];
      t.visitDefs((nodeType, schema, $ref, key, propKey) => {
        paths.length = t.depth();
        const dataPath = dataPathBuilder(nodeType, paths[paths.length - 1] ?? '', key);
        paths.push(dataPath);

        const exp = unresolved.get(dataPath);
        if (!exp) {
          throw new Error(`visit encountered an unexpected path: ${dataPath}`);
        }
        // expect(jsonPath).toBe(exp[0]);
        expect(NodeType[nodeType]).toBe(NodeType[exp[0]]);
        expect(schema).toBeCorrectSchema(exp[1], dataPath);
        expect($ref).toBe(exp[2]);
        expect(key).toBe(exp[3]);
        expect(propKey).toBe(exp[4]);

        unresolved.delete(dataPath);
      });
      expect([...unresolved.keys()]).toEqual([]);
    });
  });

  describe('visit', () => {
    it('handles object properties', () => {
      const t = new Visitor(kitchenSink);
      const unresolved = new Map(ksExpectations);
      let paths: string[] = [''];
      t.visitSchema((nodeType, schema, $ref, key, propKey) => {
        paths.length = t.depth();
        const dataPath = dataPathBuilder(nodeType, paths[paths.length - 1] ?? '', key);
        paths.push(dataPath);

        const exp = unresolved.get(dataPath);
        if (!exp) {
          throw new Error(`visit encountered an unexpected path: ${dataPath}`);
        }
        // expect(jsonPath).toBe(exp[0]);
        expect(NodeType[nodeType]).toBe(NodeType[exp[0]]);
        expect(schema).toBeCorrectSchema(exp[1], dataPath);
        expect($ref).toBe(exp[2]);
        expect(key).toBe(exp[3]);
        expect(propKey).toBe(exp[4]);

        unresolved.delete(dataPath);
      });
      expect([...unresolved.keys()]).toEqual([]);
    });
  });

  // describe('refSources', () => {
  //   it(`throws if visit hasn't been called`, () => {
  //     const t = new Visitor({});
  //     expect(() => t.refSources('foo')).toThrow(/can't be called before/);
  //   });

  //   const testCases: [any, string[]][] = [
  //     [kitchenSink.$defs.foo, ['.refStr']],
  //     [kitchenSink.$defs.bar, ['.refObj']],
  //     [{}, []],
  //   ];
  //   it.each(testCases)('returns ref sources for %s', (obj, expected) => {
  //     const t = new Visitor(kitchenSink);
  //     t.visitSchema(() => {});
  //     expect(t.refSources(obj)).toEqual(expected);
  //   });
  // });
});
