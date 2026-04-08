export const MAX_BACKEND_REQUEST_BODY_LIMIT_BYTES = 50 * 1024 * 1024;

/**
 * Parses an Express body-parser size limit string into bytes and enforces a max.
 */
export function parseRequestBodyLimit(limit: string): number {
  const normalizedLimit = limit.trim().toLowerCase();

  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
  } as const;

  let limitInBytes: number | undefined;

  if (/^\d+$/.test(normalizedLimit)) {
    limitInBytes = Number(normalizedLimit);
  } else {
    const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/.exec(normalizedLimit);
    if (match) {
      limitInBytes = Number(match[1]) * units[match[2] as keyof typeof units];
    }
  }

  if (typeof limitInBytes !== "number" || !Number.isSafeInteger(limitInBytes) || limitInBytes <= 0) {
    throw new Error(
      `Invalid value for BACKEND_REQUEST_BODY_LIMIT: "${limit}". Expected a positive byte size like "10mb".`,
    );
  }

  if (limitInBytes > MAX_BACKEND_REQUEST_BODY_LIMIT_BYTES) {
    throw new Error(
      `Invalid value for BACKEND_REQUEST_BODY_LIMIT: "${limit}". Maximum allowed is ${MAX_BACKEND_REQUEST_BODY_LIMIT_BYTES} bytes (50mb).`,
    );
  }

  return limitInBytes;
}
