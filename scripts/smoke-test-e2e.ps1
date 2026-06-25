<#
==============================================================================
Smoke test: Session 10 -- End-to-End Booking Flow
==============================================================================

Exercises the full owner-onboarding -> booking -> check-in -> reporting flow
against a freshly registered company, end to end:

  1.  Register a new venue owner (POST /auth/register)
  2.  Update branding (PUT /company/me/branding)
  3.  Create a location (POST /locations)
  4.  Create a sub-venue (POST /locations/:id/sub-venues)
  5.  Create a pricing rule (POST /locations/:id/sub-venues/:id/pricing)
  6.  Generate slots for 3 days (POST .../slots/generate)
  7.  Get available slots (GET /slots?sub_venue_id=...&date=...)
  8.  Lock a slot (POST /slots/:id/lock)
  9.  Create a pay_at_venue booking (POST /bookings)
  10. Check in the booking (POST /bookings/:id/check-in)
  11. Verify the booking status log (GET /bookings/:id/status-log)
  12. List marketplace venues (GET /marketplace/venues)
  13. Get the venue by slug (GET /marketplace/venues/:slug)
  14. Get the daily report (GET /reports/daily-summary)

A unique email/slug is generated per run, so this script can be re-run
repeatedly without colliding with prior runs.

Run with: pwsh ./scripts/smoke-test-e2e.ps1
==============================================================================
#>

$baseUrl = "http://localhost:3001/api/v1"
$pass = 0
$fail = 0

function Test-Result {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Write-Host "PASS: $Name" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "FAIL: $Name $Detail" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $uri = "$baseUrl$Path"
    $params = @{ Method = $Method; Uri = $uri; Headers = $Headers; ErrorAction = 'Stop' }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
        $params.ContentType = 'application/json'
    }
    try {
        $response = Invoke-RestMethod @params
        return @{ StatusCode = 200; Body = $response }
    } catch {
        $statusCode = 0
        $errorBody = $null
        $rawBody = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $rawBody = $reader.ReadToEnd()
                $errorBody = $rawBody | ConvertFrom-Json
            } catch {}
        }
        return @{ StatusCode = $statusCode; Body = $errorBody; Raw = $rawBody }
    }
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$ownerEmail = "e2e-owner-$suffix@test.com"
$companySlug = "e2e-venue-$suffix"
$today = Get-Date -Format "yyyy-MM-dd"
$endDate = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")

# ─── 1. Register owner ───────────────────────────────────────────────────────
Write-Host "`n--- 1. POST /auth/register ---" -ForegroundColor Cyan
$register = Invoke-Api -Method POST -Path "/auth/register" -Body @{
    full_name    = "E2E Owner"
    email        = $ownerEmail
    phone        = "0771234567"
    password     = "Test1234!"
    company_name = "E2E Venue $suffix"
    slug         = $companySlug
}
Test-Result "register returns 200" ($register.StatusCode -eq 200)
Test-Result "register returns an access token" ($null -ne $register.Body.data.access_token)
Test-Result "register returns company with slug" ($register.Body.data.company.slug -eq $companySlug)
$ownerToken = $register.Body.data.access_token
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }

# ─── 2. Branding ────────────────────────────────────────────────────────────
Write-Host "`n--- 2. PUT /company/me/branding ---" -ForegroundColor Cyan
$branding = Invoke-Api -Method PUT -Path "/company/me/branding" -Headers $ownerHeaders -Body @{
    primary_color   = "#FF5733"
    secondary_color = "#1E40AF"
    meta_title      = "E2E Venue $suffix"
}
Test-Result "branding update returns 200" ($branding.StatusCode -eq 200)
Test-Result "branding reflects primary_color" ($branding.Body.data.primary_color -eq "#FF5733")

