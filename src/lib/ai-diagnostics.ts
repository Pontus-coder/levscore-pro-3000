/**
 * AI-förbättrad diagnostik med OpenAI
 * Genererar intelligenta analyser och rekommendationer för leverantörer
 */

import OpenAI from "openai"

// Initialisera OpenAI-klienten (nyckeln kommer från miljövariabel)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
  if (!process.env.OPENAI_API_KEY) {
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

Score-systemet:
- Sales Score (max 3): Relativ omsättning jämfört med andra leverantörer
- Sortiment Score (max 2): Antal artiklar/produktbredd
- Efficiency Score (max 2): Omsättning per artikel (hur bra varje artikel säljer)
- Margin Score (max 3): Täckningsgrad (0=<20%, 1=20-30%, 2=30-40%, 3=40%+)
- Total Score (max 10): Summan av ovan

Tier-systemet:
- A-tier: Topp 80% av omsättningen (kärnleverantörer)
- B-tier: Nästa 15% (viktiga men inte dominerande)
- C-tier: Sista 5% (svans, potentiellt ineffektiva)`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800,
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

  return `Analysera denna leverantör och ge rekommendationer.

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

🏷️ KLASSIFICERING: ${supplier.tier || "Ej klassificerad"}

---

Ge din analys som JSON med exakt detta format:
{
  "diagnosis": "2-3 meningar som förklarar VARFÖR leverantören presterar som den gör. Var specifik om vad siffrorna betyder.",
  "opportunities": "2-3 meningar om VAR de största möjligheterna finns. Koppla till konkreta åtgärder.",
  "action": "EN konkret, prioriterad rekommendation som börjar med ett verb (t.ex. 'Utöka sortimentet med...')",
  "priority": "high/medium/low baserat på potential och nuvarande position",
  "confidence": 70-95 beroende på hur tydlig datan är
}`
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

