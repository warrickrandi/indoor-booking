<#
==============================================================================
Smoke test: Session 12 -- Subscription Billing System
==============================================================================

Exercises the venue-subscription billing endpoints (separate from player
booking payments) against a freshly registered company:

  1.  POST /auth/register                      -> fresh basic-tier owner
  2.  GET  /billing/plans (public)              -> basic/pro/elite plans
  3.  GET  /billing/current                     -> basic, active, no trial
  4.  GET  /billing/invoices                    -> empty array
  5.  POST /billing/upgrade -> pro (monthly)    -> trial granted
  6.  GET  /billing/current                     -> trialing, pro
  7.  POST /billing/upgrade -> elite (monthly)  -> prorated invoice + PayHere
                                                    checkout params
  8.  GET  /billing/invoices                    -> pending elite invoice
  9.  POST /payments/webhook/payhere-billing
      (bad signature)                          -> 200, invoice still pending
  10. POST /billing/cancel                      -> scheduled downgrade to basic
  11. GET  /billing/current                     -> cancelling, scheduled basic
  12. POST /auth/admin-login (platform admin)
  13. GET  /admin/billing/invoices               -> includes this company
  14. GET  /admin/billing/invoices (owner token) -> 403
  15. POST /admin/billing/invoices (manual)      -> pending invoice (basic plan)
  16. PUT  /admin/billing/invoices/:id/mark-paid -> paid, applies to company
  17. GET  /billing/current                      -> back on basic, no longer
                                                     cancelling
  18. GET  /billing/invoices                     -> manual invoice is 'paid'

MANUAL PREREQUISITE: a platform admin account must already exist (see
scripts/smoke-test-admin-reports.ps1 for the SQL to create one):
  - platformadmin@test.com / Test1234!  (super_admin platform role)

A unique email/slug is generated per run, so this script can be re-run
repeatedly without colliding with prior runs.

Run with: pwsh ./scripts/smoke-test-billing.ps1
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
$ownerEmail = "billing-owner-$suffix@test.com"
$companySlug = "billing-venue-$suffix"

# ─── 1. Register owner (basic tier) ─────────────────────────────────────────
Write-Host "`n--- 1. POST /auth/register ---" -ForegroundColor Cyan
$register = Invoke-Api -Method POST -Path "/auth/register" -Body @{
    full_name    = "Billing Owner"
    email        = $ownerEmail
    phone        = "0771234567"
    password     = "Test1234!"
    company_name = "Billing Venue $suffix"
    slug         = $companySlug
}
Test-Result "register returns 200" ($register.StatusCode -eq 200)
$ownerToken = $register.Body.data.access_token
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }
$companyId = $register.Body.data.company.id
Test-Result "register returns company id" ($null -ne $companyId)

# ─── 2. GET /billing/plans (public) ─────────────────────────────────────────
Write-Host "`n--- 2. GET /billing/plans ---" -ForegroundColor Cyan
$plans = Invoke-Api -Method GET -Path "/billing/plans"
Test-Result "plans returns 200" ($plans.StatusCode -eq 200)
Test-Result "plans returns 3 active plans" (@($plans.Body.data).Count -eq 3)
$basicPlan = @($plans.Body.data) | Where-Object { $_.tier -eq 'basic' } | Select-Object -First 1
$proPlan = @($plans.Body.data) | Where-Object { $_.tier -eq 'pro' } | Select-Object -First 1
$elitePlan = @($plans.Body.data) | Where-Object { $_.tier -eq 'elite' } | Select-Object -First 1
Test-Result "basic plan priced at 2900/29000" ($basicPlan.price_monthly -eq 2900 -and $basicPlan.price_annual -eq 29000)
Test-Result "pro plan priced at 7900/79000 with 14-day trial" ($proPlan.price_monthly -eq 7900 -and $proPlan.price_annual -eq 79000 -and $proPlan.trial_period_days -eq 14)
Test-Result "elite plan priced at 19900/199000 with 14-day trial" ($elitePlan.price_monthly -eq 19900 -and $elitePlan.price_annual -eq 199000 -and $elitePlan.trial_period_days -eq 14)

