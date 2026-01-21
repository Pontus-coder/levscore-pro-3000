import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

// PUT: Uppdatera befintlig mötesanteckning
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, noteId } = await params

    // Validera ID-format
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    if (!noteId || typeof noteId !== 'string' || noteId.length < 20 || noteId.length > 30) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    // Hämta mötesanteckningen
    const existingNote = await prisma.meetingNote.findUnique({
      where: { id: noteId },
      include: {
        supplier: {
          select: { organizationId: true },
        },
      },
    })

    if (!existingNote) {
      return NextResponse.json({ error: "Meeting note not found" }, { status: 404 })
    }

    // Verifiera att leverantören tillhör användarens organisation
    if (existingNote.supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verifiera att användaren är skaparen
    if (existingNote.userId !== ctx.user.id) {
      return NextResponse.json(
        { error: "Du kan endast redigera dina egna anteckningar" },
        { status: 403 }
      )
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

    // Uppdatera mötesanteckning
    const updatedNote = await prisma.meetingNote.update({
      where: { id: noteId },
      data: {
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

    return NextResponse.json(updatedNote)
  } catch (error) {
    console.error("Error updating meeting note:", error)
    return NextResponse.json(
      { error: "Kunde inte uppdatera mötesanteckning" },
      { status: 500 }
    )
  }
}

// DELETE: Ta bort mötesanteckning
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const ctx = await getOrganizationContext(request)
    
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, noteId } = await params

    // Validera ID-format
    if (!id || typeof id !== 'string' || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    if (!noteId || typeof noteId !== 'string' || noteId.length < 20 || noteId.length > 30) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 })
    }

    // Hämta mötesanteckningen
    const existingNote = await prisma.meetingNote.findUnique({
      where: { id: noteId },
      include: {
        supplier: {
          select: { organizationId: true },
        },
      },
    })

    if (!existingNote) {
      return NextResponse.json({ error: "Meeting note not found" }, { status: 404 })
    }

    // Verifiera att leverantören tillhör användarens organisation
    if (existingNote.supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verifiera att användaren är skaparen
    if (existingNote.userId !== ctx.user.id) {
      return NextResponse.json(
        { error: "Du kan endast ta bort dina egna anteckningar" },
        { status: 403 }
      )
    }

    // Ta bort mötesanteckning
    await prisma.meetingNote.delete({
      where: { id: noteId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting meeting note:", error)
    return NextResponse.json(
      { error: "Kunde inte ta bort mötesanteckning" },
      { status: 500 }
    )
  }
}

