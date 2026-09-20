// Browser session for FastAPI. Server-side cookie auth lives in lib/auth.ts.
function usableToken(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value
    && value.split(".").length === 3 && value.split(".").every(Boolean);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  const token = storage.getItem("token");
  if (usableToken(token)) return token;
  const legacyToken = storage.getItem("access_token");
  return usableToken(legacyToken) ? legacyToken : null;
}

export function saveSession(accessToken: unknown, username: string): void {
  if (!usableToken(accessToken)) {
    throw new Error("Máy chủ không trả về token đăng nhập hợp lệ. Vui lòng thử lại.");
  }
  window.localStorage.setItem("token", accessToken);
  window.localStorage.setItem("username", username);
  window.localStorage.removeItem("access_token");
}

export function clearSession(): void {
  for (const key of ["token", "access_token", "username", "email", "phone"]) {
    window.localStorage.removeItem(key);
  }
}
