import { CalendarClock, MessageCircle, Phone } from 'lucide-react'

interface ContactLocation {
  name: string
  city: string
  phone: string | null
}

interface PermanentBookingCardProps {
  venueName: string
  locations: ContactLocation[]
}

/** Digits only, with Sri Lankan local numbers (07XXXXXXXX) converted to international form for WhatsApp. */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `94${digits.slice(1)}` : digits
}

/** Permanent / recurring bookings are arranged directly with the venue, not through the online booking flow. */
export function PermanentBookingCard({ venueName, locations }: PermanentBookingCardProps) {
  const contacts = locations.filter((location) => location.phone)

  return (
    <section className="mt-12 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-volt">
          <CalendarClock className="h-7 w-7" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold">Need a regular or permanent slot?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly or long-term bookings are arranged directly with {venueName}. Get in touch and they will set it up
            for you.
          </p>

          {contacts.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {contacts.map((location) => (
                <li key={`${location.name}-${location.phone}`} className="rounded-2xl border bg-muted/40 p-4">
                  <p className="font-semibold">{location.name}</p>
                  <p className="text-xs text-muted-foreground">{location.city}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`tel:${location.phone}`}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-soft"
                    >
                      <Phone className="h-4 w-4" />
                      {location.phone}
                    </a>
                    <a
                      href={`https://wa.me/${toWhatsAppNumber(location.phone as string)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-white"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              This venue has not listed a phone number yet. Please contact them directly.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
