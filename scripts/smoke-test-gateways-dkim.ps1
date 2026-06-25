<#
==============================================================================
Smoke test: Session 13 -- Additional Payment Gateways + Custom Email Domain (DKIM)
==============================================================================

Exercises the pluggable payment gateway registry (PayHere + WebXPay/DirectPay
stubs) and the DKIM key-generation flow for custom-domain email, against a
freshly registered company:

  1.  POST /auth/register                          -> fresh basic-tier owner
  2.  GET  /payments/gateways                       -> payhere active/configurable,
                                                         webxpay/directpay inactive stubs
  3.  PUT  /payments/gateway-config/payhere         -> save venue credentials
  4.  GET  /payments/gateway-config/payhere         -> credentials masked
  5.  PUT  /payments/gateway-config/webxpay         -> 409 (driver inactive)
  6.  Booking setup (player register, location/sub-venue/pricing/slots,
      lock + create an "online" booking)            -> pending_payment booking
  7.  POST /payments/initiate (player)              -> PayHere checkout built
                                                         from venue credentials
  8.  POST /payments/webhook/payhere (valid sig)    -> booking confirmed,
                                                         transaction paid
  9.  POST /payments/webhook/webxpay (stub)         -> 200, no state change
  10. POST /payments/webhook/does-not-exist         -> 200, unknown slug ignored
  11. POST /auth/admin-login (platform admin)
  12. GET  /admin/gateway-drivers                   -> webxpay inactive
  13. PUT  /admin/gateway-drivers/:id                -> activate webxpay
  14. GET  /payments/gateways (owner)               -> webxpay now active
  15. POST /billing/upgrade -> elite (first-ever upgrade grants an immediate
      trial) + re-login                            -> elite JWT
  16. PUT  /company/me/email-config                  -> custom_domain mode
  17. POST /company/me/email-config/dkim/generate   -> public key + DNS record
  18. GET  /company/me/email-config/dkim            -> same key/record persisted
  19. POST /company/me/email-config/dkim/generate
      (fresh basic owner)                           -> 403 (requires elite)

MANUAL PREREQUISITE: a platform admin account must already exist (see
scripts/smoke-test-admin-reports.ps1 for the SQL to create one):
  - platformadmin@test.com / Test1234!  (super_admin platform role)

A unique suffix is generated per run, so this script can be re-run repeatedly
without colliding with prior runs.

Run with: pwsh ./scripts/smoke-test-gateways-dkim.ps1
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

function Get-Md5Hex {
    param([string]$Text)
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $md5.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$ownerEmail = "gateway-owner-$suffix@test.com"
$ownerPassword = "Test1234!"
$companySlug = "gateway-venue-$suffix"
$today = Get-Date -Format "yyyy-MM-dd"
$endDate = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")

# ─── 1. Register owner (basic tier) ─────────────────────────────────────────
Write-Host "`n--- 1. POST /auth/register ---" -ForegroundColor Cyan
$register = Invoke-Api -Method POST -Path "/auth/register" -Body @{
    full_name    = "Gateway Owner"
    email        = $ownerEmail
    phone        = "0771234567"
    password     = $ownerPassword
    company_name = "Gateway Venue $suffix"
    slug         = $companySlug
}
Test-Result "register returns 200" ($register.StatusCode -eq 200)
$ownerToken = $register.Body.data.access_token
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }
$companyId = $register.Body.data.company.id
Test-Result "register returns company id" ($null -ne $companyId)

# ─── 2. GET /payments/gateways ──────────────────────────────────────────────
Write-Host "`n--- 2. GET /payments/gateways ---" -ForegroundColor Cyan
$gateways = Invoke-Api -Method GET -Path "/payments/gateways" -Headers $ownerHeaders
Test-Result "gateways returns 200" ($gateways.StatusCode -eq 200)
$payhere = @($gateways.Body.data) | Where-Object { $_.slug -eq 'payhere' } | Select-Object -First 1
$webxpay = @($gateways.Body.data) | Where-Object { $_.slug -eq 'webxpay' } | Select-Object -First 1
$directpay = @($gateways.Body.data) | Where-Object { $_.slug -eq 'directpay' } | Select-Object -First 1
Test-Result "payhere is active and not a stub" ($payhere.is_active -eq $true -and $payhere.is_stub -eq $false)
Test-Result "payhere is not yet configured" ($payhere.configured -eq $false)
Test-Result "webxpay is inactive and a stub" ($webxpay.is_active -eq $false -and $webxpay.is_stub -eq $true)
Test-Result "directpay is inactive and a stub" ($directpay.is_active -eq $false -and $directpay.is_stub -eq $true)

