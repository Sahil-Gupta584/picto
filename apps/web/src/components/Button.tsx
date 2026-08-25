import { Button as HeroButton } from '@heroui/react'
import type { ButtonProps } from '@heroui/react'

export type CustomButtonProps = ButtonProps & {
  color?: string
  isLoading?: boolean
  startContent?: React.ReactNode
  endContent?: React.ReactNode
}

export function Button({
  variant = 'secondary',
  color,
  isLoading,
  startContent,
  endContent,
  children,
  ...props
}: CustomButtonProps) {
  let finalVariant: any = variant
  if (color === 'primary') {
    finalVariant = variant === 'ghost' ? 'ghost' : 'primary'
  } else if (color === 'danger') {
    finalVariant = 'danger'
  }

  return (
    <HeroButton variant={finalVariant} isPending={isLoading} {...props}>
      {startContent}
      {children}
      {endContent}
    </HeroButton>
  )
}
