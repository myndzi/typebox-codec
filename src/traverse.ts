import * as URI from 'uri-js';

const escapedRegex = /~[01]/;
const unescapeJsonPointer = (ptr: string) =>
  ptr.replace(escapedRegex, v => (v[1] === '0' ? '~' : '/'));

const strictVal = <T extends any>(
  obj: any,
  key: string,
  type?: 'string' | 'object',
): undefined | T => {
  if (typeof obj !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
  const v = obj[key];
  if (type && typeof v !== type) return undefined;
  return v as T;
};

export enum NodeType {
  Root, // the schema document root
  ObjectProperty, // the schema of a named property on an object
  ObjectPatternProperty, // the schema of a pattern property on an object
  ObjectAdditionalProperties, // the schema of "wildcard" properties on an object
  TupleItem, // the schema of a tuple item in an array
  ArrayItems, // the schema of non-tuple items in an array
  Ref, // a sub-schema referenced elsewhere
}

export interface TraverseCallback {
  (
    schema: any,
    nodeType: NodeType,
    path: string,
    ref: string | undefined,
    hasChildren: boolean,
  ): void;
}

export interface PathBuilder {
  (nodeType: NodeType, parentPath: string, currentKey?: string): string;
}

const defaultPathBuilder: PathBuilder = (nodeType, parentPath, currentKey) => {
  switch (nodeType) {
    case NodeType.ObjectProperty:
      return `${parentPath}.${currentKey}`;
    case NodeType.ObjectPatternProperty:
      return `${parentPath}./${currentKey}/`;
    case NodeType.ObjectAdditionalProperties:
      return `${parentPath}.*`;
    case NodeType.TupleItem:
      return `${parentPath}[${currentKey}]`;
    case NodeType.ArrayItems:
      return `${parentPath}[*]`;
    case NodeType.Ref:
    case NodeType.Root:
      // unused, but satisfies typescript
      return 'implementation error';
  }
};

export class Traverser {
  private refs: Map<string, any>;
  private seenAs: Map<any, string[]>;
  private root: any;
  private path: PathBuilder;

  constructor(root: any, pathBuilder: PathBuilder = defaultPathBuilder) {
    if (!root || Array.isArray(root) || typeof root !== 'object') {
      throw new Error('Invalid schema?');
    }

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
    const schema = jsonPointer.reduce(
      (obj: any, key: string) => strictVal(obj, key),
      this.root,
    );

    if (typeof schema === undefined) {
      throw new Error(
        `Invalid json-pointer (failed to look up value): ${fragment}`,
      );
    }
    this.refs.set(key, schema);
    return schema;
  }

  refSources($ref: string): string[] {
    return this.seenAs.get($ref) ?? [];
  }

  // only usable after the initial call to traverse
  traverseRefs(cb: TraverseCallback): void {
    for (const [key, val] of this.refs) {
      // skip the root
      if (key === '#') continue;

      this.traverse(cb, val, NodeType.Ref, key);
    }
  }

  // work through the schema and call the callback with what we find
  traverse(cb: TraverseCallback): void;
  traverse(
    cb: TraverseCallback,
    schema: any,
    nodeType: NodeType,
    path: string,
  ): void;
  traverse(
    cb: TraverseCallback,
    schema: any = this.root,
    nodeType: NodeType = NodeType.Root,
    path: string = '',
  ): void {
    // json schema is actully undefined in the absence of a concrete value to apply it to,
    // as explained here: https://github.com/json-schema/json-schema/issues/172#issuecomment-114076650
    // therefore, it's not _invalid_ to be missing "type", but if it is missing, we probably
    // shouldn't make any assumptions. it also appears to be valid for a schema to contain
    // array keywords like "items" and also object keywords like "properties".
    //
    // we'll take the strategy of just "communicating what is present" whether or not it is
    // sane, and let the caller sort it out if they want to.

    const properties = strictVal<object>(schema, 'properties', 'object');
    const patternProperties = strictVal<object>(
      schema,
      'patternProperties',
      'object',
    );
    const additionalProperties = strictVal<object>(
      schema,
      'additionalProperties',
      'object',
    );
    const items = strictVal<object>(schema, 'items', 'object');
    const additionalItems = strictVal<object>(
      schema,
      'additionalItems',
      'object',
    );
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
        sources.push(path);
        this.seenAs.set(refSchema, sources);
      }
    }
    cb(schema, nodeType, path, $ref, hasChildren);

    // object keywords...
    const callObjectEntries = (nodeType: NodeType, obj: any) => {
      if (!obj) return;
      for (const [key, val] of Object.entries(obj)) {
        // skip over meta-values
        if (key.startsWith('$') || key === 'definitions') continue;
        this.traverse(cb, val, nodeType, this.path(nodeType, path, key));
      }
    };
    callObjectEntries(NodeType.ObjectProperty, properties);

    callObjectEntries(NodeType.ObjectPatternProperty, patternProperties);

    if (additionalProperties) {
      this.traverse(
        cb,
        additionalProperties,
        NodeType.ObjectAdditionalProperties,
        this.path(NodeType.ObjectAdditionalProperties, path),
      );
    }

    // array keywords...

    // "items" as an array is an older way to define a tuple. it's now "prefixItems"
    const tupleItems = Array.isArray(items) ? items : prefixItems;
    // "additionalItems" is the older way to define the schema for items beyond
    // the tuple. it's now "items"
    const restItems = additionalItems ?? items;
    // there are other possible combinations of these three properties, but they should
    // be invalid -- so we might "fail" to expose certain values here. we could
    // potentially crash or issue a warning, but it seems sanest to just pick a
    // valid intepreretation and use it

    if (tupleItems) {
      if (Array.isArray(items)) {
        for (const [key, val] of items.entries()) {
          this.traverse(
            val,
            cb,
            NodeType.TupleItem,
            this.path(NodeType.TupleItem, path, String(key)),
          );
        }
      }
    }

    if (restItems) {
      this.traverse(
        cb,
        restItems,
        NodeType.ArrayItems,
        this.path(NodeType.ArrayItems, path),
      );
    }
  }
}
