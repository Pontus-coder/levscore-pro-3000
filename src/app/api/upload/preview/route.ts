import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import * as XLSX from 'xlsx'

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

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    
    // Get headers from first row
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as unknown[][]
    
    if (jsonData.length === 0) {
      return NextResponse.json({ error: "Filen är tom" }, { status: 400 })
    }

    const headers = (jsonData[0] as string[])
      .map((h, index) => ({
        index,
        name: String(h).trim(),
        preview: jsonData.slice(1, 4).map(row => String((row as unknown[])[index] || '').substring(0, 50))
      }))
      .filter(h => h.name.length > 0)

    // Get total row count (excluding header)
    const rowCount = jsonData.length - 1

    return NextResponse.json({
      filename: file.name,
      headers,
      rowCount,
      sheetName
    })
  } catch (error) {
    console.error("Error previewing file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview file" },
      { status: 500 }
    )
  }
}

