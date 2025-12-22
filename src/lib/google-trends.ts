/**
 * Google Trends Integration
 * Hämtar söktrend-data för produktkategorier
 */

// @ts-expect-error - google-trends-api has no types
import googleTrends from "google-trends-api"

export interface TrendPoint {
  date: string
  value: number
}

export interface TrendData {
  keyword: string
  averageInterest: number
  trend: "rising" | "stable" | "declining"
  trendPercent: number
  timeline: TrendPoint[]
  relatedQueries: string[]
}

export interface TrendResult {
  success: boolean
  data?: TrendData
  error?: string
}

/**
 * Hämta trenddata för ett sökord
 * Returnerar intresse över tid (senaste 12 månaderna)
 */
export async function getTrendData(keyword: string, geo: string = "SE"): Promise<TrendResult> {
  try {
    // Hämta intresse över tid (senaste 12 månaderna)
    const interestResult = await googleTrends.interestOverTime({
      keyword,
      geo,
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 år sedan
      endTime: new Date(),
    })

    const interestData = JSON.parse(interestResult)
    
    if (!interestData.default?.timelineData?.length) {
      return {
        success: false,
        error: "Ingen trenddata hittades för detta sökord"
      }
    }

    const timeline: TrendPoint[] = interestData.default.timelineData.map((point: { formattedTime: string; value: number[] }) => ({
      date: point.formattedTime,
      value: point.value[0]
    }))

    // Beräkna genomsnitt
    const values = timeline.map(t => t.value)
    const averageInterest = Math.round(values.reduce((a, b) => a + b, 0) / values.length)

    // Beräkna trend (jämför första och sista kvartalet)
    const firstQuarter = values.slice(0, Math.floor(values.length / 4))
    const lastQuarter = values.slice(-Math.floor(values.length / 4))
    
    const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length
    const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length
    
    const trendPercent = firstAvg > 0 ? Math.round(((lastAvg - firstAvg) / firstAvg) * 100) : 0
    
    let trend: "rising" | "stable" | "declining"
    if (trendPercent > 10) trend = "rising"
    else if (trendPercent < -10) trend = "declining"
    else trend = "stable"

    // Försök hämta relaterade sökningar
    let relatedQueries: string[] = []
    try {
      const relatedResult = await googleTrends.relatedQueries({
        keyword,
        geo,
      })
      const relatedData = JSON.parse(relatedResult)
      relatedQueries = relatedData.default?.rankedList?.[0]?.rankedKeyword
        ?.slice(0, 5)
        ?.map((q: { query: string }) => q.query) || []
    } catch {
      // Relaterade sökningar är inte kritiska
    }

    return {
      success: true,
      data: {
        keyword,
        averageInterest,
        trend,
        trendPercent,
        timeline,
        relatedQueries,
      }
    }
  } catch (error) {
    console.error("Google Trends error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Kunde inte hämta trenddata"
    }
  }
}

/**
 * Hämta trenddata för flera sökord
 */
export async function getMultipleTrends(keywords: string[], geo: string = "SE"): Promise<Map<string, TrendResult>> {
  const results = new Map<string, TrendResult>()
  
  // Kör sekventiellt för att undvika rate limiting
  for (const keyword of keywords) {
    const result = await getTrendData(keyword, geo)
    results.set(keyword, result)
    
    // Vänta lite mellan anrop för att undvika rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return results
}

/**
 * Formatera trenddata för AI-prompt
 */
export function formatTrendsForAI(trends: Map<string, TrendResult>): string {
  const lines: string[] = ["📈 GOOGLE TRENDS DATA (Sverige, senaste 12 mån):"]
  
  for (const [keyword, result] of trends) {
    if (result.success && result.data) {
      const { averageInterest, trend, trendPercent, relatedQueries } = result.data
      
      const trendEmoji = trend === "rising" ? "🔼" : trend === "declining" ? "🔽" : "➡️"
      const trendText = trend === "rising" ? "Stigande" : trend === "declining" ? "Fallande" : "Stabil"
      
      lines.push(`\n"${keyword}":`)
      lines.push(`  - Sökintresse: ${averageInterest}/100`)
      lines.push(`  - Trend: ${trendEmoji} ${trendText} (${trendPercent > 0 ? "+" : ""}${trendPercent}%)`)
      
      if (relatedQueries.length > 0) {
        lines.push(`  - Relaterade sökningar: ${relatedQueries.join(", ")}`)
      }
    } else {
      lines.push(`\n"${keyword}": Ingen data tillgänglig`)
    }
  }
  
  return lines.join("\n")
}