# ─── 3. Location ────────────────────────────────────────────────────────────
Write-Host "`n--- 3. POST /locations ---" -ForegroundColor Cyan
$location = Invoke-Api -Method POST -Path "/locations" -Headers $ownerHeaders -Body @{
    name     = "Main Branch"
    address  = "123 Galle Road"
    city     = "Colombo"
    timezone = "Asia/Colombo"
    phone    = "0112345678"
}
Test-Result "location create returns 200" ($location.StatusCode -eq 200)
Test-Result "location create returns an id" ($null -ne $location.Body.data.id)
$locationId = $location.Body.data.id

# ─── 4. Sub-venue ───────────────────────────────────────────────────────────
Write-Host "`n--- 4. POST /locations/:locationId/sub-venues ---" -ForegroundColor Cyan
$subVenue = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues" -Headers $ownerHeaders -Body @{
    name       = "Court 1"
    sport_type = "futsal"
    capacity   = 10
}
Test-Result "sub-venue create returns 200" ($subVenue.StatusCode -eq 200)
Test-Result "sub-venue create returns an id" ($null -ne $subVenue.Body.data.id)
$subVenueId = $subVenue.Body.data.id

# ─── 5. Pricing rule ────────────────────────────────────────────────────────
Write-Host "`n--- 5. POST /locations/:locationId/sub-venues/:subVenueId/pricing ---" -ForegroundColor Cyan
$pricingRule = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues/$subVenueId/pricing" -Headers $ownerHeaders -Body @{
    rule_name          = "Standard Rate"
    rate_type          = "flat"
    price_per_slot     = 2000
    slot_duration_mins = 60
    applicable_days    = @(0, 1, 2, 3, 4, 5, 6)
}
Test-Result "pricing rule create returns 200" ($pricingRule.StatusCode -eq 200)
Test-Result "pricing rule create returns an id" ($null -ne $pricingRule.Body.data.id)

# ─── 6. Generate slots for 3 days ───────────────────────────────────────────
Write-Host "`n--- 6. POST /locations/:locationId/sub-venues/:subVenueId/slots/generate ---" -ForegroundColor Cyan
$generate = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues/$subVenueId/slots/generate" -Headers $ownerHeaders -Body @{
    from_date = $today
    to_date   = $endDate
}
Test-Result "slot generation returns 200" ($generate.StatusCode -eq 200)
Test-Result "slot generation covers 3 dates" (@($generate.Body.data.dates).Count -eq 3)
Test-Result "slot generation created slots" ($generate.Body.data.generated -gt 0)

# ─── 7. Get available slots ─────────────────────────────────────────────────
Write-Host "`n--- 7. GET /slots?sub_venue_id=...&date=... ---" -ForegroundColor Cyan
$slots = Invoke-Api -Method GET -Path "/slots?sub_venue_id=$subVenueId&date=$today"
Test-Result "available slots returns 200" ($slots.StatusCode -eq 200)
Test-Result "available slots returns at least 1 slot" (@($slots.Body.data.available).Count -ge 1)
$targetSlot = @($slots.Body.data.available) | Select-Object -First 1
$slotId = $targetSlot.slotId

# ─── 8. Lock the slot ───────────────────────────────────────────────────────
Write-Host "`n--- 8. POST /slots/:slotId/lock ---" -ForegroundColor Cyan
$lock = Invoke-Api -Method POST -Path "/slots/$slotId/lock"
Test-Result "slot lock returns 200" ($lock.StatusCode -eq 200)
Test-Result "slot lock returns a lock token" ($null -ne $lock.Body.data.lockToken)
$lockToken = $lock.Body.data.lockToken

# ─── 9. Create pay_at_venue booking ─────────────────────────────────────────
Write-Host "`n--- 9. POST /bookings (pay_at_venue) ---" -ForegroundColor Cyan
$booking = Invoke-Api -Method POST -Path "/bookings" -Headers $ownerHeaders -Body @{
    slot_id        = $slotId
    lock_token     = $lockToken
    payment_method = "pay_at_venue"
    customer_info  = @{
        full_name = "Test Customer"
        email     = "customer-$suffix@test.com"
        phone     = "0779876543"
    }
}
Test-Result "booking create returns 200" ($booking.StatusCode -eq 200)
Test-Result "booking status is confirmed" ($booking.Body.data.booking.status -eq "confirmed")
Test-Result "booking has a booking_ref" ($null -ne $booking.Body.data.booking.booking_ref)
$bookingId = $booking.Body.data.booking.id

