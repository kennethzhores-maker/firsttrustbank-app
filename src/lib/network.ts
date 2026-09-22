export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const err = error as {
      message?: string;
      name?: string;
      code?: string;
      status?: number;
      details?: string;
      hint?: string;
    };

    const message = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
    const code = `${err.code ?? ""}`.toLowerCase();
    const name = `${err.name ?? ""}`.toLowerCase();

    if (name.includes("abort") || name.includes("network")) return true;
    if (code === "econnreset" || code === "etimedout" || code === "enotfound") return true;
    if (typeof err.status === "number" && (err.status === 0 || err.status >= 500)) return true;

    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("fetch failed") ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("connection") ||
      message.includes("offline") ||
      message.includes("load failed")
    );
  }

  if (typeof error === "string") {
    return isNetworkError({ message: error });
  }

  return false;
}

export const CONNECTION_PROBLEM_MESSAGE =
  "Connection problem. Your account data could not be loaded. Check your internet or try a VPN, then tap Retry.";
