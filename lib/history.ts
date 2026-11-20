import { mutate, preload } from "swr";
import { API_ENDPOINTS } from "@/lib/api-config";
import { getAccessToken } from "@/lib/client-session";

export const HISTORY_PAGE_SIZE = 20;

export interface HistoryInputs {
  age?: string | number | null;
  sex?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  trestbps?: string | number | null;
  chol?: string | number | null;
  thalch?: string | number | null;
  oldpeak?: string | number | null;
  fbs?: string | number | null;
  exang?: string | number | null;
  cp?: string | null;
  restecg?: string | null;
  slope?: string | null;
  bmi?: number | null;
}

export interface HistoryItem {
  id: number;
  name_prediction: string;
  prediction_result: number;
  risk_level: string;
  timestamp: string | null;
  clinical_score?: number | null;
  probability?: number | null;
  inputs?: HistoryInputs | null;
}

export function readToken() {
  return getAccessToken();
}

export function historyKey(token: string | null, page = 0, query = "") {
  if (!token) return null;
  const params = new URLSearchParams({
    limit: String(HISTORY_PAGE_SIZE + 1),
    offset: String(page * HISTORY_PAGE_SIZE),
    q: query,
  });
  return [`${API_ENDPOINTS.historyPredictions}?${params}`, token] as const;
}

export async function fetchHistory([url, token]: readonly [string, string]): Promise<HistoryItem[]> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401
    ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    : "Không thể tải lịch sử. Vui lòng thử lại.");
  return response.json();
}

export function prefetchHistory() {
  const key = historyKey(readToken());
  if (key) void preload(key, fetchHistory).catch(() => undefined);
}

export function invalidateHistory() {
  return mutate((key) => Array.isArray(key) && typeof key[0] === "string"
    && key[0].startsWith(`${API_ENDPOINTS.historyPredictions}?`), undefined, { revalidate: true });
}
