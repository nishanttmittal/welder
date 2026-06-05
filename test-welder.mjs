import { chromium, devices } from 'playwright'
const BASE='http://localhost:4174/welder/?local=1', PWD='6133923_N'
function ok(c,m){ if(!c){ console.error('  ✗',m); process.exitCode=1; throw new Error(m) } console.log('  ✓',m) }
const b=await chromium.launch(); const p=await (await b.newContext({...devices['Pixel 5']})).newPage()
p.on('pageerror',e=>{ console.error('  PAGEERR',e.message); process.exitCode=1 })
try{
  await p.goto(BASE,{waitUntil:'networkidle'}); await p.evaluate(()=>localStorage.clear()); await p.reload({waitUntil:'networkidle'})
  console.log('\n[1] Role chooser'); await p.waitForSelector('text=Welder')
  ok(await p.locator('text=Owner / Admin').isVisible(),'Chooser shows Welder + Admin')
  console.log('\n[2] Welder entry: Spider Chrome × 50 → Sriram')
  await p.locator('button:has-text("Welder")').first().click()
  await p.waitForSelector('text=Tap the product')
  await p.locator('button:has-text("Spider")').first().click()
  await p.waitForSelector('text=Finish')
  ok(await p.locator('text=Spider Chrome').first().isVisible(),'Finish suffix shows "Spider Chrome"')
  await p.fill('input[inputmode=numeric]','50')
  await p.click('button:has-text("SAVE")')
  await p.waitForSelector('text=Save this entry?')
  ok(await p.locator('text=50 × Spider Chrome').first().isVisible(),'Confirm shows 50 × Spider Chrome')
  await p.click('button:has-text("Yes, Save")')
  await p.waitForSelector('text=Saved:')
  ok(await p.locator('text=Spider Chrome').first().isVisible(),'Today list shows Spider Chrome')
  console.log('\n[3] Admin dashboard')
  await p.locator('button:has-text("Switch")').click()
  await p.locator('text=Owner / Admin').click()
  await p.fill('input[type=password]',PWD); await p.click('text=Unlock')
  await p.waitForSelector('text=Admin Console')
  await p.locator('text=Dashboard').first().click()
  await p.waitForSelector('text=Sent to each party')
  ok(await p.locator('text=Sriram').first().isVisible(),'Dashboard shows party Sriram')
  ok((await p.locator('text=Spider Chrome').count())>0,'Dashboard shows Spider Chrome')
  console.log('\n✅ WELDER CHECKS PASSED')
}catch(e){ console.error('FAIL',e.message); await p.screenshot({path:'wfail.png'}).catch(()=>{}); process.exitCode=1 }
finally{ await b.close() }
