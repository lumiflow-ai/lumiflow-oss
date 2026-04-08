import { type MouseEventHandler, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";

import type { ColumnDescriptor, KeyPath } from "@/generated/serverTypes";

import { NamedComponent } from "@/library/NamedComponent";
import { StateObject, useBinding } from "@/library/StateObject";

import { ArtifactNode } from "@/model/artifactNode";
import { type ItemNode, isPrimitiveValue, type SortDescriptor, type SortOrder } from "@/model/keyPath";

import { type ControlProps, useControlDefaults } from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Font } from "@/components/ui/fonts";
import { Size } from "@/components/ui/sizes";
import { TruncatingText } from "@/components/ui/TruncatingText";

// MARK: - Types

export const TableUserIntent = {
  handleSelection: "handleSelection",
  handleAction: "handleAction",
  handleNesting: "handleNesting",
  disableInteraction: "disableInteraction",
  auto: "auto",
} as const;
export type TableUserIntent = (typeof TableUserIntent)[keyof typeof TableUserIntent];

export type TableActionHandler<Item extends ItemNode = ItemNode> = (item: Item) => void | Promise<void>;
export type TableInteractionHandler<Item extends ItemNode = ItemNode> = (
  item: Item,
  action: TableActionHandler<Item> | undefined,
) => TableUserIntent;
export type TableColumnAlignment = "leading" | "center" | "trailing";

export type TableColumnDescriptor = Omit<ColumnDescriptor, "width" | "title"> & {
  title: ReactNode;
  width?: number | string | "auto";
  stickyPosition?: "left" | "right";
  alignment?: TableColumnAlignment;
  textAlign?: "left" | "center" | "right";
};

/** Render a cell by returning a string (which will be embedded as a link), a node (which will be embedded as is), or `undefined` if the default cell renderer should be used instead. Wrap a component in TableLink to get the standard hover behavior. */
export type TableCellRenderer<Item extends ItemNode = ItemNode> = (
  item: Item,
  column: TableColumnDescriptor,
  action: MouseEventHandler<HTMLElement> | undefined,
) => undefined | string | ReactNode;

export type TableProps<
  Item extends ItemNode = ItemNode,
  Selection extends ItemNode = Item,
  Action extends ItemNode = Item,
  Interaction extends ItemNode = Item,
  Render extends ItemNode = Item,
> = {
  /** The items to display. */
  items: Item[];
  /** The columns to offer for display. Specify a state object to allow column positions to change. */
  columnsState: TableColumnDescriptor[] | StateObject<TableColumnDescriptor[]>;
  /** A state object representing the current selection. Specify an ItemNode or null to support single selection, or a set of ItemNodes for multiple selection. Leave undefined to disable selection, or set to a specific item node to force selection. */
  selectionState?: StateObject<Selection | null> | StateObject<Set<Selection>> | Selection | undefined;
  /** A state object representing the current sort options. Specify one to allow for sorting changes, or leave undefined to disable column sorting interactions. It is up to the container to perform actual sorting when the state object changes. */
  sortDescriptorsState?: StateObject<SortDescriptor[]> | undefined;
  /** An action to perform when the user double clicks or clicks on text in a row. */
  action?: TableActionHandler<Action>;
  /** A delegation method to control when happens when a user interacts with an item. */
  interactionHandler?: TableInteractionHandler<Interaction>;
  /** A flag indicating if children of items should be included or not. */
  shouldNestItems?: boolean;
  /** A string to show when no items are available. */
  emptyStateComponent?: ReactNode;
  /** A function indicating how the row should be rendered for a given item in a given column. Return `undefined` to render based on the key path, a string to customize the value displayed in a cell (with default hover behavior), or a custom component. Wrap a component in TableLink to get the standard hover behavior. */
  cellRenderer?: TableCellRenderer<Render>;
  /** Optional: render additional rows after a given item row. Return a <tr> or fragment of <tr>s. */
  expansionRenderer?: (item: Item) => ReactNode;
} & ControlProps;

