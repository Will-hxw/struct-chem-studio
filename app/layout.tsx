import type { Metadata } from "next";
import "./globals.css";
import assets from "../lib/generated/workbench.json";
export const metadata: Metadata = {
  title: "结构化学考试复习与错题训练",
  description:
    "按重庆大学课程练习和试卷考点组题，支持错因分析、AI 追问与交互结构模型。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href={assets.style} />
      </head>
      <body>{children}</body>
    </html>
  );
}