# ─── 3. GET /billing/current (fresh basic company) ──────────────────────────
Write-Host "`n--- 3. GET /billing/current (basic) ---" -ForegroundColor Cyan
$current = Invoke-Api -Method GET -Path "/billing/current" -Headers $ownerHeaders
Test-Result "current returns 200" ($current.StatusCode -eq 200)
Test-Result "current plan is basic" ($current.Body.data.plan.tier -eq 'basic')
Test-Result "current status is active" ($current.Body.data.status -eq 'active')
Test-Result "current billing_cycle is monthly" ($current.Body.data.billing_cycle -eq 'monthly')
Test-Result "current is_trial is false" ($current.Body.data.is_trial -eq $false)
Test-Result "current scheduled_plan is null" ($null -eq $current.Body.data.scheduled_plan)

# ─── 4. GET /billing/invoices (none yet) ────────────────────────────────────
Write-Host "`n--- 4. GET /billing/invoices (empty) ---" -ForegroundColor Cyan
$invoices = Invoke-Api -Method GET -Path "/billing/invoices" -Headers $ownerHeaders
Test-Result "invoices returns 200" ($invoices.StatusCode -eq 200)
Test-Result "invoices is an empty array" (@($invoices.Body.data).Count -eq 0)

# ─── 5. POST /billing/upgrade -> pro (first upgrade grants trial) ───────────
Write-Host "`n--- 5. POST /billing/upgrade -> pro (monthly) ---" -ForegroundColor Cyan
$upgradePro = Invoke-Api -Method POST -Path "/billing/upgrade" -Headers $ownerHeaders -Body @{
    plan_id = $proPlan.id
    billing_cycle = "monthly"
}
Test-Result "upgrade to pro returns 200" ($upgradePro.StatusCode -eq 200)
Test-Result "upgrade to pro grants a trial" ($upgradePro.Body.data.trial -eq $true)
Test-Result "upgrade to pro returns trial_ends_at" ($null -ne $upgradePro.Body.data.trial_ends_at)
Test-Result "upgrade to pro returns pro plan" ($upgradePro.Body.data.plan.tier -eq 'pro')

# ─── 6. GET /billing/current (now trialing on pro) ──────────────────────────
Write-Host "`n--- 6. GET /billing/current (trialing pro) ---" -ForegroundColor Cyan
$current2 = Invoke-Api -Method GET -Path "/billing/current" -Headers $ownerHeaders
Test-Result "current returns 200" ($current2.StatusCode -eq 200)
Test-Result "current plan is pro" ($current2.Body.data.plan.tier -eq 'pro')
Test-Result "current status is trialing" ($current2.Body.data.status -eq 'trialing')
Test-Result "current is_trial is true" ($current2.Body.data.is_trial -eq $true)
Test-Result "current trial_ends_at is set" ($null -ne $current2.Body.data.trial_ends_at)

# ─── 7. POST /billing/upgrade -> elite (no trial, prorated invoice) ─────────
Write-Host "`n--- 7. POST /billing/upgrade -> elite (monthly) ---" -ForegroundColor Cyan
$upgradeElite = Invoke-Api -Method POST -Path "/billing/upgrade" -Headers $ownerHeaders -Body @{
    plan_id = $elitePlan.id
    billing_cycle = "monthly"
}
Test-Result "upgrade to elite returns 200" ($upgradeElite.StatusCode -eq 200)
Test-Result "upgrade to elite returns a pending invoice" ($upgradeElite.Body.data.invoice.status -eq 'pending')
Test-Result "upgrade to elite invoice amount > 0" ([double]$upgradeElite.Body.data.invoice.amount -gt 0)
Test-Result "upgrade to elite returns PayHere checkout params" ($null -ne $upgradeElite.Body.data.checkout_params.hash)
$eliteInvoiceId = $upgradeElite.Body.data.invoice.id

