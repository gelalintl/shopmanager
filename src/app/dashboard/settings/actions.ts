'use server'

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import {
  defaultPrintSettings,
  parsePrintSettings,
  type PrintSettings,
} from '@/lib/invoices'
import {
  digitsOnly,
  emptyToNull,
  toPrintCompany,
  type AccountProfileInput,
  type CompanyProfileInput,
  type FinancialSettingsInput,
  type PasswordInput,
  type PrintSettingsInput,
  type SettingsPayload,
} from '@/lib/settings'

const PATH = '/dashboard/settings'
const MAX_LOGO_BYTES = 1_800_000
const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateSettings() {
  revalidatePath(PATH)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/invoices')
  revalidatePath('/dashboard/invoices/new')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/reports')
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function getSettings(): Promise<SettingsPayload | null> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return null

  const [company, user] = await Promise.all([
    prisma.company.findFirst({
      where: { id: ctx.user.companyId, isActive: true },
    }),
    prisma.user.findFirst({
      where: { id: ctx.user.id, companyId: ctx.user.companyId, isDeleted: false },
      select: { name: true, pseudo: true, role: true },
    }),
  ])
  if (!company || !user) return null

  return {
    company: {
      ...toPrintCompany(company),
      phone2: company.phone2,
    },
    print: parsePrintSettings(company.printSettings),
    account: {
      name: user.name,
      pseudo: user.pseudo,
      role: user.role,
    },
  }
}

export async function updateCompanyProfile(data: CompanyProfileInput, logo?: File | null): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const name = String(data.name ?? '').trim()
  if (name.length < 2) return { ok: false, error: 'La raison sociale est obligatoire.' }

  const address = String(data.address ?? '').trim()
  if (!address) return { ok: false, error: 'L’adresse physique est obligatoire.' }

  const phone1 = digitsOnly(String(data.phone1 ?? ''))
  if (phone1.length < 8) return { ok: false, error: 'Le téléphone principal doit contenir au moins 8 chiffres.' }

  const phone2Raw = digitsOnly(String(data.phone2 ?? ''))
  const email = String(data.email ?? '').trim()
  if (email && !isEmail(email)) return { ok: false, error: 'L’email n’est pas valide.' }

  const company = await prisma.company.findFirst({
    where: { id: ctx.user.companyId, isActive: true },
    select: { printSettings: true, logoPath: true },
  })
  if (!company) return { ok: false, error: 'Entreprise introuvable.' }

  let logoPath = company.logoPath
  if (logo && logo.size > 0) {
    const stored = await storeCompanyLogo(ctx.user.companyId, logo, company.logoPath)
    if (!stored.ok) return stored
    logoPath = stored.path
  }

  const print = parsePrintSettings(company.printSettings)
  if (data.rccm !== undefined) print.rccm = String(data.rccm ?? '').trim()

  await prisma.company.update({
    where: { id: ctx.user.companyId },
    data: {
      name,
      address,
      phone1,
      phone2: phone2Raw || null,
      email: email || null,
      slogan: emptyToNull(data.slogan),
      nif: emptyToNull(data.nif),
      postBox: emptyToNull(data.postBox),
      logoPath,
      printSettings: print,
    },
  })

  revalidateSettings()
  return { ok: true }
}

export async function removeCompanyLogo(): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const company = await prisma.company.findFirst({
    where: { id: ctx.user.companyId },
    select: { logoPath: true },
  })
  if (!company) return { ok: false, error: 'Entreprise introuvable.' }

  await deleteLogoFile(company.logoPath)
  await prisma.company.update({
    where: { id: ctx.user.companyId },
    data: { logoPath: null },
  })
  revalidateSettings()
  return { ok: true }
}

export async function updateFinancialSettings(data: FinancialSettingsInput): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const current = await prisma.company.findFirst({
    where: { id: ctx.user.companyId },
    select: { printSettings: true },
  })
  if (!current) return { ok: false, error: 'Entreprise introuvable.' }

  const print = parsePrintSettings(current.printSettings)
  print.rccm = String(data.rccm ?? '').trim()
  print.bankName = String(data.bankName ?? '').trim()
  print.bankAccountName = String(data.bankAccountName ?? '').trim()

  await prisma.company.update({
    where: { id: ctx.user.companyId },
    data: {
      nif: emptyToNull(data.nif),
      rib: emptyToNull(data.rib),
      printSettings: print,
    },
  })
  revalidateSettings()
  return { ok: true }
}

