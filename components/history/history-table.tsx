"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Heart, Loader2, AlertTriangle, RefreshCw, 
  Search, Calendar, Activity, CheckCircle2
} from "lucide-react";

import useSWR, { preload } from "swr";
import { fetchHistory, historyKey, readToken, HISTORY_PAGE_SIZE } from "@/lib/history";

export function HistoryTable() {
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { setToken(readToken()); setAuthReady(true); }, []);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(searchTerm.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, error: fetchError, isLoading: loading, isValidating, mutate } = useSWR(
    historyKey(token, page, query), fetchHistory,
    { dedupingInterval: 5000, revalidateOnFocus: true, shouldRetryOnError: false },
  );
  const isLoading = !authReady || loading;
  const error = authReady && !token ? "Vui lòng đăng nhập để xem lịch sử chẩn đoán." : fetchError?.message;
  const filteredHistory = (data || []).slice(0, HISTORY_PAGE_SIZE);
  const hasNext = (data?.length || 0) > HISTORY_PAGE_SIZE;
  const prefetchNext = () => {
    const key = historyKey(token, page + 1, query);
    if (hasNext && key) void preload(key, fetchHistory).catch(() => undefined);
  };

  const getRiskStyles = (level: string) => {
    switch (level?.toUpperCase()) {
      case "THẤP": return "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm";
      case "TRUNG BÌNH": return "bg-amber-50 text-amber-700 border-amber-200 shadow-sm";
      case "CAO": return "bg-orange-50 text-orange-700 border-orange-200 shadow-sm";
      case "RẤT CAO": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Card className="border border-slate-200 rounded-lg overflow-hidden">
        <CardHeader className="border-b border-slate-200 bg-white text-slate-900 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner">
                <Heart className="h-5 w-5 text-sky-400 fill-sky-400/20" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Lịch sử đánh giá</CardTitle>
                <CardDescription className="text-slate-600 text-sm mt-1">Tra cứu các lần đánh giá bạn đã lưu vào tài khoản.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void mutate()} disabled={isValidating || !token} className="rounded-md border-slate-300 text-slate-700 bg-white hover:bg-slate-50 self-start sm:self-auto gap-2">
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} /> Tải lại dữ liệu
            </Button>
          </div>
        </CardHeader>

        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input type="search" aria-label="Tìm kiếm lịch sử" maxLength={100} placeholder="Tìm tên bản ghi, mức độ nguy cơ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-xl border-slate-200 bg-white focus-visible:ring-sky-500 text-sm" />
          </div>
        </div>

        <CardContent className="p-0 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-2" />
              <p className="text-xs">Đang tải lịch sử...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-700 bg-red-50 m-4 rounded-xl border border-sky-100 text-xs flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">Chưa có kết quả phù hợp. Bạn có thể lưu kết quả từ trang Đánh giá nguy cơ.</p>
            </div>
          ) : (
            <>
            <ul className="divide-y divide-slate-200 md:hidden" aria-label="Lịch sử đánh giá nguy cơ">
              {filteredHistory.map((item) => <li key={item.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-sm font-semibold text-slate-900">{item.name_prediction || "Đánh giá định kỳ"}</h3>
                  <span className="shrink-0 text-xs text-slate-500">#HG-{item.id}</span>
                </div>
                <p className="text-xs text-slate-500">{item.timestamp ? new Date(item.timestamp).toLocaleString("vi-VN") : "Chưa có thời gian"}</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-slate-600">Mức nguy cơ</dt><dd className={`rounded border px-2 py-1 text-xs font-semibold ${getRiskStyles(item.risk_level)}`}>{item.risk_level || "Chưa xác định"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phân loại mô hình</dt><dd className="mt-1 text-slate-700">{item.prediction_result === 1 ? "Phát hiện bất thường" : "Không phát hiện nguy cơ"}</dd></div>
                </dl>
              </li>)}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table aria-label="Lịch sử đánh giá nguy cơ" className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                    <th className="px-6 py-3.5">Mã số</th>
                    <th className="px-6 py-3.5">Tên lần đánh giá</th>
                    <th className="px-6 py-3.5">Thời gian</th>
                    <th className="px-6 py-3.5">Phân loại mô hình</th>
                    <th className="px-6 py-3.5">Mức Nguy Cơ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">#HG-{item.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{item.name_prediction || "Đánh giá định kỳ"}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{item.timestamp ? new Date(item.timestamp).toLocaleString("vi-VN") : "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.prediction_result === 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200">
                            <Activity className="h-3.5 w-3.5" /> Phát hiện bất thường
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Không phát hiện nguy cơ
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border uppercase ${getRiskStyles(item.risk_level)}`}>
                          {item.risk_level || "Chưa xác định"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
        <div className="flex items-center justify-between gap-2 p-3 border-t sm:gap-4 sm:p-4">
          <Button size="sm" variant="outline" disabled={page === 0 || isLoading} onClick={() => setPage(page - 1)}>Trang trước</Button>
          <span className="text-sm text-slate-500" aria-live="polite">Trang {page + 1}</span>
          <Button size="sm" variant="outline" disabled={!hasNext || isLoading} onMouseEnter={prefetchNext} onFocus={prefetchNext} onClick={() => setPage(page + 1)}>Trang sau</Button>
        </div>
      </Card>
    </div>
  );
}
