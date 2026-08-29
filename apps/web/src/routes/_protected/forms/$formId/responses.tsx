import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card } from '@heroui/react'
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
      <div className="mx-auto max-w-4xl p-6 text-[#999999]">
        <p>Loading responses...</p>
      </div>
    )
  }

  const submissions = (formSubmissions as any[]) || []

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6 text-[#ffffff] font-sans antialiased">
      <Button
        variant="secondary"
        className="tembo-btn-secondary h-8 px-3 text-xs"
        onClick={() => router.navigate({ to: '/dashboard' })}
        startContent={<RiArrowLeftLine />}
      >
        Back to Dashboard
      </Button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-sm font-semibold tracking-[-0.1px] text-[#ffffff]">Form Responses</h1>
          <p className="text-xs text-[#999999]">
            View collected submission events
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-[#118af3]/10 text-[#118af3] border-[#118af3]/25">
          {submissions.length} Submissions
        </span>
      </div>

      <div className="space-y-4">
        {submissions.length === 0 ? (
          <Card className="tembo-panel p-8 text-center text-xs text-[#777777] bg-[#141414] border border-[#212121] rounded-2xl">
            <Card.Content>No responses submitted yet.</Card.Content>
          </Card>
        ) : (
          submissions.map((res: any) => (
            <Card key={res.id} className="tembo-panel p-4 bg-[#141414] border border-[#212121] rounded-2xl">
              <Card.Header className="flex justify-between items-center pb-2 border-b border-[#212121]">
                <div>
                  <Card.Title className="font-semibold text-xs text-[#ffffff]">
                    {res.recipientName}
                  </Card.Title>
                  <Card.Description className="text-xs text-[#999999]">
                    {res.recipientEmail}
                  </Card.Description>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#212121] text-[#999999] border border-[#383838]">
                  {res.gift?.name ?? 'Option Item'}
                </span>
              </Card.Header>

              {res.note && (
                <Card.Content className="text-xs text-[#ffffff] bg-[#181818] p-3 rounded-lg border border-[#212121] mt-2">
                  "{res.note}"
                </Card.Content>
              )}

              <Card.Footer className="text-[11px] font-mono text-[#777777] pt-3 border-t border-[#212121] mt-2">
                Submitted on {new Date(res.createdAt).toLocaleDateString()}
              </Card.Footer>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
