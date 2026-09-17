import type { Metadata } from 'next'
import { LoginCard } from '@/components/auth/login-card'

export const metadata: Metadata = {
  title: 'SM | LOGIN',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-powder px-4 py-8">
      <LoginCard />
    </main>
  )
}
