/**
 * Score Calculator - Beräknar alla scores från rådata
 * Portad från Google Sheets formler och Apps Script
 */

// Konfiguration - justera trösklar här
export const CFG = {
  STRONG_TOTAL: 8,            // totalScore >= 8 => Stark leverantör
  BREADTH_LOW: 0.7,           // breadthScore < 0.7 => låg bredd
  EFF_OK: 0.7,                // efficiencyScore >= 0.7 => ok effektivitet
  SALES_OK: 1,                // salesScore >= 1 => "topp-ish" relativt
  REV_OK: 100000,             // faktisk omsättning som räknas som "ok efterfrågan"
  REV_LOW: 50000,             // låg faktisk omsättning (för VARFOR/PAUSA)
  ROWS_MIN_ACTIVITY: 5        // om du vill använda rader som signal (valfritt)
}

/**
 * Hjälpfunktion: gör om värden till number robust
 */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN
  if (typeof v === "number") return v

  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Rå artikeldata från Excel
 */
export interface RawArticleData {
  articleNumber: string
  description: string
  quantity: number
  supplierNumber: string
  supplierName: string
  margin: number      // TG i procent (valfritt, kan beräknas från TB)
  revenue: number     // Belopp (Omsättning)
  grossProfit?: number // TB (Bruttovinst) - används för korrekt TG-beräkning
}

/**
 * Aggregerad leverantörsdata
 */
export interface AggregatedSupplier {
  supplierNumber: string
  name: string
  rowCount: number          // Antal rader/artiklar
  totalQuantity: number     // Summa antal
  totalRevenue: number      // Summa belopp
  avgMargin: number         // Snitt-TG
}

/**
 * Leverantör med beräknade scores
 */
export interface CalculatedSupplier extends AggregatedSupplier {
  salesScore: number
  assortmentScore: number
  efficiencyScore: number
  marginScore: number
  totalScore: number
  diagnosis: string
  shortAction: string
  revenueShare: number
  accumulatedShare: number
  tier: string
  profile: string
}

/**
 * Aggregera artikeldata till leverantörsnivå
 * TG beräknas korrekt: (Total TB / Total Omsättning) * 100
 */
export function aggregateBySupplier(articles: RawArticleData[]): AggregatedSupplier[] {
  const supplierMap = new Map<string, {
    supplierNumber: string
    name: string
    rows: number
    totalQuantity: number
    totalRevenue: number
    totalGrossProfit: number  // Summa TB
  }>()

  for (const article of articles) {
    const key = article.supplierNumber
    const existing = supplierMap.get(key)

    // Beräkna TB om det inte finns - använd margin om TB saknas
    let grossProfit = article.grossProfit
    if (grossProfit === undefined || grossProfit === null) {
      // Fallback: räkna TB från margin om TB saknas
      grossProfit = article.revenue * (article.margin / 100)
    }

    if (existing) {
      existing.rows += 1
      existing.totalQuantity += article.quantity
      existing.totalRevenue += article.revenue
      existing.totalGrossProfit += grossProfit
    } else {
      supplierMap.set(key, {
        supplierNumber: article.supplierNumber,
        name: article.supplierName,
        rows: 1,
        totalQuantity: article.quantity,
        totalRevenue: article.revenue,
        totalGrossProfit: grossProfit,
      })
    }
  }

  return Array.from(supplierMap.values()).map(s => {
    // Korrekt TG-beräkning: (Total TB / Total Omsättning) * 100
    const avgMargin = s.totalRevenue > 0 
      ? (s.totalGrossProfit / s.totalRevenue) * 100 
      : 0

    return {
      supplierNumber: s.supplierNumber,
      name: s.name,
      rowCount: s.rows,
      totalQuantity: s.totalQuantity,
      totalRevenue: s.totalRevenue,
      avgMargin,
    }
  })
}

/**
 * Beräkna Sales Score
 * Formel: 3 * revenue / MAX(all revenues)
 */
function calculateSalesScore(revenue: number, maxRevenue: number): number {
  if (maxRevenue === 0) return 0
  return Math.round((3 * revenue / maxRevenue) * 100) / 100
}

/**
 * Beräkna Sortimentsbredd Score
 * Formel: 2 * rowCount / MAX(all rowCounts)
 */
function calculateAssortmentScore(rowCount: number, maxRowCount: number): number {
  if (maxRowCount === 0) return 0
  return Math.round((2 * rowCount / maxRowCount) * 100) / 100
}

