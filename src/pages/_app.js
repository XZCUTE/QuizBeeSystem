import Toaster from "@/components/Toaster"
import { PlayerContextProvider } from "@/context/player"
import { SocketContextProvider } from "@/context/socket"
import { QuizProvider } from "@/context/quiz"
import "@/styles/globals.css"
import clsx from "clsx"
import { Montserrat } from "next/font/google"
import Head from "next/head"

const montserrat = Montserrat({ subsets: ["latin"] })

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="shortcut icon" href="/icon.svg" />
        <title>ICCT Quiz Bee System</title>
      </Head>
      <SocketContextProvider>
        <PlayerContextProvider>
          <QuizProvider>
            <main
              className={clsx(
                "text-base-[8px] flex flex-col",
                montserrat.className,
              )}
            >
              <Component {...pageProps} />
            </main>
          </QuizProvider>
        </PlayerContextProvider>
      </SocketContextProvider>
      <Toaster />
    </>
  )
}
