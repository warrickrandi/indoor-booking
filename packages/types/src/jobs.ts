export interface EmailJobData {
  to:         string
  template:   string
  data:       Record<string, unknown>
  companyId?: string | null
  bookingId?: string
}

export interface DomainSslJobData {
  domainId:  string
  domain:    string
  companyId: string
}
