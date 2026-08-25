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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading form...</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Form not found or inactive.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <Card.Header>
            <Card.Title className="text-2xl font-bold text-emerald-600">
              Thank You!
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-gray-600">
              Your gift request has been submitted.
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg p-6">
        <Card.Header className="pb-4">
          <Card.Title className="text-2xl font-bold text-gray-900">
            Gift Offer Form
          </Card.Title>
        </Card.Header>

        <Card.Content>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Select your gift"
              placeholder="Choose a gift..."
              value={selectedGiftId}
              onChange={(val: any) => setSelectedGiftId(val)}
              required
            >
              <SelectItem key="gift-1" value="gift-1">
                Sample Gift
              </SelectItem>
            </Select>

            <Input
              label="Your Name"
              placeholder="John Doe"
              value={recipientName}
              onChange={(e: any) => setRecipientName(e.target.value)}
              required
            />

            <Input
              type="email"
              label="Your Email"
              placeholder="john@example.com"
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
              className="w-full justify-center"
              isLoading={submitMutation.isPending}
            >
              Claim Gift
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  )
}
