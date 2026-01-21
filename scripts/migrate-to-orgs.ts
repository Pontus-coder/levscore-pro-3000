/**
 * Migration script: Move user-based data to organization-based structure
 * 
 * Run with: npx ts-node scripts/migrate-to-orgs.ts
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30)
  
  const suffix = crypto.randomBytes(4).toString("hex")
  return `${base}-${suffix}`
}

async function migrate() {
  console.log("Starting migration to organization structure...")
  
  // Get all users with suppliers
  const users = await prisma.user.findMany({
    include: {
      // @ts-expect-error - suppliers relation may not exist yet
      suppliers: true,
    },
  })
  
  console.log(`Found ${users.length} users`)
  
  for (const user of users) {
    // @ts-expect-error - suppliers may not exist
    if (!user.suppliers || user.suppliers.length === 0) {
      console.log(`User ${user.email} has no suppliers, skipping...`)
      continue
    }
    
    console.log(`Processing user: ${user.email}`)
    
    // Check if user already has an organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
    })
    
    if (existingMembership) {
      console.log(`  User already has organization, skipping...`)
      continue
    }
    
    // Create organization for user
    const orgName = user.name ? `${user.name}s team` : "Mitt team"
    const slug = generateSlug(orgName)
    
    console.log(`  Creating organization: ${orgName}`)
    
    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    })
    
    console.log(`  Created organization ${organization.id}`)
    
    // Update suppliers to belong to organization
    // @ts-expect-error - suppliers may have userId
    const supplierIds = user.suppliers.map((s: { id: string }) => s.id)
    
    console.log(`  Updating ${supplierIds.length} suppliers...`)
    
    await prisma.supplier.updateMany({
      where: { id: { in: supplierIds } },
      data: { organizationId: organization.id },
    })
    
    // Update upload history
    await prisma.uploadHistory.updateMany({
      where: { userId: user.id },
      data: { organizationId: organization.id },
    })
    
    console.log(`  Done processing user ${user.email}`)
  }
  
  console.log("Migration complete!")
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())