type TableRowProps = {
  /** The item to display. */
  itemNode: ItemNode;
  /** The index of the row in the table. */
  rowIndex?: number;
  /** The columns to offer for display. */
  columns: TableColumnDescriptor[];
  /** A state object representing the current selection. Specify an ItemNode or null to support single selection, or a set of ItemNodes for multiple selection. Leave undefined to disable selection, or set to a specific item node to force selection. */
  selectionState: StateObject<ItemNode | null> | StateObject<Set<ItemNode>> | ItemNode | undefined;
  /** An action to perform when the user double clicks or clicks on text in a row. */
  action: TableActionHandler | undefined;
  /** A delegation method to control when happens when a user interacts with an item. */
  interactionHandler: TableInteractionHandler | undefined;
  /** A flag indicating if children of items should be included or not. */
  shouldNestItems: boolean;
  /** The current depth being rendered. */
  depth: number;
  /** A function indicating how the row should be rendered for a given item in a given column. Return `undefined` to render based on the key path, a string to customize the value displayed in a cell (with default hover behavior), or a custom component. Wrap a component in TableLink to get the standard hover behavior. */
  cellRenderer: TableCellRenderer;
  /** Optional: render additional <tr> rows directly after this row (e.g. nested expansion). */
  expansionRenderer?: (item: ItemNode) => ReactNode;
};

// MARK: - Constants

const defaultCellRenderer: TableCellRenderer = () => undefined;

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const Hint = styled.div`${() => css`
  position: sticky;
  inset: 0px;
  padding: 12px;
  display: flex;
  align-items: end;
  justify-content: center;
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  transition: opacity 0.2s;

  &::after {
    position: relative;
    content: "Double-click row to open.";
    font-size: ${Size.fontSize.fontSize14};
    font-weight: 400;
    color: black;
    background-color: ${Color.contentSurface};
    border-radius: 4px;
    padding: 2px 8px 1px;
    outline: ${Size.line.thickness} solid ${Color.line};
  }
`}`;

const InfoCell = styled.td`${() => css`
  display: block;
  height: auto;
  padding: 0px 20px;
  border: 0px;
  border-radius: 16px;
  font-family: ${Font.ibmPlexSans};
  font-size: ${Size.fontSize.fontSize14};
  line-height: 1.2;
  border: ${Size.line.thickness} solid ${Color.line};
`}`;

const InfoRow = styled.tr`${() => css`
  display: flex;
  position: absolute;
  inset: 40px 0px 0px 0px;
  align-items: center;
  justify-content: center;
 


  h3 {
    -webkit-user-select: none;
    user-select: none;
    font-size: ${Size.fontSize.fontSize14};
    pointer-events: none;
    font-weight: 400;
  }
`}`;

const DisclosureTriangle = styled.div<{ $state: "open" | "closed" | null }>`${({ $state }) => css`
  position: absolute;
  display: block;
  width: 16px;
  height: 16px;
  padding: 0px 6px;
  margin: 0px -6px;
  ${
    $state &&
    css`
      background-color: currentcolor;
      mask-image: url(/assets/disclosure-${$state}.svg);
      mask-size: 16px 16px;
      mask-position: center;
      mask-repeat: no-repeat;
    `
  }
`}`;

export const TableLink = styled.a<{ $status: "done" | "failed" | null }>`
  color: ${Color.textDark};
  text-decoration: none;
  ${({ $status }) =>
    $status === "done" &&
    css`
      color: ${Color.textOffWhite};
      background-color: rgba(37, 193, 99, 1);
      padding: 0px 8px;
      border-radius: 38px;
      height: 20px;`}
  ${({ $status }) =>
    $status === "failed" &&
    css`
      color: ${Color.textOffWhite};
      background-color: rgba(241, 72, 72, 1);
      padding: 0px 8px;
      border-radius: 38px;
      height: 20px;
    `}`;

const BodyCell = styled.td<{ $alignment?: TableColumnAlignment }>`${({ $alignment }) => css`
  padding: 0px 20px;
  font-family: ${Font.inter};
  font-size: ${Size.fontSize.fontSize14};
  border-top: ${Size.line.thickness} solid ${Color.line};
  border-right: ${Size.line.thickness} solid ${Color.line};
  border-bottom: ${Size.line.thickness} solid ${Color.line};
  margin: 0px;

  justify-items: ${$alignment === "center" ? "center" : $alignment === "trailing" ? "right" : "left"};

  &[data-sticky-column] {
    position: sticky;
  }

  &[data-sticky-column="left"] {
    left: 0px;
    /* right border for sticky left column */
    &::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: ${Size.line.thickness};
      background-color: ${Color.line};
      pointer-events: none;
    }
  }

  &[data-sticky-column="right"] {
    right: 0px;
    /* left border for sticky right column */
    &::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: ${Size.line.thickness};
      background-color: ${Color.line};
      pointer-events: none;
    }
  }
