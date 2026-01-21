import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function setSuperAdmin() {
  try {
    const email = "konsbergpontus@gmail.com"
    
    console.log(`Setting ${email} as super admin...`)

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log(`User ${email} does not exist. Creating user...`)
      user = await prisma.user.create({
        data: {
          email,
          name: "Pontus Konsberg",
          isSuperAdmin: true,
        },
      })
      console.log(`✅ User created and set as super admin`)
    } else {
      // Update existing user
      user = await prisma.user.update({
        where: { email },
        data: {
          isSuperAdmin: true,
        },
      })
      console.log(`✅ User updated to super admin`)
    }

    console.log(`\nSuper admin set successfully!`)
    console.log(`Email: ${user.email}`)
    console.log(`Name: ${user.name}`)
    console.log(`Super Admin: ${user.isSuperAdmin}`)
  } catch (error) {
    console.error("Error setting super admin:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setSuperAdmin()



