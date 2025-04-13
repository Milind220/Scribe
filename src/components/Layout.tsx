import React from 'react';
import Head from 'next/head';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
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
      <main className='flex-grow container mx-auto px-4 py-8'>
        {children}
      </main>
    </div>
  );
}