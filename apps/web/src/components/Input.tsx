import {
  TextField,
  Input as HeroInput,
  Label,
  Description,
  FieldError,
} from '@heroui/react'
import type { ReactNode } from 'react'

export interface CustomInputProps extends React.ComponentProps<
  typeof HeroInput
> {
  label?: ReactNode
  description?: ReactNode
  errorMessage?: ReactNode
  isInvalid?: boolean
  isRequired?: boolean
}

export function Input({
  label,
  description,
  errorMessage,
  isInvalid,
  isRequired,
  ...props
}: CustomInputProps) {
  if (label || description || errorMessage || isInvalid) {
    return (
      <TextField isInvalid={isInvalid} isRequired={isRequired}>
        {label && <Label>{label}</Label>}
        <HeroInput {...props} />
        {description && <Description>{description}</Description>}
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
      </TextField>
    )
  }

  return <HeroInput {...props} />
}
