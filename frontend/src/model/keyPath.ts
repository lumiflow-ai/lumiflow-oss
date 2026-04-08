import type { ReactNode } from "react";

import {
  type EvaluationGroupID,
  type EventSummaryID,
  type Filter,
  GroupFilterOperator,
  type KeyPath,
  type MetricDefinition,
  type MetricID,
  type PrimitiveValue,
  ValueFilterOperator,
} from "@/generated/serverTypes";

import type { KindConfigurationLookup } from "@/components/contexts/OrganizationContext";

export type KeyPathValue = {
  raw: PrimitiveValue;
  sort: PrimitiveValue;
  filter: PrimitiveValue;
  display: ReactNode;
};

export function KeyPathValue(
  value: PrimitiveValue | { raw: PrimitiveValue; sort?: PrimitiveValue; filter?: PrimitiveValue; display?: ReactNode },
): KeyPathValue {
  if (isPrimitiveValue(value)) {
    return { raw: value, sort: value, filter: value, display: value !== null ? `${value}` : null };
  }

  const { raw, sort, filter, display } = value;
  return { raw, sort: sort ?? raw, filter: filter ?? raw, display: display ?? raw };
}

export type KeyPathValuePair = {
  index: number;
  key: string | null;
  value: PrimitiveValue;
};

export type KeyPathValueRole = "sort" | "display" | "filter";

export type KeyPathContext = {
  activeEventSummaryID?: EventSummaryID | null;
  metricDefinitionForID?: (id: MetricID) => MetricDefinition | null;
  kindConfigurationForPattern?: KindConfigurationLookup;
  evaluationGroupID?: EvaluationGroupID;
};

const supportedPrimitiveTypes = new Set(["string", "number", "boolean"]);
export function isPrimitiveValue(value: unknown): value is PrimitiveValue {
  return supportedPrimitiveTypes.has(typeof value) || value === null;
}

export function popFirstKeyPathComponent(keyPath: KeyPath): [string, KeyPath] {
  const [component] = keyPath.split(".", 1);

  const remainingPath = keyPath.slice(component.length + 1);
  return [component, remainingPath];
}

export function valueForKeyPath(root: unknown, keyPath: KeyPath): KeyPathValue {
  if (root === null || root === undefined) return KeyPathValue(null);
  if (root instanceof Date) return valueForDateKeyPath(root, keyPath);
  if (isPrimitiveValue(root)) return valueForPrimitiveValueKeyPath(root, keyPath);

  const [component, remainingPath] = popFirstKeyPathComponent(keyPath);
  if (component && typeof root === "object" && component in root) {
    return valueForKeyPath(root[component as keyof typeof root], remainingPath);
  }

  return KeyPathValue(null);
}

