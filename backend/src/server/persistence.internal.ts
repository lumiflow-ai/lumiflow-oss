import type pg from "pg";
import { assert, expect } from "vitest";

import type { IsolationLevel, TransactionMode } from "@/server/persistence";

import { captureStackTrace, type StackTrace, withStackTraceReplacementOnThrow } from "@/lib/stackTrace";

interface ClientPersistenceTester {
  expectQuery(expectation: QueryExpectation["handler"], stackTrace?: StackTrace): this;
  expectTransaction(
    handler?: ClientPersistenceTester | ((transactionTester: ClientPersistenceTester) => void),
    stackTrace?: StackTrace,
  ): this;

  expectTransactionBegin(
    { mode, isolation }: { mode?: TransactionMode; isolation?: IsolationLevel },
    stackTrace?: StackTrace,
  ): this;
  expectTransactionCommit(stackTrace?: StackTrace): this;
}

type QueryExpectation = {
  kind: "query";
  // biome-ignore lint/suspicious/noConfusingVoidType: We intentionally want to allow the caller to not need to think about returning anything.
  handler: (query: pg.QueryConfig) => Partial<pg.QueryResult<pg.QueryResultRow>> | void;
  stackTrace: StackTrace;
};

type ConnectExpectation = {
  kind: "connect";
  stackTrace: StackTrace;
};

type ReleaseExpectation = {
  kind: "release";
  error: Error | boolean | undefined;
  stackTrace: StackTrace;
};

type Expectation = QueryExpectation | ConnectExpectation | ReleaseExpectation;

/** Normalize a query by removing extraneous white-space and ensuring a single trailing semi-colon. */
export function normalizeQueryText(text: string) {
  return `${text
    .replace(/\s\s+/g, " ")
    .replace(/(;\s?)+$/, "")
    .trim()};`;
}

function failTests(message: string, stackTrace: StackTrace): never {
  withStackTraceReplacementOnThrow(stackTrace, () => {
    assert.fail(message);
  });
  assert.fail("Shouldn't get here!");
}

/** Expect query text to match the given query text, ignoring white-space. */
export function expectQueryText(text: string): {
  /** Expect query text to match the given query text, ignoring white-space. */
  toMatch: (text: string) => void;
} {
  const toMatch = (matchText: string, stackTrace: StackTrace = captureStackTrace(toMatch)) => {
    withStackTraceReplacementOnThrow(stackTrace, () => {
      expect(normalizeQueryText(text)).toEqual(normalizeQueryText(matchText));
    });
  };
  return { toMatch };
}

function fakePool(tester: PersistenceTester): pg.Pool {
  const query = async (
    textOrConfig: string | pg.QueryConfig,
    values?: pg.QueryConfigValues<unknown>,
  ): Promise<pg.QueryResult<pg.QueryResultRow>> => {
    const nextExpectation = tester.expectations.shift();
    const config: pg.QueryConfig =
      typeof textOrConfig === "string"
        ? {
            text: textOrConfig,
            values,
          }
        : { values, ...textOrConfig };

    if (!nextExpectation) {
      failTests(
        `A DB query was unexpectedly performed. Add \`.expectQuery(…)\` if this was expected.\n\nQuery: ${JSON.stringify(config, undefined, 2)}`,
        tester.lastStackTrace,
      );
    }
    if (nextExpectation.kind !== "query") {
      failTests(
        `A DB query was performed when a ${nextExpectation.kind} was expected. Add \`.expectQuery(…)\` before this expectation if it was expected.\n\nQuery: ${JSON.stringify(config, undefined, 2)}`,
        nextExpectation.stackTrace,
      );
    }

    return nextExpectation.handler(config) as pg.QueryResult<pg.QueryResultRow>;
  };

  const release = (error?: Error | boolean): void => {
    const nextExpectation = tester.expectations.shift();
    withStackTraceReplacementOnThrow(nextExpectation?.stackTrace ?? tester.lastStackTrace, () => {
      if (!nextExpectation) {
        assert.fail("A PG client was unexpectedly released. Add `.expectRelease()` if this was expected.");
      }
      if (nextExpectation.kind !== "release") {
        assert.fail(
          `A PG client was released when a ${nextExpectation.kind} was expected. Add \`.expectRelease()\` before this expectation if it was expected.`,
        );
      }

      if (nextExpectation.error !== undefined) expect(error).toEqual(nextExpectation.error);
    });
  };

  const connect = async (): Promise<pg.PoolClient> => {
    const nextExpectation = tester.expectations.shift();
    return withStackTraceReplacementOnThrow(nextExpectation?.stackTrace ?? tester.lastStackTrace, () => {
      if (!nextExpectation) {
        assert.fail(
          "A PG client was unexpectedly requested. Add `.expectClient(fakeClient)` or `.expectConnect().expectRelease()` if this was expected.",
        );
      }
      if (nextExpectation.kind !== "connect") {
        assert.fail(
          `A PG client was requested when a ${nextExpectation.kind} was expected. Add \`.expectClient(fakeClient)\` or \`.expectConnect()\` before this expectation if it was expected.`,
        );
      }

      return {
        query,
        release,
      } as pg.PoolClient;
    });
  };

  return {
    connect,
    query,
  } as pg.Pool;
}

