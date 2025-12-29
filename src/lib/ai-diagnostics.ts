/**
 * AI-förbättrad diagnostik med OpenAI
 * Genererar intelligenta analyser och rekommendationer för leverantörer
 */

import OpenAI from "openai"

// Lazy-initialisera OpenAI-klienten för att undvika fel vid build
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export interface SupplierData {
  name: string
  supplierNumber: string
  // Nyckeltal
  totalRevenue: number
  avgMargin: number
  rowCount: number
  totalQuantity: number
  // Scores (0-10 totalt)
  salesScore: number        // max 3
  assortmentScore: number   // max 2
  efficiencyScore: number   // max 2
  marginScore: number       // max 3
  totalScore: number        // max 10
  // Kontext
  tier: string | null
  revenueShare: number
  // Google Trends data (valfritt)
  trendsContext?: string
  // Artikeldata för ABC-analys
  articleDistribution?: {
    totalArticles: number
    aArticles: number      // Antal A-artiklar
    bArticles: number      // Antal B-artiklar
    cArticles: number      // Antal C-artiklar
    aArticlePercentage: number  // % av totalt antal artiklar som är A
    topBArticles?: Array<{      // Topp B-artiklar med potential
      articleNumber: string
      description: string | null
      revenue: number
      quantity: number          // Antal sålda (viktigt för förbrukning/kem)
      revenueShare: number
      margin: number | null
    }>
  }
}

export interface AIAnalysis {
  diagnosis: string        // Detaljerad förklaring av nuläget
  opportunities: string    // Möjligheter att utforska
  action: string           // Konkret rekommendation
  priority: "high" | "medium" | "low"
  confidence: number       // 0-100, hur säker analysen är
}

/**
 * Genererar AI-förbättrad diagnostik för en leverantör
 */
