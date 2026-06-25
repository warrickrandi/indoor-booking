interface BankDetailsProps {
  venue: {
    name: string
    phone?: string | null
    address?: string | null
  }
}

export function BankDetails({ venue }: BankDetailsProps) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/50 p-4 text-sm">
      <p className="font-medium">Bank transfer instructions</p>
      <p className="text-muted-foreground">
        Transfer the total amount to {venue.name}&apos;s bank account
        {venue.phone ? <> (contact {venue.phone} for account details)</> : ''}, then upload your payment slip below.
      </p>
      {venue.address && <p className="text-muted-foreground">{venue.address}</p>}
      <p className="text-muted-foreground">
        Your booking will be confirmed once the venue verifies your payment slip.
      </p>
    </div>
  )
}
