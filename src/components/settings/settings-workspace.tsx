'use client'

import { useCallback, type FormEvent, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField, controlClass } from '@/components/ui/input'
import { InvoicePrintTemplate } from '@/components/invoices/invoice-print-template'
import { CompanyBrand } from '@/components/print/company-brand'
import {
  removeCompanyLogo,
  updateAccountProfile,
  updateCompanyProfile,
  updateFinancialSettings,
  updatePassword,
  updatePrintSettings,
} from '@/app/dashboard/settings/actions'
import { computeTotals, DEFAULT_PRINT_ACCENT, type PrintSettings } from '@/lib/invoices'
import type { SettingsPayload, SettingsTab } from '@/lib/settings'
import { roleLabels } from '@/lib/auth'
import { toastResult } from '@/lib/notify'
import { cn } from '@/lib/cn'

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: '🏢 Profil entreprise' },
  { id: 'fiscal', label: '🏛️ Informations fiscales & RIB' },
  { id: 'print', label: '🎨 Personnalisation impression' },
  { id: 'account', label: '🔐 Mon compte' },
]

type SettingsWorkspaceProps = {
  tab: SettingsTab
  settings: SettingsPayload
}

export function SettingsWorkspace({ tab, settings }: SettingsWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { update } = useSession()

  const setTab = useCallback(
    (next: SettingsTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'profile') params.delete('tab')
      else params.set('tab', next)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
              tab === item.id
                ? 'border-cobalt bg-cobalt text-white'
                : 'border-subtle-border bg-white text-foreground hover:border-cobalt hover:text-cobalt',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <ProfileForm company={settings.company} onCompanyName={(name) => update({ companyName: name })} />
      ) : null}
      {tab === 'fiscal' ? <FiscalForm company={settings.company} /> : null}
      {tab === 'print' ? (
        <PrintForm company={settings.company} print={settings.print} />
      ) : null}
      {tab === 'account' ? (
        <AccountForm
          account={settings.account}
          onProfile={(name, pseudo) => update({ name, pseudo })}
        />
      ) : null}
    </section>
  )
}

function ProfileForm({
  company,
  onCompanyName,
}: {
  company: SettingsPayload['company']
  onCompanyName: (name: string) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(company.logoPath ?? null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const logo = data.get('logo')
    setLoading(true)
    const result = await updateCompanyProfile(
      {
        name: String(data.get('name') ?? ''),
        slogan: String(data.get('slogan') ?? ''),
        nif: String(data.get('nif') ?? ''),
        rccm: String(data.get('rccm') ?? ''),
        phone1: String(data.get('phone1') ?? ''),
        phone2: String(data.get('phone2') ?? ''),
        email: String(data.get('email') ?? ''),
        address: String(data.get('address') ?? ''),
        postBox: String(data.get('postBox') ?? ''),
      },
      logo instanceof File && logo.size > 0 ? logo : null,
    )
    setLoading(false)
    if (!toastResult(result, 'Profil entreprise enregistré.')) return
    onCompanyName(String(data.get('name') ?? ''))
    router.refresh()
  }

  async function handleRemoveLogo() {
    setLoading(true)
    const result = await removeCompanyLogo()
    setLoading(false)
    if (!toastResult(result, 'Logo retiré.')) return
    setPreview(null)
  }

  return (
    <Card className="p-5">
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-subtle-border bg-powder">
            {preview ? (
              <CompanyBrand name={company.name} logoPath={preview} />
            ) : (
              <Caption>Aucun logo</Caption>
            )}
          </div>
          <div className="flex-1">
            <InputField
              id="logo"
              name="logo"
              label="Logo (PNG, JPG, WebP)"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setPreview(file ? URL.createObjectURL(file) : company.logoPath ?? null)
              }}
            />
            {company.logoPath ? (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleRemoveLogo} disabled={loading}>
                Retirer le logo
              </Button>
            ) : null}
          </div>
        </div>
        <InputField id="name" name="name" label="Raison sociale" defaultValue={company.name} required />
        <InputField id="slogan" name="slogan" label="Slogan" defaultValue={company.slogan ?? ''} />
        <InputField id="phone1" name="phone1" label="Téléphone 1" defaultValue={company.phone1} required />
        <InputField id="phone2" name="phone2" label="Téléphone 2" defaultValue={company.phone2 ?? ''} />
        <InputField id="email" name="email" label="Email" type="email" defaultValue={company.email ?? ''} />
        <InputField id="postBox" name="postBox" label="Boîte postale" defaultValue={company.postBox ?? ''} />
        <InputField id="address" name="address" label="Adresse physique" defaultValue={company.address} required className="lg:col-span-2" />
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          <InputField id="nif" name="nif" label="NIF" defaultValue={company.nif ?? ''} />
          <InputField id="rccm" name="rccm" label="RCCM" defaultValue={company.rccm ?? ''} />
        </div>
        <div className="lg:col-span-2 flex items-center gap-3">
          <Button type="submit" isLoading={loading}>Enregistrer le profil</Button>
        </div>
      </form>
    </Card>
  )
}

