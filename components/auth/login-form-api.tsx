"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { API_ENDPOINTS, CURRENT_TERMS_VERSION } from "@/lib/api-config";
import { clearSession, saveSession } from "@/lib/client-session";
import { Heart, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";

export function LoginFormAPI() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingVersion, setPendingVersion] = useState<string>(CURRENT_TERMS_VERSION);
  const [reacceptChecked, setReacceptChecked] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const body = new URLSearchParams();
      body.append("username", formData.username);
      body.append("password", formData.password);

      const response = await fetch(API_ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Đăng nhập thất bại");
      }

      if (data.needs_terms_reaccept) {
        setPendingToken(data.access_token);
        setPendingVersion(data.current_terms_version || CURRENT_TERMS_VERSION);
        setReacceptChecked(false);
        return;
      }

      saveSession(data.access_token, formData.username);

      router.push("/diagnosis");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReacceptTerms = async () => {
    if (!pendingToken || !reacceptChecked) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(API_ENDPOINTS.acceptTerms, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({
          terms_version: pendingVersion,
          age_confirmed: true,
          research_consent: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Không thể ghi nhận xác nhận điều khoản.");
      }
      saveSession(pendingToken, formData.username);
      router.push("/diagnosis");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể ghi nhận xác nhận điều khoản.");
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingToken) {
    return (
      <Card className="w-full border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/10">
        <CardHeader className="px-7 pb-4 pt-8 text-left sm:px-9">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-semibold text-slate-950">
            Cập nhật Điều khoản ({pendingVersion})
          </CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6">
            Điều khoản sử dụng và chính sách dữ liệu đã được cập nhật. Vui lòng đọc và xác nhận lại để tiếp tục.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-7 sm:px-9">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700">
            <input
              type="checkbox"
              checked={reacceptChecked}
              onChange={(e) => setReacceptChecked(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
            />
            <span>
              Tôi xác nhận từ đủ 18 tuổi, đã đọc và đồng ý{" "}
              <Link href="/terms#terms" target="_blank" className="font-semibold text-sky-700 underline">
                Điều khoản sử dụng
              </Link>{" "}
              &amp;{" "}
              <Link href="/terms#privacy" target="_blank" className="font-semibold text-sky-700 underline">
                Chính sách dữ liệu
              </Link>{" "}
              ({pendingVersion}), và hiểu hệ thống không thay thế bác sĩ.
            </span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 px-7 pb-8 sm:px-9">
          <Button
            type="button"
            className="h-11 w-full"
            disabled={isLoading || !reacceptChecked}
            onClick={handleReacceptTerms}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Xác nhận và tiếp tục
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-slate-500"
            disabled={isLoading}
            onClick={() => {
              clearSession();
              setPendingToken(null);
            }}
          >
            Hủy đăng nhập
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/10">
      <CardHeader className="px-7 pb-5 pt-8 text-left sm:px-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 ring-1 ring-sky-100">
          <Heart className="h-6 w-6 fill-current/10" />
        </div>
        <CardTitle className="text-3xl font-semibold tracking-[-0.035em] text-slate-950">{t("auth.login")}</CardTitle>
        <CardDescription className="mt-2 text-base leading-6">Đăng nhập để tiếp tục theo dõi sức khỏe của bạn.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5 px-7 sm:px-9">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              type="text"
              placeholder="Nhập tên đăng nhập"
              autoComplete="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-5 px-7 pb-8 sm:px-9">
          <Button type="submit" className="h-12 w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("auth.login")
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("auth.register")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
