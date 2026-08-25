export interface FormField {
  id: string
  label: string
  type: 'text' | 'email' | 'number' | 'select'
  required: boolean
  options?: string[]
}

export const AMAZON_PRESET_FIELDS: FormField[] = [
  { id: 'email', label: 'Email Address', type: 'email', required: true },
  { id: 'fullName', label: 'Full Name', type: 'text', required: true },
  { id: 'mobile', label: 'Mobile Number', type: 'number', required: true },
  { id: 'city', label: 'City / Location', type: 'text', required: true },
]
