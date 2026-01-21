/**
 * Migration script: Move user-based data to organization-based structure
 * Run with: node scripts/migrate.mjs
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function generateSlug(name) {
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
  
  // Get all unique userIds from suppliers that don't have organizations yet
  const suppliersNeedingOrg = await prisma.supplier.findMany({
    where: {
      organizationId: null,
      userId: { not: null }
    },
    select: {
      userId: true
    },
    distinct: ['userId']
  })
  
  const userIds = suppliersNeedingOrg.map(s => s.userId).filter(Boolean)
  console.log(`Found ${userIds.length} users needing organization migration`)
  
  for (const userId of userIds) {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!user) {
      console.log(`User ${userId} not found, skipping...`)
      continue
    }
    
    console.log(`Processing user: ${user.email}`)
    
    // Check if user already has an organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId: user.id }
    })
    
    let organizationId
    
    if (existingMembership) {
      console.log(`  User already has organization ${existingMembership.organizationId}`)
      organizationId = existingMembership.organizationId
    } else {
      // Create organization for user
      const orgName = user.name ? `${user.name}s team` : "Mitt team"
      const slug = generateSlug(orgName)
      
      console.log(`  Creating organization: ${orgName} (${slug})`)
      
      const organization = await prisma.organization.create({
        data: {
          name: orgName,
          slug,
          members: {
            create: {
              userId: user.id,
              role: "OWNER"
            }
          }
        }
      })
      
      organizationId = organization.id
      console.log(`  Created organization ${organizationId}`)
    }
    
    // Update all suppliers for this user
    const updateResult = await prisma.supplier.updateMany({
      where: { 
        userId: user.id,
        organizationId: null
      },
      data: { organizationId }
    })
    
    console.log(`  Updated ${updateResult.count} suppliers`)
    
    // Update upload history
    const uploadResult = await prisma.uploadHistory.updateMany({
      where: {
        userId: user.id,
        organizationId: null
      },
      data: { organizationId }
    })
    
    console.log(`  Updated ${uploadResult.count} upload history records`)
  }
  
  // Verify migration
  const suppliersWithoutOrg = await prisma.supplier.count({
    where: { organizationId: null }
  })
  
  console.log(`\nMigration complete!`)
  console.log(`Suppliers without organization: ${suppliersWithoutOrg}`)
  
  if (suppliersWithoutOrg === 0) {
    console.log("✅ All suppliers have been migrated!")
  } else {
    console.log("⚠️  Some suppliers still need migration")
  }
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())



