"use client";

import { getAccessToken } from "@/lib/client-session";
import { apiErrorMessage } from "@/lib/api-errors";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot, Send, User, X, MessageCircle,
  Loader2, Heart, AlertTriangle
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api-config";
import ReactMarkdown from 'react-markdown';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PredictionResult {
  prediction:     number;
  probability:    number;
  risk_level:     string;
  clinical_score: number;
}

interface Message {
  role:        "user" | "assistant";
  content:     string;
  prediction?: PredictionResult;
}

interface ChatStatus {
  is_premium: boolean;
  used_today: number;
  limit:      number | null;
  remaining:  number;
}

// ── Hàm làm sạch tin nhắn AI ──────────────────────────────────────────────────
const cleanBotMessage = (content: string) => {
  if (!content) return "";
  // Xóa bỏ chuỗi {"status":"success"} hoặc các biến thể JSON rác ở cuối
  return content.replace(/\{"status"\s*:\s*"success"\}\s*$/, "").trim();
};

// ── PredictionCard ────────────────────────────────────────────────────────────
function PredictionCard({ result }: { result: PredictionResult }) {
  const COLOR_MAP: Record<string, string> = {
    "THẤP":       "bg-emerald-50  border-emerald-200  text-emerald-800",
    "TRUNG BÌNH": "bg-amber-50 border-amber-200 text-amber-800",
    "CAO":        "bg-orange-50 border-orange-200 text-orange-800",
    "RẤT CAO":    "bg-red-50    border-red-200    text-red-800",
  };

  const currentStyle = COLOR_MAP[result.risk_level.toUpperCase()] || COLOR_MAP["THẤP"];

  return (
    <div className={`mt-3 p-4 rounded-xl border ${currentStyle} shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className="flex items-center gap-2 font-bold mb-3 text-[13px] uppercase tracking-wider opacity-90">
        <Heart className="h-4 w-4 fill-current animate-pulse" />
        <span>Đánh giá nguy cơ</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 bg-white/60 rounded-lg backdrop-blur-sm">
          <span className="text-slate-500 block mb-1">Mức độ</span>
          <span className="font-semibold text-sm">{result.risk_level}</span>
        </div>
        <div className="p-2.5 bg-white/60 rounded-lg backdrop-blur-sm">
          <span className="text-slate-500 block mb-1">Xác suất AI</span>
          <span className="font-semibold text-sm">{Math.round(result.probability * 100)}%</span>
        </div>
        <div className="p-3 bg-white/60 rounded-lg col-span-2 backdrop-blur-sm">
          <div className="flex justify-between mb-2 font-semibold">
            <span className="text-slate-600">Điểm lâm sàng:</span>
            <span>{Math.round(result.clinical_score * 100)}%</span>
          </div>
          <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-current h-full transition-all duration-1000 ease-out" 
              style={{ width: `${Math.min(100, result.clinical_score * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HeartChatbot({ latestResult, initiallyOpen = false }: { latestResult?: any; initiallyOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatStatus, setChatStatus] = useState<ChatStatus>({
    is_premium: false,
    used_today: 0,
    limit: 20,
    remaining: 20
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const isLocked = chatStatus.remaining <= 0;

  const fetchChatStatus = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) { setChatError("Vui lòng đăng nhập để sử dụng trò chuyện."); return; }
      const res = await fetch(API_ENDPOINTS.CHAT_STATUS || "/api/user/chat-status", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) { setChatError(await apiErrorMessage(res)); return; }
      setChatStatus(await res.json());
    } catch (error) {
      console.error("Lỗi fetchChatStatus:", error);
    }
  }, []);

  const fetchChatHistory = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) { setChatError("Vui lòng đăng nhập để sử dụng trò chuyện."); return; }
      const res = await fetch(API_ENDPOINTS.chatHistory || "/api/chatbot/history", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) { setChatError(await apiErrorMessage(res)); return; }
      setMessages(await res.json());
    } catch (error) {
      console.error("Lỗi fetchChatHistory:", error);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      fetchChatStatus();
      fetchChatHistory();
    }
  }, [isOpen, fetchChatStatus, fetchChatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isLocked) return;

    const userMsg = input.trim();
    const pendingMessage: Message = { role: "user", content: userMsg };
    setChatError("");
    setInput("");
    setMessages((prev) => [...prev, pendingMessage]);
    setIsLoading(true);

    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("Vui lòng đăng nhập để sử dụng trò chuyện.");
      }

      const response = await fetch(API_ENDPOINTS.CHATBOT || "/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg, latest_result: latestResult }),
        signal: AbortSignal.timeout(75000),
      });

      if (!response.ok) throw new Error(await apiErrorMessage(response));

      const data = await response.json();
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("Dịch vụ AI trả về phản hồi trống. Vui lòng thử lại.");
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          prediction: data.prediction || undefined,
        },
      ]);
      await fetchChatStatus();
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message !== pendingMessage));
      setInput(userMsg);
      setChatError(err instanceof Error && err.name === "TimeoutError"
        ? "Yêu cầu quá thời gian chờ. Câu hỏi đã được giữ lại để bạn thử gửi lại."
        : err instanceof TypeError ? "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại."
        : err instanceof Error ? err.message : "Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans">
      {isOpen && (
        <Card className="w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100dvh-7rem))] flex flex-col shadow-sm border-0 ring-1 ring-slate-200/50 animate-in slide-in-from-bottom-6 duration-300 rounded-2xl overflow-hidden mb-4">
          
          {/* Header */}
          <CardHeader className="bg-primary text-white p-4 flex flex-row items-center justify-between space-y-0 shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full backdrop-blur-md border border-white/20 shadow-inner relative">
                <Bot className="h-5 w-5 text-white" />

              </div>
              <div>
                <CardTitle className="text-base font-bold tracking-wide">Trợ lý sức khỏe</CardTitle>
                <p className="text-[11px] text-sky-100 font-medium mt-0.5 opacity-90">
                  {chatStatus.remaining > 0 ? `Còn ${chatStatus.remaining} lượt tư vấn/giờ` : "Đang quá tải"}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              aria-label="Đóng trò chuyện"
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full h-8 w-8 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Nội dung khung Chat */}
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 bg-slate-50 space-y-5 scrollbar-thin scrollbar-thumb-slate-200">
            {chatError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {chatError}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in duration-700">
                <div className="h-16 w-16 rounded-full bg-sky-100/50 flex items-center justify-center border-4 border-white shadow-sm mb-4">
                  <Heart className="h-7 w-7 text-sky-500 fill-sky-500/20" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Bạn cần hỗ trợ thông tin gì?</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[260px]">
                  Bạn có thể hỏi về các chỉ số trong biểu mẫu hoặc kết quả đánh giá. Phản hồi được tạo tự động và chỉ mang tính tham khảo.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex gap-3 max-w-[88%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === "user" 
                      ? "bg-slate-800 text-white" 
                      : "bg-white border border-sky-100 text-sky-500"
                  }`}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  
                  <div className="space-y-1.5 flex-1">
                    <div className={`px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-slate-800 text-white rounded-tr-sm"
                        : "bg-white text-slate-700 border border-slate-100/80 rounded-tl-sm"
                    }`}>
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        // Render Markdown chuẩn chỉnh nhờ plugin typography
                        <div className="prose prose-sm prose-slate max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 marker:text-sky-400">
                          <ReactMarkdown>{cleanBotMessage(msg.content)}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.prediction && <PredictionCard result={msg.prediction} />}
                  </div>
                </div>
              ))
            )}

            {/* Typing Indicator hiện đại */}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto items-center animate-in fade-in duration-300">
                <div className="h-8 w-8 rounded-full bg-white border border-sky-100 text-sky-500 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-1.5 w-1.5 bg-sky-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}

            {isLocked && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 animate-in fade-in duration-300 mx-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Đã hết lượt chat!</span> Giới hạn tạm thời là {chatStatus.limit} tin nhắn/giờ. Hãy quay lại sau ít phút nhé.
                </div>
              </div>
            )}
            <div ref={chatEndRef} className="h-1" />
          </CardContent>

          {/* Ô nhập tin nhắn */}
          <div className="p-3 bg-white border-t border-slate-100 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] z-10">
            <form onSubmit={handleSubmit} className="flex gap-2 items-end relative">
              <Input
                type="text"
                maxLength={4000}
                placeholder={isLocked ? "Đã khóa tạm thời..." : "Nhập câu hỏi tại đây..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading || isLocked}
                className={`flex-1 min-h-[44px] rounded-full pl-4 pr-12 text-sm focus-visible:ring-sky-500 focus-visible:ring-offset-0 ${
                  isLocked ? "bg-red-50/50 text-red-400 border-red-100" : "bg-slate-50 border-slate-200"
                }`}
              />
              <Button 
                type="submit" 
                size="icon" 
                aria-label="Gửi tin nhắn"
                disabled={isLoading || isLocked || !input.trim()}
                className={`absolute right-1 bottom-1 h-9 w-9 rounded-full transition-all ${
                  input.trim() ? "bg-sky-500 hover:bg-sky-600 text-white shadow-md" : "bg-slate-200 text-slate-400"
                }`}
              >
                <Send className="h-4 w-4 ml-0.5" />
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Nút Tròn Kích Hoạt Chatbot */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Thu gọn trợ lý" : "Mở trò chuyện"}
        aria-expanded={isOpen}
        className={`ml-auto flex h-14 w-14 rounded-full shadow-sm transition-colors ${
          isOpen ? "bg-slate-800 hover:bg-slate-700" : "bg-primary hover:bg-primary/90"
        }`}
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
      </Button>
    </div>
  );
}
