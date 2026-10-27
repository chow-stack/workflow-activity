import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Workflow Lab | Gen AI Club",
  description: "Build automation workflows, run them against hidden tests, and climb the leaderboard.",
  icons: { icon: "/logo-mark.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
