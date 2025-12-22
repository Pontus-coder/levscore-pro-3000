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
      
      const supplierNumber = parseStringValue(rowObj[mapping.supplierNumber], 50)
      const supplierName = parseStringValue(rowObj[mapping.name], 200)
      
      if (!supplierNumber || !supplierName) continue
      
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

    // Upsert suppliers
    let created = 0
    let updated = 0

    for (const supplier of suppliers) {
      const existing = await prisma.supplier.findUnique({
        where: {
          supplierNumber_organizationId: {
            supplierNumber: supplier.supplierNumber,
            organizationId: ctx.organization.id,
          },
        },
      })

      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: supplier,
        })
        updated++
      } else {
        await prisma.supplier.create({
          data: supplier,
        })
        created++
      }
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
        totalSuppliers: suppliers.length,
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
