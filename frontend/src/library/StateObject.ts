import { type Dispatch, type SetStateAction, useCallback, useLayoutEffect, useRef, useState } from "react";

let stateIDCounter = 0;

/**
 An object that provides a bidirectional binding between a parent and any number of deeply nested child components.

 Create a StateObject by using the `useStateObject()` hook.
 */
export class StateObject<T> {
  private _wrappedValue: T;
  private listeners: Set<(oldValue: T, newValue: T) => void>;

  id: number;

  /**
    Please use `useStateObject()` instead.
    @package
   */
  constructor(initialValueOrFunction: T | (() => T)) {
    if (initialValueOrFunction instanceof Function) {
      this._wrappedValue = initialValueOrFunction();
    } else {
      this._wrappedValue = initialValueOrFunction;
    }
    this.listeners = new Set();
    this.id = stateIDCounter;
    stateIDCounter += 1;
  }

  /** Access the current value wrapped by the state object. */
  public get wrappedValue() {
    return this._wrappedValue;
  }

  /** Set a new value for the state object. The parent will be re-rendered along-side any children that are bound to the state object using `useBinding()` */
  public set wrappedValue(newValue: T) {
    const oldValue = this._wrappedValue;
    if (oldValue === newValue) return;

    for (const listener of this.listeners) {
      listener(oldValue, newValue);
    }

    this._wrappedValue = newValue;
  }

  updateValueSilently(newValue: T, listenerToSkip: (oldValue: T, newValue: T) => void) {
    const oldValue = this._wrappedValue;
    if (oldValue === newValue) return;

    for (const listener of this.listeners) {
      if (listener === listenerToSkip) continue;
      listener(oldValue, newValue);
    }

    this._wrappedValue = newValue;
  }

  /**
    Internally used to register listeners used by bindings.
    @package
   */
  registerListener(listener: (oldValue: T, newValue: T) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
  Bind a component to a `StateObject`, so it will re-render whenever a new value is written to a state object by another component.

  @param stateObject The StateObject to bind the component to, or a value to use as regular state.
  @returns Returns the current value along with a setter that can optionally be used. Note the StateObject can also be used directly.
 */
export function useBinding<T>(stateObject: StateObject<T>): [T, Dispatch<SetStateAction<T>>];
export function useBinding<T>(stateObjectOrValue: StateObject<T> | T): [T, Dispatch<SetStateAction<T>>];
export function useBinding<T>(
  stateObjectOrValue: StateObject<T> | undefined,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>];
export function useBinding<T>(
  stateObjectOrValue: StateObject<T> | T | undefined,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
  const [getter, setLocalState] = useState(
    stateObjectOrValue instanceof StateObject ? stateObjectOrValue?.wrappedValue : stateObjectOrValue,
  );
  const optionalStateObject = stateObjectOrValue instanceof StateObject ? stateObjectOrValue : undefined;

  useLayoutEffect(
    () => optionalStateObject?.registerListener((_, newValue) => setLocalState(newValue)),
    [optionalStateObject],
  );

  const optionalConstantValue = stateObjectOrValue instanceof StateObject ? undefined : stateObjectOrValue;
  useLayoutEffect(() => {
    if (optionalConstantValue !== undefined) setLocalState(optionalConstantValue);
  }, [optionalConstantValue]);

  const setter = useCallback(
    (valueOrFunction: SetStateAction<T | undefined>) => {
      if (!optionalStateObject) {
        setLocalState(valueOrFunction);
        return;
      }
      if (valueOrFunction instanceof Function) {
        optionalStateObject.wrappedValue = valueOrFunction(optionalStateObject.wrappedValue) as T;
        return;
      }
      optionalStateObject.wrappedValue = valueOrFunction as T;
    },
    [optionalStateObject],
  );

  return [getter, setter];
}

/**
  Bind a component to a `StateObject`, so it will re-render whenever a new value that matches the selector is written to a state object by another component.

  @param stateObject The StateObject to bind the component to.
  @param selector A selector to use to determine if the component should be rendered when the state object is updated. The last selector received by the component is retained, so be mindful of what it captures.
  @returns A boolean indicating the current value of the state object at render time as processed by the selector.
 */
export function useBindingSelector<T>(stateObject: StateObject<T>, selector: (newValue: T) => boolean): boolean {
  // Use a ref for the selector so we always keep a reference to the last one used, and don't update the effect when it changes.
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [localState, setLocalState] = useState(selector(stateObject.wrappedValue));
  useLayoutEffect(
    () => stateObject.registerListener((_, newValue) => setLocalState(selectorRef.current(newValue))),
    [stateObject],
    // TODO: might need to set local state manually in cases where the state object itself changes?
  );
  return localState;
}

/**
  Create a new state object in a parent component.

  State objects are stable references that can cause either child or parent components to re-render when values are changed. Changes to the state object's wrappedValue will re-render both the parent along with any chile components also bound to it.

  @param initialValue The initial value of the state object.
  @returns A stable state object bound to the component.
 */
export function useStateObject<T>(initialValue: T | (() => T)): StateObject<T> {
  const [stateObject] = useState(() => new StateObject(initialValue));

  useBinding(stateObject);

  return stateObject;
}

/**
  Create a derived state object with a transformation.

  Note that the transformation methods _should not_ depend on other dependencies — they will not be updated after the hook is installed. If they do, you must specify the list of dependencies as an optional third parameter.

  @param stateObject The state object to derive from.
  @param transformation A set of transformations to and from the derived state.
  @param dependencies The dependencies that cause the transformations to become invalidated.
  @returns A derived state object that can be read and written to.
 */
//  biome-ignore lint/suspicious/noExplicitAny: Used for generics.
export function useDerivedState<Derived, T = any>(
  stateObject: StateObject<T>,
  transformation: { get: (existingValue: T) => Derived; set: (existingValue: T, newValue: Derived) => T },
  dependencies: unknown[] = [],
) {
  const { get, set } = transformation;
  const [derivedState] = useState(() => new StateObject(get(stateObject.wrappedValue)));

  // biome-ignore lint/correctness/useExhaustiveDependencies: Pulling in external dependencies
  useLayoutEffect(() => {
    let derivedObjectListener: (oldValue: Derived, newValue: Derived) => void;

    const stateObjectListener: (oldValue: T, newValue: T) => void = (_, newValue) => {
      derivedState.updateValueSilently(get(newValue), derivedObjectListener);
    };
    const stateObjectCleanup = stateObject.registerListener(stateObjectListener);

    derivedObjectListener = (_, newValue) => {
      stateObject.updateValueSilently(set(stateObject.wrappedValue, newValue), stateObjectListener);
    };
    const derivedObjectCleanup = derivedState.registerListener(derivedObjectListener);

    return () => {
      stateObjectCleanup();
      derivedObjectCleanup();
    };
  }, [stateObject, derivedState, ...dependencies]);

  return derivedState;
}

/**
  React to changes to a state.

  Note that the listener methods _should not_ depend on other dependencies — it will not be updated after the hook is installed. If they do, you must specify the list of dependencies as an optional third parameter.

  @param stateObject The state object to derive from.
  @param listener A listener that is called when state changes.
  @param dependencies The dependencies that cause the listener to become invalidated.
 */
export function useReactiveState<T>(
  stateObject: StateObject<T>,
  listener: (oldValue: T, newValue: T) => void,
  dependencies: unknown[],
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Pulling in external dependencies
  useLayoutEffect(() => stateObject.registerListener(listener), [stateObject, ...dependencies]);
}
