import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'

export default function CustomerNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <Heading as="h2">Client introuvable</Heading>
      <Text variant="muted">
        Cette fiche n’existe pas, a été supprimée, ou n’appartient pas à votre entreprise.
      </Text>
      <Link href="/dashboard/customers">
        <Button>Retour à la liste</Button>
      </Link>
    </div>
  )
}
