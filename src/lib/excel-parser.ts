import * as XLSX from 'xlsx'

export interface SupplierData {
  supplierNumber: string
  name: string
  rowCount: number
  totalQuantity: number
  totalRevenue: number
  avgMargin: number
  salesScore: number
  assortmentScore: number
  efficiencyScore: number
  marginScore: number
  totalScore: number
  diagnosis: string | null
  shortAction: string | null
  revenueShare: number
  accumulatedShare: number
  tier: string | null
  profile: string | null
}

// Normalize header names - remove BOM, trim whitespace, normalize unicode
function normalizeHeader(header: string): string {
  return String(header)
    .replace(/^\uFEFF/, '') // Remove BOM
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim()
    .toLowerCase()
}

// Find column value by trying multiple possible names
function findColumnValue(row: Record<string, unknown>, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined) return row[name]
    
    // Try normalized match
    const normalizedName = normalizeHeader(name)
    for (const key of Object.keys(row)) {
      if (normalizeHeader(key) === normalizedName) {
        return row[key]
      }
    }
  }
  return undefined
}

function parseNumericValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  
  // Handle Swedish number format (comma as decimal separator)
  const strValue = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace('%', '')
    .replace(/[^\d.-]/g, '') // Remove any non-numeric characters
  
  const parsed = parseFloat(strValue)
  return isNaN(parsed) ? 0 : parsed
}

function parseStringValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

export function parseExcelFile(buffer: ArrayBuffer): SupplierData[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  
  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  
  if (jsonData.length === 0) {
    throw new Error('Excel-filen är tom eller innehåller ingen data')
  }
  
  const suppliers: SupplierData[] = []
  
  for (const row of jsonData) {
    const rowObj = row as Record<string, unknown>
    
    // Try to find supplier number with different possible column names
    const supplierNumber = parseStringValue(
      findColumnValue(rowObj, ['Leverantörsnummer', 'Leverantörnummer', 'SupplierNumber', 'Supplier Number', 'LevNr'])
    )
    
    const supplierName = parseStringValue(
      findColumnValue(rowObj, ['Leverantör', 'Supplier', 'Name', 'Namn', 'Leverantörsnamn'])
    )
    
    // Skip rows without supplier number or name
    if (!supplierNumber || !supplierName) continue
    
    const supplier: SupplierData = {
      supplierNumber,
      name: supplierName,
      rowCount: parseNumericValue(findColumnValue(rowObj, ['Antal rader', 'Antal_rader', 'RowCount'])),
      totalQuantity: parseNumericValue(findColumnValue(rowObj, ['Totalt antal', 'Totalt_antal', 'TotalQuantity'])),
      totalRevenue: parseNumericValue(findColumnValue(rowObj, ['Total omsättning', 'Total_omsättning', 'TotalRevenue', 'Omsättning'])),
      avgMargin: parseNumericValue(findColumnValue(rowObj, ['Snitt-TG (%)', 'Snitt-TG', 'AvgMargin', 'TG', 'Täckningsgrad'])),
      salesScore: parseNumericValue(findColumnValue(rowObj, ['Sales_score', 'Sales score', 'SalesScore'])),
      assortmentScore: parseNumericValue(findColumnValue(rowObj, ['Sortimentsbredd score', 'Sortimentsbredd_score', 'AssortmentScore'])),
      efficiencyScore: parseNumericValue(findColumnValue(rowObj, ['Efficiency_score', 'Efficiency score', 'EfficiencyScore'])),
      marginScore: parseNumericValue(findColumnValue(rowObj, ['Margin_score', 'Margin score', 'MarginScore'])),
      totalScore: parseNumericValue(findColumnValue(rowObj, ['Total_score', 'Total score', 'TotalScore'])),
      diagnosis: parseStringValue(findColumnValue(rowObj, ['Diagnos (varför)', 'Diagnos', 'Diagnosis'])),
      shortAction: parseStringValue(findColumnValue(rowObj, ['Kort handling', 'Kort_handling', 'ShortAction', 'Handling'])),
      revenueShare: parseNumericValue(findColumnValue(rowObj, ['Andel av total omsättning', 'Andel_av_total_omsättning', 'RevenueShare'])),
      accumulatedShare: parseNumericValue(findColumnValue(rowObj, ['Ackumulerad andel', 'Ackumulerad_andel', 'AccumulatedShare'])),
      tier: parseStringValue(findColumnValue(rowObj, ['Leverantörstier', 'Tier', 'Leverantörs-tier'])),
      profile: parseStringValue(findColumnValue(rowObj, ['Leverantörsprofil (valfri, men kraftfull)', 'Leverantörsprofil', 'Profile'])),
    }
    
    suppliers.push(supplier)
  }
  
  if (suppliers.length === 0) {
    throw new Error('Inga giltiga leverantörer hittades i filen. Kontrollera att kolumnerna "Leverantörsnummer" och "Leverantör" finns.')
  }
  
  return suppliers
}

export function validateExcelHeaders(buffer: ArrayBuffer): { valid: boolean; missingColumns: string[]; foundColumns: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as unknown[][]
  
  if (jsonData.length === 0) {
    return { valid: false, missingColumns: ['Filen är tom'], foundColumns: [] }
  }
  
  const headers = (jsonData[0] as string[]).map(h => normalizeHeader(String(h)))
  const originalHeaders = (jsonData[0] as string[]).map(h => String(h).trim())
  
  // Check for required columns (case-insensitive, normalized)
  const requiredColumns = [
    { name: 'Leverantörsnummer', alternatives: ['leverantörsnummer', 'leverantörnummer', 'suppliernumber', 'levnr'] },
    { name: 'Leverantör', alternatives: ['leverantör', 'supplier', 'name', 'namn'] }
  ]
  
  const missingColumns: string[] = []
  
  for (const req of requiredColumns) {
    const found = req.alternatives.some(alt => headers.includes(alt))
    if (!found) {
      missingColumns.push(req.name)
    }
  }
  
  return {
    valid: missingColumns.length === 0,
    missingColumns,
    foundColumns: originalHeaders.filter(h => h.length > 0)
  }
}
