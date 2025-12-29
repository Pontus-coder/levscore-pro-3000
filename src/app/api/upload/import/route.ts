import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"
import { calculateDerivedFields } from "@/lib/score-calculator"
import { validateFile, sanitizeFilename, MAX_ROWS } from "@/lib/file-validation"
import * as XLSX from 'xlsx'

interface ColumnMapping {
  supplierNumber: string
  name: string
  rowCount?: string
  totalQuantity?: string
  totalRevenue?: string
  avgMargin?: string
  salesScore?: string
  assortmentScore?: string
  efficiencyScore?: string
  marginScore?: string
  totalScore?: string
  diagnosis?: string
  shortAction?: string
  revenueShare?: string
  accumulatedShare?: string
  tier?: string
  profile?: string
}

function parseNumericValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  
  const strValue = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace('%', '')
    .replace(/[^\d.-]/g, '')
  
  const parsed = parseFloat(strValue)
  return isNaN(parsed) ? 0 : parsed
}

function parseStringValue(value: unknown, maxLength: number = 500): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim().substring(0, maxLength)
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext()
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const mappingJson = formData.get("mapping") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!mappingJson) {
      return NextResponse.json({ error: "No mapping provided" }, { status: 400 })
    }

    // SECURITY: Validate file
    const validation = await validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // SECURITY: Safe JSON parse
    let mapping: ColumnMapping
    try {
      mapping = JSON.parse(mappingJson)
    } catch {
      return NextResponse.json({ error: "Invalid mapping format" }, { status: 400 })
    }

    if (!mapping.supplierNumber || !mapping.name) {
      return NextResponse.json(
        { error: "Leverantörsnummer och Leverantör måste mappas" },
        { status: 400 }
      )
    }

    // Parse file with security options
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { 
      type: 'array',
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
    })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    
    if (jsonData.length === 0) {
      return NextResponse.json({ error: "Filen är tom" }, { status: 400 })
    }

    // SECURITY: Limit rows
    if (jsonData.length > MAX_ROWS) {
      return NextResponse.json({ 
        error: `Filen innehåller för många rader. Max ${MAX_ROWS.toLocaleString()} rader tillåtet.` 
      }, { status: 400 })
    }

    const suppliers = []
    
    for (const row of jsonData) {
      const rowObj = row as Record<string, unknown>
      
      const supplierNumber = parseStringValue(rowObj[mapping.supplierNumber], 50)?.trim() || ""
      const supplierName = parseStringValue(rowObj[mapping.name], 200)?.trim() || ""
      
      // Skippa rader utan leverantörsnummer eller leverantörsnamn (efter trim)
      if (!supplierNumber || !supplierName || supplierNumber.length === 0 || supplierName.length === 0) {
        continue
      }
      
      // Hämta grunddata
      const baseData = {
        supplierNumber,
        name: supplierName,
        organizationId: ctx.organization.id,
        rowCount: mapping.rowCount ? Math.max(0, parseNumericValue(rowObj[mapping.rowCount])) : 0,
        totalQuantity: mapping.totalQuantity ? Math.max(0, parseNumericValue(rowObj[mapping.totalQuantity])) : 0,
        totalRevenue: mapping.totalRevenue ? Math.max(0, parseNumericValue(rowObj[mapping.totalRevenue])) : 0,
        avgMargin: mapping.avgMargin ? Math.max(-100, Math.min(100, parseNumericValue(rowObj[mapping.avgMargin]))) : 0,
        salesScore: mapping.salesScore ? Math.max(0, Math.min(10, parseNumericValue(rowObj[mapping.salesScore]))) : 0,
        assortmentScore: mapping.assortmentScore ? Math.max(0, Math.min(10, parseNumericValue(rowObj[mapping.assortmentScore]))) : 0,
        efficiencyScore: mapping.efficiencyScore ? Math.max(0, Math.min(10, parseNumericValue(rowObj[mapping.efficiencyScore]))) : 0,
        marginScore: mapping.marginScore ? Math.max(0, Math.min(10, parseNumericValue(rowObj[mapping.marginScore]))) : 0,
        totalScore: mapping.totalScore ? Math.max(0, Math.min(40, parseNumericValue(rowObj[mapping.totalScore]))) : 0,
        diagnosis: mapping.diagnosis ? parseStringValue(rowObj[mapping.diagnosis], 500) : null,
        shortAction: mapping.shortAction ? parseStringValue(rowObj[mapping.shortAction], 500) : null,
        revenueShare: mapping.revenueShare ? Math.max(0, Math.min(1, parseNumericValue(rowObj[mapping.revenueShare]))) : 0,
        accumulatedShare: mapping.accumulatedShare ? Math.max(0, Math.min(1, parseNumericValue(rowObj[mapping.accumulatedShare]))) : 0,
        tier: mapping.tier ? parseStringValue(rowObj[mapping.tier], 100) : null,
        profile: mapping.profile ? parseStringValue(rowObj[mapping.profile], 500) : null,
      }
      
      // Beräkna härledda fält om de saknas
      const derived = calculateDerivedFields(baseData)
      
      suppliers.push({
        ...baseData,
        diagnosis: baseData.diagnosis || derived.diagnosis,
        shortAction: baseData.shortAction || derived.shortAction,
        tier: baseData.tier || derived.tier,
      })
    }

    if (suppliers.length === 0) {
      return NextResponse.json(
        { error: "Inga giltiga leverantörer hittades" },
        { status: 400 }
      )
    }

    // Hämta alla befintliga leverantörer en gång för snabb lookup
    const allExistingSuppliersForLookup = await prisma.supplier.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
    })

    // Skapa en map med normaliserade nummer som nyckel
    const existingSuppliersMap = new Map<string, typeof allExistingSuppliersForLookup[0]>()
    for (const supplier of allExistingSuppliersForLookup) {
      const normalized = supplier.supplierNumber.trim().toUpperCase()
      if (!existingSuppliersMap.has(normalized)) {
        existingSuppliersMap.set(normalized, supplier)
      }
    }

    // Upsert suppliers
    let created = 0
    let updated = 0
    const supplierNumbersInFile = new Set<string>() // Samla alla leverantörsnummer från filen

    for (const supplier of suppliers) {
      // Normalisera leverantörsnummer (trim för att undvika matchningsproblem)
      const normalizedSupplierNumber = supplier.supplierNumber.trim()
      supplierNumbersInFile.add(normalizedSupplierNumber)

      // Hitta befintlig leverantör med normaliserad matchning
      const existing = existingSuppliersMap.get(normalizedSupplierNumber.toUpperCase())

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            ...supplier,
            supplierNumber: normalizedSupplierNumber,
          },
        })
        updated++
      } else {
        await prisma.supplier.create({
          data: {
            ...supplier,
            supplierNumber: normalizedSupplierNumber,
          },
        })
        created++
      }
    }

    // Ta bort alla leverantörer som INTE finns i den nya filen (full refresh)
    // Använd samma data som vi redan hämtat
    const normalizedFileNumbers = new Set(
      Array.from(supplierNumbersInFile)
        .map(n => n.trim().toUpperCase())
        .filter(n => n.length > 0) // Filtrera bort tomma
    )

    // Hitta leverantörer som ska tas bort (normalisera för jämförelse)
    const suppliersToDelete = allExistingSuppliersForLookup.filter(
      existing => {
        const normalizedExisting = existing.supplierNumber.trim().toUpperCase()
        // Ta bort om: inte i filen, eller om leverantörsnummer är tomt
        return normalizedExisting.length === 0 || !normalizedFileNumbers.has(normalizedExisting)
      }
    )

    // Ta bort leverantörer som inte finns i filen
    let deletedCount = 0
    if (suppliersToDelete.length > 0) {
      const deleted = await prisma.supplier.deleteMany({
        where: {
          id: {
            in: suppliersToDelete.map(s => s.id),
          },
        },
      })
      deletedCount = deleted.count
    }

    // Log the upload
    await prisma.uploadHistory.create({
      data: {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        fileName: sanitizeFilename(file.name),
        recordCount: suppliers.length,
        status: "completed",
      },
    })

    return NextResponse.json({
      success: true,
      message: `${suppliers.length} leverantörer importerade`,
      stats: {
        suppliersCreated: created,
        suppliersUpdated: updated,
        suppliersDeleted: deletedCount,
        totalSuppliers: suppliers.length,
        existingBeforeDelete: allExistingSuppliersForLookup.length,
      },
    })
  } catch (error) {
    console.error("Error importing file:", error)
    return NextResponse.json(
      { error: "Kunde inte importera filen. Kontrollera formatet och försök igen." },
      { status: 500 }
    )
  }
}
