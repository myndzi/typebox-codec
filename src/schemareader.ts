import isPlainObject from 'lodash.isplainobject';
import * as URI from 'uri-js';
import { isObjectLike } from './util';

import { ownProperties, unescapeJsonPointer } from './util';

export enum NodeType {
  Root, // the schema document root
  ObjectProperty, // the schema of a named property on an object
  ObjectPatternProperties, // the schema of a pattern property on an object
  ObjectAdditionalProperties, // the schema of "wildcard" properties on an object
  TupleItem, // the schema of a tuple item in an array
  ArrayItems, // the schema of non-tuple items in an array
  DefProperty, // the schema of reusable definitions on the root document
}

export type Node<T extends NodeType = NodeType> = T extends NodeType.Root
  ? [unknown, T]
  : T extends NodeType.ObjectAdditionalProperties | NodeType.ArrayItems
  ? [unknown, T, string]
  : [unknown, T, string, string];

type SchemaLookupFn<T extends NodeType = NodeType> = {
  (schema: object, nodeType: T, key: string): Node<T>[];
  (schema: object, nodeType: T): Node<T>[];
};

export type SchemaReaderOpts = {
  retrievalURI?: string;
  lookupFn?: SchemaLookupFn;
};

export const defaultLookupFn: SchemaLookupFn = <T extends NodeType>(
  schema: any,
  nodeType: T,
  key?: string | undefined,
): Node[] => {
  let subschema: unknown | undefined;

  // https://json-schema.org/understanding-json-schema/structuring.html#ref
  // In Draft 4-7, $ref behaves a little differently. When an object contains a $ref property,
  // the object is considered a reference, not a schema. Therefore, any other properties you
  // put in that object will not be treated as JSON Schema keywords and will be ignored by the
  // validator. $ref can only be used where a schema is expected.
  if (ownProperties(schema, '$ref')) return [];

  // json schema is actully undefined in the absence of a concrete value to apply it to,
  // as explained here: https://github.com/json-schema/json-schema/issues/172#issuecomment-114076650
  // therefore, it's not _invalid_ to be missing "type", but if it is missing, we probably
  // shouldn't make any assumptions. it also appears to be valid for a schema to contain
  // array keywords like "items" and also object keywords like "properties".
  //
  // we'll take the strategy of just "communicating what is present" whether or not it is
  // sane, and let the caller sort it out if they want to.

  const ret: Node[] = [];

  if (typeof key === 'string') {
    switch (nodeType) {
      case NodeType.ObjectProperty:
        subschema = ownProperties(schema, 'properties', key);
        if (subschema !== undefined) ret.push([subschema, nodeType, 'properties', key]);
        break;
      case NodeType.ObjectPatternProperties:
        subschema = ownProperties(schema, 'patternProperties', key);
        if (subschema !== undefined) ret.push([subschema, nodeType, 'patternProperties', key]);
        break;
      case NodeType.DefProperty:
        subschema = ownProperties(schema, '$defs', key);
        if (subschema !== undefined) {
          ret.push([subschema, nodeType, '$defs', key]);
          break;
        }
        subschema = ownProperties(schema, 'definitions', key);
        if (subschema !== undefined) {
          ret.push([subschema, nodeType, 'definitions', key]);
          break;
        }
        break;
      case NodeType.TupleItem:
        subschema = ownProperties(schema, 'prefixItems');
        if (Array.isArray(subschema)) {
          subschema = ownProperties(subschema, key);
          if (subschema !== undefined) ret.push([subschema, nodeType, 'prefixItems', key]);
          break;
        }
        subschema = ownProperties(schema, 'items');
        if (Array.isArray(subschema)) {
          subschema = ownProperties(subschema, key);
          if (subschema !== undefined) ret.push([subschema, nodeType, 'items', key]);
          break;
        }
        break;
    }
  } else {
    switch (nodeType) {
      case NodeType.ObjectProperty:
        subschema = ownProperties(schema, 'properties');
        if (isObjectLike(subschema)) {
          for (const key of Object.keys(subschema)) {
            Array.prototype.push.apply(ret, defaultLookupFn(schema, nodeType, key));
          }
        }
        break;
      case NodeType.ObjectPatternProperties:
        subschema = ownProperties(schema, 'patternProperties');
        if (isObjectLike(subschema)) {
          for (const key of Object.keys(subschema)) {
            Array.prototype.push.apply(ret, defaultLookupFn(schema, nodeType, key));
          }
        }
        break;
      case NodeType.DefProperty:
        let defKey = '$defs';
        subschema = ownProperties(schema, defKey);
        if (subschema === undefined) {
          defKey = 'definitions';
          subschema = ownProperties(schema, defKey);
        }
        if (isObjectLike(subschema)) {
          for (const key of Object.keys(subschema)) {
            Array.prototype.push.apply(ret, defaultLookupFn(schema, nodeType, key));
          }
        }
        break;
      case NodeType.ObjectAdditionalProperties:
        subschema = ownProperties(schema, 'additionalProperties');
        if (subschema !== undefined) ret.push([subschema, nodeType, 'additionalProperties']);
        break;
      case NodeType.TupleItem:
        let tupleKey = 'prefixItems';
        subschema = ownProperties(schema, tupleKey);
        if (!Array.isArray(subschema)) {
          tupleKey = 'items';
          subschema = ownProperties(schema, tupleKey);
        }
        if (Array.isArray(subschema)) {
          for (let key = 0; key < subschema.length; key++) {
            Array.prototype.push.apply(ret, defaultLookupFn(schema, nodeType, String(key)));
          }
        }
        break;
      case NodeType.ArrayItems:
        if (Array.isArray(ownProperties(schema, 'prefixItems'))) {
          // if "prefixItems" exists and is an array, we expect "items" to hold the "rest" schema
          subschema = ownProperties(schema, 'items');
          if (subschema !== undefined && subschema !== false) ret.push([subschema, nodeType, 'items']);
        } else if (Array.isArray(ownProperties(schema, 'items'))) {
          // if "items" exists and is an array, we expect "additionalItems" to hold the "rest" schema
          subschema = ownProperties(schema, 'additionalItems');
          if (subschema !== undefined && subschema !== false) ret.push([subschema, nodeType, 'additionalItems']);
        } else {
          // if neither tuple format is present, we expect "items" to hold the "rest" (any/all) schema
          subschema = ownProperties(schema, 'items');
          if (subschema !== undefined && subschema !== false) ret.push([subschema, nodeType, 'items']);
        }
        break;
    }
  }

  return ret;
};

