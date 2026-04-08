import { type StateObject, useReactiveState, useStateObject } from "@/library/StateObject";
import useLocalStorage from "@/library/useLocalStorage";

/**
 * Use local storage as a state object.
 */
export default function useLocalStorageStateObject<T>(key: string, initialValue: T | (() => T)): StateObject<T> {
  const [localState, setLocalState] = useLocalStorage(key, initialValue);
  const stateObject = useStateObject(localState);

  useReactiveState(
    stateObject,
    (_, newValue) => {
      setLocalState(newValue);
    },
    [setLocalState],
  );

  return stateObject;
}