`}`;

const BodyRow = styled.tr<{ $depth: number }>`${({ $depth }) => {
  const colorValues = (Color.contentSurface.match(/\d+/g) ?? ["255", "255", "255"])
    .map((s) => Number.parseInt(s, 10))
    .map((val) => ($depth ? val - 80 * (1 - 1 / (1.1 * $depth)) : val));
  const backgroundColor = `rgb(${colorValues.join(", ")})`;
  return css`
    background-color: ${backgroundColor};
    height: 47px;

    &:not(:last-of-type) {
      border-bottom: ${Size.line.thickness} solid ${Color.line};
    }

    ${BodyCell} {
      &[data-sticky-column] {
        background-color: ${backgroundColor};
      }

      &[data-disclosure-column="true"] {
        padding-left: ${$depth * 16 + 6 + 16 + 4}px;

        ${DisclosureTriangle} {
          left: ${$depth * 16 + 6}px;
        }
      }
    }

    &:not([data-user-intent="disableInteraction"])[data-selected]:hover{
      background-color: ${Color.surfaceRowHover};
      cursor: pointer;

      ${BodyCell} {
        background-color: inherit;
      }
    }

    &:not([data-user-intent="disableInteraction"]):has(${TableLink}:hover) ${TableLink} {
      text-shadow:
        0.15px 0 0 currentColor,
        -0.15px 0 0 currentColor;
    }
  `;
}}`;

const Body = styled.tbody`${() => css``}`;

const SortIndicator = styled.div<{ $state: SortOrder | null }>`${({ $state }) => css`
  position: relative;
  display: inline-block;
  width: 16px;
  height: 10px;
  margin-left: 4px;
  flex-shrink: 0;
  ${
    $state &&
    css`
    background-color: currentcolor;
    mask-image: url(/assets/${$state}.svg);
  `
  }
  mask-size: 16px 16px;
  mask-position: 50% 50%;
`}`;

const TableColumnHeader = styled.div<{ $textAlign?: "left" | "center" | "right"; $alignment?: TableColumnAlignment }>`
  ${({ $textAlign, $alignment }) => css`
  position: absolute;
  inset: 0px 0px 0px 0px;
  display: flex;
  margin: 0px 0px;
  padding: ${
    $textAlign === "center" || $textAlign === "right" || $alignment === "center" || $alignment === "trailing"
      ? "0px 0px"
      : "0px 10px 0px 20px"
  };
  border-right: ${Size.line.thickness} solid ${Color.line};
  align-items: center;
  justify-content: ${
    $textAlign === "center"
      ? "center"
      : $textAlign === "right"
        ? "flex-end"
        : $alignment === "center"
          ? "center"
          : $alignment === "trailing"
            ? "flex-end"
            : "flex-start"
  };
  font-weight: 400;
`}`;

const HeaderCell = styled.th<{ $textAlign?: "left" | "center" | "right"; $alignment?: TableColumnAlignment }>`
  ${({ $textAlign, $alignment }) => css`
  position: relative;
  padding: 0px;
  text-align: ${$textAlign ?? ($alignment === "center" ? "center" : $alignment === "trailing" ? "right" : "left")};
  color: ${Color.textDark};
  -webkit-user-select: none;
  font-size: ${Size.fontSize.fontSize14};
  user-select: none;

  &[data-sort-key]:hover {
    text-shadow:
      0.15px 0 0 currentColor,
      -0.15px 0 0 currentColor;
    cursor: pointer;
  }

  &[data-sort-key]:hover:active {
    cursor: pointer;
    background: ${Color.tableHeader};
  }

  &[data-sticky-column] {
    position: sticky;
    background: ${Color.tableHeader};
    z-index: 3;
  }

  &[data-sticky-column="left"] {
    left: 0px;
  }

  &[data-sticky-column="right"] {
    right: 0px;
  }

  &:last-of-type ${TableColumnHeader} {
    inset: 0px 0px 0px 0px;
    border-right: 0px;
  }
`}`;

