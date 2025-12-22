/**
 * Score Calculator - Beräknar Diagnos och Åtgärd baserat på leverantörsscores
 * Portad från Google Apps Script
 */

// Konfiguration - justera trösklar här
const CFG = {
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
function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN
  if (typeof v === "number") return v

  const s = String(v).trim().replace(/\s+/g, "").replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Returnerar "Varför"-text baserat på score-kolumner.
 */
export function calculateDiagnosis(
  totalScore: number,
  salesScore: number,
  breadthScore: number,
  efficiencyScore: number,
  marginScore: number,
  revenue: number
): string {
  const total = toNumber(totalScore)
  if (!isFinite(total)) return ""

  if (total >= CFG.STRONG_TOTAL) return "Stark leverantör"

  const reasons: string[] = []
  const sales = toNumber(salesScore)
  const breadth = toNumber(breadthScore)
  const eff = toNumber(efficiencyScore)
  const margin = toNumber(marginScore)
  const rev = toNumber(revenue)

  // Relativt mått: säger INTE "dålig", bara "inte topp"
  if (!isFinite(sales) || sales < CFG.SALES_OK) reasons.push("Ej toppomsättning")

  // Absolut mått (valfritt men bra för att undvika missförstånd)
  if (isFinite(rev) && rev > 0 && rev < CFG.REV_LOW) reasons.push("Låg faktisk omsättning")

  if (!isFinite(breadth) || breadth < CFG.BREADTH_LOW) reasons.push("Låg bredd")
  if (!isFinite(eff) || eff < CFG.EFF_OK) reasons.push("Svag effektivitet")
  if (!isFinite(margin) || margin < 1) reasons.push("Låg TG")

  return reasons.join(", ")
}

/**
 * Returnerar en konkret rekommendation (Åtgärd) baserat på score.
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
  const total = toNumber(totalScore)
  const sales = toNumber(salesScore)
  const breadth = toNumber(breadthScore)
  const eff = toNumber(efficiencyScore)
  const margin = toNumber(marginScore)
  const rev = toNumber(revenue)
  const r = toNumber(rows)

  if (!isFinite(total)) return ""

  const lowBreadth = !isFinite(breadth) || breadth < CFG.BREADTH_LOW
  const highBreadth = isFinite(breadth) && breadth >= CFG.BREADTH_LOW
  const lowSales = !isFinite(sales) || sales < CFG.SALES_OK
  const lowEff = !isFinite(eff) || eff < CFG.EFF_OK
  const okRevenue = isFinite(rev) && rev >= CFG.REV_OK

  // "Efterfrågan finns" ska inte triggas av rev>0 (för snällt).
  const okDemand =
    (isFinite(sales) && sales >= CFG.SALES_OK) ||
    (isFinite(eff) && eff >= CFG.EFF_OK) ||
    okRevenue

  // 1) Stark leverantör => skala (högsta prio)
  if (total >= CFG.STRONG_TOTAL) {
    return "SKALA: Bredda sortiment (hög prio). Addera många artiklar."
  }

  // 2) BREDD (topp-ish + låg bredd + demand)
  if (total >= 6 && lowBreadth && okDemand) {
    return "BREDD: Efterfrågan finns men sortimentet är smalt. Addera artiklar (komplettera toppar, tillbehör, förbrukning)."
  }

  // 3) SELEKTIV BREDD (mitten + låg bredd + demand)
  if (total >= 4 && total < 6 && lowBreadth && okDemand) {
    return "SELEKTIV BREDD: Addera bara 'säkra' artiklar (reservdelar/tillbehör/förbrukning)."
  }

  // 4) OPTIMERA (du har bredd men det säljer inte bra per artikel / relativt svagt)
  if (highBreadth && (lowSales || lowEff)) {
    return "OPTIMERA: Du har redan bredd men den säljer svagt. Rensa, förbättra exponering, behåll toppsäljare."
  }

  // 5) PAUSA (kräv flera svaga signaler så du slipper konflikter)
  if (total < 4 && lowSales && lowEff && (!isFinite(rev) || rev < CFG.REV_LOW)) {
    return "PAUSA: Lägg inte tid här nu. Bredda inte. Fokusera på andra leverantörer."
  }

  // 6) Fallback
  return "UTVÄRDERA: Kräver manuell bedömning (kolla toppartiklar och kompletteringsmöjligheter)."
}

/**
 * Beräknar tier baserat på totalScore
 */
export function calculateTier(totalScore: number): string {
  const total = toNumber(totalScore)
  if (!isFinite(total)) return "F"
  
  if (total >= 8) return "A"
  if (total >= 6) return "B"
  if (total >= 4) return "C"
  if (total >= 2) return "D"
  return "F"
}

/**
 * Huvudfunktion: beräknar alla härledda fält för en leverantör
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
  // Använd befintliga värden om de finns, annars beräkna
  const diagnosis = supplier.diagnosis || calculateDiagnosis(
    supplier.totalScore,
    supplier.salesScore,
    supplier.assortmentScore, // breadthScore = assortmentScore
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

  const tier = supplier.tier || calculateTier(supplier.totalScore)

  return { diagnosis, shortAction, tier }
}

