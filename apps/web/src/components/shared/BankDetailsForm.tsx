'use client'

import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import type { BankDetailsInput } from '@/hooks/usePayments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const FIELDS: { key: keyof BankDetailsInput; label: string; placeholder: string }[] = [
  { key: 'bank_name', label: 'Bank name', placeholder: 'e.g. Commercial Bank' },
  { key: 'bank_account_name', label: 'Account holder name', placeholder: 'e.g. ABC Sports (Pvt) Ltd' },
  { key: 'bank_account_number', label: 'Account number', placeholder: 'e.g. 8001234567' },
  { key: 'bank_branch', label: 'Branch (optional)', placeholder: 'e.g. Colombo 07' },
]

type FormValues = Record<keyof BankDetailsInput, string>

interface BankDetailsFormProps {
  initial: Partial<BankDetailsInput> | null | undefined
  isPending: boolean
  onSubmit: (values: BankDetailsInput) => void
  onCancel?: () => void
}

/** Shared by the venue Payments page and the platform admin company page. */
export function BankDetailsForm({ initial, isPending, onSubmit, onCancel }: BankDetailsFormProps) {
  const form = useForm<FormValues>({
    defaultValues: {
      bank_name: initial?.bank_name ?? '',
      bank_account_name: initial?.bank_account_name ?? '',
      bank_account_number: initial?.bank_account_number ?? '',
      bank_branch: initial?.bank_branch ?? '',
    },
  })

  const submit = (values: FormValues) => {
    const clean = (value: string) => value.trim() || null
    const body: BankDetailsInput = {
      bank_name: clean(values.bank_name),
      bank_account_name: clean(values.bank_account_name),
      bank_account_number: clean(values.bank_account_number),
      bank_branch: clean(values.bank_branch),
    }
    if (!body.bank_name !== !body.bank_account_number) {
      toast.error('Bank name and account number are both required (leave all empty to disable bank transfer)')
      return
    }
    onSubmit(body)
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`bank-${field.key}`}>{field.label}</Label>
            <Input id={`bank-${field.key}`} placeholder={field.placeholder} {...form.register(field.key)} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Bank transfer is offered to customers at checkout once a bank name and account number are saved. Clear all
        fields to stop offering it.
      </p>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save bank details
        </Button>
      </div>
    </form>
  )
}