function valueForPrimitiveValueKeyPath(root: PrimitiveValue | Date | undefined, keyPath: KeyPath): KeyPathValue {
  if (root === null || root === undefined) return KeyPathValue(null);
  if (root instanceof Date) return valueForDateKeyPath(root, keyPath);
  const [component, remainingPath] = popFirstKeyPathComponent(keyPath);

  switch (component) {
    case "": {
      return KeyPathValue(root);
    }
    case "as(string)": {
      return valueForPrimitiveValueKeyPath(`${root}`, remainingPath);
    }
    case "as(number)": {
      const number = Number(root);
      if (!Number.isFinite(number)) return KeyPathValue(null);
      return valueForPrimitiveValueKeyPath(number, remainingPath);
    }
    case "as(boolean)": {
      const bool = Boolean(root);
      return valueForPrimitiveValueKeyPath(bool, remainingPath);
    }
    case "truncated":
    case "truncated()": {
      if (typeof root === "string" && root.length > 13) {
        /// Only truncate the display value when it is too long.
        return KeyPathValue({
          ...valueForPrimitiveValueKeyPath(root, remainingPath),
          display: valueForPrimitiveValueKeyPath(`${root.slice(0, 6)}…${root.slice(-6)}`, remainingPath).display,
        });
      }
      return valueForPrimitiveValueKeyPath(root, remainingPath);
    }
  }

  /// Matches `truncated(5)`, `truncated(4,2)`, `truncated(7, 0)`…
  const truncatedMatch = component.match(/^truncated(\(([1-9]+\d*)\))|(\((\d+), ?(\d+)\))$/);
  if (truncatedMatch && truncatedMatch.length > 1) {
    if (typeof root !== "string") return valueForPrimitiveValueKeyPath(root, remainingPath);

    const headTruncation = Number(truncatedMatch[2] ?? truncatedMatch[4]);
    const tailTruncation = Number(truncatedMatch[2] ?? truncatedMatch[5]);
    if (root.length <= headTruncation + tailTruncation + 1) return valueForPrimitiveValueKeyPath(root, remainingPath);

    /// Only truncate the display value when it is too long.
    return KeyPathValue({
      ...valueForPrimitiveValueKeyPath(root, remainingPath),
      display: valueForPrimitiveValueKeyPath(
        `${root.slice(0, headTruncation)}…${root.slice(root.length - tailTruncation, root.length)}`,
        remainingPath,
      ).display,
    });
  }

  /// Matches `by(2)`, `by(0.25)`, `by(100)`…
  const byMatch = component.match(/^by\(((0\.\d*[1-9]\d*)|([1-9]+\d*(\.\d+)?))\)$/);
  if (byMatch && byMatch.length > 1) {
    if (typeof root !== "number") return KeyPathValue(null);
    const segmentationAmount = Number(byMatch[1]);
    const segmentedValue = Math.floor(root / segmentationAmount) * segmentationAmount;
    return valueForPrimitiveValueKeyPath(segmentedValue, remainingPath);
  }
  return KeyPathValue(null);
}

function valueForDateKeyPath(root: Date | null | undefined, keyPath: KeyPath): KeyPathValue {
  if (root === null || root === undefined) return KeyPathValue(null);
  const [component, remainingPath] = popFirstKeyPathComponent(keyPath);

  switch (component) {
    case "":
      /// Only render the display value as an ISO date, without milliseconds.
      return KeyPathValue({
        raw: root.getTime(),
        display: root.toISOString().split(".")[0],
      });
    case "as(string)":
      return valueForPrimitiveValueKeyPath(root.toISOString().split(".")[0], remainingPath);
    case "as(number)":
      return valueForPrimitiveValueKeyPath(root.getTime(), remainingPath);
    case "as(boolean)":
      return valueForPrimitiveValueKeyPath(true, remainingPath);
    case "sortableDate": {
      const formattedValue = valueForPrimitiveValueKeyPath(
        `${String(root.getFullYear()).padStart(4, "0")}-${String(root.getMonth() + 1).padStart(2, "0")}-${String(root.getDate()).padStart(2, "0")}`,
        remainingPath,
      );
      /// Format the filter and display values only.
      return KeyPathValue({
        raw: root.getTime(),
        filter: formattedValue.filter,
        display: formattedValue.display,
      });
    }
    case "localized": {
      const formattedValue = valueForPrimitiveValueKeyPath(
        root.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          timeZoneName: "short",
        }),
        remainingPath,
      );
      /// Format the filter and display values only.
      return KeyPathValue({
        raw: root.getTime(),
        filter: formattedValue.filter,
        display: formattedValue.display,
      });
    }
    case "localizedDate": {
      const formattedValue = valueForPrimitiveValueKeyPath(
        root.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        remainingPath,
      );
      /// Format the filter and display values only.
      return KeyPathValue({
        raw: root.getTime(),
        filter: formattedValue.filter,
        display: formattedValue.display,
      });
    }
    case "localizedTime": {
      const formattedValue = valueForPrimitiveValueKeyPath(
        root.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          timeZoneName: "short",
        }),
        remainingPath,
      );
      /// Format the filter and display values only.
      return KeyPathValue({
        raw: root.getTime(),
        filter: formattedValue.filter,
        display: formattedValue.display,
      });
    }
    case "date":
      return valueForPrimitiveValueKeyPath(
        `${String(root.getFullYear()).padStart(4, "0")}-${String(root.getMonth() + 1).padStart(2, "0")}-${String(root.getDate()).padStart(2, "0")}`,
        remainingPath,
      );
  }

  /// Matches `15s`, `2m`, `1h`, `5d`, `2w`…
  const byDuration = component.match(/^([1-9]\d*)(ms|s|m|h|d|w|mo|y)$/);
  if (byDuration && byDuration.length > 2) {
    const amount = Number(byDuration[1]);
    const unit = byDuration[2];
    let segmentationAmount = 1;
    switch (unit) {
      case "ms":
        segmentationAmount = amount;
        break;
      case "s":
        segmentationAmount = amount * 1000;
        break;
      case "m":
        segmentationAmount = amount * 1000 * 60;
        break;
      case "h":
        segmentationAmount = amount * 1000 * 60 * 60;
        break;
      case "d":
        segmentationAmount = amount * 1000 * 60 * 60 * 24;
        break;
      case "w":
        segmentationAmount = amount * 1000 * 60 * 60 * 24 * 7;
        break;
      case "mo":
        segmentationAmount = amount * 1000 * 60 * 60 * 24 * 30;
        break;
      case "y":
        segmentationAmount = amount * 1000 * 60 * 60 * 24 * 365;
        break;
    }
    // TODO: Round to the user's current local, so `mo` gets rounded to the actual months, not just 30 days.
    const segmentedMS = Math.floor(root.getTime() / segmentationAmount) * segmentationAmount;
    return valueForDateKeyPath(new Date(segmentedMS), remainingPath);
  }
  return KeyPathValue(null);
}

