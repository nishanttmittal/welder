/**
 * Welder no-approval model test (Pixel 5, local).
 * Staff entry shows on the dashboard IMMEDIATELY (no pass/approve).
 * User1 can make/edit entries (2-day window) but has no Dashboard/Admin.
 * No "Approvals"/"Manager" wording anywhere.
 */
import { chromium, devices } from 'playwright'
const O = 'http://localhost:4174/welder'
function ok(c, m) { if (!c) { console.error('  ✗', m); process.exitCode = 1; throw new Error(m) } console.log('  ✓', m) }
const b = await chromium.launch()
const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage()
p.on('pageerror', e => { console.error('  PAGEERR', e.message); process.exitCode = 1 })
try {
  console.log('\n[1] Staff (Naveen) enters Spider Chrome × 50')
  await p.goto(`${O}/?welder=1&who=Naveen&local=1`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('text=Tap the product')
  await p.locator('button:has-text("Spider")').first().click()
  await p.waitForSelector('text=Spider Chrome')
  await p.fill('input[inputmode=numeric]', '50')
  await p.click('button:has-text("SAVE")')
  await p.waitForSelector('text=Save this entry?'); await p.click('button:has-text("Yes, Save")')
  await p.waitForSelector('text=Saved:')
  ok(true, 'Staff saved')
  ok((await p.locator('text=Fix qty').count()) > 0, 'Welder can fix/cancel own entry (2-day window)')

  console.log('\n[2] Owner — entry shows on dashboard IMMEDIATELY (no approval)')
  await p.goto(`${O}/?role=owner&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', '6133923_N'); await p.click('text=Unlock')
  await p.waitForSelector('text=Dashboard')
  ok((await p.locator('text=/Approval/').count()) === 0, 'No "Approvals" wording')
  await p.locator('text=Dashboard').first().click()
  await p.waitForSelector('text=Sent to each party')
  ok((await p.locator('text=Spider Chrome').count()) > 0, 'Entry counts immediately on dashboard')

  console.log('\n[3] User1 — can make/edit entries, no Dashboard/Admin')
  await p.goto(`${O}/?role=user1&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', 'nsp@123'); await p.click('text=Unlock')
  await p.waitForSelector('text=Material Sent')
  ok((await p.locator('text=Entries').count()) > 0, 'User1 sees Entries (edit)')
  ok((await p.locator('text=Dashboard').count()) === 0, 'User1 has NO Dashboard')
  ok((await p.locator('text=Admin').count()) === 0, 'User1 has NO Admin')
  ok((await p.locator('text=/Manager|Approval/').count()) === 0, 'No Manager/Approvals wording')
  await p.locator('text=View & edit entries').click()
  await p.waitForSelector('text=Spider Chrome')
  ok((await p.locator('button:has-text("Edit")').count()) > 0, 'User1 can edit recent entry (2-day window)')
  console.log('\n✅ WELDER NO-APPROVAL MODEL PASSED')
} catch (e) { console.error('FAIL', e.message); await p.screenshot({ path: 'wfail.png' }).catch(() => {}); process.exitCode = 1 }
finally { await b.close() }