# ─── 3. PUT /payments/gateway-config/payhere ────────────────────────────────
Write-Host "`n--- 3. PUT /payments/gateway-config/payhere ---" -ForegroundColor Cyan
$saveConfig = Invoke-Api -Method PUT -Path "/payments/gateway-config/payhere" -Headers $ownerHeaders -Body @{
    credentials = @{
        merchant_id     = "TESTMERCHANT123"
        merchant_secret = "TESTSECRET456"
    }
}
Test-Result "save payhere config returns 200" ($saveConfig.StatusCode -eq 200)
Test-Result "save payhere config is configured" ($saveConfig.Body.data.configured -eq $true)
Test-Result "save payhere config is active" ($saveConfig.Body.data.is_active -eq $true)

# ─── 4. GET /payments/gateway-config/payhere ────────────────────────────────
Write-Host "`n--- 4. GET /payments/gateway-config/payhere ---" -ForegroundColor Cyan
$getConfig = Invoke-Api -Method GET -Path "/payments/gateway-config/payhere" -Headers $ownerHeaders
Test-Result "get payhere config returns 200" ($getConfig.StatusCode -eq 200)
Test-Result "merchant_id is masked with prefix" ($getConfig.Body.data.credentials.merchant_id -eq "TEST****")
Test-Result "merchant_secret is fully masked" ($getConfig.Body.data.credentials.merchant_secret -eq "••••••••••••••••")

# ─── 5. PUT /payments/gateway-config/webxpay (inactive driver) ──────────────
Write-Host "`n--- 5. PUT /payments/gateway-config/webxpay (inactive) ---" -ForegroundColor Cyan
$webxpayConfig = Invoke-Api -Method PUT -Path "/payments/gateway-config/webxpay" -Headers $ownerHeaders -Body @{
    credentials = @{ foo = "bar" }
}
Test-Result "save webxpay config returns 409 (inactive driver)" ($webxpayConfig.StatusCode -eq 409)

# ─── 6. Booking setup (player + location + slot + online booking) ──────────
Write-Host "`n--- 6. Booking setup ---" -ForegroundColor Cyan
$playerEmail = "gateway-player-$suffix@test.com"
$playerRegister = Invoke-Api -Method POST -Path "/marketplace/customers/register" -Body @{
    full_name = "Gateway Player"
    email     = $playerEmail
    phone     = "0779876543"
    password  = $ownerPassword
}
Test-Result "player register returns 200" ($playerRegister.StatusCode -eq 200)
$playerToken = $playerRegister.Body.data.access_token
$playerHeaders = @{ Authorization = "Bearer $playerToken" }

$location = Invoke-Api -Method POST -Path "/locations" -Headers $ownerHeaders -Body @{
    name     = "Main Branch"
    address  = "123 Galle Road"
    city     = "Colombo"
    timezone = "Asia/Colombo"
    phone    = "0112345678"
}
Test-Result "location create returns 200" ($location.StatusCode -eq 200)
$locationId = $location.Body.data.id

$subVenue = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues" -Headers $ownerHeaders -Body @{
    name       = "Court 1"
    sport_type = "futsal"
    capacity   = 10
}
Test-Result "sub-venue create returns 200" ($subVenue.StatusCode -eq 200)
$subVenueId = $subVenue.Body.data.id

$pricingRule = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues/$subVenueId/pricing" -Headers $ownerHeaders -Body @{
    rule_name          = "Standard Rate"
    rate_type          = "flat"
    price_per_slot     = 2000
    slot_duration_mins = 60
    applicable_days    = @(0, 1, 2, 3, 4, 5, 6)
}
Test-Result "pricing rule create returns 200" ($pricingRule.StatusCode -eq 200)

