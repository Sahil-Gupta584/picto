import { z } from 'zod'
import { prisma } from '#/db'
import { authed, base } from '#/orpc/middleware'
import { AMAZON_PRESET_FIELDS } from '#/lib/forms'

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'number', 'select']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

export const listUserForms = authed.input(z.void()).handler(async ({ context }) => {
  return prisma.form.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { submissions: true },
      },
    },
  })
})

export const createForm = authed
  .input(
    z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      preset: z.string().default('amazon'),
    }),
  )
  .handler(async ({ input, context }) => {
    return prisma.form.create({
      data: {
        title: input.title,
        description: input.description,
        preset: input.preset,
        fields: AMAZON_PRESET_FIELDS as any,
        userId: context.user.id,
      },
    })
  })

export const getForm = base
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const form = await prisma.form.findUnique({
      where: { id: input.id },
    })
    if (!form) {
      throw new Error('Form not found')
    }
    return form
  })

export const updateFormFields = authed
  .input(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      fields: z.array(fieldSchema),
    }),
  )
  .handler(async ({ input, context }) => {
    const form = await prisma.form.findUnique({
      where: { id: input.id },
    })

    if (!form || form.userId !== context.user.id) {
      throw new Error('Form not found or unauthorized')
    }

    return prisma.form.update({
      where: { id: input.id },
      data: {
        title: input.title,
        description: input.description,
        fields: input.fields as any,
      },
    })
  })

export const deleteForm = authed
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const form = await prisma.form.findUnique({
      where: { id: input.id },
    })

    if (!form || form.userId !== context.user.id) {
      throw new Error('Form not found or unauthorized')
    }

    await prisma.form.delete({
      where: { id: input.id },
    })

    return { success: true }
  })

export const submitFormResponse = base
  .input(
    z.object({
      formId: z.string(),
      data: z.record(z.string(), z.any()),
    }),
  )
  .handler(async ({ input }) => {
    const form = await prisma.form.findUnique({
      where: { id: input.formId },
    })

    if (!form) {
      throw new Error('Form not found')
    }

    return prisma.formSubmission.create({
      data: {
        formId: input.formId,
        data: input.data,
      },
    })
  })

export const getFormSubmissions = authed
  .input(z.object({ formId: z.string() }))
  .handler(async ({ input, context }) => {
    const form = await prisma.form.findUnique({
      where: { id: input.formId },
    })

    if (!form || form.userId !== context.user.id) {
      throw new Error('Form not found or unauthorized')
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId: input.formId },
      orderBy: { createdAt: 'desc' },
    })

    return {
      form,
      submissions,
    }
  })