const HeaderRow = styled.tr`${() => css`
  position: relative;
  height: 45px;

  &::after {
    content: "";
    position: absolute;
    display: block;
    inset: 0px;
   
    pointer-events: none;
  }
`}`;

const Header = styled.thead`${() => css`
  position: sticky;
  top: 0px;
  background: ${Color.tableHeader};
  -webkit-user-select: none;
  user-select: none;
  z-index: 1;
`}`;

const StyledTable = styled.table`${() => css`
  border-collapse: collapse;
  width: 100%;
`}`;

const ScrollView = styled.div`${() => css`
  position: relative;
  overflow: auto;
  background-color: ${Color.contentSurface};
  outline: ${Size.line.thickness} solid ${Color.line};
  border-radius: 16px;
  
  &:has(${TableLink}):hover ${Hint} {
    opacity: 1;
  }
`}`;

// MARK: - Helper Functions

function encodeKeyPaths(keyPaths: KeyPath[]) {
  return JSON.stringify(keyPaths);
}

function decodeKeyPaths(encodedKeyPaths: string): KeyPath[] | undefined {
  if (!encodedKeyPaths) return undefined;
  return JSON.parse(encodedKeyPaths);
}

function supportsMultipleSelection(selection: ItemNode | null | Set<ItemNode> | undefined): selection is Set<ItemNode> {
  return selection instanceof Set;
}

function isPercentWidth(width: TableColumnDescriptor["width"] | undefined) {
  return typeof width === "string" && width.trim().endsWith("%");
}

function getColumnWidthStyle(width: TableColumnDescriptor["width"] | undefined) {
  if (width === undefined) {
    return { width: undefined, minWidth: 180 };
  }
  if (isPercentWidth(width)) {
    return { width, minWidth: 0 };
  }
  const widthAmount = Number.parseInt(`${width}`, 10);
  if (Number.isFinite(widthAmount)) {
    return { width: widthAmount * 1.5, minWidth: width };
  }
  return { width, minWidth: 180 };
}

// MARK: - Components

const TableRowExpansion = ({
  itemNode,
  columns,
  selectionState,
  action,
  interactionHandler,
  depth,
  cellRenderer,
}: Omit<TableRowProps, "shouldNestItems">) =>
  itemNode.orderedChildren.flatMap((childNode) => (
    <TableRow
      key={childNode.id}
      itemNode={childNode}
      columns={columns}
      selectionState={selectionState}
      action={action}
      interactionHandler={interactionHandler}
      depth={depth}
      cellRenderer={cellRenderer}
      shouldNestItems
    />
  ));

