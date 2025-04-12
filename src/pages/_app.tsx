import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { JetBrains_Mono } from 'next/font/google';
import Layout from '@/components/Layout';
const jetbrains = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${jetbrains.className} font-sans`}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <Analytics />
    </div>
  );
}
