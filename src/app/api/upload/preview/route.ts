import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { validateFile, sanitizeFilename, MAX_ROWS } from "@/lib/file-validation"
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // SECURITY: Validate file
    const validation = await validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    
    // SECURITY: Limit parsing options to prevent XXE and other attacks
    const workbook = XLSX.read(buffer, { 
      type: 'array',
      cellDates: false, // Don't parse dates to prevent formula injection
      cellFormula: false, // Don't evaluate formulas
      cellHTML: false, // Don't parse HTML
      cellStyles: false, // Don't parse styles
      sheetStubs: false,
    })
    
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Get headers from first row
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as unknown[][]
    
    if (jsonData.length === 0) {
      return NextResponse.json({ error: "Filen är tom" }, { status: 400 })
    }

    // SECURITY: Limit number of rows
    if (jsonData.length > MAX_ROWS) {
      return NextResponse.json({ 
        error: `Filen innehåller för många rader. Max ${MAX_ROWS.toLocaleString()} rader tillåtet.` 
      }, { status: 400 })
    }

    const headers = (jsonData[0] as string[])
      .map((h, index) => ({
        index,
        name: String(h || '').trim().substring(0, 100), // Limit header length
        preview: jsonData.slice(1, 4).map(row => 
          String((row as unknown[])[index] || '').substring(0, 50)
        )
      }))
      .filter(h => h.name.length > 0)

    // Get total row count (excluding header)
    const rowCount = jsonData.length - 1

    return NextResponse.json({
      filename: sanitizeFilename(file.name),
      headers,
      rowCount,
      sheetName: String(sheetName).substring(0, 100),
    })
  } catch (error) {
    console.error("Error previewing file:", error)
    // Don't expose internal error details
    return NextResponse.json(
      { error: "Kunde inte läsa filen. Kontrollera att det är en giltig Excel-fil." },
      { status: 500 }
    )
  }
}
