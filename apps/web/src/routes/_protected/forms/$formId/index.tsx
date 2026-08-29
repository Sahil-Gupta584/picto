import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card, Tooltip } from '@heroui/react'
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
      <div className="mx-auto max-w-4xl p-6 text-[#999999]">
        <p>Loading form details...</p>
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
    <div className="mx-auto max-w-4xl p-6 space-y-6 text-[#ffffff] font-sans antialiased">
      <Button
        variant="secondary"
        className="tembo-btn-secondary h-8 px-3 text-xs"
        onClick={() => router.navigate({ to: '/dashboard' })}
        startContent={<RiArrowLeftLine />}
      >
        Back to Dashboard
      </Button>

      <Card className="tembo-panel p-6 bg-[#141414] border border-[#212121] rounded-2xl">
        <Card.Header className="flex justify-between items-start pb-4 border-b border-[#212121]">
          <div>
            <Card.Title className="text-sm font-semibold tracking-[-0.1px] text-[#ffffff]">Form Details</Card.Title>
            <Card.Description className="text-xs text-[#999999] mt-0.5">
              Manage form options and parameters
            </Card.Description>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border bg-[#29c239]/10 text-[#29c239] border-[#29c239]/25">
            Active
          </span>
        </Card.Header>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold tracking-[-0.1px] flex items-center gap-2 text-[#ffffff]">
            Options <span className="text-[10px] font-mono text-[#999999] bg-[#181818] border border-[#212121] px-1.5 py-0.2 rounded">{gifts.length}</span>
          </h2>
          <Button
            className="tembo-btn-primary h-8 px-3 text-xs shadow-sm"
            onClick={() => setShowAddGift(!showAddGift)}
            startContent={<RiAddLine />}
          >
            Add Option
          </Button>
        </div>

        {showAddGift && (
          <Card className="tembo-panel p-6 border border-[#212121] bg-[#181818] rounded-2xl">
            <Card.Header className="pb-4 border-b border-[#212121]">
              <Card.Title className="text-sm font-semibold tracking-[-0.1px] text-[#ffffff]">
                New Option
              </Card.Title>
            </Card.Header>
            <Card.Content className="pt-4">
              <form onSubmit={handleSubmit(onAddGift)} className="space-y-4">
                <Input
                  label="Option Name"
                  placeholder="e.g. Free Tier Setup"
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
                <div className="flex justify-end gap-2 pt-2 border-t border-[#212121]">
                  <Button
                    variant="secondary"
                    className="tembo-btn-secondary h-8 px-3 text-xs"
                    onClick={() => setShowAddGift(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-sm"
                    isLoading={addGiftMutation.isPending}
                  >
                    Save Option
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {gifts.map((gift) => (
            <Card key={gift.id} className="tembo-panel p-4 flex flex-col justify-between bg-[#141414] border border-[#212121] rounded-2xl">
              <Card.Header className="flex justify-between items-start pb-2 border-b border-[#212121]">
                <Card.Title className="font-semibold text-xs text-[#ffffff]">
                  {gift.name}
                </Card.Title>
                <Tooltip>
                  <Tooltip.Trigger>
                    <button className="text-[#999999] hover:text-[#ffffff]">
                      <RiInformationLine />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="text-xs p-2 bg-[#181818] border border-[#212121] text-[#ffffff] rounded-lg">
                    ID: {gift.id}
                  </Tooltip.Content>
                </Tooltip>
              </Card.Header>

              {gift.description && (
                <Card.Content className="text-xs text-[#999999] py-2">
                  {gift.description}
                </Card.Content>
              )}

              <Card.Footer className="flex justify-between items-center pt-4 border-t border-[#212121]">
                <span className="text-xs text-[#999999]">
                  Qty: <strong className="text-[#ffffff]">{gift.quantity}</strong>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[#f15555] hover:bg-[#f15555]/10 px-2"
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
