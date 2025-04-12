import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { JetBrains_Mono } from 'next/font/google';

const jetbrains = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

// TODO: adjust OG tag 
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <div className={`${jetbrains.className} font-sans`}>
        <Head>
          <title>Scribe</title>
          <meta name="description" content="Impermanent thoughts, ready to post." />
          <meta property="og:title" content="Scribe" />
          <meta property="og:description" content="Impermanent thoughts, ready to post." />
          <meta property="og:url" content="https://ephemeral-notes.com" />
          <meta property="og:site_name" content="Scribe" />
          <meta property="og:image" content="https://ephemeral-notes.com/static/OpenGraphEphemeral.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:locale" content="en-US" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Scribe" />
          <meta name="twitter:description" content="Impermanent thoughts, ready to post." />
          <meta name="twitter:site" content="@milindS_" />
          <meta name="twitter:site:id" content="998575387067142144" />
          <meta name="twitter:image" content="https://ephemeral-notes.com/static/OpenGraphEphemeral.png" />
        </Head>
        <main>
          <Component {...pageProps} />
        </main>
      <Analytics />
    </div>
  </>)
}
