import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const tier = searchParams.get("tier")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "totalScore"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      userId: user.id,
    }
    
    if (tier) {
      where.tier = tier
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { supplierNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        customFactors: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    // Calculate aggregated stats
    const stats = {
      totalSuppliers: suppliers.length,
      totalRevenue: suppliers.reduce((sum, s) => sum + Number(s.totalRevenue), 0),
      avgMargin: suppliers.length > 0 
        ? suppliers.reduce((sum, s) => sum + Number(s.avgMargin), 0) / suppliers.length 
        : 0,
      avgTotalScore: suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + Number(s.totalScore), 0) / suppliers.length
        : 0,
      tierDistribution: suppliers.reduce((acc, s) => {
        const tier = s.tier || "Okänd"
        acc[tier] = (acc[tier] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({ suppliers, stats })
  } catch (error) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    )
  }
}
