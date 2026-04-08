import {
  type ChangeEventHandler,
  type JSXElementConstructor,
  type PropsWithChildren,
  type ReactElement,
  useCallback,
  useMemo,
} from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";
import { type StateObject, useBinding, useReactiveState, useStateObject } from "@/library/StateObject";

import { ControlCSSMetrics, type ControlProps, type ControlSize, useControlDefaults } from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Size } from "@/components/ui/sizes";

// MARK: - Types

export type PopupItemActionHandler = (previousValue: string, newValue: string | null) => void | Promise<void>;

type PopupItemProps = {
  title: string;
} & (
  | {
      value: string;
      disabled?: boolean;
      action?: PopupItemActionHandler;
    }
  | {
      value?: string;
      disabled?: boolean;
      action: PopupItemActionHandler;
    }
  | {
      value?: string;
      disabled: true;
      action?: PopupItemActionHandler;
    }
);

type PopupDividerProps = object & {};

// MARK: - Constants

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const Select = styled.select<{ $size: ControlSize; $backgroundColor: string }>`${({ $size, $backgroundColor }) => css`
  position: relative;
  width: 100%;
  font-size: ${ControlCSSMetrics[$size].fontSize};
  font-weight: normal;
  padding: 1px calc(min(${ControlCSSMetrics[$size].controlPadding} + 12px, 24px)) 0px ${ControlCSSMetrics[$size].controlPadding};
  font-family: inherit;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 12px;
  outline-offset: -3px;
  background: ${$backgroundColor};
  appearance: none;
  color: black;
  box-sizing: border-box;
  height: ${ControlCSSMetrics[$size].controlHeight};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;

  &:not([disabled]):hover {
    color: ${Color.emphasizedText};
    background: ${Color.hover};
  }

  &:not([disabled]):active:hover {
    background: rgba(0, 0, 0, 0.1);
  }
`}`;

const SelectContainer = styled.div<{ $size: ControlSize }>`${({ $size }) => css`
  position: relative;

  &::after {
    display: block;
    position: absolute;
    top: 0px;
    bottom: 0px;
    content: "";
    background: ${Color.textDark};
    mask-image: url(/assets/ui-choose.svg);
    mask-repeat: no-repeat;
    mask-position: center;
    pointer-events: none;

    ${() => {
      switch ($size) {
        case "small":
          return css`
            right: 4px;
            width: 12px;
            mask-size: 12px;
          `;
        case "regular":
          return css`
            right: 6px;
            width: 16px;
          `;
        case "large":
          return css`
            right: 8px;
            width: 16px;
          `;
      }
    }}
  }

  &:not(:has(${Select}[disabled])):hover::after {
    background: rgba(0, 0, 0, 1);
  }

  &:has(${Select}[disabled]) {
    opacity: 0.5;
  }
`}`;

// MARK: - Components

export const PopupItem = ({ title, value, disabled = false }: PopupItemProps) => {
  return (
    <option value={value} disabled={disabled}>
      {title}
    </option>
  );
};
PopupItem.displayName = "PopupItem";

export const PopupDivider = (_: PopupDividerProps) => {
  return <option disabled>─────</option>;
};
PopupDivider.displayName = "PopupDivider";

type PopupItemJSXElement =
  | ReactElement<PropsWithChildren<PopupItemProps>, JSXElementConstructor<typeof PopupItem>>
  | ReactElement<PropsWithChildren<PopupDividerProps>, JSXElementConstructor<typeof PopupDivider>>
  | undefined
  | null
  | false
  | PopupItemJSXElement[];

function flattenJSXElement(element: PopupItemJSXElement): PopupItemProps[] {
  let props: PopupItemProps[] = [];
  if (!element) return [];
  if (!Array.isArray(element)) {
    if ("title" in element.props) return [element.props];
    return [{ title: "─────", disabled: true }];
  }
  for (const child of element) {
    props = props.concat(flattenJSXElement(child));
  }
  return props;
}

export const PopupButton = NamedComponent(
  "PopupButton",
  ({
    selectionState,
    style,
    className,
    children,
    ...controlProps
  }: {
    selectionState: StateObject<string>;
    children: PopupItemJSXElement;
  } & ControlProps) => {
    const { id, isEnabled, size, prominence } = useControlDefaults(controlProps);

    const underlyingState = useStateObject(() => `@${selectionState.wrappedValue}`);
    const [selection, setSelection] = useBinding(underlyingState);

    useReactiveState(
      selectionState,
      (_, newValue) => {
        setSelection(`@${newValue}`);
      },
      [],
    );

    const { popupItems, itemMap } = useMemo(() => {
      const popupItems = flattenJSXElement(children).map((item, index) => ({
        ...item,
        value: item.value !== undefined ? `@${item.value}` : `?${index}`,
      }));

      const itemMap = new Map(popupItems.map((item) => [item.value, item]));

      return { popupItems, itemMap };
    }, [children]);

    const onChange: ChangeEventHandler<HTMLSelectElement> = useCallback(
      async (event) => {
        const value = event.currentTarget.value;
        const item = itemMap.get(value);

        const previousValue = selectionState.wrappedValue;
        if (value.slice(0, 1) === "@") {
          /// If the caller provided a value, switch to it first, then let the caller know it was selected, if they are interested. This way, their selection callback can change the value again if they desire.
          const originalValue = value.slice(1);
          selectionState.wrappedValue = originalValue;
          await item?.action?.(previousValue, originalValue);
        } else {
          /// If the caller didn't provide a value, let the caller know it was selected, if they are interested, and restore the selection to what it was prior to selection. This way, their selection callback can change the value if they desire.
          try {
            await item?.action?.(previousValue, null);
          } finally {
            setSelection(`@${selectionState.wrappedValue}`);
          }
        }
      },
      [itemMap, setSelection, selectionState],
    );

    return (
      <SelectContainer className={className} style={style} $size={size}>
        <Select
          id={id}
          value={selection}
          disabled={!isEnabled}
          onChange={onChange}
          $size={size}
          $backgroundColor={prominence === "primary" ? Color.buttonPlain : Color.surfaceOffWhite}
        >
          {popupItems.map(({ title, value, disabled }) => (
            <PopupItem key={value} title={title} value={value} disabled={disabled} />
          ))}
        </Select>
      </SelectContainer>
    );
  },
);
