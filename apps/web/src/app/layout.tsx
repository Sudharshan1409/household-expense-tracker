import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AmplifyProvider } from "@/components/providers/amplify-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "Household Finance Tracker",
  description: "Track your shared expenses easily.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

import { HouseholdProvider } from "@/components/providers/household-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-background`}>
        <AmplifyProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthGuard>
              <HouseholdProvider>
                <div className="flex min-h-screen flex-col md:flex-row">
                  <Sidebar />
                  <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
                    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
                      {children}
                    </div>
                  </main>
                  <BottomNav />
                </div>
              </HouseholdProvider>
            </AuthGuard>
          </ThemeProvider>
        </AmplifyProvider>
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
