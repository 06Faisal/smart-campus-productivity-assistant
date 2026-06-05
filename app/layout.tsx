import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppContext";
import LayoutWrapper from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "Smart Campus Productivity Assistant",
  description: "AI-powered student productivity center: Track schedules, summarize lectures, plan study routines, and manage tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
