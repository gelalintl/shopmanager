import {
  defaultPrintSettings,
  parsePrintSettings,
  type PrintCompany,
  type PrintSettings,
} from '@/lib/invoices'

export type SettingsTab = 'profile' | 'fiscal' | 'print' | 'account'

export type CompanyProfileInput = {
  name: string
  slogan?: string
  nif?: string
  rccm?: string
  phone1: string
  phone2?: string
  email?: string
  address: string
  postBox?: string
}

export type FinancialSettingsInput = {
  nif?: string
  rccm?: string
  rib?: string
  bankName?: string
  bankAccountName?: string
}

export type PrintSettingsInput = {
  legalMentions?: string
  footerText?: string
  accentColor?: string
  defaultPaymentTerms?: string
  defaultWarrantyMonths?: number
  showRib?: boolean
  showLegalMentions?: boolean
  showWarranty?: boolean
  showQuantity?: boolean
  showUnitPrice?: boolean
  showLineTotal?: boolean
}

export type AccountProfileInput = {
  name: string
  pseudo: string
}

export type PasswordInput = {
  currentPassword: string
  nextPassword: string
  confirmPassword: string
}

export type SettingsCompany = PrintCompany & {
  phone2: string | null
}

export type SettingsAccount = {
  name: string
  pseudo: string
  role: string
}

export type SettingsPayload = {
  company: SettingsCompany
  print: PrintSettings
  account: SettingsAccount
}

const TABS: SettingsTab[] = ['profile', 'fiscal', 'print', 'account']

export function parseSettingsTab(value?: string | null): SettingsTab {
  return TABS.includes(value as SettingsTab) ? (value as SettingsTab) : 'profile'
}

export function emptyToNull(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

export function digitsOnly(value: string) {
  return value.replace(/\D+/g, '')
}

export function toPrintCompany(company: {
  name: string
  address: string
  postBox: string | null
  phone1: string
  phone2?: string | null
  email: string | null
  nif: string | null
  rib: string | null
  legalMentions: string | null
  slogan: string | null
  logoPath?: string | null
  printSettings?: unknown
}): PrintCompany {
  const extras = parsePrintSettings(company.printSettings)
  return {
    name: company.name,
    address: company.address,
    postBox: company.postBox,
    phone1: company.phone1,
    phone2: company.phone2 ?? null,
    email: company.email,
    nif: company.nif,
    rccm: extras.rccm || null,
    rib: company.rib,
    bankName: extras.bankName || null,
    bankAccountName: extras.bankAccountName || null,
    legalMentions: company.legalMentions,
    slogan: company.slogan,
    logoPath: company.logoPath ?? null,
  }
}

export function settingsFromCompany(printSettings: unknown): PrintSettings {
  return parsePrintSettings(printSettings ?? defaultPrintSettings)
}
