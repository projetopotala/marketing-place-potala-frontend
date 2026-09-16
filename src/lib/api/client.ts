import { API_BASE_URL } from "./config";

/**
 * Every backend service in this project shares the same error body shape
 * (`GlobalExceptionFilter`, identical across identity-service,
 * sellers-service, catalog-service and orders-service):
 * `{ statusCode, error, message, path, timestamp }`. `message` is a plain
 * string for most errors but an array of strings for class-validator
 * failures (one entry per invalid field) — ApiError normalizes both into a
 * single displayable string, see `parseMessage` below.
 */
interface BackendErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function parseMessage(body: BackendErrorBody | null, fallback: string): string {
  if (!body?.message) return fallback;
  return Array.isArray(body.message) ? body.message.join(" ") : body.message;
}

/**
 * Thin wrapper around `fetch` for every call this frontend makes to
 * potala-api-gateway. `credentials: "include"` on every request is not
 * optional: the session is a browser-set HttpOnly cookie
 * (`SessionAuthGuard` across every service), never a token this code can
 * read or attach itself — omitting it would make every authenticated call
 * silently behave as anonymous.
 *
 * Returns `null` for a `204 No Content` response (e.g. logout) instead of
 * attempting to parse an empty body as JSON.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const hasBody = init.body !== undefined;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(hasBody ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    // Network failure (gateway unreachable, CORS misconfiguration, etc.) —
    // never let a raw TypeError from fetch reach a form's catch block.
    throw new ApiError(0, "Não foi possível conectar ao servidor. Tente novamente.");
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // A non-JSON body (e.g. an HTML error page from a misconfigured proxy
      // in front of the gateway) — fall through with body === null so the
      // status-based error path below still produces a clear ApiError
      // instead of throwing a raw SyntaxError out of this function.
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parseMessage(body as BackendErrorBody | null, "Ocorreu um erro inesperado."),
    );
  }

  return body as T;
}
