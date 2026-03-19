import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Geist } from "next/font/google";
import Head from "next/head";
import SEO from "@/components/SEO";

const geist = Geist({ subsets: ["latin"] });

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      {/* Default SEO — overridden per-page via <SEO> */}
      <SEO />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={geist.className}>
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}