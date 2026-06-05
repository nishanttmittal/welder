/**
 * Welder 3-tier + approval test (Pixel 5, local). Staff entry (pending) →
 * Manager Pass → Owner Approve → Dashboard counts it. Role separation checked.
 */
import { chromium, devices } from 'playwright'
const O = 'http://localhost:4174/welder'
function ok(c, m) { if (!c) { console.error('  ✗', m); process.exitCode = 1; throw new Error(m) } console.log('  ✓', m) }
const b = await chromium.launch()
const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage()
p.on('pageerror', e => { console.error('  PAGEERR', e.message); process.exitCode = 1 })
try {
  console.log('\n[1] Staff (Naveen) enters Spider Chrome × 50 → pending')
  await p.goto(`${O}/?welder=1&who=Naveen&local=1`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('text=Tap the product')
  ok((await p.locator('button:has-text("Switch")').count()) === 0, 'Staff has NO Switch (locked)')
  await p.locator('button:has-text("Spider")').first().click()
  await p.waitForSelector('text=Spider Chrome')
  await p.fill('input[inputmode=numeric]', '50')
  await p.click('button:has-text("SAVE")')
  await p.waitForSelector('text=Save this entry?'); await p.click('button:has-text("Yes, Save")')
  await p.waitForSelector('text=Saved:')
  ok(true, 'Staff saved (pending)')

  console.log('\n[2] In-Charge passes it (no edit/dashboard)')
  await p.goto(`${O}/?role=user1&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', 'nsp@123'); await p.click('text=Unlock')
  await p.waitForSelector('text=Approvals')
  ok((await p.locator('text=Dashboard').count()) === 0, 'In-Charge does NOT see Dashboard')
  ok((await p.locator('text=/Manager/').count()) === 0, 'No "Manager" wording anywhere')
  await p.locator('text=Approvals').first().click()
  await p.waitForSelector('text=Spider Chrome')
  await p.click('button:has-text("Pass")')
  await p.waitForSelector('text=Passed ✓')
  ok(true, 'In-Charge passed the entry')

  console.log('\n[3] Owner approves → dashboard counts it')
  await p.goto(`${O}/?role=owner&local=1`, { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', '6133923_N'); await p.click('text=Unlock')
  await p.waitForSelector('text=Approvals')
  ok((await p.locator('text=Dashboard').count()) > 0, 'Owner sees Dashboard')
  await p.locator('text=Approvals').first().click()
  await p.waitForSelector('text=Spider Chrome')
  await p.click('button:has-text("Approve")')
  await p.waitForSelector('text=Approved')
  await p.click('text=Home'); await p.locator('text=Dashboard').first().click()
  await p.waitForSelector('text=Sent to each party')
  ok((await p.locator('text=Spider Chrome').count()) > 0, 'Approved entry shows in owner dashboard')
  console.log('\n✅ WELDER 3-TIER CHECKS PASSED')
} catch (e) { console.error('FAIL', e.message); await p.screenshot({ path: 'wfail.png' }).catch(() => {}); process.exitCode = 1 }
finally { await b.close() }
