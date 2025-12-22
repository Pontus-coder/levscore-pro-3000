import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { parseExcelFile, validateExcelHeaders } from "@/lib/excel-parser"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Check file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ]
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV" },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()

    // Validate headers
    const validation = validateExcelHeaders(buffer)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: `Saknade kolumner: ${validation.missingColumns.join(', ')}. Hittade: ${validation.foundColumns.slice(0, 5).join(', ')}${validation.foundColumns.length > 5 ? '...' : ''}`,
          missingColumns: validation.missingColumns,
          foundColumns: validation.foundColumns
        },
        { status: 400 }
      )
    }

    // Parse the file
    const suppliers = parseExcelFile(buffer)

    // Upsert suppliers (update if exists, create if not)
    const results = await Promise.all(
      suppliers.map(async (supplier) => {
        return prisma.supplier.upsert({
          where: { supplierNumber: supplier.supplierNumber },
          update: {
            name: supplier.name,
            rowCount: supplier.rowCount,
            totalQuantity: supplier.totalQuantity,
            totalRevenue: supplier.totalRevenue,
            avgMargin: supplier.avgMargin,
            salesScore: supplier.salesScore,
            assortmentScore: supplier.assortmentScore,
            efficiencyScore: supplier.efficiencyScore,
            marginScore: supplier.marginScore,
            totalScore: supplier.totalScore,
            diagnosis: supplier.diagnosis,
            shortAction: supplier.shortAction,
            revenueShare: supplier.revenueShare,
            accumulatedShare: supplier.accumulatedShare,
            tier: supplier.tier,
            profile: supplier.profile,
          },
          create: {
            supplierNumber: supplier.supplierNumber,
            name: supplier.name,
            rowCount: supplier.rowCount,
            totalQuantity: supplier.totalQuantity,
            totalRevenue: supplier.totalRevenue,
            avgMargin: supplier.avgMargin,
            salesScore: supplier.salesScore,
            assortmentScore: supplier.assortmentScore,
            efficiencyScore: supplier.efficiencyScore,
            marginScore: supplier.marginScore,
            totalScore: supplier.totalScore,
            diagnosis: supplier.diagnosis,
            shortAction: supplier.shortAction,
            revenueShare: supplier.revenueShare,
            accumulatedShare: supplier.accumulatedShare,
            tier: supplier.tier,
            profile: supplier.profile,
          },
        })
      })
    )

    // Log the upload
    await prisma.uploadHistory.create({
      data: {
        userId: session.user.id,
        filename: file.name,
        supplierCount: results.length,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${results.length} leverantörer importerade`,
      count: results.length,
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    )
  }
}

