'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import {
  createUser,
  toggleUserStatus,
  updateUserRole,
} from '@/app/dashboard/users/actions'
import { roleLabels } from '@/lib/auth'
import { teamRoleOptions, type TeamMember, type TeamRole } from '@/lib/users'
import { toastResult } from '@/lib/notify'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/cn'

type TeamWorkspaceProps = {
  members: TeamMember[]
}

export function TeamWorkspace({ members }: TeamWorkspaceProps) {
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  async function handleRole(member: TeamMember, role: TeamRole) {
    setPendingId(member.publicId)
    const result = await updateUserRole(member.publicId, role)
    setPendingId(null)
    toastResult(result, 'Rôle mis à jour.')
  }

  async function handleActive(member: TeamMember, active: boolean) {
    const confirmed = await confirm({
      title: active ? 'Réactiver le compte' : 'Désactiver le compte',
      description: active ? `Réactiver ${member.name} ?` : `Désactiver le compte de ${member.name} ?`,
      confirmLabel: active ? 'Réactiver' : 'Désactiver',
      variant: active ? 'solid' : 'danger',
    })
    if (!confirmed) return
    setPendingId(member.publicId)
    const result = await toggleUserStatus(member.publicId)
    setPendingId(null)
    toastResult(result, active ? 'Compte réactivé.' : 'Compte désactivé.')
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Inviter un collaborateur</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] table-fixed text-left">
            <thead className="border-b border-subtle-border bg-powder/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Collaborateur</th>
                <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">Identifiant</th>
                <th className="w-44 px-4 py-3 text-sm font-bold text-foreground-muted">Rôle</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">Statut</th>
                <th className="w-40 px-4 py-3 text-sm font-bold text-foreground-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Text variant="muted">Aucun collaborateur pour le moment.</Text>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.publicId} className="border-b border-subtle-border last:border-0">
                    <td className="overflow-hidden px-4 py-3">
                      <Text weight="bold" className="truncate">
                        {member.name}
                      </Text>
                      <Caption className="block truncate">{member.email || '—'}</Caption>
                    </td>
                    <td className="px-4 py-3">{member.pseudo}</td>
                    <td className="px-4 py-3">
                      <select
                        className="h-9 w-full rounded-lg border border-subtle-border bg-white px-2 text-sm font-bold"
                        value={member.role === 'ADMIN' ? 'ADMIN' : 'USER'}
                        disabled={member.isCurrent || member.isDeleted || pendingId === member.publicId}
                        onChange={(event) => handleRole(member, event.target.value as TeamRole)}
                      >
                        {teamRoleOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                          member.isDeleted ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {member.isDeleted ? 'Désactivé' : 'Actif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {member.isCurrent ? (
                        <Caption>Vous</Caption>
                      ) : (
                        <Button
                          variant={member.isDeleted ? 'secondary' : 'danger'}
                          size="sm"
                          isLoading={pendingId === member.publicId}
                          onClick={() => handleActive(member, member.isDeleted)}
                        >
                          {member.isDeleted ? 'Réactiver' : 'Désactiver'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {open ? <InviteDialog onClose={() => setOpen(false)} /> : null}
      {dialog}
    </section>
  )
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    const result = await createUser({
      name: String(form.get('name') ?? ''),
      pseudo: String(form.get('pseudo') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      role: String(form.get('role') ?? 'USER'),
    })
    setLoading(false)
    if (!toastResult(result, 'Collaborateur invité.')) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <Text weight="bold">Inviter un collaborateur</Text>
        <form onSubmit={handleSubmit} className="mt-2">
          <InputField id="invite-name" name="name" label="Nom" required />
          <InputField id="invite-pseudo" name="pseudo" label="Identifiant de connexion" required />
          <InputField id="invite-email" name="email" label="Email (optionnel)" type="email" />
          <InputField id="invite-password" name="password" label="Mot de passe temporaire" type="password" required />
          <label className="mt-2.5 mb-1 block font-sans text-sm font-bold text-foreground" htmlFor="invite-role">
            Rôle
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="USER"
            className="h-10 w-full rounded-md border border-subtle-border bg-white px-3 text-sm font-bold"
          >
            {teamRoleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Caption className="mt-1 block">
            {roleLabels.USER} crée les documents et encaisse. {roleLabels.ADMIN} valide les annulations et gère
            l’équipe.
          </Caption>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Inviter
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
