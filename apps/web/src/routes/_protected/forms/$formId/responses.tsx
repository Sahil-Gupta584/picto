import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card, Chip } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Button } from '#/components/Button'
import { RiArrowLeftLine } from 'react-icons/ri'

export const Route = createFileRoute('/_protected/forms/$formId/responses')({
  component: FormResponsesPage,
})

function FormResponsesPage() {
  const { formId } = Route.useParams()
  const router = useRouter()

  const { data: formSubmissions, isLoading } = useQuery(
    orpc.forms.getFormSubmissions.queryOptions({ input: { formId } }),
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-gray-500">Loading responses...</p>
      </div>
    )
  }

  const submissions = (formSubmissions as any[]) || []

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.navigate({ to: '/dashboard' })}
        startContent={<RiArrowLeftLine />}
      >
        Back to Dashboard
      </Button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Form Responses</h1>
          <p className="text-sm text-gray-500">
            View collected gift claim requests
          </p>
        </div>
        <Chip color="accent">{submissions.length} Submissions</Chip>
      </div>

      <div className="space-y-4">
        {submissions.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <Card.Content>No responses submitted yet.</Card.Content>
          </Card>
        ) : (
          submissions.map((res: any) => (
            <Card key={res.id} className="p-4">
              <Card.Header className="flex justify-between items-center pb-2">
                <div>
                  <Card.Title className="font-semibold text-gray-900">
                    {res.recipientName}
                  </Card.Title>
                  <Card.Description className="text-sm text-gray-500">
                    {res.recipientEmail}
                  </Card.Description>
                </div>
                <Chip size="sm" variant="secondary">
                  {res.gift?.name ?? 'Unknown Gift'}
                </Chip>
              </Card.Header>

              {res.note && (
                <Card.Content className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md mt-2">
                  "{res.note}"
                </Card.Content>
              )}

              <Card.Footer className="text-xs text-gray-400 pt-3 border-t border-gray-100 mt-2">
                Submitted on {new Date(res.createdAt).toLocaleDateString()}
              </Card.Footer>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