export async function updatePrintSettings(data: PrintSettingsInput): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const current = await prisma.company.findFirst({
    where: { id: ctx.user.companyId },
    select: { printSettings: true },
  })
  if (!current) return { ok: false, error: 'Entreprise introuvable.' }

  const previous = parsePrintSettings(current.printSettings)
  const next: PrintSettings = {
    ...defaultPrintSettings,
    ...previous,
    accentColor: data.accentColor ?? previous.accentColor,
    footerText: String(data.footerText ?? previous.footerText).trim(),
    defaultPaymentTerms: String(data.defaultPaymentTerms ?? previous.defaultPaymentTerms).trim(),
    defaultWarrantyMonths: Math.min(Math.max(Number(data.defaultWarrantyMonths ?? previous.defaultWarrantyMonths) || 0, 0), 12),
    showRib: data.showRib ?? previous.showRib,
    showLegalMentions: data.showLegalMentions ?? previous.showLegalMentions,
    showWarranty: data.showWarranty ?? previous.showWarranty,
    showQuantity: data.showQuantity ?? previous.showQuantity,
    showUnitPrice: data.showUnitPrice ?? previous.showUnitPrice,
    showLineTotal: data.showLineTotal ?? previous.showLineTotal,
  }

  await prisma.company.update({
    where: { id: ctx.user.companyId },
    data: {
      legalMentions: emptyToNull(data.legalMentions),
      printSettings: next,
    },
  })
  revalidateSettings()
  return { ok: true }
}

export async function updateAccountProfile(data: AccountProfileInput): Promise<ActionResult & { name?: string; pseudo?: string }> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const name = String(data.name ?? '').trim()
  const pseudo = String(data.pseudo ?? '').trim()
  if (name.length < 2) return { ok: false, error: 'Le nom affiché est obligatoire.' }
  if (pseudo.length < 3) return { ok: false, error: 'Le pseudo doit contenir au moins 3 caractères.' }

  const clash = await prisma.user.findFirst({
    where: {
      companyId: ctx.user.companyId,
      pseudo,
      isDeleted: false,
      NOT: { id: ctx.user.id },
    },
    select: { id: true },
  })
  if (clash) return { ok: false, error: 'Ce pseudo est déjà utilisé dans l’entreprise.' }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { name, pseudo },
  })
  revalidateSettings()
  return { ok: true, name, pseudo }
}

export async function updatePassword(data: PasswordInput): Promise<ActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const currentPassword = String(data.currentPassword ?? '')
  const nextPassword = String(data.nextPassword ?? '')
  const confirmPassword = String(data.confirmPassword ?? '')
  if (!currentPassword) return { ok: false, error: 'Le mot de passe actuel est requis.' }
  if (nextPassword.length < 8) return { ok: false, error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }
  if (nextPassword !== confirmPassword) return { ok: false, error: 'La confirmation ne correspond pas.' }

  const user = await prisma.user.findFirst({
    where: { id: ctx.user.id, companyId: ctx.user.companyId, isDeleted: false },
    select: { password: true },
  })
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return { ok: false, error: 'Le mot de passe actuel est incorrect.' }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { password: await bcrypt.hash(nextPassword, 10) },
  })
  revalidateSettings()
  return { ok: true }
}

async function storeCompanyLogo(
  companyId: number,
  file: File,
  previousPath: string | null,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Le logo ne doit pas dépasser 1,8 Mo.' }
  }
  const ext = LOGO_TYPES[file.type]
  if (!ext) return { ok: false, error: 'Formats acceptés : PNG, JPG ou WebP.' }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'companies', String(companyId))
  await mkdir(dir, { recursive: true })
  const filename = `logo-${Date.now()}.${ext}`
  const absolute = path.join(dir, filename)
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(absolute, bytes)
  await deleteLogoFile(previousPath)
  return { ok: true, path: `/uploads/companies/${companyId}/${filename}` }
}

async function deleteLogoFile(logoPath: string | null) {
  if (!logoPath || !logoPath.startsWith('/uploads/companies/')) return
  const absolute = path.join(process.cwd(), 'public', logoPath.replace(/^\//, ''))
  try {
    await unlink(absolute)
  } catch {
    // already gone
  }
}
