import type { ZodType } from "zod";

export async function fetchService<Response, Request>({
  payload,
  endpoint,
  responseSchema,
}: {
  payload: Request;
  endpoint: string;
  responseSchema?: ZodType<Response>;
}): Promise<Response> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (responseSchema) {
    const data = await response.json();
    return responseSchema.parse(data);
  }
  return response.json() as Response;
}
