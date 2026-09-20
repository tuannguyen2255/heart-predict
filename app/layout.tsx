import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "HeartGuard | Theo dõi sức khỏe tim mạch",
  description:
    "Quản lý hồ sơ sức khỏe, đánh giá nguy cơ tim mạch và tra cứu các kết quả đã lưu cùng HeartGuard.",
  keywords: ["heart disease", "prediction", "AI", "healthcare", "benh tim", "du doan"],
};

export const viewport: Viewport = {
  themeColor: "#0c619d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
