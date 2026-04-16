import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "激活码短信平台",
  description: "激活码领取号码并展示验证码"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
