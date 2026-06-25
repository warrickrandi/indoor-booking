<#
==============================================================================
Smoke test: Session 11 -- Subdomain & Custom Domain Provisioning
==============================================================================

Exercises the new domain-provisioning endpoints against a freshly registered
company:

  1.  Register a new venue owner (POST /auth/register) — basic tier
  2.  GET /company/me/domains -> 200, custom_domains is an empty array
  3.  POST /company/me/domains -> 403, details.required_tier === 'elite'
      (basic tier cannot add custom domains)
  4.  GET /marketplace/resolve-domain?host=does-not-exist.example -> 404
  5.  GET /marketplace/venues/:slug -> 200, still works (regression check)

A unique email/slug is generated per run, so this script can be re-run
repeatedly without colliding with prior runs.

------------------------------------------------------------------------------
Manual step (not scripted) -- subdomain middleware rewrite
------------------------------------------------------------------------------
The Next.js middleware (apps/web/src/middleware.ts) rewrites requests for
`{slug}.${NEXT_PUBLIC_PLATFORM_DOMAIN}` to `/venues/{slug}`. To verify this
locally:

  1. Add a hosts-file entry (C:\Windows\System32\drivers\etc\hosts, run editor
     as Administrator):
       127.0.0.1 testfutsal.localhost

  2. Ensure apps/web/.env.local (or .env) has:
       NEXT_PUBLIC_PLATFORM_DOMAIN=localhost:3000

  3. Register a venue with slug "testfutsal" (or reuse an existing one).

  4. Start the web app (pnpm --filter @sports-booking/web dev) and visit:
       http://testfutsal.localhost:3000

     This should rewrite to the venue page for slug "testfutsal" (same
     content as http://localhost:3000/venues/testfutsal).

The full custom-domain flow (DNS TXT verification -> Vercel registration ->
SSL polling) requires an Elite-tier company, a real domain you control, and
VERCEL_TOKEN/VERCEL_PROJECT_ID set -- out of scope for local smoke testing.

Run with: pwsh ./scripts/smoke-test-domains.ps1
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
$ownerEmail = "domains-owner-$suffix@test.com"
$companySlug = "domains-venue-$suffix"

# ─── 1. Register owner (basic tier) ─────────────────────────────────────────
Write-Host "`n--- 1. POST /auth/register ---" -ForegroundColor Cyan
$register = Invoke-Api -Method POST -Path "/auth/register" -Body @{
    full_name    = "Domains Owner"
    email        = $ownerEmail
    phone        = "0771234567"
    password     = "Test1234!"
    company_name = "Domains Venue $suffix"
    slug         = $companySlug
}
Test-Result "register returns 200" ($register.StatusCode -eq 200)
Test-Result "register returns an access token" ($null -ne $register.Body.data.access_token)
Test-Result "register returns company with slug" ($register.Body.data.company.slug -eq $companySlug)
$ownerToken = $register.Body.data.access_token
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }

# ─── 2. GET /company/me/domains ─────────────────────────────────────────────
Write-Host "`n--- 2. GET /company/me/domains ---" -ForegroundColor Cyan
$domains = Invoke-Api -Method GET -Path "/company/me/domains" -Headers $ownerHeaders
Test-Result "get domains returns 200" ($domains.StatusCode -eq 200)
Test-Result "get domains returns subdomain value" ($null -ne $domains.Body.data.subdomain.value)
Test-Result "get domains custom_domains is an empty array" (@($domains.Body.data.custom_domains).Count -eq 0)

# ─── 3. POST /company/me/domains (basic tier -> 403) ────────────────────────
Write-Host "`n--- 3. POST /company/me/domains (basic tier) ---" -ForegroundColor Cyan
$addDomain = Invoke-Api -Method POST -Path "/company/me/domains" -Headers $ownerHeaders -Body @{
    domain = "test.lk"
}
Test-Result "add domain on basic tier returns 403" ($addDomain.StatusCode -eq 403)
Test-Result "add domain error requires elite tier" ($addDomain.Body.details.required_tier -eq "elite")

# ─── 4. GET /marketplace/resolve-domain (unknown host -> 404) ───────────────
Write-Host "`n--- 4. GET /marketplace/resolve-domain ---" -ForegroundColor Cyan
$resolve = Invoke-Api -Method GET -Path "/marketplace/resolve-domain?host=does-not-exist.example"
Test-Result "resolve-domain for unknown host returns 404" ($resolve.StatusCode -eq 404)

# ─── 5. GET /marketplace/venues/:slug (regression check) ────────────────────
Write-Host "`n--- 5. GET /marketplace/venues/:slug ---" -ForegroundColor Cyan
$venueDetail = Invoke-Api -Method GET -Path "/marketplace/venues/$companySlug"
Test-Result "venue by slug returns 200" ($venueDetail.StatusCode -eq 200)
Test-Result "venue by slug returns matching slug" ($venueDetail.Body.data.slug -eq $companySlug)

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "Results: $pass passed, $fail failed" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    exit 1
}
