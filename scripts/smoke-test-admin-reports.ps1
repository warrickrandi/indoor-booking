<#
==============================================================================
Smoke test: Session 9 -- Platform Admin Panel & Reporting
==============================================================================

MANUAL PREREQUISITE (run once, against a reachable Postgres instance, before
this script will work -- e.g. via Prisma Studio or psql):

  -- Create a platform admin user and grant it the super_admin platform role.
  -- Replace the password_hash with a real bcrypt hash of "Test1234!".
  INSERT INTO users (id, email, password_hash, full_name, email_verified)
  VALUES (gen_random_uuid(), 'platformadmin@test.com', '<bcrypt hash of Test1234!>', 'Platform Admin', true);

  INSERT INTO platform_user_roles (user_id, role_id)
  SELECT u.id, r.id
  FROM users u, platform_roles r
  WHERE u.email = 'platformadmin@test.com' AND r.name = 'super_admin';

This script also assumes the following accounts already exist from prior
sessions' smoke testing:
  - owner@test.com   / Test1234!  (venue_staff, owner role, company "Test ...")
  - manager@test.com / Test1234!  (venue_staff, location-scoped manager,
                                    no reports.full_ledger permission)

If manager@test.com does not exist, scenario 10 is skipped rather than
reported as a failure.

Run with: pwsh ./scripts/smoke-test-admin-reports.ps1
==============================================================================
#>

$baseUrl = "http://localhost:3001/api/v1"
$pass = 0
$fail = 0
$skip = 0

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

function Skip-Result {
    param([string]$Name, [string]$Reason = "")
    Write-Host "SKIP: $Name $Reason" -ForegroundColor Yellow
    $script:skip++
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
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
            } catch {}
        }
        return @{ StatusCode = $statusCode; Body = $errorBody }
    }
}

# ─── 1. Platform admin login ────────────────────────────────────────────────
Write-Host "`n--- 1. POST /auth/admin-login (platform admin) ---" -ForegroundColor Cyan
$adminLogin = Invoke-Api -Method POST -Path "/auth/admin-login" -Body @{ email = "platformadmin@test.com"; password = "Test1234!" }
Test-Result "admin-login returns 200" ($adminLogin.StatusCode -eq 200)
Test-Result "admin-login returns an access token" ($null -ne $adminLogin.Body.data.access_token)
$adminToken = $adminLogin.Body.data.access_token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

# ─── 2. GET /admin/stats ────────────────────────────────────────────────────
Write-Host "`n--- 2. GET /admin/stats ---" -ForegroundColor Cyan
$stats = Invoke-Api -Method GET -Path "/admin/stats" -Headers $adminHeaders
Test-Result "admin/stats returns 200" ($stats.StatusCode -eq 200)
Test-Result "admin/stats: total_companies >= 1" ($stats.Body.data.total_companies -ge 1)
Test-Result "admin/stats: companies_by_tier present" ($null -ne $stats.Body.data.companies_by_tier)
Test-Result "admin/stats: signups_by_day present" ($null -ne $stats.Body.data.signups_by_day)
Test-Result "admin/stats: total_bookings.all_time present" ($null -ne $stats.Body.data.total_bookings.all_time)

# ─── 3. GET /admin/companies ────────────────────────────────────────────────
Write-Host "`n--- 3. GET /admin/companies ---" -ForegroundColor Cyan
$companies = Invoke-Api -Method GET -Path "/admin/companies" -Headers $adminHeaders
Test-Result "admin/companies returns 200" ($companies.StatusCode -eq 200)
Test-Result "admin/companies returns at least 1 company" (@($companies.Body.data).Count -ge 1)

$testCompany = @($companies.Body.data) | Select-Object -First 1

# ─── 4. Venue owner login ───────────────────────────────────────────────────
Write-Host "`n--- 4. POST /auth/login (venue owner) ---" -ForegroundColor Cyan
$ownerLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = "owner@test.com"; password = "Test1234!" }
Test-Result "owner login returns 200" ($ownerLogin.StatusCode -eq 200)
$ownerToken = $ownerLogin.Body.data.access_token
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }

# ─── 5. GET /reports/daily-summary ──────────────────────────────────────────
Write-Host "`n--- 5. GET /reports/daily-summary ---" -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
$daily = Invoke-Api -Method GET -Path "/reports/daily-summary?date=$today" -Headers $ownerHeaders
Test-Result "daily-summary returns 200" ($daily.StatusCode -eq 200)
Test-Result "daily-summary: bookings_by_status present" ($null -ne $daily.Body.data.bookings_by_status)
Test-Result "daily-summary: revenue_by_payment_method present" ($null -ne $daily.Body.data.revenue_by_payment_method)
Test-Result "daily-summary: occupancy present" ($null -ne $daily.Body.data.occupancy)
Test-Result "daily-summary: pending_verifications present" ($null -ne $daily.Body.data.pending_verifications)

