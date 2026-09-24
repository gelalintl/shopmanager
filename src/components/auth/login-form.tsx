'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input'
import { Caption } from '@/components/ui/typography'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.1" />
      <path d="M6.1 6.1A18 18 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 4.2-.8" />
    </svg>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ pseudo?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors: { pseudo?: string; password?: string } = {}
    if (!pseudo.trim()) nextFieldErrors.pseudo = 'Le pseudo est requis.'
    if (!password) nextFieldErrors.password = 'Le mot de passe est requis.'

    setFieldErrors(nextFieldErrors)
    setError(null)

    if (nextFieldErrors.pseudo || nextFieldErrors.password) {
      return
    }

    setLoading(true)

    const result = await signIn('credentials', {
      pseudo: pseudo.trim(),
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Identifiants incorrects.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
      {error ? (
        <Caption color="danger" className="italic">
          *{error}
        </Caption>
      ) : null}

      <div>
        <InputField
          id="pseudo"
          name="pseudo"
          label="Pseudo"
          placeholder="Pseudo"
          autoComplete="username"
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          error={fieldErrors.pseudo}
          disabled={loading}
          className="focus:ring-cobalt"
        />
      </div>

      <div className="mb-4">
        <InputField
          id="mdp"
          name="password"
          label="Mot de Passe"
          placeholder="Mot de Passe"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          disabled={loading}
          className="focus:ring-cobalt"
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((open) => !open)}
              className="p-1 text-foreground-muted transition-all duration-200 hover:text-foreground"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <EyeIcon open={showPassword} />
            </button>
          }
        />
      </div>

      <Button
        type="submit"
        variant="solid"
        size="lg"
        isLoading={loading}
        className="w-full uppercase bg-cobalt hover:bg-cobalt-hover"
      >
        Connexion
      </Button>
    </form>
  )
}