/**
 * Beräkna Efficiency Score
 * Formel: 2 * (revenue/rowCount) / MAX(all revenue/rowCount)
 */
function calculateEfficiencyScore(revenue: number, rowCount: number, maxEfficiency: number): number {
  if (rowCount === 0 || maxEfficiency === 0) return 0
  const efficiency = revenue / rowCount
  return Math.round((2 * efficiency / maxEfficiency) * 100) / 100
}

/**
 * Beräkna Margin Score
 * Formel: <20→0, <30→1, <40→2, ≥40→3
 */
function calculateMarginScore(avgMargin: number): number {
  if (avgMargin < 20) return 0
  if (avgMargin < 30) return 1
  if (avgMargin < 40) return 2
  return 3
}

/**
 * Beräkna Total Score
 * Formel: sum av alla scores, avrundat till 1 decimal
 */
function calculateTotalScore(sales: number, assortment: number, efficiency: number, margin: number): number {
  return Math.round((sales + assortment + efficiency + margin) * 10) / 10
}

/**
 * Beräkna Diagnos (Varför)
 */
export function calculateDiagnosis(
  totalScore: number,
  salesScore: number,
  breadthScore: number,
  efficiencyScore: number,
  marginScore: number,
  revenue: number
): string {
  if (!isFinite(totalScore)) return ""

  if (totalScore >= CFG.STRONG_TOTAL) return "Stark leverantör"

  const reasons: string[] = []

  if (!isFinite(salesScore) || salesScore < CFG.SALES_OK) reasons.push("Ej toppomsättning")
  if (isFinite(revenue) && revenue > 0 && revenue < CFG.REV_LOW) reasons.push("Låg faktisk omsättning")
  if (!isFinite(breadthScore) || breadthScore < CFG.BREADTH_LOW) reasons.push("Låg bredd")
  if (!isFinite(efficiencyScore) || efficiencyScore < CFG.EFF_OK) reasons.push("Svag effektivitet")
  if (!isFinite(marginScore) || marginScore < 1) reasons.push("Låg TG")

  return reasons.join(", ")
}

/**
 * Beräkna Åtgärd
 */
export function calculateAction(
  totalScore: number,
  salesScore: number,
  breadthScore: number,
  efficiencyScore: number,
  marginScore: number,
  revenue: number,
  rows: number
): string {
  if (!isFinite(totalScore)) return ""

  const lowBreadth = !isFinite(breadthScore) || breadthScore < CFG.BREADTH_LOW
  const highBreadth = isFinite(breadthScore) && breadthScore >= CFG.BREADTH_LOW
  const lowSales = !isFinite(salesScore) || salesScore < CFG.SALES_OK
  const lowEff = !isFinite(efficiencyScore) || efficiencyScore < CFG.EFF_OK
  const okRevenue = isFinite(revenue) && revenue >= CFG.REV_OK

  const okDemand =
    (isFinite(salesScore) && salesScore >= CFG.SALES_OK) ||
    (isFinite(efficiencyScore) && efficiencyScore >= CFG.EFF_OK) ||
    okRevenue

  if (totalScore >= CFG.STRONG_TOTAL) {
    return "SKALA: Bredda sortiment (hög prio). Addera många artiklar."
  }

  if (totalScore >= 6 && lowBreadth && okDemand) {
    return "BREDD: Efterfrågan finns men sortimentet är smalt. Addera artiklar."
  }

  if (totalScore >= 4 && totalScore < 6 && lowBreadth && okDemand) {
    return "SELEKTIV BREDD: Addera bara 'säkra' artiklar (reservdelar/tillbehör)."
  }

  if (highBreadth && (lowSales || lowEff)) {
    return "OPTIMERA: Du har bredd men den säljer svagt. Rensa, behåll toppsäljare."
  }

  if (totalScore < 4 && lowSales && lowEff && (!isFinite(revenue) || revenue < CFG.REV_LOW)) {
    return "PAUSA: Lägg inte tid här nu. Fokusera på andra leverantörer."
  }

  return "UTVÄRDERA: Kräver manuell bedömning."
}

/**
 * Beräkna Tier baserat på ackumulerad andel
 */
function calculateTier(accumulatedShare: number): string {
  if (accumulatedShare <= 0.8) return "A-tier – Kärnleverantör (topp 80%)"
  if (accumulatedShare <= 0.95) return "B-tier – Viktig (nästa 15%)"
  return "C-tier – Svans (sista 5%)"
}