export class SchemaReader {
  private refs: Map<string, unknown>;
  readonly root: object;
  private path: Node[];
  readonly baseURI: string;
  readonly lookup: SchemaLookupFn;

  constructor(root: object, opts: SchemaReaderOpts = {}) {
    this.refs = new Map();

    this.baseURI = this.addDocument(root, opts.retrievalURI);
    this.lookup = typeof opts.lookupFn === 'function' ? opts.lookupFn : defaultLookupFn;

    this.root = root;
    this.path = [];
  }

  addDocument(document: object, retrievalURI?: string): string {
    if (!isPlainObject(document)) {
      throw new Error('Base schema must be a plain JavaScript object');
    }

    let baseURI: any = ownProperties(document, '$id');
    if (typeof baseURI !== 'string') baseURI = retrievalURI;
    if (typeof baseURI !== 'string') baseURI = '';

    const { fragment, ...rest } = URI.parse(URI.normalize(baseURI));
    if (fragment !== undefined) {
      // https://json-schema.org/understanding-json-schema/structuring.html#id
      throw new Error('JSON Schema cannot have a base URI with a fragment');
    }

    const normalizedURI = URI.serialize({ ...rest, fragment: '' });

    if (this.refs.has(normalizedURI) && this.refs.get(normalizedURI) !== document) {
      throw new Error(`addDocument: refusing to replace ${normalizedURI} with other schema`);
    }

    this.refs.set(normalizedURI, document);
    return normalizedURI;
  }

