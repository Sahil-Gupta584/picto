import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card, Chip, Tooltip } from '@heroui/react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiArrowLeftLine,
  RiInformationLine,
} from 'react-icons/ri'

export const Route = createFileRoute('/_protected/forms/$formId/')({
  component: FormDetailsPage,
})

const giftSchema = z.object({
  name: z.string().min(1, 'Gift name is required'),
  description: z.string().optional(),
  imageUrl: z.string().url('Invalid URL').or(z.literal('')).optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
})

type GiftSchemaInput = z.infer<typeof giftSchema>

function FormDetailsPage() {
  const { formId } = Route.useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showAddGift, setShowAddGift] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GiftSchemaInput>({
    resolver: zodResolver(giftSchema),
    defaultValues: {
      quantity: 1,
    },
  })

  const { data: formSubmissions, isLoading } = useQuery(
    orpc.forms.getFormSubmissions.queryOptions({ input: { formId } }),
  )

  const addGiftMutation = useMutation(
    orpc.forms.createForm.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries()
        setShowAddGift(false)
        reset({ name: '', description: '', imageUrl: '', quantity: 1 })
      },
    }),
  )

  const deleteGiftMutation = useMutation(
    orpc.forms.createForm.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries()
      },
    }),
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-gray-500">Loading form details...</p>
      </div>
    )
  }

  const gifts: any[] = []

  const onAddGift = (data: GiftSchemaInput) => {
    addGiftMutation.mutate({
      title: data.name,
      description: data.description,
    })
  }

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

      <Card className="p-6">
        <Card.Header className="flex justify-between items-start pb-4">
          <div>
            <Card.Title className="text-2xl font-bold">Form Details</Card.Title>
            <Card.Description className="text-gray-500 mt-1">
              Manage form gifts and options
            </Card.Description>
          </div>
          <Chip color="accent">Active</Chip>
        </Card.Header>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Gifts <Chip size="sm">{gifts.length}</Chip>
          </h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddGift(!showAddGift)}
            startContent={<RiAddLine />}
          >
            Add Gift
          </Button>
        </div>

        {showAddGift && (
          <Card className="p-6 border-2 border-indigo-100">
            <Card.Header className="pb-4">
              <Card.Title className="text-lg font-semibold">
                New Gift Option
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <form onSubmit={handleSubmit(onAddGift)} className="space-y-4">
                <Input
                  label="Gift Name"
                  placeholder="e.g. Free T-Shirt"
                  {...register('name')}
                  errorMessage={errors.name?.message}
                  isInvalid={!!errors.name}
                />
                <Input
                  label="Description"
                  placeholder="Optional description"
                  {...register('description')}
                />
                <Input
                  label="Image URL"
                  placeholder="https://..."
                  {...register('imageUrl')}
                  errorMessage={errors.imageUrl?.message}
                  isInvalid={!!errors.imageUrl}
                />
                <Input
                  type="number"
                  label="Quantity Available"
                  {...register('quantity')}
                  errorMessage={errors.quantity?.message}
                  isInvalid={!!errors.quantity}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAddGift(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={addGiftMutation.isPending}
                  >
                    Save Gift
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {gifts.map((gift) => (
            <Card key={gift.id} className="p-4 flex flex-col justify-between">
              <Card.Header className="flex justify-between items-start pb-2">
                <Card.Title className="font-semibold text-gray-900">
                  {gift.name}
                </Card.Title>
                <Tooltip>
                  <Tooltip.Trigger>
                    <button className="text-gray-400 hover:text-gray-600">
                      <RiInformationLine />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="text-xs p-2">
                    Gift ID: {gift.id}
                  </Tooltip.Content>
                </Tooltip>
              </Card.Header>

              {gift.description && (
                <Card.Content className="text-sm text-gray-500 py-2">
                  {gift.description}
                </Card.Content>
              )}

              <Card.Footer className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Qty: <strong>{gift.quantity}</strong>
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteGiftMutation.mutate({ title: gift.id })}
                  isLoading={deleteGiftMutation.isPending}
                >
                  <RiDeleteBinLine />
                </Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