# ─── 8. GET /billing/invoices (pending elite invoice) ───────────────────────
Write-Host "`n--- 8. GET /billing/invoices (pending elite invoice) ---" -ForegroundColor Cyan
$invoices2 = Invoke-Api -Method GET -Path "/billing/invoices" -Headers $ownerHeaders
Test-Result "invoices returns 200" ($invoices2.StatusCode -eq 200)
$pendingInvoice = @($invoices2.Body.data) | Where-Object { $_.id -eq $eliteInvoiceId } | Select-Object -First 1
Test-Result "pending elite invoice is present" ($null -ne $pendingInvoice)
Test-Result "pending elite invoice plan is elite" ($pendingInvoice.plan.tier -eq 'elite')
Test-Result "pending elite invoice status is pending" ($pendingInvoice.status -eq 'pending')

# ─── 9. POST /payments/webhook/payhere-billing (bad signature) ──────────────
Write-Host "`n--- 9. POST /payments/webhook/payhere-billing (bad signature) ---" -ForegroundColor Cyan
$webhook = Invoke-Api -Method POST -Path "/payments/webhook/payhere-billing" -Body @{
    merchant_id = "test-merchant"
    order_id = $eliteInvoiceId
    payhere_amount = $pendingInvoice.amount.ToString("0.00")
    payhere_currency = "LKR"
    status_code = "2"
    custom_1 = $eliteInvoiceId
    md5sig = "0000000000000000000000000000000"
}
Test-Result "webhook with bad signature returns 200" ($webhook.StatusCode -eq 200)

$invoices3 = Invoke-Api -Method GET -Path "/billing/invoices" -Headers $ownerHeaders
$stillPending = @($invoices3.Body.data) | Where-Object { $_.id -eq $eliteInvoiceId } | Select-Object -First 1
Test-Result "invoice is still pending after bad-signature webhook" ($stillPending.status -eq 'pending')

# ─── 10. POST /billing/cancel (scheduled downgrade to basic) ────────────────
Write-Host "`n--- 10. POST /billing/cancel ---" -ForegroundColor Cyan
$cancel = Invoke-Api -Method POST -Path "/billing/cancel" -Headers $ownerHeaders
Test-Result "cancel returns 200" ($cancel.StatusCode -eq 200)
Test-Result "cancel returns scheduled=true" ($cancel.Body.data.scheduled -eq $true)
Test-Result "cancel returns effective_at" ($null -ne $cancel.Body.data.effective_at)

# ─── 11. GET /billing/current (cancelling, scheduled basic) ─────────────────
Write-Host "`n--- 11. GET /billing/current (cancelling) ---" -ForegroundColor Cyan
$current3 = Invoke-Api -Method GET -Path "/billing/current" -Headers $ownerHeaders
Test-Result "current returns 200" ($current3.StatusCode -eq 200)
Test-Result "current status is cancelling" ($current3.Body.data.status -eq 'cancelling')
Test-Result "current scheduled_plan is basic" ($current3.Body.data.scheduled_plan.tier -eq 'basic')

# ─── 12. Platform admin login ────────────────────────────────────────────────
Write-Host "`n--- 12. POST /auth/admin-login (platform admin) ---" -ForegroundColor Cyan
$adminLogin = Invoke-Api -Method POST -Path "/auth/admin-login" -Body @{ email = "platformadmin@test.com"; password = "Test1234!" }
Test-Result "admin-login returns 200" ($adminLogin.StatusCode -eq 200)
$adminToken = $adminLogin.Body.data.access_token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

