import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getOrganizationContext } from "@/lib/organization"

export async function DELETE(request: NextRequest) {
  try {
    const context = await getOrganizationContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verifiera att användaren har rätt behörighet (OWNER eller ADMIN)
    if (context.role !== "OWNER" && context.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Du måste vara OWNER eller ADMIN för att radera all data" },
        { status: 403 }
      )
    }

    // Radera alla leverantörer för organisationen (cascade tar bort customFactors automatiskt)
    const deletedSuppliers = await prisma.supplier.deleteMany({
      where: {
        organizationId: context.organization.id,
      },
    })

    // Radera alla upload history
    const deletedUploads = await prisma.uploadHistory.deleteMany({
      where: {
        organizationId: context.organization.id,
      },
    })

    // Radera alla artiklar för organisationen
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: context.organization.id },
      select: { id: true },
    })
    const supplierIds = suppliers.map(s => s.id)
    
    let deletedArticles = 0
    if (supplierIds.length > 0) {
      const deletedArticlesResult = await prisma.article.deleteMany({
        where: {
          supplierId: { in: supplierIds },
        },
      })
      deletedArticles = deletedArticlesResult.count
    }

    // Radera alla invitations för organisationen
    const deletedInvitations = await prisma.invitation.deleteMany({
      where: {
        organizationId: context.organization.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: "All data har raderats",
      deletedSuppliers: deletedSuppliers.count,
      deletedUploads: deletedUploads.count,
      deletedArticles,
      deletedInvitations: deletedInvitations.count,
    })
  } catch (error) {
    console.error("Delete all error:", error)
    return NextResponse.json(
      { error: "Kunde inte radera data" },
      { status: 500 }
    )
  }
}

