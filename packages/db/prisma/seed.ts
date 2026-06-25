import { PrismaClient } from '../generated/index.js'

const prisma = new PrismaClient()

const SUBSCRIPTION_PLANS = [
  {
    name:          'basic',
    tier:          'basic',
    price_monthly: 2900,
    price_annual:  29000,
    max_locations: 1,
    trial_period_days: 0,
    feature_flags: {
      subdomain:             false,
      custom_domain:         false,
      rbac:                  false,
      custom_email:          false,
      reports_full:          false,
      location_manager_role: false,
    },
  },
  {
    name:          'pro',
    tier:          'pro',
    price_monthly: 7900,
    price_annual:  79000,
    max_locations: 10,
    trial_period_days: 14,
    feature_flags: {
      subdomain:             true,
      custom_domain:         false,
      rbac:                  false,
      custom_email:          false,
      reports_full:          true,
      location_manager_role: true,
    },
  },
  {
    name:          'elite',
    tier:          'elite',
    price_monthly: 19900,
    price_annual:  199000,
    max_locations: -1,
    trial_period_days: 14,
    feature_flags: {
      subdomain:             true,
      custom_domain:         true,
      rbac:                  true,
      custom_email:          true,
      reports_full:          true,
      location_manager_role: true,
    },
  },
]

const COMPANY_PERMISSIONS = [
  // basic tier
  { key: 'locations.read',          min_tier_required: 'basic',  description: 'View locations' },
  { key: 'locations.write',         min_tier_required: 'basic',  description: 'Create/update locations' },
  { key: 'locations.delete',        min_tier_required: 'basic',  description: 'Delete locations' },
  { key: 'sub_venues.write',        min_tier_required: 'basic',  description: 'Create/update sub-venues (courts)' },
  { key: 'slots.read',              min_tier_required: 'basic',  description: 'View time slots' },
  { key: 'slots.write',             min_tier_required: 'basic',  description: 'Create/modify time slots' },
  { key: 'pricing.write',           min_tier_required: 'basic',  description: 'Set pricing rules' },
  { key: 'bookings.read',           min_tier_required: 'basic',  description: 'View bookings' },
  { key: 'bookings.checkin',        min_tier_required: 'basic',  description: 'Check in customers' },
  { key: 'bookings.cancel',         min_tier_required: 'basic',  description: 'Cancel bookings' },
  { key: 'payments.read',           min_tier_required: 'basic',  description: 'View payment records' },
  { key: 'payments.verify_slip',    min_tier_required: 'basic',  description: 'Approve/reject bank transfer slips' },
  { key: 'payments.gateway_config', min_tier_required: 'basic',  description: 'Configure payment gateway credentials' },
  { key: 'reports.daily',           min_tier_required: 'basic',  description: 'View daily reports' },
  { key: 'staff.invite',            min_tier_required: 'basic',  description: 'Invite staff members' },
  { key: 'company.branding',        min_tier_required: 'basic',  description: 'Update branding (logo, colors)' },
  { key: 'marketplace.listing',     min_tier_required: 'basic',  description: 'Manage marketplace listing visibility' },
  { key: 'notifications.send',      min_tier_required: 'basic',  description: 'Send manual notifications to customers' },
  // pro tier
  { key: 'locations.multi',         min_tier_required: 'pro',    description: 'Manage multiple locations' },
  { key: 'reports.full_ledger',     min_tier_required: 'pro',    description: 'View full financial ledger' },
  { key: 'company.subdomain',       min_tier_required: 'pro',    description: 'Set custom branded subdomain' },
  { key: 'audit_logs.read',         min_tier_required: 'pro',    description: 'View audit log history' },
  // elite tier
  { key: 'company.custom_domain',   min_tier_required: 'elite',  description: 'Set custom domain (bring your own domain)' },
  { key: 'email.custom_config',     min_tier_required: 'elite',  description: 'Configure custom SMTP server' },
  { key: 'rbac.custom_roles',       min_tier_required: 'elite',  description: 'Create custom roles and permission sets' },
]

const PLATFORM_ROLES = [
  { name: 'super_admin',       description: 'Full platform access — all operations and tenant management' },
  { name: 'platform_support',  description: 'Read-only access to company data for customer support purposes' },
]

async function main() {
  console.log('Seeding database...')

  // 1. Subscription plans
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where:  { name: plan.name },
      update: plan,
      create: plan,
    })
  }
  console.log('  ✓ subscription_plans (3 rows)')

  // 2. Company permissions
  for (const perm of COMPANY_PERMISSIONS) {
    await prisma.companyPermission.upsert({
      where:  { key: perm.key },
      update: perm,
      create: perm,
    })
  }
  console.log(`  ✓ company_permissions (${COMPANY_PERMISSIONS.length} rows)`)

  // 3. Platform roles
  for (const role of PLATFORM_ROLES) {
    await prisma.platformRole.upsert({
      where:  { name: role.name },
      update: role,
      create: role,
    })
  }
  console.log('  ✓ platform_roles (2 rows)')

  // 4. Platform admin user
  const superAdminRole = await prisma.platformRole.findUniqueOrThrow({ where: { name: 'super_admin' } })
  const adminUser = await prisma.user.upsert({
    where:  { email: 'platformadmin@test.com' },
    update: {},
    create: {
      email:          'platformadmin@test.com',
      // bcrypt hash of 'Test1234!' with 12 rounds
      password_hash:  '$2a$12$3Cuyw0NOuUEwy7sqWJNKX./CZuTjstVSPUQGDIVq.zChElEa29QX.',
      full_name:      'Platform Admin',
      status:         'active',
      email_verified: true,
    },
  })
  await prisma.platformUserRole.upsert({
    where:  { user_id_role_id: { user_id: adminUser.id, role_id: superAdminRole.id } },
    update: {},
    create: { user_id: adminUser.id, role_id: superAdminRole.id },
  })
  console.log('  ✓ platform_admin (platformadmin@test.com / Test1234!)')

  // 5. Gateway drivers: PayHere (active), WebXPay/DirectPay (stubs, inactive)
  await prisma.gatewayDriver.upsert({
    where:  { slug: 'payhere' },
    update: { name: 'PayHere', is_active: true },
    create: { slug: 'payhere', name: 'PayHere', is_active: true },
  })
  await prisma.gatewayDriver.upsert({
    where:  { slug: 'webxpay' },
    update: { name: 'WebXPay', is_active: false },
    create: { slug: 'webxpay', name: 'WebXPay', is_active: false },
  })
  await prisma.gatewayDriver.upsert({
    where:  { slug: 'directpay' },
    update: { name: 'DirectPay', is_active: false },
    create: { slug: 'directpay', name: 'DirectPay', is_active: false },
  })
  console.log('  ✓ gateway_drivers (payhere active; webxpay, directpay inactive)')

  console.log('\nSeeding complete.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
