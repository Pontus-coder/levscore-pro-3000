import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateDerivedFields } from "@/lib/score-calculator"
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

function parseStringValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
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

    const mapping: ColumnMapping = JSON.parse(mappingJson)

    if (!mapping.supplierNumber || !mapping.name) {
      return NextResponse.json(
        { error: "Leverantörsnummer och Leverantör måste mappas" },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    
    if (jsonData.length === 0) {
      return NextResponse.json({ error: "Filen är tom" }, { status: 400 })
    }

    const suppliers = []
    
    for (const row of jsonData) {
      const rowObj = row as Record<string, unknown>
      
      const supplierNumber = parseStringValue(rowObj[mapping.supplierNumber])
      const supplierName = parseStringValue(rowObj[mapping.name])
      
      if (!supplierNumber || !supplierName) continue
      
      // Hämta grunddata
      const baseData = {
        supplierNumber,
        name: supplierName,
        userId: user.id,
        rowCount: mapping.rowCount ? parseNumericValue(rowObj[mapping.rowCount]) : 0,
        totalQuantity: mapping.totalQuantity ? parseNumericValue(rowObj[mapping.totalQuantity]) : 0,
        totalRevenue: mapping.totalRevenue ? parseNumericValue(rowObj[mapping.totalRevenue]) : 0,
        avgMargin: mapping.avgMargin ? parseNumericValue(rowObj[mapping.avgMargin]) : 0,
        salesScore: mapping.salesScore ? parseNumericValue(rowObj[mapping.salesScore]) : 0,
        assortmentScore: mapping.assortmentScore ? parseNumericValue(rowObj[mapping.assortmentScore]) : 0,
        efficiencyScore: mapping.efficiencyScore ? parseNumericValue(rowObj[mapping.efficiencyScore]) : 0,
        marginScore: mapping.marginScore ? parseNumericValue(rowObj[mapping.marginScore]) : 0,
        totalScore: mapping.totalScore ? parseNumericValue(rowObj[mapping.totalScore]) : 0,
        diagnosis: mapping.diagnosis ? parseStringValue(rowObj[mapping.diagnosis]) : null,
        shortAction: mapping.shortAction ? parseStringValue(rowObj[mapping.shortAction]) : null,
        revenueShare: mapping.revenueShare ? parseNumericValue(rowObj[mapping.revenueShare]) : 0,
        accumulatedShare: mapping.accumulatedShare ? parseNumericValue(rowObj[mapping.accumulatedShare]) : 0,
        tier: mapping.tier ? parseStringValue(rowObj[mapping.tier]) : null,
        profile: mapping.profile ? parseStringValue(rowObj[mapping.profile]) : null,
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
          supplierNumber_userId: {
            supplierNumber: supplier.supplierNumber,
            userId: user.id,
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
        userId: user.id,
        fileName: file.name,
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
      { error: error instanceof Error ? error.message : "Failed to import file" },
      { status: 500 }
    )
  }
}
