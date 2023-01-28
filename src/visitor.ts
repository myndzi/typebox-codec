import isPlainObject from 'lodash.isplainobject';
import { Node, NodeType, SchemaReader } from './schemareader';
import { ownProperties, unescapeJsonPointer } from './util';

export interface VisitorCallback {
  (
    nodeType: NodeType,
    schema: unknown,
    $ref: string | undefined,
    key: string | undefined,
    propKey: string | undefined,
  ): void;
}

export class Visitor {
  private seenAs: Map<any, string[]>;
  private didTraversal: boolean;
  private r: SchemaReader;

  constructor(root: any) {
    if (!isPlainObject(root)) {
      throw new Error('Base schema must be a plain JavaScript object');
    }

    this.r = new SchemaReader(root);

    this.didTraversal = false;
    this.seenAs = new Map();
  }

  refSources($ref: string): string[] {
    if (!this.didTraversal) {
      throw new Error(`.refSources can't be called before .visit()`);
    }
    return this.seenAs.get($ref) ?? [];
  }

  visitDefs(cb: VisitorCallback): void {
    this.r.each(node => this.visit(cb, ...node), NodeType.DefProperty);
  }

  visitSchema(cb: VisitorCallback): void {
    this.visit(cb, undefined, NodeType.Root);
  }

  depth() {
    return this.r.depth();
  }

  private visit(cb: VisitorCallback, ...[schema, nodeType, propKey, key]: Node): void {
    if (nodeType !== NodeType.Root) {
      const $ref = ownProperties(schema, '$ref');
      const dereferenced = typeof $ref === 'string' ? this.r.dereference($ref) : schema;
      // if (typeof $ref === 'string') {
      //   const seen = this.seenAs.get(dereferenced) ?? [];
      //   seen.push(dataPath);
      //   this.seenAs.set(dereferenced, seen);
      // }
      cb(
        nodeType,
        dereferenced,
        typeof $ref === 'string' ? $ref : undefined,
        typeof key === 'string' ? unescapeJsonPointer(key) : undefined,
        propKey,
      );
    }

    this.r.each(node => this.visit(cb, ...node), NodeType.ObjectProperty);
    this.r.each(node => this.visit(cb, ...node), NodeType.ObjectPatternProperties);
    this.r.try(node => this.visit(cb, ...node), NodeType.ObjectAdditionalProperties);
    this.r.each(node => this.visit(cb, ...node), NodeType.TupleItem);
    this.r.try(node => this.visit(cb, ...node), NodeType.ArrayItems);

    if (nodeType === NodeType.Root) {
      this.didTraversal = true;
    }
  }
}