# ─── 6. GET /reports/revenue (owner) ────────────────────────────────────────
# Requires reports.full_ledger + pro tier. If the test company is on the
# basic plan, a 403 with required_tier="pro" is the correct response.
Write-Host "`n--- 6. GET /reports/revenue (owner) ---" -ForegroundColor Cyan
$fromDate = (Get-Date).AddDays(-29).ToString("yyyy-MM-dd")
$revenue = Invoke-Api -Method GET -Path "/reports/revenue?from_date=$fromDate&to_date=$today&group_by=day" -Headers $ownerHeaders
if ($revenue.StatusCode -eq 200) {
    Test-Result "revenue returns by_period array" ($null -ne $revenue.Body.data.by_period)
    Test-Result "revenue returns by_sub_venue array" ($null -ne $revenue.Body.data.by_sub_venue)
} elseif ($revenue.StatusCode -eq 403) {
    Test-Result "revenue 403 reports required_tier=pro for basic-tier owner" ($revenue.Body.details.required_tier -eq 'pro')
} else {
    Test-Result "revenue returns 200 (pro+) or 403 (basic)" $false "got status $($revenue.StatusCode)"
}

# ─── 7. GET /reports/export (CSV download) ──────────────────────────────────
# Same tier/permission requirement as scenario 6.
Write-Host "`n--- 7. GET /reports/export?type=transactions&format=csv ---" -ForegroundColor Cyan
$exportResult = Invoke-Api -Method GET -Path "/reports/export?type=transactions&from_date=$fromDate&to_date=$today&format=csv" -Headers $ownerHeaders
if ($exportResult.StatusCode -eq 200) {
    Test-Result "export returns a CSV with a header row" ($exportResult.Body -match 'transaction_id|booking_ref')
} elseif ($exportResult.StatusCode -eq 403) {
    Test-Result "export 403 reports required_tier=pro for basic-tier owner" ($exportResult.Body.details.required_tier -eq 'pro')
} else {
    Test-Result "export returns 200 (pro+) or 403 (basic)" $false "got status $($exportResult.StatusCode)"
}

# ─── 8. GET /admin/audit-logs ───────────────────────────────────────────────
Write-Host "`n--- 8. GET /admin/audit-logs ---" -ForegroundColor Cyan
$auditLogs = Invoke-Api -Method GET -Path "/admin/audit-logs?company_id=$($testCompany.id)" -Headers $adminHeaders
Test-Result "audit-logs returns 200" ($auditLogs.StatusCode -eq 200)
Test-Result "audit-logs response has a data array" ($null -ne $auditLogs.Body.data)
if (@($auditLogs.Body.data).Count -gt 0) {
    $entry = @($auditLogs.Body.data)[0]
    Test-Result "audit-log entry has action/entity_type/created_at" ($null -ne $entry.action -and $null -ne $entry.created_at)
} else {
    Skip-Result "audit-log entry shape check" "no entries yet for company $($testCompany.id)"
}

# ─── 9. GET /admin/stats with owner token (expect 403) ──────────────────────
Write-Host "`n--- 9. GET /admin/stats with venue_staff token (expect 403) ---" -ForegroundColor Cyan
$statsAsOwner = Invoke-Api -Method GET -Path "/admin/stats" -Headers $ownerHeaders
Test-Result "admin/stats with venue_staff token returns 403" ($statsAsOwner.StatusCode -eq 403)

# ─── 10. GET /reports/revenue with manager token (expect 403) ───────────────
Write-Host "`n--- 10. GET /reports/revenue with manager token (expect 403) ---" -ForegroundColor Cyan
$managerLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = "manager@test.com"; password = "Test1234!" }
if ($managerLogin.StatusCode -eq 200) {
    $managerToken = $managerLogin.Body.data.access_token
    $managerHeaders = @{ Authorization = "Bearer $managerToken" }
    $revenueAsManager = Invoke-Api -Method GET -Path "/reports/revenue?from_date=$fromDate&to_date=$today&group_by=day" -Headers $managerHeaders
    Test-Result "revenue with manager token returns 403" ($revenueAsManager.StatusCode -eq 403)
} else {
    Skip-Result "revenue with manager token returns 403" "manager@test.com login failed (account may not exist)"
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "Results: $pass passed, $fail failed, $skip skipped" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
}
