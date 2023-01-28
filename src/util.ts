import { NodeType } from './schemareader';

const escapedRegex = /~[01]/g;
export const unescapeJsonPointer = (ptr: string) => ptr.replace(escapedRegex, v => (v[1] === '0' ? '~' : '/'));

const unescapedRegex = /[~/]/g;
export const escapeJsonPointer = (ptr: string) => ptr.replace(unescapedRegex, v => (v === '~' ? '~0' : '~1'));

const HOP = Object.prototype.hasOwnProperty;
export const ownProperties = (obj: any, ...keys: PropertyKey[]): unknown | undefined =>
  keys.reduce((obj, key) => (obj && HOP.call(obj, key) ? obj[key] : undefined), obj);

export const hasChildren = (obj: unknown): boolean =>
  obj !== null &&
  typeof obj === 'object' &&
  ['properties', 'patternProperties', 'additionalProperties', 'items', 'additionalItems', 'prefixItems'].some(key =>
    HOP.call(obj, key),
  );

export interface PathBuilder {
  (nodeType: NodeType, parentPath: string, currentKey?: string): string;
}

export const dataPathBuilder: PathBuilder = (nodeType, parentPath, currentKey) => {
  const unescaped = typeof currentKey === 'string' ? unescapeJsonPointer(currentKey) : undefined;

  switch (nodeType) {
    case NodeType.DefProperty:
      return `.${unescaped}`;
    case NodeType.ObjectProperty:
      return `${parentPath}.${unescaped}`;
    case NodeType.ObjectPatternProperties:
      return `${parentPath}./${unescaped}/`;
    case NodeType.ObjectAdditionalProperties:
      return `${parentPath}.*`;
    case NodeType.TupleItem:
      return `${parentPath}[${unescaped}]`;
    case NodeType.ArrayItems:
      return `${parentPath}[*]`;
    case NodeType.Root:
      return '';
  }
};

export const isObjectLike = (v: unknown): v is object => typeof v === 'object' && v != null && !Array.isArray(v);
