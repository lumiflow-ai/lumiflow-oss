import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from "react";

function resolveInitialValue<T>(valueOrFunction: T | (() => T)): T {
  if (valueOrFunction instanceof Function) return valueOrFunction();
  return valueOrFunction;
}

function resolveUpdate<T>(valueOrFunction: SetStateAction<T>, oldValue: T): T {
  if (valueOrFunction instanceof Function) return valueOrFunction(oldValue);
  return valueOrFunction;
}

function resolveCurrentValue<T>(currentLocalValue: string | null, initialValue: T | (() => T)): T {
  try {
    if (!currentLocalValue) return resolveInitialValue(initialValue);
    return JSON.parse(currentLocalValue ?? "null");
  } catch {
    return resolveInitialValue(initialValue);
  }
}

/**
 * Use local storage as state.
 *
 * Derived from https://stackoverflow.com/a/73648393.
 */
export default function useLocalStorage<T>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const currentLocalValue = localStorage.getItem(key);
  const state = useMemo(() => resolveCurrentValue(currentLocalValue, initialValue), [currentLocalValue, initialValue]);

  const [_, setInternalState] = useState<T>(state);

  const setState = useCallback(
    (value: SetStateAction<T>) => {
      const oldValue = resolveCurrentValue(localStorage.getItem(key), initialValue);
      const newValue = resolveUpdate(value, oldValue);
      localStorage.setItem(key, JSON.stringify(newValue));
      setInternalState(newValue);
    },
    [key, initialValue],
  );

  return [state, setState];
}