export class IndexedObject {
  id = "";

  valueForKeyPath(_: { keyPath: KeyPath } & KeyPathContext): KeyPathValue {
    return KeyPathValue(null);
  }

  valueForKeyPaths(keyPaths: KeyPath[]): KeyPathValue;
  valueForKeyPaths({ keyPaths, ...context }: { keyPaths: KeyPath[] } & KeyPathContext): KeyPathValue;
  valueForKeyPaths(props: KeyPath[] | ({ keyPaths: KeyPath[] } & KeyPathContext)): KeyPathValue {
    const { keyPaths, ...context } = Array.isArray(props) ? { keyPaths: props } : props;
    for (const keyPath of keyPaths) {
      const result = this.valueForKeyPath({ ...context, keyPath });
      if (result.raw !== null) return result;
      if (context.activeEventSummaryID) {
        /// If no value was found, and we specified an event summary ID, try falling back to `null` in case the event summary ID belonged to a different artifact.
        const result = this.valueForKeyPath({ ...context, keyPath, activeEventSummaryID: null });
        if (result.raw !== null) return result;
      }
    }
    return KeyPathValue(null);
  }
}

export class ItemNode<Item extends object | undefined = object | undefined> extends IndexedObject {
  parent?: this;
  id: string;
  item: Item;

  children: Map<string, this> = new Map();
  orderedChildren: this[] = [];

  constructor({
    parent,
    id,
    item,
  }: {
    parent?: ThisType<Item>;
    id: string;
    item: Item;
  }) {
    super();
    this.parent = parent as this;
    this.id = id;
    this.item = item;
  }

  get childlessCopy(): ItemNode<Item> {
    const copy = new ItemNode({
      parent: this.parent,
      id: this.id,
      item: this.item,
    });

    return copy;
  }

  allChildren<Child extends object | undefined = Item>(): ItemNode<Child>[] {
    return Array.from(this.children.values()) as unknown as ItemNode<Child>[];
  }

