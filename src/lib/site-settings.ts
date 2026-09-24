import { prisma } from '@/lib/prisma'
import { DEFAULT_PRIMARY_COLOR, resolveSignatoryTitle } from '@/lib/invoices'

export const COMPANY_LOGO_SETTING_KEY = 'company_logo'
export const DELIVERY_SIGNATORY_TITLE_KEY = 'delivery_signatory_title'
export const PRIMARY_COLOR_SETTING_KEY = 'primary_color'

const LOGO_DATA_URI = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i
const MAX_LOGO_DATA_URI_CHARS = 2_600_000

export function isLogoDataUri(value: unknown): value is string {
  const text = String(value ?? '').trim()
  return text.startsWith('data:image/') && LOGO_DATA_URI.test(text.replace(/\s+/g, ''))
}

export function normalizeLogoDataUri(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!isLogoDataUri(text)) return null
  const compact = text.replace(/\s+/g, '')
  if (compact.length > MAX_LOGO_DATA_URI_CHARS) return null
  return compact
}

export async function getSiteSetting(companyId: number, key: string): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { value: true },
  })
  const value = String(setting?.value ?? '').trim()
  return value || null
}

export async function setSiteSetting(companyId: number, key: string, value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) {
    await prisma.siteSetting.deleteMany({ where: { companyId, key } })
    return
  }
  await prisma.siteSetting.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, value: trimmed },
    update: { value: trimmed },
  })
}

export async function getDeliverySignatoryTitle(companyId: number): Promise<string> {
  return resolveSignatoryTitle(await getSiteSetting(companyId, DELIVERY_SIGNATORY_TITLE_KEY))
}

export function parsePrimaryColor(value: unknown): string {
  const raw = String(value ?? '').trim()
  return /^#([0-9a-fA-F]{6})$/.test(raw) ? raw.toLowerCase() : DEFAULT_PRIMARY_COLOR
}

export async function getPrimaryColor(companyId: number): Promise<string> {
  return parsePrimaryColor(await getSiteSetting(companyId, PRIMARY_COLOR_SETTING_KEY))
}

export async function setPrimaryColor(companyId: number, color: string): Promise<void> {
  await setSiteSetting(companyId, PRIMARY_COLOR_SETTING_KEY, parsePrimaryColor(color))
}

export async function setDeliverySignatoryTitle(companyId: number, title: string): Promise<void> {
  await setSiteSetting(companyId, DELIVERY_SIGNATORY_TITLE_KEY, resolveSignatoryTitle(title))
}

export async function getCompanyLogo(companyId: number): Promise<string | null> {
  const fromSettings = normalizeLogoDataUri(await getSiteSetting(companyId, COMPANY_LOGO_SETTING_KEY))
  if (fromSettings) return fromSettings

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { logoPath: true },
  })
  const fromCompany = normalizeLogoDataUri(company?.logoPath)
  if (fromCompany) {
    await setCompanyLogo(companyId, fromCompany)
    return fromCompany
  }
  return null
}

export async function setCompanyLogo(companyId: number, dataUri: string): Promise<void> {
  await setSiteSetting(companyId, COMPANY_LOGO_SETTING_KEY, dataUri)
}

export async function clearCompanyLogo(companyId: number): Promise<void> {
  await prisma.siteSetting.deleteMany({
    where: { companyId, key: COMPANY_LOGO_SETTING_KEY },
  })
}
