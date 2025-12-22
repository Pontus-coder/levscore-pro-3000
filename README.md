# LevScore PRO 3000

Ett leverantörspoängsystem för att analysera och optimera leverantörsrelationer.

## Funktioner

- **Excel-import** - Ladda upp försäljningsdata från Excel-filer
- **Dashboard** - Överskådlig vy med KPIer och leverantörsranking
- **Egna faktorer** - Lägg till manuella bedömningar per leverantör
- **Multi-user** - Flera användare kan samarbeta och lägga till faktorer
- **Google-inloggning** - Säker autentisering via Google

## Teknikstack

- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Backend**: Next.js API Routes
- **Databas**: Vercel Postgres + Prisma ORM
- **Auth**: NextAuth.js med Google OAuth
- **Hosting**: Vercel

## Kom igång

### 1. Klona och installera

```bash
git clone <repo-url>
cd levscore-pro
npm install
```

### 2. Konfigurera miljövariabler

Kopiera `.env.example` till `.env.local` och fyll i:

```bash
cp .env.example .env.local
```

#### Databas (Vercel Postgres)
1. Gå till [Vercel Dashboard](https://vercel.com/dashboard)
2. Skapa ett nytt Postgres-database
3. Kopiera `DATABASE_URL` och `DIRECT_URL`

#### Google OAuth
1. Gå till [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Skapa ett nytt projekt
3. Konfigurera OAuth 2.0 credentials
4. Lägg till authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Kopiera Client ID och Client Secret

#### NextAuth Secret
Generera en säker secret:
```bash
openssl rand -base64 32
```

### 3. Konfigurera databas

```bash
npm run db:push
```

### 4. Starta utvecklingsserver

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000)

## Excel-format

Filen ska innehålla följande kolumner:

| Kolumn | Beskrivning | Obligatorisk |
|--------|-------------|--------------|
| Leverantörsnummer | Unikt ID | Ja |
| Leverantör | Namn | Ja |
| Antal rader | Antal orderrader | Nej |
| Totalt antal | Total kvantitet | Nej |
| Total omsättning | Omsättning i SEK | Nej |
| Snitt-TG (%) | Genomsnittlig täckningsgrad | Nej |
| Sales_score | Försäljningspoäng | Nej |
| Sortimentsbredd score | Sortimentspoäng | Nej |
| Efficiency_score | Effektivitetspoäng | Nej |
| Margin_score | Marginalpoäng | Nej |
| Total_score | Total poäng | Nej |
| Diagnos (varför) | Analys | Nej |
| Kort handling | Rekommendation | Nej |
| Leverantörstier | Tier (A-F) | Nej |
| Leverantörsprofil | Beskrivning | Nej |

## Deploy till Vercel

1. Pusha till GitHub
2. Importera projektet i Vercel
3. Lägg till miljövariabler i Vercel Dashboard
4. Deploya!

## Licens

MIT
