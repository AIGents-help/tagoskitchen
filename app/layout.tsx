import type { Metadata } from "next";
import "./globals.css";
import "./type-scale.css";

export const metadata: Metadata = {
  title: "TaGo's Kitchen | Put Your Cookin' on the Map",
  description: "Book commercial kitchen space, discover resident-chef food drops, and bring your cooking to the neighborhood.",
  icons: {
    icon: "/tagos-pin-mascot.png",
    shortcut: "/tagos-pin-mascot.png",
    apple: "/tagos-pin-mascot.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
