import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <Dashboard />
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>CryptoPro Analyzer — technical analysis &amp; education. Not financial advice.</p>
          <p>Market data: Binance public klines · Analysis runs locally in your browser</p>
        </div>
      </footer>
    </>
  );
}