export async function generateAIDiagnosis(supplier: SupplierData): Promise<AIAnalysis> {
  // Om ingen API-nyckel finns, returnera fallback
  const openai = getOpenAIClient()
  if (!openai) {
    return generateFallbackDiagnosis(supplier)
  }

  try {
    const prompt = buildPrompt(supplier)
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Snabb och prisvärd
      messages: [
        {
          role: "system",
          content: `Du är en expert på leverantörsanalys och sortimentsoptimering för e-handel/retail.
Din uppgift är att analysera leverantörsdata och ge konkreta, actionerbara insikter.

Svara ALLTID på svenska.
Var konkret och specifik - undvik generella fraser.
Fokusera på VAR möjligheterna finns och VAD som bör göras.

VIKTIGT - Google Trends-data:
Om trenddata inkluderas i analysen:
- Du HAR redan trenddata - använd den DIREKT, säg INTE "kolla trends" eller "analysera trends"
- Citera ALLTID konkreta siffror: "industridammsugare har stigande trend (+25%)" eller "sökintresse 75/100"
- Nämn specifika sökord och deras exakta trender i din analys
- Använd relaterade sökningar för att ge konkreta produktförslag (t.ex. "Baserat på relaterade sökningar som X och Y, överväg att lägga till...")
- Om ett sökord har stigande trend, säg exakt hur mycket (t.ex. "+15%", "+30%")
- Om sökintresset är högt (över 50/100), nämn det explicit
- Prioritera kategorier med stigande trender högre i rekommendationerna
- Säg INTE "baserat på trendanalys" - säg istället "industridammsugare har ökat 25% i sökningar"

Score-systemet:
- Sales Score (max 3): Relativ omsättning jämfört med andra leverantörer
- Sortiment Score (max 2): Antal artiklar/produktbredd
- Efficiency Score (max 2): Omsättning per artikel (hur bra varje artikel säljer)
- Margin Score (max 3): Täckningsgrad (0=<20%, 1=20-30%, 2=30-40%, 3=40%+)
- Total Score (max 10): Summan av ovan

Tier-systemet:
- A-tier: Topp 80% av omsättningen (kärnleverantörer)
- B-tier: Nästa 15% (viktiga men inte dominerande)
- C-tier: Sista 5% (svans, potentiellt ineffektiva)

ABC-analys och sortimentsoptimering:
- Målsättning: 20% av artiklarna ska vara A-artiklar (står för 80% av omsättningen)
- Om A-artiklar är <20%: Identifiera B-artiklar med potential att flytta upp till A-nivå
- Ta hänsyn till BÅDE omsättning OCH antal sålda artiklar:
  * Hög omsättning = bra för stora produkter (t.ex. skurmaskiner, maskiner)
  * Hög kvantitet = bra för förbrukning/kem (produkten rör på sig, återkommande försäljning, potential för uppsäljning)
- Analysera B-artiklar med antingen hög omsättning+bra TG ELLER hög kvantitet (även om omsättning är låg)
- Ge konkreta rekommendationer om vilka B-artiklar som bör prioriteras för att öka A-artikelprocenten`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000, // Ökat för mer detaljerade analyser med trenddata
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return generateFallbackDiagnosis(supplier)
    }

    const parsed = JSON.parse(content) as AIAnalysis
    return {
      diagnosis: parsed.diagnosis || "",
      opportunities: parsed.opportunities || "",
      action: parsed.action || "",
      priority: parsed.priority || "medium",
      confidence: parsed.confidence || 70,
    }
  } catch (error) {
    console.error("AI diagnosis error:", error)
    return generateFallbackDiagnosis(supplier)
  }
}

/**
 * Bygger prompten för AI-analys
 */
function buildPrompt(supplier: SupplierData): string {
  const formatCurrency = (n: number) => 
    new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n)

  // Beräkna procentuella scores
  const salesPct = ((supplier.salesScore / 3) * 100).toFixed(0)
  const assortmentPct = ((supplier.assortmentScore / 2) * 100).toFixed(0)
  const efficiencyPct = ((supplier.efficiencyScore / 2) * 100).toFixed(0)
  const marginPct = ((supplier.marginScore / 3) * 100).toFixed(0)
  const totalPct = ((supplier.totalScore / 10) * 100).toFixed(0)

  let prompt = `Analysera denna leverantör och ge rekommendationer.

**LEVERANTÖR: ${supplier.name}** (Nr: ${supplier.supplierNumber})

📊 NYCKELTAL:
- Total omsättning: ${formatCurrency(supplier.totalRevenue)}
- Andel av total omsättning: ${(supplier.revenueShare * 100).toFixed(1)}%
- Täckningsgrad (TG): ${supplier.avgMargin.toFixed(1)}%
- Antal artiklar: ${supplier.rowCount}
- Omsättning/artikel: ${formatCurrency(supplier.totalRevenue / Math.max(supplier.rowCount, 1))}

📈 SCORES:
- Sales Score: ${supplier.salesScore.toFixed(1)}/3 (${salesPct}% av max)
- Sortiment Score: ${supplier.assortmentScore.toFixed(1)}/2 (${assortmentPct}% av max)
- Efficiency Score: ${supplier.efficiencyScore.toFixed(1)}/2 (${efficiencyPct}% av max)
- Margin Score: ${supplier.marginScore}/3 (${marginPct}% av max)
- **TOTAL: ${supplier.totalScore.toFixed(1)}/10** (${totalPct}%)

🏷️ KLASSIFICERING: ${supplier.tier || "Ej klassificerad"}`

  // Lägg till artikeldata för ABC-analys om det finns
  if (supplier.articleDistribution) {
    const dist = supplier.articleDistribution
    prompt += `

📦 ARTIKELANALYS (ABC):
- Totalt antal artiklar: ${dist.totalArticles}
- A-artiklar: ${dist.aArticles} (${dist.aArticlePercentage.toFixed(1)}% av totalt) - står för 80% av omsättningen
- B-artiklar: ${dist.bArticles}
- C-artiklar: ${dist.cArticles}

🎯 ABC-STRATEGI:
- Målsättning: 20% av artiklarna ska vara A-artiklar (står för 80% av omsättningen)
- Nuvarande: ${dist.aArticlePercentage.toFixed(1)}% är A-artiklar
${dist.aArticlePercentage < 20 ? `- GAP: ${(20 - dist.aArticlePercentage).toFixed(1)}% under målsättningen - identifiera B-artiklar med potential!` : ""}
${dist.topBArticles && dist.topBArticles.length > 0 ? `
- Topp B-artiklar med potential att flytta upp till A-nivå:
${dist.topBArticles.map((a, i) => `  ${i + 1}. ${a.articleNumber}${a.description ? ` (${a.description})` : ""}: ${formatCurrency(a.revenue)} (${a.revenueShare.toFixed(1)}% av omsättning, ${a.quantity.toLocaleString("sv-SE")} st sålda${a.margin !== null ? `, TG: ${a.margin.toFixed(1)}%` : ""})`).join("\n")}
` : ""}

⚠️ VIKTIGT - ABC-ANALYS OCH KVANTITET:
- Om A-artiklar är <20% av totalt antal: Identifiera B-artiklar med potential att flytta upp till A-nivå
- Ta hänsyn till BÅDE omsättning OCH antal sålda artiklar:
  * Hög omsättning = bra för stora produkter (t.ex. skurmaskiner)
  * Hög kvantitet = bra för förbrukning/kem (produkten rör på sig, återkommande försäljning)
- Fokusera på B-artiklar med antingen:
  * Hög omsättning OCH bra TG (kan skalas upp)
  * Hög kvantitet även om omsättning är låg (produkten rör på sig, potential för uppsäljning)
- Ge konkreta rekommendationer om vilka B-artiklar som bör prioriteras för att öka A-artikelprocenten
- Förklara HUR dessa B-artiklar kan flyttas upp (t.ex. bättre exponering, marknadsföring, komplettering, uppsäljning)`
  }

  // Lägg till trenddata om det finns
  if (supplier.trendsContext) {
    prompt += `

${supplier.trendsContext}

⚠️ KRITISKT - TRENDDATA:
- Du HAR trenddata ovan - använd den DIREKT i din analys!
- Citera ALLTID konkreta siffror från trenddata (t.ex. "industridammsugare har stigande trend (+25%)" eller "sökintresse 75/100")
- Nämn specifika sökord och deras exakta trender i diagnosis och opportunities
- Använd relaterade sökningar för konkreta produktförslag
- Säg INTE "kolla trends", "analysera trends" eller "baserat på trendanalys" - du HAR redan datan, använd den direkt!
- Om ett sökord har stigande trend, säg exakt hur mycket (t.ex. "+15%", "+30%")
- Om sökintresset är högt (över 50/100), nämn det explicit
- Prioritera kategorier med stigande trender högre i rekommendationerna`
  }

  prompt += `

---

Ge din analys som JSON med exakt detta format:
{
  "diagnosis": "2-3 meningar som förklarar VARFÖR leverantören presterar som den gör. Var specifik om vad siffrorna betyder.${supplier.articleDistribution ? ` MÅSTE inkludera ABC-analys: "X% av artiklarna är A-artiklar (målsättning 20%)" och identifiera gapet.` : ""}${supplier.trendsContext ? " MÅSTE inkludera konkreta trenddata med siffror (t.ex. 'Sökintresset för X är Y/100 och har ökat Z%')." : ""}",
  "opportunities": "2-3 meningar om VAR de största möjligheterna finns.${supplier.articleDistribution && supplier.articleDistribution.topBArticles && supplier.articleDistribution.topBArticles.length > 0 ? ` MÅSTE nämna specifika B-artiklar med potential (t.ex. 'Artikel X har sålts Y st gånger trots låg omsättning - produkten rör på sig och har potential för uppsäljning' eller 'Artikel Y har hög omsättning och bra TG - kan skalas upp').` : ""}${supplier.trendsContext ? " MÅSTE nämna specifika sökord och deras trender med siffror. Använd relaterade sökningar för konkreta produktförslag (t.ex. 'Baserat på relaterade sökningar som X och Y, överväg att lägga till...')." : ""} Koppla till konkreta åtgärder.",
  "action": "EN konkret, prioriterad rekommendation som börjar med ett verb.${supplier.articleDistribution && supplier.articleDistribution.aArticlePercentage < 20 ? ` Fokusera på att öka A-artikelprocenten från ${supplier.articleDistribution.aArticlePercentage.toFixed(1)}% till 20% genom att lyfta B-artiklar. Nämn specifika B-artiklar om de finns listade.` : ""}${supplier.trendsContext ? " Basera på trenddata - nämn specifika kategorier som trendar uppåt med siffror (t.ex. 'Utöka sortimentet med produkter relaterade till X som har ökat Y%')." : ""}",
  "priority": "high/medium/low baserat på potential och nuvarande position",
  "confidence": ${supplier.trendsContext || supplier.articleDistribution ? "80-95" : "70-90"} beroende på hur tydlig datan är
}`

  return prompt
}

