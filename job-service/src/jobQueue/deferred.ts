export class JobDeferredError extends Error {
  retryAfterSeconds: number;
  deferUntil: Date;
  code?: string;

  constructor({
    retryAfterSeconds,
    message,
    code,
  }: {
    retryAfterSeconds: number;
    message: string;
    code?: string;
  }) {
    super(message);
    this.name = "JobDeferredError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.deferUntil = new Date(Date.now() + retryAfterSeconds * 1000);
    this.code = code;
  }
}

type RetryableEvalFailure = {
  retryable?: boolean;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
};

function parseRetryAfterHeader(response: Response) {
  const retryAfterHeader = Number(response.headers.get("Retry-After") ?? "");
  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return retryAfterHeader;
  }
  return undefined;
}

export async function getJobDeferralFromResponse(response: Response) {
  const retryAfterHeader = parseRetryAfterHeader(response);

  let responseBody: RetryableEvalFailure | undefined;
  try {
    responseBody = (await response.json()) as RetryableEvalFailure;
  } catch {
    responseBody = undefined;
  }

  const retryAfterSeconds =
    (typeof responseBody?.retryAfterSeconds === "number" && Number.isFinite(responseBody.retryAfterSeconds)
      ? responseBody.retryAfterSeconds
      : undefined) ?? retryAfterHeader;

  if (responseBody?.retryable !== true || !retryAfterSeconds || retryAfterSeconds <= 0) {
    return undefined;
  }

  return new JobDeferredError({
    retryAfterSeconds,
    message: responseBody.message ?? `Retryable downstream response (${response.status}).`,
    code: responseBody.code,
  });
}
