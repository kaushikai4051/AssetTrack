const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = 'http://localhost:5177'
const SHOTS = path.join(__dirname, 'verify-screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS)

const shot = async (page, name) => {
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  return file
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const results = []

  const pass = (label, note = '') => { results.push(`✅ ${label}${note ? ' — ' + note : ''}`); console.log(`✅ ${label}`) }
  const fail = (label, note = '') => { results.push(`❌ ${label}${note ? ' — ' + note : ''}`); console.log(`❌ ${label}`) }

  try {
    // 1. Login page loads
    await page.goto(BASE, { waitUntil: 'networkidle' })
    const url1 = page.url()
    const title = await page.title()
    await shot(page, '01-login-page')
    if (url1.includes('/login')) pass('Redirects to /login when not authenticated')
    else fail('Expected redirect to /login', `got ${url1}`)
    if (title === 'AssetTrack — Personal Finance Manager') pass('Page title correct')
    else fail('Page title wrong', title)

    // 2. Login form visible
    const brand = await page.textContent('h1')
    if (brand?.includes('AssetTrack')) pass('AssetTrack branding visible')
    else fail('Branding missing')
    const emailInput = await page.locator('input[type="email"]').count()
    const passInput  = await page.locator('input[type="password"]').count()
    if (emailInput && passInput) pass('Email + password fields rendered')
    else fail('Form inputs missing')

    // 3. Wrong password shows error
    await page.fill('input[type="email"]', 'test@assettrack.com')
    await page.fill('input[type="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1500)
    const errText = await page.locator('text=Invalid').count()
    await shot(page, '02-login-error')
    if (errText) pass('Bad credentials shows error message')
    else fail('No error shown for bad credentials')

    // 4. Correct login → dashboard
    await page.fill('input[type="password"]', 'secure123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 5000 })
    await page.waitForTimeout(1000)
    await shot(page, '03-dashboard')
    if (page.url().includes('/dashboard')) pass('Login succeeds → dashboard')
    else fail('Did not land on dashboard', page.url())

    // 5. Stat cards
    const cards = await page.locator('.rounded-xl').count()
    if (cards >= 4) pass(`Dashboard stat cards rendered (${cards} cards visible)`)
    else fail('Expected ≥4 cards on dashboard', `got ${cards}`)

    const netWorthText = await page.locator('text=Net Worth').count()
    if (netWorthText) pass('Net Worth card present')
    else fail('Net Worth card missing')

    const noEvents = await page.locator('text=No upcoming events').count()
    if (noEvents) pass('Upcoming events shows empty state correctly')
    else fail('Upcoming events section missing')

    // 6. Sidebar nav links
    const sidebarLinks = await page.locator('nav a').count()
    if (sidebarLinks >= 10) pass(`Sidebar renders all nav links (${sidebarLinks} links)`)
    else fail('Sidebar nav links missing', `got ${sidebarLinks}`)

    const mfLink = await page.locator('text=Mutual Funds').first()
    if (await mfLink.count()) pass('Mutual Funds nav link visible')
    else fail('Mutual Funds nav link missing')

    // 7. Sidebar collapse
    const chevron = await page.locator('nav button, aside button').first()
    await chevron.click()
    await page.waitForTimeout(400)
    await shot(page, '04-sidebar-collapsed')
    const sidebarWidth = await page.locator('aside').evaluate(el => el.offsetWidth)
    if (sidebarWidth <= 70) pass(`Sidebar collapses to icon-only (${sidebarWidth}px)`)
    else fail('Sidebar did not collapse', `width: ${sidebarWidth}px`)
    // Re-expand
    await chevron.click()
    await page.waitForTimeout(400)

    // 8. Placeholder page
    await page.click('text=Mutual Funds')
    await page.waitForTimeout(800)
    await shot(page, '05-placeholder-mutualfunds')
    const placeholder = await page.locator('text=coming in a future phase').count()
    if (placeholder) pass('Placeholder page shown for unbuilt routes')
    else fail('Placeholder page not rendered')

    // 9. Header FY selector
    const fySelect = await page.locator('select').count()
    if (fySelect) pass('FY selector present in header')
    else fail('FY selector missing')
    const logoutBtn = await page.locator('text=Logout').count()
    if (logoutBtn) pass('Logout button visible in header')
    else fail('Logout button missing')

    // 10. Logout flow
    await page.click('text=Logout')
    await page.waitForURL('**/login', { timeout: 3000 })
    await shot(page, '06-after-logout')
    if (page.url().includes('/login')) pass('Logout redirects to /login')
    else fail('Logout did not redirect', page.url())

    // 11. Register page
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
    await shot(page, '07-register-page')
    const nameInput = await page.locator('input#full_name').count()
    const regEmail  = await page.locator('input#email').count()
    const regPass   = await page.locator('input#password').count()
    const confirmP  = await page.locator('input#confirm_password').count()
    if (nameInput && regEmail && regPass && confirmP)
      pass('Register page — all 4 fields rendered')
    else fail('Register page fields missing')

    // 12. Probe — protected route blocks unauthenticated access
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await shot(page, '08-auth-guard')
    if (page.url().includes('/login')) pass('🔍 Auth guard: direct /dashboard visit → redirects to /login')
    else fail('🔍 Auth guard failed — dashboard accessible without login')

  } catch (err) {
    fail('Unexpected error', err.message)
  } finally {
    await browser.close()
  }

  console.log('\n--- SUMMARY ---')
  results.forEach(r => console.log(r))
  const passed  = results.filter(r => r.startsWith('✅')).length
  const failed  = results.filter(r => r.startsWith('❌')).length
  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(`Screenshots saved to: verify-screenshots/`)
  process.exit(failed > 0 ? 1 : 0)
})()