# ─── 10. Check in the booking ───────────────────────────────────────────────
Write-Host "`n--- 10. POST /bookings/:bookingId/check-in ---" -ForegroundColor Cyan
$checkIn = Invoke-Api -Method POST -Path "/bookings/$bookingId/check-in" -Headers $ownerHeaders
Test-Result "check-in returns 200" ($checkIn.StatusCode -eq 200)
Test-Result "check-in status is checked_in" ($checkIn.Body.data.status -eq "checked_in")

# ─── 11. Verify status log ──────────────────────────────────────────────────
Write-Host "`n--- 11. GET /bookings/:bookingId/status-log ---" -ForegroundColor Cyan
$statusLog = Invoke-Api -Method GET -Path "/bookings/$bookingId/status-log" -Headers $ownerHeaders
Test-Result "status-log returns 200" ($statusLog.StatusCode -eq 200)
Test-Result "status-log has at least 2 entries" (@($statusLog.Body.data).Count -ge 2)
$hasConfirmedEntry = @($statusLog.Body.data | Where-Object { $_.to_status -eq "confirmed" })
$hasCheckedInEntry = @($statusLog.Body.data | Where-Object { $_.to_status -eq "checked_in" })
Test-Result "status-log includes transition to confirmed" (@($hasConfirmedEntry).Count -eq 1)
Test-Result "status-log includes transition to checked_in" (@($hasCheckedInEntry).Count -eq 1)

# ─── 12. Marketplace venues ─────────────────────────────────────────────────
Write-Host "`n--- 12. GET /marketplace/venues ---" -ForegroundColor Cyan
$venues = Invoke-Api -Method GET -Path "/marketplace/venues?limit=50"
Test-Result "marketplace venues returns 200" ($venues.StatusCode -eq 200)
Test-Result "marketplace venues returns a data array" ($null -ne $venues.Body.data)
$ourVenue = @($venues.Body.data | Where-Object { $_.slug -eq $companySlug })
Test-Result "marketplace venues includes the new venue" (@($ourVenue).Count -eq 1)

# ─── 13. Venue by slug ──────────────────────────────────────────────────────
Write-Host "`n--- 13. GET /marketplace/venues/:slug ---" -ForegroundColor Cyan
$venueDetail = Invoke-Api -Method GET -Path "/marketplace/venues/$companySlug"
Test-Result "venue by slug returns 200" ($venueDetail.StatusCode -eq 200)
Test-Result "venue by slug returns matching slug" ($venueDetail.Body.data.slug -eq $companySlug)
Test-Result "venue by slug includes our location" (@($venueDetail.Body.data.locations | Where-Object { $_.id -eq $locationId }).Count -eq 1)

# ─── 14. Daily report ───────────────────────────────────────────────────────
Write-Host "`n--- 14. GET /reports/daily-summary ---" -ForegroundColor Cyan
$dailySummary = Invoke-Api -Method GET -Path "/reports/daily-summary?date=$today" -Headers $ownerHeaders
Test-Result "daily-summary returns 200" ($dailySummary.StatusCode -eq 200)
Test-Result "daily-summary: bookings_by_status present" ($null -ne $dailySummary.Body.data.bookings_by_status)
$checkedInStatus = @($dailySummary.Body.data.bookings_by_status | Where-Object { $_.status -eq "checked_in" })
Test-Result "daily-summary: reflects the checked_in booking" (@($checkedInStatus).Count -eq 1)
Test-Result "daily-summary: occupancy present" ($null -ne $dailySummary.Body.data.occupancy)

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "Results: $pass passed, $fail failed" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
}
