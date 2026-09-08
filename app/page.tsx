import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 py-4 sm:px-6 sm:py-6 lg:py-8">
        <Dashboard />
      </main>
      <footer className="border-t border-border pt-5 pb-safe">
        <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-3.5 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-xs">
          <p>CryptoPro Analyzer — technical analysis &amp; education. Not financial advice.</p>
          <p>Market data: Binance public klines · Analysis runs locally in your browser</p>
        </div>
      </footer>
    </>
  );
}