# ─── 13. GET /admin/billing/invoices (includes this company) ────────────────
Write-Host "`n--- 13. GET /admin/billing/invoices ---" -ForegroundColor Cyan
$adminInvoices = Invoke-Api -Method GET -Path "/admin/billing/invoices?company_id=$companyId" -Headers $adminHeaders
Test-Result "admin billing invoices returns 200" ($adminInvoices.StatusCode -eq 200)
Test-Result "admin billing invoices meta has total" ($null -ne $adminInvoices.Body.meta.total)
$adminEliteInvoice = @($adminInvoices.Body.data) | Where-Object { $_.id -eq $eliteInvoiceId } | Select-Object -First 1
Test-Result "admin billing invoices includes the elite invoice" ($null -ne $adminEliteInvoice)

# ─── 14. GET /admin/billing/invoices with venue_staff token (expect 403) ────
Write-Host "`n--- 14. GET /admin/billing/invoices (venue_staff token) ---" -ForegroundColor Cyan
$adminInvoicesAsOwner = Invoke-Api -Method GET -Path "/admin/billing/invoices" -Headers $ownerHeaders
Test-Result "admin billing invoices with venue_staff token returns 403" ($adminInvoicesAsOwner.StatusCode -eq 403)

# ─── 15. POST /admin/billing/invoices (manual invoice, basic plan) ──────────
Write-Host "`n--- 15. POST /admin/billing/invoices (manual) ---" -ForegroundColor Cyan
$dueDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$manualInvoice = Invoke-Api -Method POST -Path "/admin/billing/invoices" -Headers $adminHeaders -Body @{
    company_id = $companyId
    plan_id = $basicPlan.id
    billing_cycle = "monthly"
    amount = 2900
    due_date = $dueDate
}
Test-Result "create manual invoice returns 200" ($manualInvoice.StatusCode -eq 200)
Test-Result "manual invoice status is pending" ($manualInvoice.Body.data.status -eq 'pending')
$manualInvoiceId = $manualInvoice.Body.data.id

# ─── 16. PUT /admin/billing/invoices/:id/mark-paid ───────────────────────────
Write-Host "`n--- 16. PUT /admin/billing/invoices/:id/mark-paid ---" -ForegroundColor Cyan
$markPaid = Invoke-Api -Method PUT -Path "/admin/billing/invoices/$manualInvoiceId/mark-paid" -Headers $adminHeaders -Body @{
    payment_ref = "BANK-TEST-$suffix"
}
Test-Result "mark-paid returns 200" ($markPaid.StatusCode -eq 200)
Test-Result "mark-paid invoice status is paid" ($markPaid.Body.data.status -eq 'paid')
Test-Result "mark-paid invoice has paid_at" ($null -ne $markPaid.Body.data.paid_at)

# ─── 17. GET /billing/current (back on basic, no longer cancelling) ─────────
Write-Host "`n--- 17. GET /billing/current (back on basic) ---" -ForegroundColor Cyan
$current4 = Invoke-Api -Method GET -Path "/billing/current" -Headers $ownerHeaders
Test-Result "current returns 200" ($current4.StatusCode -eq 200)
Test-Result "current plan is basic again" ($current4.Body.data.plan.tier -eq 'basic')
Test-Result "current status is active" ($current4.Body.data.status -eq 'active')
Test-Result "current scheduled_plan is null" ($null -eq $current4.Body.data.scheduled_plan)

# ─── 18. GET /billing/invoices (manual invoice is paid) ─────────────────────
Write-Host "`n--- 18. GET /billing/invoices (manual invoice paid) ---" -ForegroundColor Cyan
$invoices4 = Invoke-Api -Method GET -Path "/billing/invoices" -Headers $ownerHeaders
$paidInvoice = @($invoices4.Body.data) | Where-Object { $_.id -eq $manualInvoiceId } | Select-Object -First 1
Test-Result "manual invoice is present and paid" ($null -ne $paidInvoice -and $paidInvoice.status -eq 'paid')

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "Results: $pass passed, $fail failed" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
}
