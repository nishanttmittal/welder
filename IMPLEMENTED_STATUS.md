# UNICO Welder App — ACTUAL Implemented Status

**Generated from a code read on 2026-06-07** (not the plan). Every claim below was
checked against the source. Legend: ✅ working · 🟡 works with caveat · 🟦 placeholder/dormant (code exists, not wired) · 🔴 not built.

---

## 1. What ACTUALLY runs end-to-end today

This is the real working loop a user can perform right now (build passes; logic verified):

```
Open link → Role (Welder / Manager / Owner) → password (Manager/Owner)
  → Welder records "Material Sent" (gaadi + products, one Save)
      → app writes N dispatch rows + auto welder-challan NAV-001
      → if chrome/gold/rose + gaadi → builds a Plating Outbox PREVIEW
  → Owner sees Dashboard (instant totals), Export daily PDF
  → Owner sets time-based piece RATES; pay auto-derives (qty × rate-by-date)
  → Manager OR Owner records a PAYMENT (auto slip UMP-PAY-0001, mode, paid-by)
  → Contractor LEDGER shows running balance; Owner reverses/edits (audited)
  → Owner/Manager export Ledger PDF + signature-ready Settlement PDF
```

---

## 2. Screen-by-screen — really working vs not

| Screen | Status | Reality |
|---|---|---|
| Role Chooser + Password Gate | ✅ | Welder uses `?welder=1&who=Name`; Manager `?role=manager`; Owner `?role=owner` or chooser. Passwords work (but are client-side — see §5). |
| **Material Sent (Entry)** | ✅ | One-save multi-product; auto challan `NAV-001` **derived from synced data** (crash-safe); double-submit blocked; same-day Fix/Cancel; future-compat fields auto-filled. |
| **History** | ✅ | Search, edit qty/date, void (qty→0), owner hard-delete (password), per-entry edit log. ⚠️ **Can only edit qty & date** — not welder/product/party (wrong assignment ⇒ void + re-enter). |
| **Dashboard** | ✅ | Day total, by-welder, by-party breakdown, month-to-date. Counts every entry (no approval gate). |
| **Export / Share** | ✅ | Daily dispatch PDF via WhatsApp/Web Share. |
| **Admin** | ✅ | Add/delete products·welders·parties, JSON backup/restore, clear dispatches, activity log (last 40). |
| **Contractor Pay** | ✅ | Historical time-based rates (never overwritten, scheduled/future dates, per-contractor override), rate resolved per production date, Rate History table + deactivate, month/day + product/finish filters, statements, PDF + Excel/CSV, record payment. |
| **Contractor Ledger** | ✅ | Derived running balance (Production=Debit, Payment/Advance=Credit), opening b/f + closing, slip/paid-by columns, owner reverse/edit with audit, Ledger PDF + Settlement PDF. |
| **Plating Outbox** | 🟡 | **PREVIEW ONLY.** It shows the combined challans, but **nothing is ever pushed** to the Plating app (see §3). |

---

## 3. Placeholders / dormant code (exists but NOT wired)

| Feature | Evidence in code | Reality |
|---|---|---|
| **Live push to Plating Job Work app** | `platingPaths` defined in `firebase.js` but **never imported/called** anywhere; every `plating_outbox` row is created with `pushed: false`; nothing ever sets `pushed: true` or a `platingChallanNo`. | 🟦 **Not implemented.** Outbox is a read-only preview. Plating challans are NOT created in the plating app. |
| **Google login for Owner/Admin** | `verifyAdminGoogle()` + `GoogleAuthProvider` defined in `firebase.js`, **never invoked**. Admin unlocks via hard-coded password. | 🟦 **Dormant.** Real auth not active. |
| **Rates for plating/powder/assembly/packing/dispatch** | `process` dropdown lets you *save* rates for these, and `rateOn` honours `process`. | 🟡 **Half-real:** you can store the rates, but there is **no production capture** for those processes and no app feeds them, so they pay nothing yet. |
| **Cross-app links (`parentTransactionId`, `batchId`, `productId`, `sourceApp`, etc.)** | Fields exist on `dispatches`, auto-filled on save. | 🟡 **Data is real, consumers are future.** No Orders/Production app reads them yet. `parentTransactionId` stays blank. |
| **Multi-factory (`factoryId`)** | Stored as `'main'` on every record. | 🟦 No UI, single value. Future. |
| **Approval / QC / reject-rework** | Legacy `status` field on dispatch (default `'pending'`) is **never read**. | 🔴 Removed by design. Every entry counts; only Void exists. |

---

## 4. Cloud / data layer — real state

- **Two backends, same shape:** `localStorage` and **Firestore** (real-time `onSnapshot` + offline `persistentLocalCache`). `?local=1` forces pure on-device mode. ✅ code-complete.
- 🟡 **Firestore activation depends on rules being published** in the Firebase console (`apps/welder/...`). Per project notes this was still pending; until the welder rules are live, cloud reads/writes are denied and the app shows a connect error (local mode still works). **Verify in the console.**
- ✅ **New collections** (`rates`, `payments`, `ledger`) are covered by the generic `apps/welder/{collection}` rule — no extra rule needed once the welder block is published.
- ✅ `updatedAt` is now auto-stamped on every insert/update across all collections.

---

## 5. Honest risk flags (unchanged or partially addressed)

| Flag | State |
|---|---|
| **Role enforcement is UI-only** | 🔴 Still true. Anyone signed in (anonymous auth) can read/write any `apps/welder` doc — including rates/payments/ledger — at the database level. Owner-control is screen-deep only. |
| **Passwords in client code** | 🔴 `6133923_N` / `nsp@123` shipped in `config.js`. |
| **GitHub token** | 🔴 Previously exposed — rotate. |
| **Challan numbering** | 🟡 Crash-safe (derived) and cross-device-safe when online; rare residual: same welder on two offline devices. |
| **Payment integrity** | ✅ Auto slip numbers, no silent delete (reverse-only), audit log on edit/reverse. |
| **History can't reassign welder/product** | 🟡 Only qty/date editable. |

---

## 6. Tests — real coverage

- **One** automated test: `test-welder.mjs` (Playwright). Covers: staff save → outbox → dashboard → record payment → User1 read-only.
- 🔴 **It is now partially STALE:** step [5] asserts *"User1 cannot record payments"* — but today's change deliberately **lets the Manager record payments**, so that assertion would now FAIL. The test needs updating to the new permission model.
- 🟡 The new **rates / historical-rate / ledger / payment-slip / reversal** logic was verified only by **ad-hoc Node checks during development** — there is no committed automated test for them yet.
- ✅ `vite build` passes clean for the whole app.

---

## 7. One-line summary

**Working for real:** the full welder→pay→ledger loop (entry, challan, dashboard, export, admin, time-based rates, derived statements, slip-numbered payments with manager/owner tracking, audited reversals, and a derived contractor ledger with PDF/settlement export).
**Not real yet:** live plating push (preview only), Google login (dormant), non-welding process pay, cross-app order/production links, multi-factory, and proper server-side security — plus the Firestore rules likely need publishing and the lone UI test needs updating.