$generate = Invoke-Api -Method POST -Path "/locations/$locationId/sub-venues/$subVenueId/slots/generate" -Headers $ownerHeaders -Body @{
    from_date = $today
    to_date   = $endDate
}
Test-Result "slot generation returns 200" ($generate.StatusCode -eq 200)

$slots = Invoke-Api -Method GET -Path "/slots?sub_venue_id=$subVenueId&date=$today"
Test-Result "available slots returns at least 1 slot" (@($slots.Body.data.available).Count -ge 1)
$slotId = (@($slots.Body.data.available) | Select-Object -First 1).slotId

$lock = Invoke-Api -Method POST -Path "/slots/$slotId/lock"
Test-Result "slot lock returns 200" ($lock.StatusCode -eq 200)
$lockToken = $lock.Body.data.lockToken

$booking = Invoke-Api -Method POST -Path "/bookings" -Headers $playerHeaders -Body @{
    slot_id        = $slotId
    lock_token     = $lockToken
    payment_method = "online"
}
Test-Result "online booking create returns 200" ($booking.StatusCode -eq 200)
Test-Result "online booking status is pending_payment" ($booking.Body.data.booking.status -eq "pending_payment")
$bookingId = $booking.Body.data.booking.id
$bookingRef = $booking.Body.data.booking.booking_ref
$totalAmount = $booking.Body.data.booking.total_amount
$transactionId = $booking.Body.data.payment_transaction.id

# ─── 7. POST /payments/initiate (player) ────────────────────────────────────
Write-Host "`n--- 7. POST /payments/initiate (player) ---" -ForegroundColor Cyan
$initiate = Invoke-Api -Method POST -Path "/payments/initiate" -Headers $playerHeaders -Body @{
    booking_id = $bookingId
}
Test-Result "initiate returns 200" ($initiate.StatusCode -eq 200)
Test-Result "initiate checkout_url is PayHere" ($initiate.Body.data.checkout_url -eq "https://www.payhere.lk/pay/checkout")
Test-Result "initiate uses venue merchant_id" ($initiate.Body.data.checkout_params.merchant_id -eq "TESTMERCHANT123")
Test-Result "initiate gateway_slug is payhere" ($initiate.Body.data.gateway_slug -eq "payhere")

# ─── 8. POST /payments/webhook/payhere (valid signature) ───────────────────
Write-Host "`n--- 8. POST /payments/webhook/payhere (valid signature) ---" -ForegroundColor Cyan
$merchantId = "TESTMERCHANT123"
$merchantSecret = "TESTSECRET456"
$amountStr = $totalAmount.ToString("0.00")
$hashedSecret = (Get-Md5Hex $merchantSecret).ToUpper()
$sigInput = $merchantId + $bookingRef + $amountStr + "LKR" + "2" + $hashedSecret
$md5sig = (Get-Md5Hex $sigInput).ToUpper()

$webhook = Invoke-Api -Method POST -Path "/payments/webhook/payhere" -Body @{
    merchant_id      = $merchantId
    order_id         = $bookingRef
    payhere_amount   = $amountStr
    payhere_currency = "LKR"
    status_code      = "2"
    custom_1         = $bookingId
    md5sig           = $md5sig
}
Test-Result "payhere webhook returns 200" ($webhook.StatusCode -eq 200)

$transaction = Invoke-Api -Method GET -Path "/payments/transactions/$transactionId" -Headers $ownerHeaders
Test-Result "transaction status is paid" ($transaction.Body.data.status -eq "paid")
Test-Result "transaction gateway_slug is payhere" ($transaction.Body.data.gateway_slug -eq "payhere")

# ─── 9. POST /payments/webhook/webxpay (stub, no effect) ────────────────────
Write-Host "`n--- 9. POST /payments/webhook/webxpay (stub) ---" -ForegroundColor Cyan
$webxpayWebhook = Invoke-Api -Method POST -Path "/payments/webhook/webxpay" -Body @{
    some_field = "irrelevant"
}
Test-Result "webxpay webhook returns 200" ($webxpayWebhook.StatusCode -eq 200)

