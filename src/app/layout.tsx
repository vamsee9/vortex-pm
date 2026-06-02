/**
 * layout.tsx (Root Layout)
 * ------------------------
 * The root layout wraps every page in the app.
 * Sets up the font, dark mode class, and global providers.
 * TooltipProvider is required by Shadcn/ui tooltip components.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Using Inter font — clean, professional, great for dashboards
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Sprint Metrics Dashboard | Jira Analytics",
  description:
    "Track sprint velocity, absorption rates, and team delivery metrics. " +
    "Built for coordinate managers managing contract deliverables.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
