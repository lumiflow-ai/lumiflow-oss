import {
  type ChangeEventHandler,
  type HTMLInputAutoCompleteAttribute,
  type KeyboardEventHandler,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled, { css } from "styled-components";

import { NamedComponent } from "@/library/NamedComponent";
import { type StateObject, useBinding, useStateObject } from "@/library/StateObject";

import { ControlCSSMetrics, type ControlProps, type ControlSize, useControlDefaults } from "@/components/ui/Control";
import { Color } from "@/components/ui/colors";
import { Font } from "@/components/ui/fonts";
import { Size } from "@/components/ui/sizes";

// MARK: - Types

export type TextFieldSubmitHandler = (previousValue: string, newValue: string) => boolean | Promise<boolean>;
export type TextFieldValidationHandler = (previousValue: string, newValue: string) => boolean | Promise<boolean>;

// MARK: - Constants

export const alwaysValid: TextFieldValidationHandler = () => true;

export const isValidISOTimestamp: TextFieldValidationHandler = (_, newValue) => {
  return newValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) !== null;
};

export const isNonEmpty: TextFieldValidationHandler = (_, newValue) => {
  return !!newValue;
};

// MARK: - Contexts

// MARK: - Hooks

// MARK: - Styles

const Input = styled.input<{ $size: ControlSize; $backgroundColor: string; $isRawValue: boolean }>`${({
  $size,
  $backgroundColor,
  $isRawValue,
}) => css`
  background-color: ${$backgroundColor};
  box-sizing: border-box;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 12px;
  font-family: ${$isRawValue ? Font.monospace : Font.inter};

  font-size: ${ControlCSSMetrics[$size].fontSize};
  height: 40px;
  padding: 1px ${ControlCSSMetrics[$size].controlPadding} 0px;

  &:not([disabled]):hover,
  &:not([disabled]):focus {
    color: ${Color.textDark}
    background: ${Color.contentSurface}
  }

  &[disabled] {
    opacity: 0.4;
  }

  &[data-valid="false"] {
    color: ${Color.danger};
    border: ${Size.line.thickness} solid ${Color.line};
    padding: 1px ${ControlCSSMetrics[$size].controlPadding} 0px;
  }
`}`;

const TextArea = styled.textarea<{ $size: ControlSize; $backgroundColor: string; $isRawValue: boolean }>`${({
  $size,
  $backgroundColor,
}) => css`
  background-color: ${$backgroundColor};
  box-sizing: border-box;
  border: ${Size.line.thickness} solid ${Color.line};
  border-radius: 12px;
  font-family: ${Font.inter};
  resize: none;

  flex-grow: 1;

  font-size: ${ControlCSSMetrics[$size].fontSize};
  min-height: ${ControlCSSMetrics[$size].controlHeight};
  padding: 10px calc(${ControlCSSMetrics[$size].controlPadding} - 1px);

  &:not([disabled]):hover,
  &:not([disabled]):focus {
    color: ${Color.textDark}
    background: ${Color.contentSurface}
  }

  &[disabled] {
    opacity: 0.4;
  }

  &[data-valid="false"] {
    color: ${Color.danger};
    border: ${Size.line.thickness} solid ${Color.line};
    padding: 4px calc(${ControlCSSMetrics[$size].controlPadding} - 1px);
  }
`}`;

// MARK: - Components

export const TextField = NamedComponent(
  "TextField",
  ({
    valueState,
    focusState,
    submitHandler,
    isRawValue = false,
    isMultiline = false,
    placeholder = "",
    validator = alwaysValid,
    autoCorrect = "off",
    autoCapitalize = "off",
    autoComplete = "off",
    style,
    className,
    ...controlProps
  }: {
    valueState: StateObject<string>;
    focusState?: StateObject<boolean>;
    submitHandler?: TextFieldSubmitHandler;
    isRawValue?: boolean;
    isMultiline?: boolean;
    placeholder?: string;
    validator?: TextFieldValidationHandler;
    autoCorrect?: "off" | "on";
    autoCapitalize?: "off" | "on" | "sentences" | "words" | "characters";
    autoComplete?: HTMLInputAutoCompleteAttribute;
  } & ControlProps) => {
    const { id, isEnabled, size, prominence } = useControlDefaults(controlProps);

    const controlRef = useRef<HTMLInputElement>(null);

    const resetValueState = useStateObject("");
    const [value, setValue] = useBinding(valueState);
    const [focused, setIsFocused] = useBinding(focusState ?? false);
    const [isValid, setIsValid] = useState(true);

    const updateValue: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = useCallback(
      async (event) => {
        const previousValue = valueState.wrappedValue;
        setValue(event.currentTarget.value);
        const validationResult = validator(previousValue, valueState.wrappedValue);
        if (typeof validationResult === "boolean") {
          setIsValid(validationResult);
        } else {
          setIsValid(await validationResult);
        }
      },
      [valueState, setValue, validator],
    );

    useLayoutEffect(() => {
      const validationResult = validator(valueState.wrappedValue, valueState.wrappedValue);
      if (typeof validationResult === "boolean") {
        setIsValid(validationResult);
      } else {
        (async () => {
          setIsValid(await validationResult);
        })();
      }
    }, [valueState, validator]);

    useLayoutEffect(() => {
      if (focused) {
        controlRef.current?.focus();
        resetValueState.wrappedValue = valueState.wrappedValue;
      } else {
        controlRef.current?.blur();
      }
    }, [focused, resetValueState, valueState]);

    const focusHandler = useCallback(() => setIsFocused(true), [setIsFocused]);
    const blurHandler = useCallback(() => {
      try {
        submitHandler?.(resetValueState.wrappedValue, valueState.wrappedValue);
      } finally {
        setIsFocused(false);
      }
    }, [setIsFocused, submitHandler, resetValueState, valueState]);

    const keyDownHandler: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement> = useCallback(
      async (event) => {
        if (event.key === "Escape") {
          valueState.wrappedValue = resetValueState.wrappedValue;
        } else if (event.key === "Enter") {
          if (submitHandler) {
            const result = submitHandler(resetValueState.wrappedValue, valueState.wrappedValue);
            if ((typeof result === "boolean" && result) || (await result)) {
              controlRef.current?.blur();
            }
          }
          resetValueState.wrappedValue = valueState.wrappedValue;
        }
      },
      [submitHandler, resetValueState, valueState],
    );

    /// Cast as input otherwise the compiler can't resolve the type below despite having identical props.
    const Component = (isMultiline ? TextArea : Input) as typeof Input;

    return (
      <Component
        ref={controlRef}
        id={id}
        className={className}
        style={style}
        value={value}
        placeholder={placeholder}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        disabled={!isEnabled}
        $size={size}
        $backgroundColor={prominence === "primary" ? Color.surfaceOffWhite : "transparent"}
        $isRawValue={isRawValue}
        onChange={updateValue}
        onFocus={focusHandler}
        onBlur={blurHandler}
        onKeyDown={keyDownHandler}
        data-valid={isValid}
      />
    );
  },
);