$transactionAfter = Invoke-Api -Method GET -Path "/payments/transactions/$transactionId" -Headers $ownerHeaders
Test-Result "transaction status unchanged after webxpay webhook" ($transactionAfter.Body.data.status -eq "paid")

# ─── 10. POST /payments/webhook/does-not-exist (unknown slug) ──────────────
Write-Host "`n--- 10. POST /payments/webhook/does-not-exist ---" -ForegroundColor Cyan
$unknownWebhook = Invoke-Api -Method POST -Path "/payments/webhook/does-not-exist" -Body @{ foo = "bar" }
Test-Result "unknown gateway webhook returns 200" ($unknownWebhook.StatusCode -eq 200)

# ─── 11. Platform admin login ────────────────────────────────────────────────
Write-Host "`n--- 11. POST /auth/admin-login (platform admin) ---" -ForegroundColor Cyan
$adminLogin = Invoke-Api -Method POST -Path "/auth/admin-login" -Body @{ email = "platformadmin@test.com"; password = "Test1234!" }
Test-Result "admin-login returns 200" ($adminLogin.StatusCode -eq 200)
$adminToken = $adminLogin.Body.data.access_token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

# ─── 12. GET /admin/gateway-drivers ─────────────────────────────────────────
Write-Host "`n--- 12. GET /admin/gateway-drivers ---" -ForegroundColor Cyan
$drivers = Invoke-Api -Method GET -Path "/admin/gateway-drivers" -Headers $adminHeaders
Test-Result "gateway-drivers returns 200" ($drivers.StatusCode -eq 200)
$webxpayDriver = @($drivers.Body.data) | Where-Object { $_.slug -eq 'webxpay' } | Select-Object -First 1
Test-Result "webxpay driver is present and inactive" ($null -ne $webxpayDriver -and $webxpayDriver.is_active -eq $false)
$webxpayDriverId = $webxpayDriver.id

# ─── 13. PUT /admin/gateway-drivers/:id (activate webxpay) ──────────────────
Write-Host "`n--- 13. PUT /admin/gateway-drivers/:id (activate webxpay) ---" -ForegroundColor Cyan
$activateWebxpay = Invoke-Api -Method PUT -Path "/admin/gateway-drivers/$webxpayDriverId" -Headers $adminHeaders -Body @{
    is_active = $true
}
Test-Result "activate webxpay returns 200" ($activateWebxpay.StatusCode -eq 200)
Test-Result "webxpay driver is now active" ($activateWebxpay.Body.data.is_active -eq $true)

# ─── 14. GET /payments/gateways (owner, webxpay now active) ────────────────
Write-Host "`n--- 14. GET /payments/gateways (webxpay active) ---" -ForegroundColor Cyan
$gateways2 = Invoke-Api -Method GET -Path "/payments/gateways" -Headers $ownerHeaders
$webxpay2 = @($gateways2.Body.data) | Where-Object { $_.slug -eq 'webxpay' } | Select-Object -First 1
Test-Result "webxpay is now active for the venue" ($webxpay2.is_active -eq $true)

# ─── 15. Upgrade owner to elite (first upgrade grants a trial) + re-login ──
Write-Host "`n--- 15. POST /billing/upgrade -> elite ---" -ForegroundColor Cyan
$plans = Invoke-Api -Method GET -Path "/billing/plans"
$elitePlan = @($plans.Body.data) | Where-Object { $_.tier -eq 'elite' } | Select-Object -First 1
$upgradeElite = Invoke-Api -Method POST -Path "/billing/upgrade" -Headers $ownerHeaders -Body @{
    plan_id       = $elitePlan.id
    billing_cycle = "monthly"
}
Test-Result "upgrade to elite returns 200" ($upgradeElite.StatusCode -eq 200)
Test-Result "upgrade to elite grants a trial" ($upgradeElite.Body.data.trial -eq $true)
Test-Result "upgrade to elite returns elite plan" ($upgradeElite.Body.data.plan.tier -eq 'elite')

$ownerLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = $ownerEmail; password = $ownerPassword }
Test-Result "owner re-login returns 200" ($ownerLogin.StatusCode -eq 200)
$eliteToken = $ownerLogin.Body.data.access_token
$eliteHeaders = @{ Authorization = "Bearer $eliteToken" }

# ─── 16. PUT /company/me/email-config (custom_domain mode) ─────────────────
Write-Host "`n--- 16. PUT /company/me/email-config (custom_domain) ---" -ForegroundColor Cyan
$emailDomain = "example-venue-$suffix.com"
$emailConfig = Invoke-Api -Method PUT -Path "/company/me/email-config" -Headers $eliteHeaders -Body @{
    mode         = "custom_domain"
    from_name    = "Test Venue"
    from_address = "noreply@$emailDomain"
}
Test-Result "email config update returns 200" ($emailConfig.StatusCode -eq 200)
Test-Result "email config mode is custom_domain" ($emailConfig.Body.data.mode -eq "custom_domain")

# ─── 17. POST /company/me/email-config/dkim/generate ───────────────────────
Write-Host "`n--- 17. POST /company/me/email-config/dkim/generate ---" -ForegroundColor Cyan
$dkimGenerate = Invoke-Api -Method POST -Path "/company/me/email-config/dkim/generate" -Headers $eliteHeaders -Body @{
    selector = "default"
}
Test-Result "dkim generate returns 200" ($dkimGenerate.StatusCode -eq 200)
Test-Result "dkim public_key is a PEM public key" ($dkimGenerate.Body.data.public_key -like "-----BEGIN PUBLIC KEY-----*")
Test-Result "dkim dns_record_value is a DKIM TXT record" ($dkimGenerate.Body.data.dns_record_value -like "v=DKIM1; k=rsa; p=*")
Test-Result "dkim dns_record_host uses default selector" ($dkimGenerate.Body.data.dns_record_host -eq "default._domainkey.$emailDomain")
$dkimJson = $dkimGenerate.Body.data | ConvertTo-Json -Depth 10
Test-Result "dkim response does not leak the private key" ($dkimJson -notmatch 'private_key')

# ─── 18. GET /company/me/email-config/dkim ──────────────────────────────────
Write-Host "`n--- 18. GET /company/me/email-config/dkim ---" -ForegroundColor Cyan
$dkimGet = Invoke-Api -Method GET -Path "/company/me/email-config/dkim" -Headers $eliteHeaders
Test-Result "dkim get returns 200" ($dkimGet.StatusCode -eq 200)
Test-Result "dkim get returns same public_key" ($dkimGet.Body.data.public_key -eq $dkimGenerate.Body.data.public_key)
Test-Result "dkim get returns same dns_record_value" ($dkimGet.Body.data.dns_record_value -eq $dkimGenerate.Body.data.dns_record_value)

# ─── 19. POST .../dkim/generate (fresh basic owner, expect 403) ─────────────
Write-Host "`n--- 19. POST /company/me/email-config/dkim/generate (basic tier) ---" -ForegroundColor Cyan
$basicEmail = "gateway-basic-$suffix@test.com"
$basicSlug = "gateway-basic-venue-$suffix"
$basicRegister = Invoke-Api -Method POST -Path "/auth/register" -Body @{
    full_name    = "Basic Owner"
    email        = $basicEmail
    phone        = "0771234567"
    password     = $ownerPassword
    company_name = "Basic Venue $suffix"
    slug         = $basicSlug
}
$basicHeaders = @{ Authorization = "Bearer $($basicRegister.Body.data.access_token)" }

$basicDkim = Invoke-Api -Method POST -Path "/company/me/email-config/dkim/generate" -Headers $basicHeaders -Body @{
    selector = "default"
}
Test-Result "dkim generate on basic tier returns 403" ($basicDkim.StatusCode -eq 403)
Test-Result "dkim generate 403 requires elite tier" ($basicDkim.Body.error.details.required_tier -eq 'elite')

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "Results: $pass passed, $fail failed" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
}