const TableRow = ({
  itemNode,
  rowIndex: _rowIndex,
  columns,
  selectionState,
  action,
  interactionHandler,
  shouldNestItems,
  depth,
  cellRenderer,
  expansionRenderer,
}: TableRowProps) => {
  /// Context & State

  // TODO: Update to shared state object down the road
  const [showChildren, setShowsChildren] = useState(false);

  /// A timer to make sure double-clicking a row doesn't change the selection until we are sure the user didn't follow through with the second click.
  const clickTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);

  /// Derived State

  const [selection, setSelection] = useBinding(
    selectionState as StateObject<ItemNode | null | Set<ItemNode>> | undefined,
  );

  const hasChildren = itemNode.children.size > 0;
  const isSelectable = selectionState instanceof StateObject;
  const isOpenable = action !== undefined;
  const isSelected = selection === itemNode || (supportsMultipleSelection(selection) && selection.has(itemNode));

  /// Ask the delegate what should happen for a given row.
  const userIntent = interactionHandler?.(itemNode, action) ?? TableUserIntent.auto;

  /// Actions

  const toggleShowsChildren: MouseEventHandler = useCallback((event) => {
    setShowsChildren((previous) => !previous);
    event.stopPropagation();
  }, []);

  const simpleSelectItemAction = useCallback(() => {
    /// If interaction should be disabled, stop here.
    if (userIntent === TableUserIntent.disableInteraction) return;

    /// If an action should take place, stop here and execute it.
    if (userIntent === TableUserIntent.handleAction) {
      action?.(itemNode);
      return;
    }

    /// If we should explicitly select, or if we have an item, handle selection
    if (userIntent === TableUserIntent.handleSelection || (itemNode.item && userIntent === TableUserIntent.auto)) {
      setSelection((previous) => {
        /// If selection is unsupported, stop here without making changes.
        if (previous === undefined) return;

        /// If we support multiple selection, handle things as a set.
        if (supportsMultipleSelection(previous)) {
          let updatedSelection = new Set(previous);
          // TODO: support shift, command clicking and more! Shift should always be handled from the last addition (or removal) to/from the set, which needs to be tracked separately. Use Finder lists as a benchmark.
          if (updatedSelection.has(itemNode) && updatedSelection.size === 1) {
            /// If the selection contains only this item, deselect it.
            updatedSelection.delete(itemNode);
          } else {
            /// Otherwise, deselect everything and select this item only.
            updatedSelection = new Set([itemNode]);
          }
          return updatedSelection;
        }

        /// If we are only handling single selection, toggle the selection accordingly.
        return previous === itemNode ? null : itemNode;
      });
      return;
    }

    /// Otherwise fall back to toggling the row if we are nesting.
    if (shouldNestItems && (userIntent === TableUserIntent.handleNesting || userIntent === TableUserIntent.auto)) {
      setShowsChildren((previous) => !previous);
    }
  }, [userIntent, action, itemNode, setSelection, shouldNestItems]);

  const selectItemAction: MouseEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (!action) {
        simpleSelectItemAction();
        return;
      }
      /// If the user clicked on a link within the row, don't process the double click or selection.
      if ((event.target as HTMLElement).closest("a")) return;

      /// If the caller requested no interaction for the row, don't do anything else here.
      if (userIntent === TableUserIntent.disableInteraction) return;

      /// Reset the single click selection action.
      clearTimeout(clickTimeoutRef.current);

      /// If a double click occurred, open the item.
      if (event.detail >= 2) {
        action(itemNode);
        return;
      }

      /// Otherwise, enqueue a single-click inspect action after a 200ms delay, so we are sure a double-click isn't coming. Otherwise, listeners like the side panel may open unintentionally.
      clickTimeoutRef.current = setTimeout(simpleSelectItemAction, 200);
      event.stopPropagation();
    },
    [action, itemNode, simpleSelectItemAction, userIntent],
  );
  const selectItem = isSelectable ? selectItemAction : undefined;

  const openItem: MouseEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      /// Reset the single click selection action.
      clearTimeout(clickTimeoutRef.current);

      action(itemNode);
    },
    [action, itemNode],
  );

  /// Component

  return (
    <>
      <BodyRow
        data-selected={isSelectable ? isSelected : undefined}
        data-user-intent={userIntent}
        $depth={depth}
        onClick={selectItem}
      >
        {columns.map((column, columnIndex) => {
          const { keyPaths } = column;
          const key = encodeKeyPaths(keyPaths);
          const columnWidthStyle = isPercentWidth(column.width) ? getColumnWidthStyle(column.width) : undefined;

          const disableInteraction = interactionHandler?.(itemNode, action) === TableUserIntent.disableInteraction;
          const shouldRenderAsLink = isOpenable && !disableInteraction;
          /// Attempt to render the cell using the provided renderer. If undefined is returned, fallback to key-path rendering.
          const nodeOrPrimitive = (() => {
            const nodeOrString = cellRenderer(itemNode, column, shouldRenderAsLink ? openItem : undefined);
            if (nodeOrString !== undefined) return nodeOrString;
            return itemNode.valueForKeyPaths(keyPaths).display;
          })();

          /// If the returned value is a node, use it as is, otherwise wrap it in a link or plain string depending on action support.
          const contents = (() => {
            if (!isPrimitiveValue(nodeOrPrimitive)) return nodeOrPrimitive;
            const stringValue = `${nodeOrPrimitive}`;
            const status =
              stringValue.toLowerCase() === "done" ? "done" : stringValue.toLowerCase() === "failed" ? "failed" : null;

            return (
              <TruncatingText title={stringValue}>
                {shouldRenderAsLink ? (
                  <TableLink onClick={openItem} $status={status}>
                    {stringValue}
                  </TableLink>
                ) : (
                  stringValue
                )}
              </TruncatingText>
            );
          })();

          const shouldRenderDisclosure = columnIndex === 0 && shouldNestItems;
          const stickyPosition = column.stickyPosition ?? (shouldRenderDisclosure ? "left" : undefined);

          /// Render the first column as a sticky column, with disclosure indicators if nesting is supported.
          if (shouldRenderDisclosure) {
            const disclosureState = !hasChildren ? null : showChildren ? "open" : "closed";
            return (
              <BodyCell
                key={key}
                data-disclosure-column={shouldNestItems}
                data-sticky-column={stickyPosition}
                data-alignment={column.alignment ?? "leading"}
                style={columnWidthStyle}
                $alignment={column.alignment}
              >
                {shouldNestItems && <DisclosureTriangle $state={disclosureState} onClick={toggleShowsChildren} />}
                {contents}
              </BodyCell>
            );
          }

          /// Legacy support for mocked values is only available through ArtifactNode.
          const isMockedValue = itemNode instanceof ArtifactNode && itemNode.isMockedValueForKeyPaths(keyPaths);
          return (
            <BodyCell
              key={key}
              className={isMockedValue ? "fakeData" : undefined}
              data-sticky-column={stickyPosition}
              data-alignment={column.alignment ?? "leading"}
              style={columnWidthStyle}
              $alignment={column.alignment}
            >
              {contents}
            </BodyCell>
          );
        })}
      </BodyRow>
      {expansionRenderer?.(itemNode)}
      {showChildren && shouldNestItems && (
        <TableRowExpansion
          itemNode={itemNode}
          columns={columns}
          selectionState={selectionState}
          action={action}
          interactionHandler={interactionHandler}
          depth={depth}
          cellRenderer={cellRenderer}
        />
      )}
    </>
  );
};

