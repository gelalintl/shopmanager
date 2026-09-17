import { PrismaClient, RoleName } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Début du seeding...')

  // 1. Création de l'entreprise racine
  const company = await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Electic Niger',
      address: 'Niamey',
      nif: '65278/R',
      postBox: '10462',
      email: 'honliassoo@gmail.com',
      phone1: '96019191',
      isActive: true,
    },
  })

  // 2. Hachage explicite du mot de passe Admin2026!
  const hashedPassword = await bcrypt.hash('Admin2026!', 10)

  // 3. Import / Mise à jour du compte Admin
  const adminUser = await prisma.user.upsert({
    where: {
      companyId_pseudo: {
        companyId: company.id,
        pseudo: 'admin',
      },
    },
    update: {
      password: hashedPassword,
      isDeleted: false,
    },
    create: {
      companyId: company.id,
      name: 'administrateur',
      pseudo: 'admin',
      password: hashedPassword,
      role: RoleName.TENANT_SUPERADMIN,
      isDeleted: false,
    },
  })

  console.log(`✅ Compte Administrateur configuré : ${adminUser.pseudo}`)

  // 4. Initialisation des séquences de numérotation
  await prisma.documentSequence.upsert({
    where: {
      companyId_fiscalYear_type: {
        companyId: company.id,
        fiscalYear: 2026,
        type: 'ESTIMATION',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      fiscalYear: 2026,
      type: 'ESTIMATION',
      lastValue: 0,
    },
  })

  await prisma.documentSequence.upsert({
    where: {
      companyId_fiscalYear_type: {
        companyId: company.id,
        fiscalYear: 2026,
        type: 'INVOICE',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      fiscalYear: 2026,
      type: 'INVOICE',
      lastValue: 0,
    },
  })

  console.log('✅ Séquences de numérotation initialisées.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })