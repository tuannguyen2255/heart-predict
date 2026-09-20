interface ValidationIssue {
  loc?: Array<string | number>;
  msg?: string;
}

const fieldNames: Record<string, string> = {
  age: "Tuổi",
  sex: "Giới tính",
  height: "Chiều cao",
  weight: "Cân nặng",
  trestbps: "Huyết áp nghỉ",
  chol: "Cholesterol",
  thalch: "Nhịp tim tối đa",
  oldpeak: "Oldpeak",
  fbs: "Đường huyết lúc đói",
  exang: "Đau thắt ngực khi vận động",
};

export function formatApiDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;
  const messages = detail.flatMap((issue: ValidationIssue) => {
    if (!issue || typeof issue !== "object" || typeof issue.msg !== "string") return [];
    const rawField = issue.loc?.at(-1);
    const field = typeof rawField === "string" ? (fieldNames[rawField] || rawField) : "Dữ liệu";
    return [`${field}: ${issue.msg}`];
  });
  return messages.length ? messages.join("; ") : null;
}

export async function apiErrorMessage(response: Response): Promise<string> {
  if (response.status === 401) return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
  const fallback: Record<number, string> = {
    429: "Bạn đã hết lượt tư vấn. Vui lòng thử lại sau.",
    502: "Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.",
    503: "Dịch vụ AI đang bận hoặc chưa sẵn sàng. Vui lòng thử lại sau.",
    504: "AI phản hồi quá lâu. Vui lòng thử gửi lại câu hỏi.",
  };
  // Proxies may return HTML for 504, so JSON decoding must not hide the status.
  const body = await response.json().catch(() => null);
  return formatApiDetail(body?.detail)
    || fallback[response.status]
    || `Không thể hoàn thành yêu cầu (HTTP ${response.status}).`;
}