class ProxyPersistenceTester implements ClientPersistenceTester {
  expectations: Expectation[] = [];

  expectQuery(
    expectation: QueryExpectation["handler"],
    stackTrace: StackTrace = captureStackTrace(this.expectQuery),
  ): this {
    const newTester = new ProxyPersistenceTester() as this;
    newTester.expectations = Array.from(this.expectations);
    newTester.expectations.push({ kind: "query", handler: expectation, stackTrace });
    return newTester;
  }

  expectTransaction(
    handler: ProxyPersistenceTester | ((transactionTester: ClientPersistenceTester) => void) = fakeClient,
    stackTrace: StackTrace = captureStackTrace(this.expectTransaction),
  ): this {
    let newTester = new ProxyPersistenceTester() as this;
    newTester.expectations = Array.from(this.expectations);
    newTester = newTester.expectTransactionBegin({ mode: "readWrite", isolation: "serializable" }, stackTrace);
    if (handler instanceof ProxyPersistenceTester) {
      for (const expectation of handler.expectations) {
        newTester.expectations.push(expectation);
      }
    } else {
      handler(newTester);
    }
    newTester = newTester.expectTransactionCommit(stackTrace);
    return newTester;
  }

  expectTransactionBegin(
    { mode, isolation }: { mode?: TransactionMode; isolation?: IsolationLevel } = {},
    stackTrace: StackTrace = captureStackTrace(this.expectTransactionBegin),
  ): this {
    return this.expectQuery(({ text, values }) => {
      const transactionMode = (() => {
        switch (mode) {
          case "readOnly":
            return "TRANSACTION READ ONLY";
          case "readWrite":
            return "";
          default:
            throw new Error(`Unknown transaction mode: ${mode}`);
        }
      })();
      const isolationLevel = (() => {
        switch (isolation) {
          case "serializable":
            return "ISOLATION LEVEL SERIALIZABLE";
          case "repeatableRead":
            return "ISOLATION LEVEL REPEATABLE READ";
          case "readCommitted":
            return "";
          default:
            throw new Error(`Unknown isolation level: ${isolation}`);
        }
      })();
      expectQueryText(text).toMatch(`BEGIN ${transactionMode} ${isolationLevel}`);
      expect(values?.length).toEqual(undefined);
    }, stackTrace);
  }

  expectTransactionCommit(stackTrace: StackTrace = captureStackTrace(this.expectTransactionCommit)): this {
    return this.expectQuery(({ text, values }) => {
      expectQueryText(text).toMatch("COMMIT");
      expect(values?.length).toEqual(undefined);
    }, stackTrace);
  }
}

class PersistenceTester<Result = unknown> implements Promise<Result>, ClientPersistenceTester {
  lastStackTrace: StackTrace;
  handlerResult: Promise<Result>;
  expectations: Expectation[] = [];

  constructor(handler: (pgPool: pg.Pool) => Promise<Result>, testStackTrace: StackTrace) {
    this.lastStackTrace = testStackTrace;
    this.handlerResult = (async () => {
      /// Wait until expectations have a chance to load.
      await new Promise<void>((resolve) => resolve());

      /// Kick off the handler with a fake pool.
      const result = await handler(fakePool(this));

      /// Make sure no expectations are left.
      if (this.expectations.length !== 0) {
        failTests(
          `${this.expectations.length} unhandled expectation${this.expectations.length === 1 ? "" : "s"} remained when faking the persistence.`,
          this.expectations[0].stackTrace,
        );
      }
      return result;
    })();
  }

  // MARK: Expectations

