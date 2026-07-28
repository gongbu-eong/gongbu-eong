import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gongbu Eong Frontend",
  description: "Frontend app for Gongbu Eong",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/diagnosis-result-heroes.svg"
          as="image"
          type="image/svg+xml"
        />
        <link
          rel="preload"
          href="/diagnosis-question-owls.svg"
          as="image"
          type="image/svg+xml"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