/**
 * Fallback-diagnostik om AI inte är tillgänglig
 */
function generateFallbackDiagnosis(supplier: SupplierData): AIAnalysis {
  const issues: string[] = []
  const opportunities: string[] = []
  
  // Analysera varje score
  if (supplier.salesScore < 1) {
    issues.push("låg relativ omsättning")
  }
  if (supplier.assortmentScore < 0.7) {
    issues.push("smalt sortiment")
    opportunities.push("Bredda sortimentet med fler artiklar från leverantören")
  }
  if (supplier.efficiencyScore < 0.7) {
    issues.push("låg omsättning per artikel")
    opportunities.push("Optimera befintligt sortiment - fokusera på toppsäljare")
  }
  if (supplier.marginScore < 1) {
    issues.push("låg täckningsgrad")
  }

  // Bygg diagnosis
  let diagnosis = ""
  if (supplier.totalScore >= 8) {
    diagnosis = `Stark leverantör med bra prestanda över alla mätpunkter. Omsätter ${(supplier.revenueShare * 100).toFixed(1)}% av total försäljning.`
  } else if (issues.length > 0) {
    diagnosis = `Leverantören har utmaningar med ${issues.join(", ")}. Detta påverkar totala scoren.`
  } else {
    diagnosis = "Leverantören presterar genomsnittligt utan tydliga svagheter eller styrkor."
  }

  // Bestäm prioritet
  let priority: "high" | "medium" | "low" = "medium"
  if (supplier.tier?.startsWith("A") && supplier.assortmentScore < 1) {
    priority = "high" // A-tier med låg bredd = stor potential
  } else if (supplier.tier?.startsWith("C")) {
    priority = "low"
  }

  // Bestäm action
  let action = ""
  if (supplier.assortmentScore < 0.7 && supplier.efficiencyScore >= 0.7) {
    action = "Utöka sortimentet - artiklar som finns säljer bra, det finns troligen efterfrågan på fler."
  } else if (supplier.efficiencyScore < 0.7 && supplier.assortmentScore >= 0.7) {
    action = "Optimera befintligt sortiment - rensa svaga artiklar och stärk exponeringen av toppsäljare."
  } else if (supplier.totalScore >= 8) {
    action = "Skala upp - bredda aggressivt med fler artiklar och kategorier från denna leverantör."
  } else if (supplier.totalScore < 4) {
    action = "Pausa - lägg inte tid här nu, fokusera på starkare leverantörer."
  } else {
    action = "Utvärdera manuellt - analysera toppartiklar och kompletteringsmöjligheter."
  }

  return {
    diagnosis,
    opportunities: opportunities.join(" ") || "Kräver manuell analys för att identifiera specifika möjligheter.",
    action,
    priority,
    confidence: 60, // Lägre confidence för regelbaserad analys
  }
}

/**
 * Batch-generera diagnoser för flera leverantörer
 * Mer kostnadseffektivt än att anropa en och en
 */
export async function generateBatchDiagnosis(suppliers: SupplierData[]): Promise<Map<string, AIAnalysis>> {
  const results = new Map<string, AIAnalysis>()
  
  // Kör max 5 parallellt för att undvika rate limits
  const batchSize = 5
  for (let i = 0; i < suppliers.length; i += batchSize) {
    const batch = suppliers.slice(i, i + batchSize)
    const promises = batch.map(async (supplier) => {
      const analysis = await generateAIDiagnosis(supplier)
      return { id: supplier.supplierNumber, analysis }
    })
    
    const batchResults = await Promise.all(promises)
    batchResults.forEach(({ id, analysis }) => {
      results.set(id, analysis)
    })
  }
  
  return results
}

