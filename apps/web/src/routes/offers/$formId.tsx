import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@heroui/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { orpc } from '#/orpc/client'
import { Button } from '#/components/Button'
import { Input } from '#/components/Input'
import { Select, SelectItem } from '#/components/Select'

export const Route = createFileRoute('/offers/$formId')({
  component: OfferFormPage,
})

function OfferFormPage() {
  const { formId } = Route.useParams()
  const [selectedGiftId, setSelectedGiftId] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: form, isLoading } = useQuery(
    orpc.forms.getFormSubmissions.queryOptions({ input: { formId } }),
  )

  const submitMutation = useMutation(
    orpc.forms.createForm.mutationOptions({
      onSuccess: () => {
        setSubmitted(true)
      },
    }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414] text-[#999999] text-xs">
        <p>Loading form...</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414] text-[#999999] text-xs">
        <p>Form not found or inactive.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414] p-4 text-[#ffffff] font-sans antialiased">
        <Card className="tembo-panel w-full max-w-md p-6 text-center bg-[#141414] border border-[#212121] rounded-2xl">
          <Card.Header className="pb-2 border-b border-[#212121]">
            <Card.Title className="text-sm font-semibold tracking-[-0.1px] text-[#29c239]">
              Thank You!
            </Card.Title>
          </Card.Header>
          <Card.Content className="pt-4">
            <p className="text-xs text-[#999999]">
              Your submission request has been received.
            </p>
          </Card.Content>
        </Card>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGiftId) return
    submitMutation.mutate({ title: 'Submitted' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141414] p-4 text-[#ffffff] font-sans antialiased">
      <Card className="tembo-panel w-full max-w-lg p-6 bg-[#141414] border border-[#212121] rounded-2xl">
        <Card.Header className="pb-4 border-b border-[#212121]">
          <Card.Title className="text-sm font-semibold tracking-[-0.1px] text-[#ffffff]">
            Repository Maintainer Request
          </Card.Title>
        </Card.Header>

        <Card.Content className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Select option"
              placeholder="Choose option..."
              value={selectedGiftId}
              onChange={(val: any) => setSelectedGiftId(val)}
              required
            >
              <SelectItem key="opt-1" value="opt-1">
                Standard Maintainer Action
              </SelectItem>
            </Select>

            <Input
              label="Your Name"
              placeholder="Maintainer Name"
              value={recipientName}
              onChange={(e: any) => setRecipientName(e.target.value)}
              required
            />

            <Input
              type="email"
              label="Your Email"
              placeholder="maintainer@example.com"
              value={recipientEmail}
              onChange={(e: any) => setRecipientEmail(e.target.value)}
              required
            />

            <Input
              label="Personal Note (optional)"
              placeholder="Add a note..."
              value={note}
              onChange={(e: any) => setNote(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              className="tembo-btn-primary w-full justify-center shadow-sm"
              isLoading={submitMutation.isPending}
            >
              Submit Request
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  )
}
