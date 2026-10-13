import type { BookingBankDetails } from '@/hooks/useBookings'

interface BankDetailsProps {
  venue: {
    name: string
    phone?: string | null
  }
  account: BookingBankDetails | null
}

export function BankDetails({ venue, account }: BankDetailsProps) {
  const rows = account
    ? [
        { label: 'Bank', value: account.bank_name },
        { label: 'Account name', value: account.bank_account_name },
        { label: 'Account number', value: account.bank_account_number },
        { label: 'Branch', value: account.bank_branch },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : []

  return (
    <div className="space-y-2 rounded-md border bg-muted/50 p-4 text-sm">
      <p className="font-medium">Bank transfer instructions</p>
      {rows.length > 0 ? (
        <>
          <p className="text-muted-foreground">
            Transfer the total amount to {venue.name}&apos;s bank account, then upload your payment slip below.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="break-all font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="text-muted-foreground">
          Transfer the total amount to {venue.name}&apos;s bank account
          {venue.phone ? <> (contact {venue.phone} for account details)</> : ''}, then upload your payment slip below.
        </p>
      )}
      <p className="text-muted-foreground">
        Your booking will be confirmed once the venue verifies your payment slip.
      </p>
    </div>
  )
}
