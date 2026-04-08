import { useCallback } from "react";

export type LinearIssuePayload = {
  title: string;
  description?: string;
};

/**
 * Returns a memoized handler that opens a prefilled Linear issue in a new window.
 */
export function useOpenLinearIssue() {
  return useCallback(({ title, description }: LinearIssuePayload) => {
    if (typeof window === "undefined" || !title) return;

    const linearURL = new URL("https://linear.new");
    linearURL.searchParams.set("title", title);

    description = (description || "").replace("%url%", window.location.href);
    linearURL.searchParams.set("description", description);

    // Try to open in a popup window first with specific dimensions
    const margin = 10;
    const maxWidth = window.outerWidth - margin * 2;
    const maxHeight = window.outerHeight - margin * 2;

    // Constrain popup to be smaller than parent window with margin
    const width = Math.min(640, maxWidth);
    const height = Math.min(360, maxHeight);

    // Center relative to the current window to handle multi-monitor setups correctly
    // Round to avoid sub-pixel positioning issues on scaled displays
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const features = `width=${width},height=${height},left=${left},top=${top}`;

    const popupWindow = window.open(linearURL.toString(), "linear", features);

    // If popup was blocked or failed, fall back to opening in a new tab
    if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === "undefined") {
      window.open(linearURL.toString(), "_blank");
    }
  }, []);
}
