import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

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

    // Validate ID format
    if (!id || typeof id !== "string" || id.length < 20 || id.length > 30) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        totalRevenue: true,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership
    if (supplier.organizationId !== ctx.organization.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Hämta artiklar sorterade efter omsättning (fallande)
    const articles = await prisma.article.findMany({
      where: { supplierId: id },
      orderBy: { revenue: "desc" },
    })

    return NextResponse.json({ articles })
  } catch (error) {
    console.error("Error fetching articles:", error)
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    )
  }
}

