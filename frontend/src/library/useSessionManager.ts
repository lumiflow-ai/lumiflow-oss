import { useCallback, useMemo } from "react";

// MARK: - Global State

const receivingChannel = new BroadcastChannel("sessionChannel");
const sendingChannel = new BroadcastChannel("sessionChannel");
const logoutHandlers = new Map<number, () => void>();
let nextID = 0;

receivingChannel.addEventListener("message", (event) => {
  const { data } = event;
  if (!data) return;
  if (!("kind" in data)) return;
  if (data.kind === "logout") {
    for (const [_, handler] of logoutHandlers) {
      handler();
    }
  }
});

// MARK: - useSessionManager() Hook

export function useSessionManager() {
  const registerLogoutHandler = useCallback((handler: () => void) => {
    const id = nextID;
    nextID += 1;
    logoutHandlers.set(id, handler);
    return () => {
      logoutHandlers.delete(id);
    };
  }, []);

  const logSessionOut = useCallback(() => {
    sendingChannel.postMessage({ kind: "logout" });
  }, []);

  return useMemo(() => ({ registerLogoutHandler, logSessionOut }), [registerLogoutHandler, logSessionOut]);
}
