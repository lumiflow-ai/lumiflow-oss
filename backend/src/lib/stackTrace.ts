export type StackTrace = {
  errorName: string;
  frames: string[];
};

/** Capture the current stack trace, ignoring all functions that appear after the specified `frameCap` function. */
export function captureStackTrace(
  frameCap: Parameters<ErrorConstructor["captureStackTrace"]>[1] = captureStackTrace,
): StackTrace {
  const trace = { stack: "" };
  Error.captureStackTrace(trace, frameCap);
  const frames = trace.stack.split("\n");
  const errorName = frames.shift() ?? "";
  return { errorName, frames };
}

/** Parse the stack trace from a given error. */
export function stackTraceFromError(error: Error): StackTrace {
  const errorName = error.toString();
  const frames = error.stack?.replace(`${errorName}\n`, "").split("\n") ?? [];
  return { errorName, frames };
}

/** Assemble a stack trace into a string suitable for display within an Error. */
export function assembleStackTrace(stackTrace: StackTrace): string {
  return [stackTrace.errorName].concat(stackTrace.frames).join("\n");
}

/** Replaces the stack trace of an error with the provided stack trace's frames. */
export function replaceErrorStackTrace({ error, stackTrace }: { error: Error; stackTrace: StackTrace }) {
  const errorStackTrace = stackTraceFromError(error);
  error.stack = [
    /// Set the first group of stack frames based on where the error occurred from the test.
    assembleStackTrace({ errorName: errorStackTrace.errorName, frames: stackTrace.frames }),
    /// Special syntax so vitest can render the separation:
    `    at ---------------------\t\t\t (${__filename}:0:0)`,
    `    at Internal Stack Trace:\t\t\t (${__filename}:0:0)`,
    `    at ---------------------\t\t\t (${__filename}:0:0)`,
    /// Also include the original stack trace in case that is useful for fixing tests.
    assembleStackTrace({ errorName: "Internal Stack Trace:", frames: errorStackTrace.frames }),
  ].join("\n");
}

/** Calls the given closure, and replace the stack trace if the closure throws when called. */
export function withStackTraceReplacementOnThrow<T>(stackTrace: StackTrace, closure: () => T): T {
  try {
    return closure();
  } catch (error) {
    if (error instanceof Error) {
      replaceErrorStackTrace({ error, stackTrace });
    }
    throw error;
  }
}
