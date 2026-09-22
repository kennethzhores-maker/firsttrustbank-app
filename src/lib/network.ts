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

    // Real browser/network failures only — do not match generic words like "connection".
    if (name === "typeerror" && message.includes("fetch")) return true;
    if (name.includes("abort")) return true;
    if (code === "econnreset" || code === "etimedout" || code === "enotfound") return true;

    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("fetch failed") ||
      message.includes("request timed out") ||
      message.includes("load failed") ||
      message.includes("err_network") ||
      message.includes("err_connection")
    );
  }

  if (typeof error === "string") {
    return isNetworkError({ message: error });
  }

  return false;
}

export function formatAuthError(error: unknown): string {
  if (isNetworkError(error)) {
    return "Could not reach the login server. Please try again in a moment.";
  }

  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();
    if (message.includes("invalid login") || message.includes("invalid credentials")) {
      return "Invalid email or password.";
    }
    if (message.includes("email not confirmed")) {
      return "This email is not confirmed yet. Ask your admin to confirm the account.";
    }
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    return formatAuthError(new Error(String((error as { message: unknown }).message)));
  }

  return "Login failed. Please try again.";
}

export const CONNECTION_PROBLEM_MESSAGE =
  "Live connection interrupted. Showing your last saved account details — tap Retry to refresh.";
