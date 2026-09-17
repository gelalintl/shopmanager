import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'

export default function PaymentReceiptNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <Heading as="h2">Reçu introuvable</Heading>
      <Text variant="muted">
        Ce règlement n’existe pas, a été annulé, ou n’appartient pas à votre entreprise.
      </Text>
      <Link href="/dashboard/payments">
        <Button>Retour au journal</Button>
      </Link>
    </div>
  )
}
