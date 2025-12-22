-- Migration: Move user-based suppliers to organization structure
-- Run this in your database console or via Prisma

-- Step 1: Create organizations for users who have suppliers
INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  COALESCE(u.name || 's team', 'Mitt team'),
  LOWER(REGEXP_REPLACE(COALESCE(u.name, 'team'), '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8),
  NOW(),
  NOW()
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Supplier" s WHERE s."userId" = u.id)
AND NOT EXISTS (SELECT 1 FROM "OrganizationMember" om WHERE om."userId" = u.id);

-- Step 2: Create organization memberships (OWNER role)
INSERT INTO "OrganizationMember" (id, "userId", "organizationId", role, "joinedAt")
SELECT 
  gen_random_uuid()::text,
  u.id,
  o.id,
  'OWNER',
  NOW()
FROM "User" u
CROSS JOIN LATERAL (
  SELECT o.id 
  FROM "Organization" o 
  WHERE o.name = COALESCE(u.name || 's team', 'Mitt team')
  LIMIT 1
) o
WHERE EXISTS (SELECT 1 FROM "Supplier" s WHERE s."userId" = u.id)
AND NOT EXISTS (SELECT 1 FROM "OrganizationMember" om WHERE om."userId" = u.id);

-- Step 3: Update suppliers with organizationId
UPDATE "Supplier" s
SET "organizationId" = om."organizationId"
FROM "OrganizationMember" om
WHERE s."userId" = om."userId"
AND s."organizationId" IS NULL;

-- Step 4: Update upload history with organizationId  
UPDATE "UploadHistory" uh
SET "organizationId" = om."organizationId"
FROM "OrganizationMember" om
WHERE uh."userId" = om."userId"
AND uh."organizationId" IS NULL;

