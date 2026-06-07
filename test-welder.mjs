/**
 * Welder test (Pixel 5, local): single-screen multi-product challan entry.
 * One SAVE records all products + auto-generates the plating challan (NAV-001).
 * No separate dispatch. Owner sees combined challan in Outbox; dashboard instant.
 */
import { chromium, devices } from 'playwright'
const O = 'http://localhost:4174/welder'
function ok(c, m) { if (!c) { console.error('  ✗', m); process.exitCode = 1; throw new Error(m) } console.log('  ✓', m) }
const b = await chromium.launch()
const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage()
p.on('pageerror', e => { console.error('  PAGEERR', e.message); process.exitCode = 1 })
try {
  console.log('\n[1] Staff (Naveen): gaadi + 2 products in ONE save')
  await p.goto(`${O}/?welder=1&who=Naveen&local=1`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('text=Finish')
  await p.fill('input[placeholder="e.g. HR55 1234"]', 'HR55 1234')
  await p.locator('select').nth(1).selectOption('Spider')   // 0 = Sent to, 1 = row1 product
  await p.locator('input[placeholder="qty"]').nth(0).fill('50')
  await p.locator('select').nth(2).selectOption('Beeta')    // row2 product
  await p.locator('input[placeholder="qty"]').nth(1).fill('20')
  await p.click('button:has-text("SAVE")')
  await p.waitForSelector('button:has-text("Yes, Save")')
  await p.click('button:has-text("Yes, Save")')
  await p.waitForSelector('text=/Saved 2 product/')
  ok(true, 'One save recorded 2 products + assigned NAV-001')
  ok((await p.locator('text=NAV-001').count()) > 0, 'Welder challan NAV-001 shown on entries')

  console.log('\n[2] Owner Plating Outbox: combined challan')
  await p.goto(`${O}/?role=owner&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', '6133923_N'); await p.click('text=Unlock')
  await p.waitForSelector('text=Plating Outbox')
  await p.locator('text=Challans ready for the Plating app').click()
  await p.waitForSelector('text=NAV-001 Spider')
  ok((await p.locator('text=NAV-001 Spider').count()) > 0 && (await p.locator('text=NAV-001 Beeta').count()) > 0, 'Outbox combined both products under NAV-001')

  console.log('\n[3] Dashboard counts immediately')
  await p.click('text=Home'); await p.locator('text=Dashboard').first().click()
  await p.waitForSelector('text=Sent to each party')
  ok((await p.locator('text=Spider Chrome').count()) > 0, 'Dashboard shows entry immediately')

  console.log('\n[4] Contractor Pay: rates → auto payable → record payment')
  await p.click('text=Home'); await p.locator('text=Piece-rate earnings').click()
  await p.waitForSelector('text=Piece Rates')
  await p.locator('select').first().selectOption('Naveen')
  await p.locator('button:has-text("Piece Rates")').click()
  await p.locator('input[placeholder="₹/pc"]').nth(0).fill('10'); await p.keyboard.press('Tab')
  await p.locator('input[placeholder="₹/pc"]').nth(1).fill('5'); await p.keyboard.press('Tab')
  await p.waitForSelector('text=₹600')
  ok(true, 'Auto payable = 50×10 + 20×5 = ₹600')
  await p.click('button:has-text("Record payment")')
  await p.locator('.bg-emerald-50 input').first().fill('200')
  await p.click('button:has-text("Save payment")')
  await p.waitForSelector('text=Payment recorded')
  ok((await p.locator('text=₹400').count()) > 0, 'Balance auto = 600 − 200 = ₹400')

  console.log('\n[5] User1 can VIEW pay but not edit rates')
  await p.goto(`${O}/?role=user1&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', 'nsp@123'); await p.click('text=Unlock')
  await p.waitForSelector('text=Contractor Pay')
  await p.locator('text=Piece-rate earnings').click()
  await p.locator('button:has-text("Piece Rates")').click()
  ok((await p.locator('input[placeholder="₹/pc"]').count()) === 0, 'User1 sees rates read-only (no edit inputs)')
  ok((await p.locator('button:has-text("Record payment")').count()) === 0, 'User1 cannot record payments')
  console.log('\n✅ WELDER + CONTRACTOR PAY PASSED')
} catch (e) { console.error('FAIL', e.message); await p.screenshot({ path: 'wfail.png' }).catch(() => {}); process.exitCode = 1 }
finally { await b.close() }
