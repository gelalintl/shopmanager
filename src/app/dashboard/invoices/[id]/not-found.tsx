import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'

export default function InvoiceNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <Heading as="h2">Document introuvable</Heading>
      <Text variant="muted">Ce devis ou cette facture n’existe pas, ou n’appartient pas à votre entreprise.</Text>
      <Link href="/dashboard/invoices">
        <Button>Retour à la liste</Button>
      </Link>
    </div>
  )
}
