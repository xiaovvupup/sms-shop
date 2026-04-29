import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "激活码短信平台",
  description: "激活码领取号码并展示验证码"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen bg-background text-foreground">
          {children}
          <footer className="border-t border-border/60 bg-white/70 px-4 py-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
            售后客服 QQ：3369213906
          </footer>
        </div>
      </body>
    </html>
  );
}
