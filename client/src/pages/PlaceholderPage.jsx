import { Construction } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, CardContent } from '@/components/ui/card'

export default function PlaceholderPage({ title }) {
  return (
    <PageWrapper title={title}>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Construction size={36} />
          <p className="font-medium">{title} — coming in a future phase</p>
          <p className="text-sm">Check TASKS.md for the build order.</p>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
