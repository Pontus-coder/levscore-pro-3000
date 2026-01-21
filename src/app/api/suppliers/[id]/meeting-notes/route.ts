import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

// GET: Hämta alla mötesanteckningar för en leverantör
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validera ID-format (CUID)
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    // Verifiera att leverantören tillhör användarens organisation
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { organizationId: true },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    if (supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Hämta mötesanteckningar med användardata
    const meetingNotes = await prisma.meetingNote.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(meetingNotes)
  } catch (error) {
    console.error("Error fetching meeting notes:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta mötesanteckningar" },
      { status: 500 }
    )
  }
}

// POST: Skapa ny mötesanteckning
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validera ID-format (CUID)
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    // Verifiera att leverantören tillhör användarens organisation
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { organizationId: true },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    if (supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Parsa request body
    const body = await request.json()
    const { content, meetingDate } = body

    // Validera innehåll
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Anteckningsinnehåll krävs" },
        { status: 400 }
      )
    }

    // Begränsa längd
    if (content.length > 10000) {
      return NextResponse.json(
        { error: "Anteckningen är för lång (max 10000 tecken)" },
        { status: 400 }
      )
    }

    // Skapa mötesanteckning
    const meetingNote = await prisma.meetingNote.create({
      data: {
        supplierId: id,
        userId: ctx.user.id,
        content: content.trim(),
        meetingDate: meetingDate ? new Date(meetingDate) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(meetingNote, { status: 201 })
  } catch (error) {
    console.error("Error creating meeting note:", error)
    return NextResponse.json(
      { error: "Kunde inte skapa mötesanteckning" },
      { status: 500 }
    )
  }
}

