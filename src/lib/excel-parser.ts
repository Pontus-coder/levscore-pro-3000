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

// Column mappings from Swedish Excel headers to our data model
const COLUMN_MAPPINGS: Record<string, keyof SupplierData> = {
  'Leverantörsnummer': 'supplierNumber',
  'Leverantör': 'name',
  'Antal rader': 'rowCount',
  'Totalt antal': 'totalQuantity',
  'Total omsättning': 'totalRevenue',
  'Snitt-TG (%)': 'avgMargin',
  'Sales_score': 'salesScore',
  'Sortimentsbredd score': 'assortmentScore',
  'Efficiency_score': 'efficiencyScore',
  'Margin_score': 'marginScore',
  'Total_score': 'totalScore',
  'Diagnos (varför)': 'diagnosis',
  'Kort handling': 'shortAction',
  'Andel av total omsättning': 'revenueShare',
  'Ackumulerad andel': 'accumulatedShare',
  'Leverantörstier': 'tier',
  'Leverantörsprofil (valfri, men kraftfull)': 'profile',
}

function parseNumericValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  
  // Handle Swedish number format (comma as decimal separator)
  const strValue = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace('%', '')
  
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
      rowObj['Leverantörsnummer'] ?? rowObj['Leverantörnummer'] ?? rowObj['SupplierNumber']
    )
    
    const supplierName = parseStringValue(
      rowObj['Leverantör'] ?? rowObj['Supplier'] ?? rowObj['Name']
    )
    
    // Skip rows without supplier number or name
    if (!supplierNumber || !supplierName) continue
    
    const supplier: SupplierData = {
      supplierNumber,
      name: supplierName,
      rowCount: parseNumericValue(rowObj['Antal rader']),
      totalQuantity: parseNumericValue(rowObj['Totalt antal']),
      totalRevenue: parseNumericValue(rowObj['Total omsättning']),
      avgMargin: parseNumericValue(rowObj['Snitt-TG (%)']),
      salesScore: parseNumericValue(rowObj['Sales_score']),
      assortmentScore: parseNumericValue(rowObj['Sortimentsbredd score']),
      efficiencyScore: parseNumericValue(rowObj['Efficiency_score']),
      marginScore: parseNumericValue(rowObj['Margin_score']),
      totalScore: parseNumericValue(rowObj['Total_score']),
      diagnosis: parseStringValue(rowObj['Diagnos (varför)']),
      shortAction: parseStringValue(rowObj['Kort handling']),
      revenueShare: parseNumericValue(rowObj['Andel av total omsättning']),
      accumulatedShare: parseNumericValue(rowObj['Ackumulerad andel']),
      tier: parseStringValue(rowObj['Leverantörstier']),
      profile: parseStringValue(rowObj['Leverantörsprofil (valfri, men kraftfull)']),
    }
    
    suppliers.push(supplier)
  }
  
  if (suppliers.length === 0) {
    throw new Error('Inga giltiga leverantörer hittades i filen')
  }
  
  return suppliers
}

export function validateExcelHeaders(buffer: ArrayBuffer): { valid: boolean; missingColumns: string[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as unknown[][]
  
  if (jsonData.length === 0) {
    return { valid: false, missingColumns: ['Filen är tom'] }
  }
  
  const headers = (jsonData[0] as string[]).map(h => String(h).trim())
  
  const requiredColumns = ['Leverantörsnummer', 'Leverantör']
  const missingColumns = requiredColumns.filter(col => !headers.includes(col))
  
  return {
    valid: missingColumns.length === 0,
    missingColumns
  }
}

