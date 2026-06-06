/**
 * Welder test (Pixel 5, local): no-approval model + gaadi → dispatch → plating
 * outbox. Staff enters with a gaadi, dispatches the gaadi (gets NAV-001), and
 * the owner sees the combined plating challan in the Outbox ("NAV-001 Spider").
 */
import { chromium, devices } from 'playwright'
const O = 'http://localhost:4174/welder'
function ok(c, m) { if (!c) { console.error('  ✗', m); process.exitCode = 1; throw new Error(m) } console.log('  ✓', m) }
const b = await chromium.launch()
const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage()
p.on('pageerror', e => { console.error('  PAGEERR', e.message); process.exitCode = 1 })
try {
  console.log('\n[1] Staff (Naveen): Spider Chrome ×50, gaadi HR55 1234')
  await p.goto(`${O}/?welder=1&who=Naveen&local=1`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('text=Tap the product')
  await p.locator('button:has-text("Spider")').first().click()
  await p.waitForSelector('text=Spider Chrome')
  await p.fill('input[placeholder="e.g. HR55 1234"]', 'HR55 1234')
  await p.fill('input[inputmode=numeric]', '50')
  await p.click('button:has-text("SAVE")')
  await p.waitForSelector('text=Save this entry?'); await p.click('button:has-text("Yes, Save")')
  await p.waitForSelector('text=Saved:')
  ok(true, 'Entry saved with gaadi')

  console.log('\n[2] Dispatch tab → dispatch the gaadi')
  await p.locator('button:has-text("Dispatch")').first().click()
  await p.waitForSelector('text=/1234 →/')
  ok((await p.locator('text=Sriram').count()) > 0, 'Gaadi grouped → Sriram (chrome default)')
  await p.click('button:has-text("Dispatch to plating")')
  await p.waitForSelector('text=/Dispatched NAV-001/')
  ok(true, 'Dispatched → welder challan NAV-001 assigned')

  console.log('\n[3] Owner: Plating Outbox shows combined challan "NAV-001 Spider"')
  await p.goto(`${O}/?role=owner&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', '6133923_N'); await p.click('text=Unlock')
  await p.waitForSelector('text=Plating Outbox')
  await p.locator('text=Challans ready for the Plating app').click()
  await p.waitForSelector('text=NAV-001 Spider')
  ok((await p.locator('text=NAV-001 Spider').count()) > 0, 'Outbox line = base name with welder challan prefix')
  ok((await p.locator('text=Ready').count()) > 0, 'Marked Ready (not yet pushed live)')

  console.log('\n[4] Entry still counts on dashboard immediately (no approval)')
  await p.click('text=Home'); await p.locator('text=Dashboard').first().click()
  await p.waitForSelector('text=Sent to each party')
  ok((await p.locator('text=Spider Chrome').count()) > 0, 'Dashboard shows entry immediately')
  console.log('\n✅ WELDER + PLATING-BRIDGE PREVIEW PASSED')
} catch (e) { console.error('FAIL', e.message); await p.screenshot({ path: 'wfail.png' }).catch(() => {}); process.exitCode = 1 }
finally { await b.close() }