  expectClient(
    handler: ProxyPersistenceTester | ((clientTester: ClientPersistenceTester) => void) = fakeClient,
    stackTrace: StackTrace = captureStackTrace(this.expectClient),
  ): this {
    /// Connect the client.
    this.expectConnect(stackTrace);

    /// Grab expectations from the proxy, or call the handler to enqueue them directly.
    if (handler instanceof ProxyPersistenceTester) {
      for (const expectation of handler.expectations) {
        this.expectations.push(expectation);
        this.lastStackTrace = expectation.stackTrace;
      }
    } else {
      handler(this);
    }

    /// Release the client.
    this.expectRelease(undefined, stackTrace);
    return this;
  }

  expectConnect(stackTrace: StackTrace = captureStackTrace(this.expectConnect)): this {
    this.expectations.push({ kind: "connect", stackTrace });
    this.lastStackTrace = stackTrace;
    return this;
  }

  expectRelease(
    error: Error | boolean | undefined = undefined,
    stackTrace: StackTrace = captureStackTrace(this.expectRelease),
  ): this {
    this.expectations.push({ kind: "release", error, stackTrace });
    this.lastStackTrace = stackTrace;
    return this;
  }

  expectQuery(
    expectation: QueryExpectation["handler"],
    stackTrace: StackTrace = captureStackTrace(this.expectQuery),
  ): this {
    this.expectations.push({ kind: "query", handler: expectation, stackTrace });
    this.lastStackTrace = stackTrace;
    return this;
  }

  expectTransaction(
    handler: ProxyPersistenceTester | ((transactionTester: ClientPersistenceTester) => void) = fakeClient,
    stackTrace: StackTrace = captureStackTrace(this.expectTransaction),
  ): this {
    this.expectTransactionBegin({ mode: "readWrite", isolation: "serializable" }, stackTrace);
    /// Grab expectations from the proxy, or call the handler to enqueue them directly
    if (handler instanceof ProxyPersistenceTester) {
      for (const expectation of handler.expectations) {
        this.expectations.push(expectation);
        this.lastStackTrace = expectation.stackTrace;
      }
    } else {
      handler(this);
    }
    this.expectTransactionCommit(stackTrace);
    return this;
  }

  expectTransactionBegin(
    { mode, isolation }: { mode?: TransactionMode; isolation?: IsolationLevel } = {},
    stackTrace: StackTrace = captureStackTrace(this.expectTransactionBegin),
  ): this {
    return this.expectQuery(({ text, values }) => {
      const transactionMode = (() => {
        switch (mode) {
          case "readOnly":
            return "TRANSACTION READ ONLY";
          case "readWrite":
            return "";
          default:
            throw new Error(`Unknown transaction mode: ${mode}`);
        }
      })();
      const isolationLevel = (() => {
        switch (isolation) {
          case "serializable":
            return "ISOLATION LEVEL SERIALIZABLE";
          case "repeatableRead":
            return "ISOLATION LEVEL REPEATABLE READ";
          case "readCommitted":
            return "";
          default:
            throw new Error(`Unknown isolation level: ${isolation}`);
        }
      })();
      expectQueryText(text).toMatch(`BEGIN ${transactionMode} ${isolationLevel}`);
      expect(values?.length).toEqual(undefined);
    }, stackTrace);
  }

  expectTransactionCommit(stackTrace: StackTrace = captureStackTrace(this.expectTransactionCommit)): this {
    return this.expectQuery(({ text, values }) => {
      expectQueryText(text).toMatch("COMMIT");
      expect(values?.length).toEqual(undefined);
    }, stackTrace);
  }

  // MARK: Promise Conformance

  // biome-ignore lint/suspicious/noThenProperty: We actually want the class to behave like a Promise
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.handlerResult.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined,
  ): Promise<Result | TResult> {
    return this.handlerResult.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<Result> {
    return this.handlerResult.finally(onfinally);
  }

  readonly [Symbol.toStringTag] = "Promise";
}

/** Test a handler using a fake persistence pool. You must `await` this call for it to perform as expected. Chain the result with `.expect…` to set the sequence of queries and connections that are expected to happen within the handler. */
export function fakePersistence<T>(
  handler: (pgPool: pg.Pool) => Promise<T>,
  stackTrace: StackTrace = captureStackTrace(fakePersistence),
): PersistenceTester<T> {
  return new PersistenceTester(handler, stackTrace);
}

/** A stand-in for a fakeClient that can be used within `.expectClient(fakeClient)` and `.expectTransaction(fakeClient)` for chaining further expectations. */
export const fakeClient = new ProxyPersistenceTester();
