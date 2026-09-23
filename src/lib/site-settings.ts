import { prisma } from '@/lib/prisma'

export const COMPANY_LOGO_SETTING_KEY = 'company_logo'

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

export async function getCompanyLogo(companyId: number): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({
    where: {
      companyId_key: { companyId, key: COMPANY_LOGO_SETTING_KEY },
    },
    select: { value: true },
  })
  const fromSettings = normalizeLogoDataUri(setting?.value)
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
  await prisma.siteSetting.upsert({
    where: {
      companyId_key: { companyId, key: COMPANY_LOGO_SETTING_KEY },
    },
    create: {
      companyId,
      key: COMPANY_LOGO_SETTING_KEY,
      value: dataUri,
    },
    update: { value: dataUri },
  })
}

export async function clearCompanyLogo(companyId: number): Promise<void> {
  await prisma.siteSetting.deleteMany({
    where: { companyId, key: COMPANY_LOGO_SETTING_KEY },
  })
}
