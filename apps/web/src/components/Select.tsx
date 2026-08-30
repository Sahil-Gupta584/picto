import { Select as HeroSelect, Label, ListBox, Separator } from '@heroui/react'

export { ListBox, Separator }

export interface CustomSelectProps {
  label?: string
  placeholder?: string
  selectedKeys?: any
  value?: any
  onChange?: any
  children?: React.ReactNode
  required?: boolean
  isRequired?: boolean
  trigger?: React.ReactNode
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
  trigger,
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
      <HeroSelect.Trigger className={'border'}>
        {trigger ?? <HeroSelect.Value />}
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover className="bg-default border ">
        <ListBox>{children}</ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  )
}

export function SelectItem({ children, value, ...props }: any) {
  return (
    <ListBox.Item
      id={value}
      textValue={typeof children === 'string' ? children : String(value)}
      {...props}
    >
      {children}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  )
}
