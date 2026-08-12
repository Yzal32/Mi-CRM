import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import "./globals.css";

const plusJakartaSans = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-plus-jakarta-sans",
  weight: "400 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loop — CRM",
  description: "CRM simple para negocios pequeños.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
