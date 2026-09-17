import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { BrandLogo } from '@/components/ui/logo'
import { Heading, Text } from '@/components/ui/typography'
import { LoginForm } from '@/components/auth/login-form'

export function LoginCard() {
  return (
    <Card className="flex min-h-[min(100vh-4rem,720px)] w-full max-w-6xl overflow-hidden">
      <div className="flex w-full flex-col px-[clamp(2rem,6vw,4.5rem)] pb-10 pt-[clamp(3rem,20vh,8rem)] md:w-5/12">
        <CardHeader className="pb-2 pt-[7px]">
          <BrandLogo size="sm" className="mb-8" />
          <Heading as="h1" color="primary" className="text-[36px] leading-tight max-md:text-[34px]">
            Connexion
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            Accédez à votre espace de gestion.
          </Text>
        </CardHeader>
        <CardBody className="pt-0">
          <LoginForm />
        </CardBody>
      </div>

      <aside className="hidden w-7/12 bg-soft-cobalt md:flex md:justify-center">
        <div className="mt-[25%] flex flex-col items-center text-center">
          <BrandLogo size="lg" />
        </div>
      </aside>
    </Card>
  )
}
