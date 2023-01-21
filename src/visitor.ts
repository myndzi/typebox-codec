import * as URI from 'uri-js';

import isPlainObject from 'lodash.isplainobject';

const escapedRegex = /~[01]/g;
export const unescapeJsonPointer = (ptr: string) => ptr.replace(escapedRegex, v => (v[1] === '0' ? '~' : '/'));

const unescapedRegex = /[~/]/g;
export const escapeJsonPointer = (ptr: string) => ptr.replace(unescapedRegex, v => (v === '~' ? '~0' : '~1'));

export const jsonPathJoin = (escaped: string, ...unescaped: string[]): string =>
  [escaped, ...unescaped.map(escapeJsonPointer)].join('/');

export const strictVal = <T extends any>(obj: any, key: string, type?: 'string' | 'object'): undefined | T => {
  if (typeof obj !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
  const v = obj[key];
  if (type && typeof v !== type) return undefined;
  return v as T;
};

export enum NodeType {
  Root, // the schema document root
  ObjectProperty, // the schema of a named property on an object
  ObjectPatternProperties, // the schema of a pattern property on an object
  ObjectAdditionalProperties, // the schema of "wildcard" properties on an object
  TupleItem, // the schema of a tuple item in an array
  ArrayItems, // the schema of non-tuple items in an array
}

export interface VisitorCallback {
  (args: {
    schema: any;
    nodeType: NodeType;
    jsonPath: string;
    dataPath: string;
    $ref: string | undefined;
    hasChildren: boolean;
  }): void;
}

export interface PathBuilder {
  (nodeType: NodeType, parentPath: string, currentKey?: string): string;
}

export const dataPathBuilder: PathBuilder = (nodeType, parentPath, currentKey) => {
  switch (nodeType) {
    case NodeType.ObjectProperty:
      return `${parentPath}.${currentKey}`;
    case NodeType.ObjectPatternProperties:
      return `${parentPath}./${currentKey}/`;
    case NodeType.ObjectAdditionalProperties:
      return `${parentPath}.*`;
    case NodeType.TupleItem:
      return `${parentPath}[${currentKey}]`;
    case NodeType.ArrayItems:
      return `${parentPath}[*]`;
    case NodeType.Root:
      return '';
  }
};

export class Visitor {
  private refs: Map<string, any>;
  private seenAs: Map<any, string[]>;
  private root: any;
  private path: PathBuilder;
  private didTraversal: boolean;

  constructor(root: any, pathBuilder: PathBuilder = dataPathBuilder) {
    if (!isPlainObject(root)) {
      throw new Error('Base schema must be a plain JavaScript object');
    }

    this.didTraversal = false;
    this.refs = new Map([['#', root]]);
    this.seenAs = new Map();
    this.root = root;
    this.path = pathBuilder;
  }

  // normalize, unescape, and memoize refs
  ref(ref: string | undefined): any {
    if (!ref) return undefined;

    if (this.refs.has(ref)) return this.refs.get(ref);
    const key = URI.normalize(ref);
    if (this.refs.has(key)) return this.refs.get(key);

    const { query: _1, reference, fragment, ...rest } = URI.parse(key);

    if (reference !== 'same-document' || !fragment) {
      throw new Error('External references are not supported');
    }

    const jsonPointer = fragment
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
    const schema = jsonPointer.reduce((obj: any, key: string) => strictVal(obj, key), this.root);

    this.refs.set(key, schema);
    return schema;
  }

  refSources($ref: string): string[] {
    if (!this.didTraversal) {
      throw new Error(`.refSources can't be called before .visit()`);
    }
    return this.seenAs.get($ref) ?? [];
  }

  visitDefs(cb: VisitorCallback): void {
    const callDefs = (defKey: string) => {
      const defPath = this.path(NodeType.Root, '', defKey);

      const defs = strictVal<any>(this.root, defKey, 'object');
      if (typeof defs === 'undefined') return;

      for (const [key, val] of Object.entries(defs)) {
        this._visit(
          cb,
          val,
          NodeType.ObjectProperty,
          this.path(NodeType.ObjectProperty, defPath, key),
          `#/${defKey}/${key}`,
        );
      }
    };

    callDefs('$defs');
    callDefs('definitions');
  }

  // work through the schema and call the callback with what we find
  visit(cb: VisitorCallback): void {
    this._visit(cb, this.root, NodeType.Root, this.path(NodeType.Root, '', ''), '#');
  }

  private _visit(cb: VisitorCallback, schema: any, nodeType: NodeType, dataPath: string, jsonPath: string): void {
    // json schema is actully undefined in the absence of a concrete value to apply it to,
    // as explained here: https://github.com/json-schema/json-schema/issues/172#issuecomment-114076650
    // therefore, it's not _invalid_ to be missing "type", but if it is missing, we probably
    // shouldn't make any assumptions. it also appears to be valid for a schema to contain
    // array keywords like "items" and also object keywords like "properties".
    //
    // we'll take the strategy of just "communicating what is present" whether or not it is
    // sane, and let the caller sort it out if they want to.

    const properties = strictVal<object>(schema, 'properties', 'object');
    const patternProperties = strictVal<object>(schema, 'patternProperties', 'object');
    const additionalProperties = strictVal<object>(schema, 'additionalProperties', 'object');
    const items = strictVal<object>(schema, 'items', 'object');
    const additionalItems = strictVal<object>(schema, 'additionalItems', 'object');
    const prefixItems = strictVal<object>(schema, 'prefixItems', 'object');

    const hasChildren = !!(
      properties ||
      patternProperties ||
      additionalProperties ||
      items ||
      additionalItems ||
      prefixItems
    );

    const $ref = strictVal<string>(schema, '$ref', 'string');
    if ($ref) {
      const refSchema = this.ref($ref);
      if (refSchema) {
        // track the locations where we see refs; a schema can point into
        // the existing schema
        const sources = this.seenAs.get(refSchema) ?? [];
        sources.push(dataPath);
        this.seenAs.set(refSchema, sources);
      }
    }

    // don't call back for the initial root item call
    if (nodeType !== NodeType.Root) {
      cb({ schema, nodeType, dataPath, jsonPath, $ref, hasChildren });
    }

    // object keywords...
    const callObjectEntries = (nodeType: NodeType, obj: any, propName: string) => {
      if (!obj) return;
      for (const [_key, val] of Object.entries(obj)) {
        const key = unescapeJsonPointer(_key);
        this._visit(cb, val, nodeType, this.path(nodeType, dataPath, key), jsonPathJoin(jsonPath, propName, key));
      }
    };
    callObjectEntries(NodeType.ObjectProperty, properties, 'properties');
    callObjectEntries(NodeType.ObjectPatternProperties, patternProperties, 'patternProperties');

    if (additionalProperties) {
      this._visit(
        cb,
        additionalProperties,
        NodeType.ObjectAdditionalProperties,
        this.path(NodeType.ObjectAdditionalProperties, dataPath),
        jsonPathJoin(jsonPath, 'additionalProperties'),
      );
    }

    // array keywords...

    const callTupleEntries = (tupleItems: any[], propKey: string) => {
      for (const [key, val] of tupleItems.entries()) {
        const strKey = String(key);
        this._visit(
          cb,
          val,
          NodeType.TupleItem,
          this.path(NodeType.TupleItem, dataPath, strKey),
          jsonPathJoin(jsonPath, propKey, strKey),
        );
      }
    };

    // "items" as an array is an older way to define a tuple. it's now "prefixItems"
    if (prefixItems && Array.isArray(prefixItems)) {
      callTupleEntries(prefixItems, 'prefixItems');
    } else if (items && Array.isArray(items)) {
      callTupleEntries(items, 'items');
    }

    // "additionalItems" is the older way to define the schema for items beyond
    // the tuple. it's now "items"
    if (items && !Array.isArray(items)) {
      this._visit(
        cb,
        items,
        NodeType.ArrayItems,
        this.path(NodeType.ArrayItems, dataPath),
        jsonPathJoin(jsonPath, 'items'),
      );
    } else if (additionalItems && !Array.isArray(additionalItems)) {
      this._visit(
        cb,
        additionalItems,
        NodeType.ArrayItems,
        this.path(NodeType.ArrayItems, dataPath),
        jsonPathJoin(jsonPath, 'additionalItems'),
      );
    }

    if (nodeType === NodeType.Root) {
      this.didTraversal = true;
    }
  }
}
