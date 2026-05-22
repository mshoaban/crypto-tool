# Crypto Pro Analyzer

Professional crypto trade planner with multi-timeframe analysis.

## Features
- Multi-timeframe analysis (15m / 1h / 4h)
- 12 technical indicators (EMA, RSI, MACD, StochRSI, ADX, ATR, Bollinger Bands)
- Support & Resistance engine with pivot clustering
- Candle pattern recognition (Engulfing, Hammer, Doji, Morning/Evening Star)
- Signal grading (A/B/C/D)
- Complete trade plan: Entry, SL, TP1/2/3, Position sizing

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build for production

```bash
npm run build
```

Quick verify with lint and build:

```bash
npm run check
```

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- ccxt (exchange data)
- Custom indicator library (EMA, RSI, MACD, ADX, Bollinger Bands, StochRSI)