  addChild(node: this) {
    node.parent = this;
    this.children.set(node.id, node);
  }

  orderChildren({ sortDescriptors, ...context }: { sortDescriptors: SortDescriptor[] } & KeyPathContext) {
    this.orderedChildren = sortItems({
      ...context,
      items: Array.from(this.children.values()),
      sortDescriptors,
    });

    for (const child of this.orderedChildren) {
      child.orderChildren({ ...context, sortDescriptors });
    }
  }

  valueForKeyPath({ keyPath, ...context }: { keyPath: KeyPath } & KeyPathContext): KeyPathValue {
    const [component, remainingPath] = popFirstKeyPathComponent(keyPath);

    switch (component) {
      case "id": {
        return valueForKeyPath(this.id, remainingPath ? remainingPath : "truncated");
      }
      case "parent": {
        if (!this.parent) return KeyPathValue(null);
        return this.parent.valueForKeyPath({ ...context, keyPath });
      }
      case "rootParent": {
        let current = this as unknown as ItemNode;
        while (current.parent) current = current.parent;
        return current.valueForKeyPath({ ...context, keyPath: remainingPath });
      }
      default: {
        if (!this.item || !(component in this.item)) return KeyPathValue(null);
        const value = (this.item as NonNullable<Item>)[component as keyof typeof this.item] as unknown;
        return valueForKeyPath(value, remainingPath);
      }
    }
  }
}

export type SortOrder = "ascending" | "descending";

export type SortDescriptor = {
  keyPaths: KeyPath[];
  order: SortOrder;
};

export function keyPathCompare({
  keyPaths,
  lhs,
  rhs,
  ...context
}: {
  keyPaths: KeyPath[];
  lhs: IndexedObject;
  rhs: IndexedObject;
} & KeyPathContext): 0 | 1 | -1 {
  const lhsValue = lhs.valueForKeyPaths({ ...context, keyPaths }).sort;
  const rhsValue = rhs.valueForKeyPaths({ ...context, keyPaths }).sort;

  return primitiveValueCompare(lhsValue, rhsValue);
}

export function primitiveValueCompare(lhsValue: PrimitiveValue, rhsValue: PrimitiveValue): 0 | 1 | -1 {
  /// Generally, we follow this order:
  /// null < false < all numbers < all strings < true
  switch (typeof lhsValue) {
    case "object": {
      switch (typeof rhsValue) {
        case "string":
          return -1; // null before strings
        case "number":
          return -1; // null before number
        case "boolean":
          return -1; // null before boolean
        default:
          return 0; // null equal to null
      }
    }
    case "string": {
      switch (typeof rhsValue) {
        case "string":
          return lhsValue.localeCompare(rhsValue, "en", { numeric: true }) as 0 | 1 | -1;
        case "number":
          return 1; // strings after numbers
        case "boolean":
          return rhsValue ? -1 : 1; // strings between booleans
        default:
          return 1; // strings after null
      }
    }
    case "number": {
      switch (typeof rhsValue) {
        case "string":
          return -1; // numbers before strings
        case "number": {
          if (lhsValue < rhsValue) return -1;
          if (lhsValue > rhsValue) return 1;
          return 0;
        }
        case "boolean":
          return rhsValue ? -1 : 1; // numbers between booleans
        default:
          return 1; // numbers after null
      }
    }
    case "boolean": {
      switch (typeof rhsValue) {
        case "string":
          return lhsValue ? 1 : -1; // booleans around strings
        case "number":
          return lhsValue ? 1 : -1; // booleans around numbers
        case "boolean": {
          if (!lhsValue && rhsValue) return -1; // false before true
          if (lhsValue && !rhsValue) return 1; // true after false
          return 0;
        }
        default:
          return 1; // booleans after null
      }
    }
  }
}