function FiscalForm({ company }: { company: SettingsPayload['company'] }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setLoading(true)
    const result = await updateFinancialSettings({
      nif: String(data.get('nif') ?? ''),
      rccm: String(data.get('rccm') ?? ''),
      rib: String(data.get('rib') ?? ''),
      bankName: String(data.get('bankName') ?? ''),
      bankAccountName: String(data.get('bankAccountName') ?? ''),
    })
    setLoading(false)
    toastResult(result, 'Coordonnées bancaires enregistrées. Elles apparaîtront sur les factures.')
  }

  return (
    <Card className="p-5">
      <Text weight="bold">Virements & identification fiscale</Text>
      <Caption className="mt-1 block">Ces mentions sont imprimées sur les factures lorsque le RIB est activé.</Caption>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <InputField id="fiscal-nif" name="nif" label="NIF" defaultValue={company.nif ?? ''} />
        <InputField id="fiscal-rccm" name="rccm" label="RCCM" defaultValue={company.rccm ?? ''} />
        <InputField id="bankName" name="bankName" label="Nom de la banque" defaultValue={company.bankName ?? ''} />
        <InputField id="bankAccountName" name="bankAccountName" label="Intitulé du compte" defaultValue={company.bankAccountName ?? ''} />
        <InputField id="rib" name="rib" label="RIB" defaultValue={company.rib ?? ''} className="sm:col-span-2" />
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" isLoading={loading}>Enregistrer les informations fiscales</Button>
        </div>
      </form>
    </Card>
  )
}