/** A table component capable of displaying a nested list of elements */
export const Table: (<
  Selection extends ItemNode,
  Action extends ItemNode,
  Interaction extends ItemNode,
  Render extends ItemNode,
  Item extends Selection & Action & Interaction & Render,
>(
  props: TableProps<Item, Selection, Action, Interaction, Render>,
) => JSX.Element) &
  ReturnType<typeof NamedComponent<TableProps<ItemNode>>> = NamedComponent(
  "Table",
  ({
    items,
    columnsState,
    selectionState,
    sortDescriptorsState,
    action,
    interactionHandler,
    shouldNestItems = true,
    emptyStateComponent = "",
    cellRenderer = defaultCellRenderer,
    expansionRenderer,
    style,
    className,
    ...controlProps
  }) => {
    /// Context

    const { id } = useControlDefaults(controlProps);
    // TODO: Style prominence
    // TODO: Style size
    // TODO: Handle isEnabled

    /// State

    const [columns, _setColumns] = useBinding(columnsState);
    const [sortDescriptors] = useBinding(sortDescriptorsState);
    const [selection] = useBinding(selectionState as StateObject<ItemNode | null | Set<ItemNode>> | undefined);

    /// Derived State

    const currentSortDescriptor = sortDescriptors?.at(0);
    const currentSortDescriptorKeyPaths = useMemo(() => {
      if (!currentSortDescriptor?.keyPaths || currentSortDescriptor.keyPaths.length === 0) return undefined;
      return encodeKeyPaths(currentSortDescriptor.keyPaths);
    }, [currentSortDescriptor]);

    const selectedItems = useMemo<ItemNode[]>(() => {
      const currentSelection = selectionState instanceof StateObject ? selection : selectionState;
      if (!currentSelection) return [];
      if (supportsMultipleSelection(currentSelection)) {
        return Array.from(currentSelection);
      }
      return [currentSelection];
    }, [selectionState, selection]);

    const showDoubleClickHint = action && selectedItems.length !== 0;

    /// Flags

    const _areColumnsMutable = columnsState instanceof StateObject;
    const canChangeSortDiescriptors = sortDescriptorsState instanceof StateObject;

    /// Actions

    const changeSortDescriptors: MouseEventHandler<HTMLElement> = useCallback(
      (event) => {
        if (!canChangeSortDiescriptors || !sortDescriptorsState) return;

        /// Extract the keypath to use
        const serializedKeyPath = event.currentTarget.dataset.sortKey;
        if (!serializedKeyPath) return;
        const keyPaths = decodeKeyPaths(serializedKeyPath);
        if (!keyPaths) return;

        /// Determine which sort order to use next.
        const currentSortDescriptor = sortDescriptorsState.wrappedValue.at(0);
        let order = currentSortDescriptor?.order ?? "ascending";
        if (currentSortDescriptor && serializedKeyPath === encodeKeyPaths(currentSortDescriptor.keyPaths)) {
          order = order === "ascending" ? "descending" : "ascending";
        }

        /// Build new sort descriptors by moving the current one to the front.
        const newDescriptors: SortDescriptor[] = [{ keyPaths, order }];
        for (const previousDescriptor of sortDescriptorsState.wrappedValue) {
          /// If the sort descriptor is a legacy one, ignore it.
          if (!previousDescriptor.keyPaths) continue;

          /// Skip any descriptors that match the current one.
          if (serializedKeyPath === encodeKeyPaths(previousDescriptor.keyPaths)) continue;

          newDescriptors.push(previousDescriptor);
        }
        sortDescriptorsState.wrappedValue = newDescriptors;
      },
      [canChangeSortDiescriptors, sortDescriptorsState],
    );

    /// When the items change, refresh the selection by matching the old selected item(s) to the new ones by ID.
    useEffect(() => {
      if (!(selectionState instanceof StateObject)) return;

      const currentSelection = selectionState.wrappedValue;
      if (!currentSelection) return;

      if (supportsMultipleSelection(currentSelection)) {
        let hasChanges = false;
        const updatedSelection = new Set<ItemNode>();
        for (const selectedItem of currentSelection) {
          const updatedItem = items.find(({ id }) => id === selectedItem.id);
          if (!updatedItem) {
            hasChanges = true;
            continue;
          }
          updatedSelection.add(updatedItem);
          if (updatedItem !== selectedItem) hasChanges = true;
        }
        if (hasChanges) {
          selectionState.wrappedValue = updatedSelection;
        }
        return;
      }
      const updatedItem = items.find(({ id }) => id === currentSelection?.id);
      if (updatedItem && updatedItem !== currentSelection) {
        selectionState.wrappedValue = updatedItem;
      }
    }, [items, selectionState]);

    /// Component

    return (
      <ScrollView className={className} style={style} id={id}>
        <StyledTable>
          <Header>
            <HeaderRow>
              {columns.map(
                (
                  { keyPaths, title, width, description, stickyPosition: stickyPositionOverride, alignment, textAlign },
                  columnIndex,
                ) => {
                  const serializedKeyPaths = encodeKeyPaths(keyPaths);
                  const columnWidthStyle = getColumnWidthStyle(width);
                  const sortIndicatorState =
                    (currentSortDescriptorKeyPaths === serializedKeyPaths && currentSortDescriptor?.order) || null;
                  const shouldRenderDisclosure = columnIndex === 0 && shouldNestItems;
                  const stickyPosition = stickyPositionOverride ?? (shouldRenderDisclosure ? "left" : undefined);

                  return (
                    <HeaderCell
                      key={serializedKeyPaths}
                      data-sort-key={canChangeSortDiescriptors ? serializedKeyPaths : undefined}
                      data-sticky-column={stickyPosition}
                      onClick={canChangeSortDiescriptors ? changeSortDescriptors : undefined}
                      style={columnWidthStyle}
                      $alignment={alignment}
                      $textAlign={textAlign}
                    >
                      <TableColumnHeader
                        $alignment={alignment}
                        $textAlign={textAlign}
                        title={typeof description === "string" ? description : undefined}
                      >
                        <TruncatingText title={typeof title === "string" ? title : undefined}>{title}</TruncatingText>
                        {sortIndicatorState && <SortIndicator $state={sortIndicatorState} />}
                      </TableColumnHeader>
                    </HeaderCell>
                  );
                },
              )}
            </HeaderRow>
          </Header>
          <Body>
            {!items.length ? (
              <InfoRow>
                <InfoCell>
                  {typeof emptyStateComponent === "string" ? <h3>{emptyStateComponent}</h3> : emptyStateComponent}
                </InfoCell>
              </InfoRow>
            ) : (
              items.map((itemNode, index) => (
                <TableRow
                  key={itemNode.id}
                  itemNode={itemNode}
                  columns={columns}
                  selectionState={selectionState}
                  action={action}
                  interactionHandler={interactionHandler}
                  depth={0}
                  rowIndex={index}
                  cellRenderer={cellRenderer}
                  shouldNestItems={shouldNestItems}
                  expansionRenderer={expansionRenderer}
                />
              ))
            )}
          </Body>
        </StyledTable>
        {showDoubleClickHint && <Hint />}
      </ScrollView>
    );
  },
);
