"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { prefetchHistory } from "@/lib/history";
import { clearSession } from "@/lib/client-session";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Globe2, HeartPulse, LogOut, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  user?: { id: number; email: string; full_name: string } | null;
}

export function Header({ user }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const links = [
    { href: "/", label: t("nav.home") },
    ...(user ? [
      { href: "/diagnosis", label: language === "vi" ? "Đánh giá nguy cơ" : "Assessment" },
      { href: "/history", label: t("nav.history"), prefetch: prefetchHistory },
      { href: "/profile", label: t("nav.profile") },
    ] : []),
  ];
  const toggleLanguage = () => setLanguage(language === "vi" ? "en" : "vi");
  const handleLogout = () => { clearSession(); window.location.href = "/"; };

  const navLink = (link: typeof links[number], mobile = false) => {
    const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        onMouseEnter={link.prefetch}
        onFocus={link.prefetch}
        onClick={() => mobile && setMobileMenuOpen(false)}
        className={mobile
          ? `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? "bg-sky-50 text-sky-600" : "text-slate-600 hover:bg-slate-50"}`
          : `relative rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "text-slate-950" : "text-slate-500 hover:text-slate-950"}`}
      >
        {link.label}
        {active && !mobile && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-sky-500" />}
        {active && mobile && <span className="h-2 w-2 rounded-full bg-sky-500" />}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <HeartPulse className="h-5 w-5" />

          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-slate-950">HeartGuard</div>
            <span className="mt-1 block text-[11px] text-slate-500">{language === "vi" ? "Sức khỏe tim mạch" : "Heart health"}</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">{links.map((link) => navLink(link))}</nav>

        <div className="hidden items-center gap-2 lg:flex">
          <button onClick={toggleLanguage} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950" aria-label="Đổi ngôn ngữ">
            <Globe2 className="h-4 w-4" /> {language === "vi" ? "EN" : "VI"}
          </button>
          {user ? (
            <div className="ml-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 pl-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sky-500 shadow-sm"><UserRound className="h-4 w-4" /></div>
              <div className="max-w-28 pr-1">
                <p className="truncate text-xs font-bold text-slate-800">{user.full_name}</p>

              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title={t("auth.logout")} aria-label={t("auth.logout")} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login"><Button variant="ghost" size="sm">{t("auth.login")}</Button></Link>
              <Link href="/register"><Button size="sm">{t("auth.register")}</Button></Link>
            </div>
          )}
        </div>

        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-slate-200/70 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-lg space-y-1">{links.map((link) => navLink(link, true))}</div>
          <div className="mx-auto mt-3 flex max-w-lg items-center justify-between border-t border-slate-100 pt-3">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}><Globe2 className="h-4 w-4" /> {language === "vi" ? "English" : "Tiếng Việt"}</Button>
            {user ? <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /> {t("auth.logout")}</Button> : (
              <div className="flex gap-2"><Link href="/login"><Button variant="ghost" size="sm">{t("auth.login")}</Button></Link><Link href="/register"><Button size="sm">{t("auth.register")}</Button></Link></div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