export function sortItems<T extends IndexedObject>({
  items,
  sortDescriptors,
  sortValueForDescriptor,
  ...context
}: {
  items: T[];
  sortDescriptors: SortDescriptor[];
  sortValueForDescriptor?: (
    props: {
      item: T;
      descriptor: SortDescriptor;
    } & KeyPathContext,
  ) => PrimitiveValue | undefined;
} & KeyPathContext): T[] {
  return [...items].sort((lhs, rhs) => {
    for (const descriptor of sortDescriptors) {
      /// If the sort descriptor is a legacy one, ignore it.
      if (!descriptor.keyPaths || descriptor.keyPaths.length === 0) continue;

      const multiplier = descriptor.order === "ascending" ? 1 : -1;
      const lhsSortValue = sortValueForDescriptor?.({
        ...context,
        item: lhs,
        descriptor,
      });
      const rhsSortValue = sortValueForDescriptor?.({
        ...context,
        item: rhs,
        descriptor,
      });
      const hasCustomSortValue = lhsSortValue !== undefined && rhsSortValue !== undefined;

      const result =
        multiplier *
        (hasCustomSortValue
          ? primitiveValueCompare(lhsSortValue, rhsSortValue)
          : keyPathCompare({
              ...context,
              keyPaths: descriptor.keyPaths,
              lhs,
              rhs,
            }));
      if (result !== 0) return result;
    }

    return lhs.id.localeCompare(rhs.id, "en", { numeric: true });
  });
}

export function filterContains<T extends IndexedObject | PrimitiveValue>({
  item,
  filter,
  ...context
}: {
  item: T;
  filter: Filter;
} & KeyPathContext) {
  if ("value" in filter) {
    const itemValue =
      "keyPath" in filter
        ? item instanceof IndexedObject
          ? item.valueForKeyPaths({ ...context, keyPaths: [filter.keyPath] }).filter
          : valueForPrimitiveValueKeyPath(item, filter.keyPath).filter
        : (item as PrimitiveValue);
    switch (filter.operator) {
      case ValueFilterOperator.equal:
        return itemValue === filter.value;
      case ValueFilterOperator.notEqual:
        return itemValue !== filter.value;
      case ValueFilterOperator.greaterThan:
        return primitiveValueCompare(itemValue, filter.value) > 0;
      case ValueFilterOperator.lessThan:
        return primitiveValueCompare(itemValue, filter.value) < 0;
      case ValueFilterOperator.greaterThanOrEqual:
        return primitiveValueCompare(itemValue, filter.value) >= 0;
      case ValueFilterOperator.lessThanOrEqual:
        return primitiveValueCompare(itemValue, filter.value) <= 0;
      default:
        return false;
    }
  }
  switch (filter.operator) {
    case GroupFilterOperator.all:
      for (const subFilter of filter.filters) {
        const result = filterContains({
          ...context,
          item,
          filter: subFilter,
        });
        if (!result) return false;
      }
      return true;
    case GroupFilterOperator.any:
      for (const subFilter of filter.filters) {
        const result = filterContains({
          ...context,
          item,
          filter: subFilter,
        });
        if (result) return true;
      }
      return false;
    case GroupFilterOperator.none:
      for (const subFilter of filter.filters) {
        const result = filterContains({
          ...context,
          item,
          filter: subFilter,
        });
        if (result) return false;
      }
      return true;
    default:
      return false;
  }
}

export function filterItems<T extends IndexedObject>({
  items,
  filter,
  ...context
}: { items: T[]; filter: Filter | undefined } & KeyPathContext): T[];
export function filterItems<T extends IndexedObject>({
  items,
  filter,
  ...context
}: { items: T[] | undefined; filter: Filter | undefined } & KeyPathContext): T[] | undefined;
export function filterItems<T extends IndexedObject>({
  items,
  filter,
  ...context
}: { items: T[] | undefined; filter: Filter | undefined } & KeyPathContext): T[] | undefined {
  if (!items || !filter) return items;
  return items.filter((item) =>
    filterContains({
      ...context,
      item,
      filter,
    }),
  );
}