  // normalize, unescape, and memoize refs
  dereference($ref: string | undefined): unknown {
    if (typeof $ref !== 'string') return undefined;

    const normalized = URI.normalize(URI.resolve(this.baseURI, $ref));
    if (this.refs.has(normalized)) return this.refs.get(normalized);

    const { fragment, ...rest } = URI.parse(normalized);

    const schemaURI = URI.serialize({ ...rest, fragment: '' });
    const document = this.refs.get(schemaURI);

    // TODO: provide some signal to the caller about what kind of failure
    // was encountered
    if (document == null) return undefined;

    const jsonPointer =
      fragment === undefined
        ? []
        : fragment
            // '/' separates property accesses
            .split('/')
            // json-pointers start with `/`, which conveniently
            // works with the fallback ''.split('/') case
            .slice(1)
            // json-pointers have to escape `/` -- unescape
            .map(unescapeJsonPointer);

    // json pointer supports `-` as a special keyword to refer to the item past the end of
    // an array, which i initially took to suggest it should return the "additionalItems"
    // in an array schema. however, json schema is more literal than that (by experimental
    // testing and more reading) - a ref is just a path through the document as written
    const result = ownProperties(document, ...jsonPointer);

    this.refs.set(normalized, result);
    return result;
  }

  try<T extends NodeType = NodeType>(
    cb: (node: Node) => void,
    nodeType: T,
    key?: string | number | undefined,
    _schema?: object,
  ): number {
    if (this.path.length === 0) {
      this.path = [[this.root, NodeType.Root]];
    }
    const schema = _schema ?? (this.path[this.path.length - 1]?.[0] as object);

    let nextNode: Node | undefined = undefined;
    switch (nodeType) {
      case NodeType.ArrayItems:
      case NodeType.ObjectAdditionalProperties:
        nextNode = ((<unknown>this.lookup) as SchemaLookupFn<T>)(schema, nodeType)[0];
        break;
      case NodeType.DefProperty:
      case NodeType.ObjectProperty:
      case NodeType.ObjectPatternProperties:
      case NodeType.TupleItem:
        if (key !== undefined)
          nextNode = ((<unknown>this.lookup) as SchemaLookupFn<T>)(schema, nodeType, String(key))[0];
        break;
    }

    if (nextNode !== undefined) {
      this.path.push(nextNode);
      cb(nextNode);
      this.path.pop();

      return nextNode.length;
    }
    return 0;
  }

  each<T extends NodeType = NodeType>(cb: (node: Node<T>) => void, nodeType: T, _schema?: object): void {
    if (this.path.length === 0) {
      this.path = [[this.root, NodeType.Root]];
    }
    const schema = _schema ?? (this.path[this.path.length - 1]?.[0] as Node<T>);

    let nodes: Node<T>[] = ((<unknown>this.lookup) as SchemaLookupFn<T>)(schema, nodeType);
    for (const node of nodes) {
      this.path.push(node);
      cb(node);
      this.path.pop();
    }
  }

  depth() {
    return (this.path.length || 1) - 1;
  }

  // TODO: a given data item can have multiple schemas that apply to it:
  // if a property key matches an element in `properties` and _also_ one
  // or more elements in `patternProperties`, all matching schemas apply.
  // it will require some refactoring to pass a set or list of matching
  // schemas to the callback, so for now we will call the callback once
  // for each matching item.
  // the main problem is the data path, which needs to support the ability
  // to supply multiple paths at any given level to the callback...
  traverse(data: any, cb: (schema: unknown, data: unknown, path: Node[]) => void, _schema: any = this.root): void {
    const $ref = ownProperties(_schema, '$ref');
    const schema = typeof $ref === 'string' ? this.dereference($ref) : _schema;

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        let matched = this.try<NodeType.ObjectProperty>(
          node => this.traverse(data[key], cb, node[0]),
          NodeType.ObjectProperty,
          key,
          schema,
        );

        // also call for each matching item in patternProperties
        this.each<NodeType.ObjectPatternProperties>(
          ([subschema, _1, _2, patternKey]) => {
            const re = new RegExp(patternKey);
            if (!re.test(key)) return;

            matched++;
            this.traverse(data[key], cb, subschema);
          },
          NodeType.ObjectPatternProperties,
          schema,
        );

        if (matched === 0)
          matched = this.try<NodeType.ObjectAdditionalProperties>(
            node => this.traverse(data[key], cb, node[0]),
            NodeType.ObjectAdditionalProperties,
            key,
            schema,
          );
      }
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        let matched = this.try<NodeType.TupleItem>(
          node => this.traverse(data[i], cb, node[0]),
          NodeType.TupleItem,
          i,
          schema,
        );
        if (matched === 0)
          this.try<NodeType.ArrayItems>(node => this.traverse(data[i], cb, node[0]), NodeType.ArrayItems, schema);
      }
    } else {
      cb(schema, data, this.path);
    }
  }
}