function PrintForm({
  company,
  print,
}: {
  company: SettingsPayload['company']
  print: PrintSettings
}) {
  const [loading, setLoading] = useState(false)
  const [legalMentions, setLegalMentions] = useState(company.legalMentions ?? '')
  const [footerText, setFooterText] = useState(print.footerText)
  const [accentColor, setAccentColor] = useState(print.accentColor || DEFAULT_PRINT_ACCENT)
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(print.defaultPaymentTerms)
  const [defaultWarrantyMonths, setDefaultWarrantyMonths] = useState(print.defaultWarrantyMonths)
  const [flags, setFlags] = useState({
    showRib: print.showRib,
    showLegalMentions: print.showLegalMentions,
    showWarranty: print.showWarranty,
    showQuantity: print.showQuantity,
    showUnitPrice: print.showUnitPrice,
    showLineTotal: print.showLineTotal,
  })

  const liveSettings: PrintSettings = {
    ...print,
    ...flags,
    accentColor,
    footerText,
    defaultPaymentTerms,
    defaultWarrantyMonths,
  }
  const liveCompany = { ...company, legalMentions: legalMentions || null }
  const previewTotals = computeTotals([{ unitPrice: 25000, quantity: 2, discountRate: 0 }], true, 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const result = await updatePrintSettings({
      legalMentions,
      footerText,
      accentColor,
      defaultPaymentTerms,
      defaultWarrantyMonths,
      ...flags,
    })
    setLoading(false)
    toastResult(result, 'Préférences d’impression enregistrées.')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col">
            <span className="mt-2.5 mb-1 font-sans text-sm font-bold">Mentions légales</span>
            <textarea
              className={controlClass}
              rows={4}
              value={legalMentions}
              onChange={(event) => setLegalMentions(event.target.value)}
            />
          </label>
          <label className="flex flex-col">
            <span className="mt-2.5 mb-1 font-sans text-sm font-bold">Pied de page A4</span>
            <textarea
              className={controlClass}
              rows={3}
              value={footerText}
              onChange={(event) => setFooterText(event.target.value)}
            />
          </label>
          <label className="flex flex-col">
            <span className="mt-2.5 mb-1 font-sans text-sm font-bold">Conditions de règlement</span>
            <textarea
              className={controlClass}
              rows={3}
              value={defaultPaymentTerms}
              onChange={(event) => setDefaultPaymentTerms(event.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              id="warrantyMonths"
              label="Garantie par défaut (mois)"
              type="number"
              min={0}
              max={12}
              value={defaultWarrantyMonths}
              onChange={(event) => setDefaultWarrantyMonths(Number(event.target.value) || 0)}
            />
            <label className="flex flex-col">
              <span className="mt-2.5 mb-1 font-sans text-sm font-bold">Couleur d’accentuation</span>
              <input
                type="color"
                className="h-10 w-full cursor-pointer rounded-md border border-subtle-border"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['showRib', 'Afficher le RIB'],
                ['showLegalMentions', 'Afficher les mentions légales'],
                ['showWarranty', 'Afficher la garantie'],
                ['showQuantity', 'Colonne quantité'],
                ['showUnitPrice', 'Colonne prix unitaire'],
                ['showLineTotal', 'Colonne montant HT'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={flags[key]}
                  onChange={(event) => setFlags((current) => ({ ...current, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={loading}>Enregistrer l’impression</Button>
          </div>
        </form>
      </Card>
      <div className="overflow-auto rounded-2xl border border-subtle-border bg-powder p-3">
        <Caption className="mb-2 block font-bold">Aperçu A4</Caption>
        <div className="origin-top scale-[0.62]">
          <InvoicePrintTemplate
            kind="INVOICE"
            code="FAC-APERÇU"
            dateLabel="Niamey, le modèle"
            company={liveCompany}
            customer={{
              name: 'Client exemple',
              phone: '90000000',
              address: 'Niamey',
              postBox: null,
              email: null,
              nif: null,
            }}
            lines={[{ designation: 'Prestation exemple', quantity: 2, unitPrice: 25000, discountRate: 0, ht: 50000 }]}
            totals={previewTotals}
            warranty={defaultWarrantyMonths}
            settings={liveSettings}
          />
        </div>
      </div>
    </div>
  )
}

function AccountForm({
  account,
  onProfile,
}: {
  account: SettingsPayload['account']
  onProfile: (name: string, pseudo: string) => void
}) {
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setLoadingProfile(true)
    const result = await updateAccountProfile({
      name: String(data.get('name') ?? ''),
      pseudo: String(data.get('pseudo') ?? ''),
    })
    setLoadingProfile(false)
    if (!toastResult(result, 'Profil mis à jour.')) return
    onProfile(result.name ?? '', result.pseudo ?? '')
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setLoadingPassword(true)
    const result = await updatePassword({
      currentPassword: String(data.get('currentPassword') ?? ''),
      nextPassword: String(data.get('nextPassword') ?? ''),
      confirmPassword: String(data.get('confirmPassword') ?? ''),
    })
    setLoadingPassword(false)
    if (!toastResult(result, 'Mot de passe modifié.')) return
    form.reset()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <Text weight="bold">Profil connecté</Text>
        <Caption className="mt-1 block">
          {account.role in roleLabels ? roleLabels[account.role as keyof typeof roleLabels] : account.role}
        </Caption>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleProfile}>
          <InputField id="account-name" name="name" label="Nom" defaultValue={account.name} required />
          <InputField id="account-pseudo" name="pseudo" label="Pseudo" defaultValue={account.pseudo} required />
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={loadingProfile}>Enregistrer</Button>
          </div>
        </form>
      </Card>
      <Card className="p-5">
        <Text weight="bold">Changer le mot de passe</Text>
        <Caption className="mt-1 block">Le mot de passe actuel est exigé.</Caption>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handlePassword}>
          <InputField id="currentPassword" name="currentPassword" label="Mot de passe actuel" type="password" required />
          <InputField id="nextPassword" name="nextPassword" label="Nouveau mot de passe" type="password" required minLength={8} />
          <InputField id="confirmPassword" name="confirmPassword" label="Confirmation" type="password" required minLength={8} />
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={loadingPassword}>Mettre à jour</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
