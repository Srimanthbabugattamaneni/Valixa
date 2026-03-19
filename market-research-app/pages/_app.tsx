import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Geist } from "next/font/google";
import Head from "next/head";
import { siteConfig } from "@/config/site";

const geist = Geist({ subsets: ["latin"] });

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={siteConfig.description} />
        <title>{siteConfig.fullName}</title>
      </Head>
      <div className={geist.className}>
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}
