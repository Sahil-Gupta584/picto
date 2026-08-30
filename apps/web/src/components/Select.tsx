import { Select as HeroSelect, Label, ListBox } from '@heroui/react'

export interface CustomSelectProps {
  label?: string
  placeholder?: string
  selectedKeys?: any
  value?: any
  onChange?: any
  children?: React.ReactNode
  required?: boolean
  isRequired?: boolean
  [key: string]: any
}

export function Select({
  label,
  placeholder,
  selectedKeys,
  selectedKey,
  value,
  onChange,
  children,
  required,
  isRequired,
  ...props
}: CustomSelectProps & { selectedKey?: any }) {
  const actualSelectedKey = value !== undefined ? value : selectedKey !== undefined ? selectedKey : selectedKeys ? Array.from(selectedKeys as Set<string>)[0] : undefined

  const handleSelectionChange = (key: any) => {
    if (onChange) onChange(key as string)
  }

  return (
    <HeroSelect
      selectedKey={actualSelectedKey as any}
      onSelectionChange={handleSelectionChange as any}
      isRequired={isRequired || required}
      placeholder={placeholder}
      {...props}
    >
      {label && <Label>{label}</Label>}
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>{children}</ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  )
}

export function SelectItem({ children, value, key, ...props }: any) {
  const itemId = value || key
  return (
    <ListBox.Item
      id={itemId}
      textValue={typeof children === 'string' ? children : String(itemId)}
      {...props}
    >
      {children}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  )
}