/**
 * Beräkna Leverantörsprofil
 */
function calculateProfile(tier: string, breadthScore: number): string {
  const tierLetter = tier.charAt(0)
  
  if (tierLetter === "A") {
    if (breadthScore < 0.7) {
      return "A-tier. Stor leverantör. Låg bredd → BREDD sortiment."
    }
    return "A-tier. Kärnleverantör → Optimera och försvara."
  }
  
  if (tierLetter === "B") {
    if (breadthScore < 0.7) {
      return "B-tier. Potential → Selektiv bredd."
    }
    return "B-tier. Behåll, följ upp."
  }
  
  return "C-tier. Svans → Pausa eller testa mycket selektivt."
}

/**
 * Huvudfunktion: Beräkna alla scores för alla leverantörer
 */
export function calculateAllScores(aggregated: AggregatedSupplier[]): CalculatedSupplier[] {
  if (aggregated.length === 0) return []

  // Beräkna MAX-värden för relativa scores
  const maxRevenue = Math.max(...aggregated.map(s => s.totalRevenue))
  const maxRowCount = Math.max(...aggregated.map(s => s.rowCount))
  const maxEfficiency = Math.max(...aggregated.map(s => s.rowCount > 0 ? s.totalRevenue / s.rowCount : 0))
  const totalRevenue = aggregated.reduce((sum, s) => sum + s.totalRevenue, 0)

  // Beräkna scores för varje leverantör
  const withScores = aggregated.map(s => {
    const salesScore = calculateSalesScore(s.totalRevenue, maxRevenue)
    const assortmentScore = calculateAssortmentScore(s.rowCount, maxRowCount)
    const efficiencyScore = calculateEfficiencyScore(s.totalRevenue, s.rowCount, maxEfficiency)
    const marginScore = calculateMarginScore(s.avgMargin)
    const totalScore = calculateTotalScore(salesScore, assortmentScore, efficiencyScore, marginScore)
    const revenueShare = totalRevenue > 0 ? s.totalRevenue / totalRevenue : 0

    return {
      ...s,
      salesScore,
      assortmentScore,
      efficiencyScore,
      marginScore,
      totalScore,
      revenueShare,
    }
  })

  // Sortera efter omsättning (fallande) för ackumulerad andel
  withScores.sort((a, b) => b.totalRevenue - a.totalRevenue)

  // Beräkna ackumulerad andel och tier
  let accumulatedShare = 0
  const withTiers = withScores.map(s => {
    accumulatedShare += s.revenueShare
    const tier = calculateTier(accumulatedShare)
    const profile = calculateProfile(tier, s.assortmentScore)
    const diagnosis = calculateDiagnosis(
      s.totalScore, s.salesScore, s.assortmentScore, 
      s.efficiencyScore, s.marginScore, s.totalRevenue
    )
    const shortAction = calculateAction(
      s.totalScore, s.salesScore, s.assortmentScore,
      s.efficiencyScore, s.marginScore, s.totalRevenue, s.rowCount
    )

    return {
      ...s,
      accumulatedShare,
      tier,
      profile,
      diagnosis,
      shortAction,
    }
  })

  return withTiers
}

/**
 * Beräknar härledda fält för en enskild leverantör (för manuell import)
 */
export function calculateDerivedFields(supplier: {
  totalScore: number
  salesScore: number
  assortmentScore: number
  efficiencyScore: number
  marginScore: number
  totalRevenue: number
  rowCount: number
  diagnosis?: string | null
  shortAction?: string | null
  tier?: string | null
}): {
  diagnosis: string
  shortAction: string
  tier: string
} {
  const diagnosis = supplier.diagnosis || calculateDiagnosis(
    supplier.totalScore,
    supplier.salesScore,
    supplier.assortmentScore,
    supplier.efficiencyScore,
    supplier.marginScore,
    supplier.totalRevenue
  )

  const shortAction = supplier.shortAction || calculateAction(
    supplier.totalScore,
    supplier.salesScore,
    supplier.assortmentScore,
    supplier.efficiencyScore,
    supplier.marginScore,
    supplier.totalRevenue,
    supplier.rowCount
  )

  // Enkel tier baserad på totalScore om vi inte har ackumulerad andel
  let tier = supplier.tier || ""
  if (!tier) {
    if (supplier.totalScore >= 8) tier = "A-tier"
    else if (supplier.totalScore >= 5) tier = "B-tier"
    else tier = "C-tier"
  }

  return { diagnosis, shortAction, tier }
}
