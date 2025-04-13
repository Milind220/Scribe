import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { JetBrains_Mono } from 'next/font/google';
import Layout from '@/components/Layout';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';

const jetbrains = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system"
        disableTransitionOnChange
      >
        <div className={`${jetbrains.className} font-sans`}>
        <Layout>
          <Component {...pageProps} />
          </Layout>
          <Analytics />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}
