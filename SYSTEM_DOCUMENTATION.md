# UNICO Welder Contractor App — Complete System Documentation

**App:** Welder Contractor (part of the UNICO factory app suite)
**Live URL:** https://nishanttmittal.github.io/welder/
**Repo:** github.com/nishanttmittal/welder · **Local:** `C:\Users\lenovo\Desktop\welder`
**Tech:** Vite + React + Tailwind · Firebase (Firestore) · jsPDF · PWA
**Cloud project:** `unico-operations` (shared by all UNICO apps) · namespace `apps/welder`
**Document date:** 2026-06-07 · **Status:** Live, in active development

> **How to read this:** This describes what the app **actually does today** (not just the plan). Where something is planned, partial, or risky, it is clearly marked: ✅ done · 🟡 partial · 🔴 missing/risk.

---

## 0. One-paragraph summary

A welder (contractor) opens a personal locked link on their phone, records the products they finished and loaded onto a vehicle (gaadi) for surface finishing (Chrome / Powder / Gold / Rose Gold). On Save, the app records each product and—for plating finishes—auto-builds a combined "plating challan" preview for the owner. The owner sees dashboards of daily/monthly production, sets secret per-piece rates, and the app auto-calculates each contractor's earnings, payments, and balance. Everything syncs across phones in real time and works offline.

---

## 1. Full App Workflow (step by step)

### 1.1 The screens at a glance

| Screen | File | Who uses it | Purpose |
|---|---|---|---|
| **Role Chooser** | `RoleChooser.jsx` | In-Charge / Owner | Pick who you are (welders skip this via their own link) |
| **Password Gate** | core `PasswordGate` | In-Charge / Owner | Enter role password |
| **Material Sent (Entry)** | `Entry.jsx` | Welder, In-Charge, Owner | The main daily data-entry screen |
| **Entries (History)** | `History.jsx` | In-Charge, Owner | View / edit / void / delete past entries |
| **Contractor Pay** | `ContractorPay.jsx` | In-Charge (view), Owner (edit) | Rates, daily/monthly statements, payments |
| **Contractor Ledger** | `Ledger.jsx` | In-Charge (view), Owner (edit) | Accounting ledger: running balance, advances, adjustments, settlement PDF |
| **Plating Outbox** | `PlatingOutbox.jsx` | Owner | Preview of combined challans for the Plating app |
| **Dashboard** | `Dashboard.jsx` | Owner | Daily/monthly production totals by welder & party |
| **Export / Share** | `Export.jsx` | Owner | Daily PDF report for WhatsApp |
| **Admin** | `Admin.jsx` | Owner | Manage products/welders/parties, backup, logs |

### 1.2 Screen-by-screen detail

#### A. Material Sent (Entry) — the heart of the app
- **Who:** Welder (via `?welder=1&who=Name`, locked, entry-only), also In-Charge and Owner.
- **Inputs:** Welder name (auto-filled for locked welder link) · Date (welder limited to today + 2 days back) · Finish (Chrome / Powder / Gold / Rose Gold) · Sent-to party (auto-suggested from finish) · Gaadi (vehicle) number (**required** for plating finishes) · A list of products with quantities (add as many rows as needed; welders can only *pick* products, not create them).
- **Validation before save:** name present · party present · gaadi present if plating finish · at least one product with qty > 0.
- **Confirmation:** A "Save this challan?" popup previews welder → party (finish), gaadi last-4, and each product/qty. This guards against accidental/double save.
- **Outputs / what happens after Save:**
  1. A **welder challan number** is generated for this gaadi-load, e.g. `NAV-001` (Naveen) or `JIT-001` (Jitender). The per-welder counter increments.
  2. **One dispatch record is inserted per product line** — all sharing that challan number, marked `dispatched: true`.
  3. If the finish is a **plating finish (Chrome/Gold/Rose)** *and* a gaadi is set → a combined **Plating Outbox** entry is created (or merged into the existing one for the same gaadi + party + date). Each line reads `"NAV-001 Spider"` so the Plating app understands it unchanged.
  4. An activity **log** entry is written (`SENT …`).
  5. The "last used" welder/finish/party are remembered for next time.
  6. The form resets; today's entries list updates instantly.
- **In-screen corrections (same day, within 2-day window):** "Fix qty" and "Cancel" (sets qty to 0 = void) directly on each of today's entries.

#### B. Entries (History)
- **Who:** In-Charge (limited) and Owner (full).
- **Inputs:** Search box (product / welder / party / date).
- **Actions & rules:**

  | Action | In-Charge (User1) | Owner |
  |---|---|---|
  | Edit qty / date | ✅ only entries ≤ 2 days old | ✅ any entry |
  | Void (set qty 0) | ✅ ≤ 2 days old | ✅ any entry (asks reason) |
  | Hard delete | 🔴 not allowed | ✅ requires admin password |
  | See per-entry edit log | 🔴 no | ✅ yes (who/what/when) |
- **Output:** Every edit/void/delete is logged with who, old→new value, and timestamp.

#### C. Contractor Pay
- **Who:** In-Charge (view rates + statements), Owner (edit rates, record payments).
- **Inputs:** Month **or** any single Day · Contractor filter · Product filter · Finish filter · (Owner) per-piece rates by process + optional contractor · (Owner) payment amount/date/note.
- **Outputs:** Per-contractor statement — today's pieces & earning, period pieces, product-wise breakdown (qty × rate = amount), **Payable / Paid / Balance** for the period, plus **all-time Outstanding**. Export per-contractor **PDF** or all-contractors **Excel (CSV)**.
- **What happens after "Record payment":** a payment record is inserted, logged, and the contractor's Paid/Balance recalculates immediately (everything is derived—nothing is double-stored).

#### D. Plating Outbox
- **Who:** Owner. **Inputs:** none (read-only preview). **Output:** the combined challans (gaadi → party, welder-challan list, product lines, total pcs) that are *ready* to push into the Plating Job Work app. **Live push is intentionally OFF** — it is a preview until the owner approves and plating cloud rules are confirmed.

#### E. Dashboard
- **Who:** Owner. **Inputs:** Report date. **Outputs:** Sent that day · Month-to-date · Welders active · per-welder totals · per-party product breakdown ("what went to whom").

#### F. Export / Share
- **Who:** Owner. **Inputs:** Date. **Output:** Daily dispatch PDF (total + per-welder + per-party), shared via WhatsApp (Web Share on iPhone) or downloaded on desktop.

#### G. Admin
- **Who:** Owner. **Inputs:** Add/delete products, welders, parties · Backup (JSON) · Restore (replaces all) · Clear all dispatches. **Output:** master lists updated, JSON backup file, activity log (last 40 actions).

### 1.3 Approval / rejection flow (current reality)

> 🔴 **Important:** This app **does not have an active approval pipeline.** An earlier 3-tier "pending → passed → approved" flow was **deliberately removed** so entries hit the dashboard immediately. Per the owner's decision (2026-06-07), payment also uses the simple model:

- **Every saved entry counts** immediately (production + payment).
- **Cancel / Void** sets the quantity to **0** so it no longer counts (it is not deleted; it stays visible, struck-through, for audit).
- **Hard delete** is owner-only and password-protected.
- There is **no separate "reject / repair / QC-fail" status** in the data model. (A `status` field exists but is legacy and not enforced anywhere.)

### 1.4 Automation logic (summary — details in §4)
- Auto welder-challan numbering per welder per gaadi.
- Auto fan-out of one form into many dispatch rows.
- Auto creation/merge of the plating challan preview.
- Auto earnings = Σ(qty × rate); auto balance = payable − paid.
- Auto real-time sync + offline cache.

---

## 2. User Roles & Permissions

### 2.1 Roles that actually exist in the app

| Requested role | Maps to in this app | How they enter |
|---|---|---|
| **Owner / Admin** | **Owner** | `?role=owner` or chooser → password `6133923_N` |
| **Supervisor** | **In-Charge ("User1")** | `?role=manager` or chooser → password `nsp@123` |
| **Welder** | **Welder (Staff)** | `?welder=1&who=Naveen` (personal locked link) |
| **Contractor** | = the **Welder** (same person; "contractor" is the pay term for the welder) | same as welder |
| **Staff** | = **Welder/Staff** (no separate generic staff role) | same as welder |

> 🟡 So today there are effectively **3 real roles**: Welder, In-Charge, Owner. "Supervisor", "Contractor", "Staff" are **names for these three**, not separate accounts. A distinct QC/Supervisor role does **not** exist yet.

### 2.2 Permission matrix

| Capability | Welder (Staff) | In-Charge (Supervisor) | Owner/Admin |
|---|:--:|:--:|:--:|
| Record production (Entry) | ✅ | ✅ | ✅ |
| Fix/cancel own entry (≤ 2 days) | ✅ | ✅ | ✅ |
| See History of all entries | 🔴 | ✅ | ✅ |
| Edit/void entries ≤ 2 days old | 🔴 | ✅ | ✅ |
| Edit/void entries **older** than 2 days | 🔴 | 🔴 | ✅ |
| Hard-delete an entry | 🔴 | 🔴 | ✅ (password) |
| See Dashboard | 🔴 | 🔴 | ✅ |
| See Export / share PDF | 🔴 | 🔴 | ✅ |
| Open Contractor Pay | 🔴 | ✅ (view only) | ✅ |
| **See piece rates / money** | 🔴 | 🟡 **can view rates** | ✅ |
| **Set/edit piece rates** | 🔴 | 🔴 | ✅ |
| Record payments (auto slip no.) | 🔴 | ✅ | ✅ |
| Edit / reverse a payment (audit-logged) | 🔴 | 🔴 | ✅ |
| Open Contractor Ledger | 🔴 | ✅ (view + export + pay) | ✅ |
| Add advance / adjustment / opening balance | 🔴 | 🔴 | ✅ |
| Plating Outbox | 🔴 | 🔴 | ✅ |
| Admin (master lists, backup, reset) | 🔴 | 🔴 | ✅ |

> 🟡 **Note vs spec:** the spec says "welder/operator cannot see pricing" — that is satisfied (welders never see Contractor Pay). **But** In-Charge can *view* rates (not edit). If pricing must be hidden from In-Charge too, that is a small change. Flag for decision.

---

## 3. Database Structure (Firestore)

All data lives under `apps/welder/` in the shared `unico-operations` Firestore project. Each collection is a set of documents; the app reads them live via `onSnapshot`.

### 3.1 Collections

| Collection (path) | Purpose | Grows with |
|---|---|---|
| `apps/welder/dispatches/{id}` | Every "material sent" line | Daily production |
| `apps/welder/products/{id}` | Base product master list | Admin edits |
| `apps/welder/welders/{id}` | Welder/contractor master list | Admin edits |
| `apps/welder/parties/{id}` | Where material is sent (job-work/dept) | Admin edits |
| `apps/welder/rates/{id}` | Owner-set piece rates | Owner edits |
| `apps/welder/payments/{id}` | Payments made to contractors | Owner edits |
| `apps/welder/ledger/{id}` | Manual ledger entries: opening / advance / adjustment | Owner edits |
| `apps/welder/plating_outbox/{id}` | Combined challan previews for Plating app | On dispatch |
| `apps/welder/logs/{id}` | Activity / audit log | Every action |
| `apps/welder/meta/counters` | Singleton: per-welder challan counters | On each save |

### 3.2 Fields per collection

**dispatches** (one per product line sent)
| Field | Type | Meaning |
|---|---|---|
| `id`, `createdAt` | string | auto |
| `date` | date | when sent |
| `welder` | text | contractor name |
| `productName` | text | base product (e.g. "Spider") |
| `finish` | text | `chrome` / `powder` / `gold` / `rosegold` |
| `finishedName` | text | product + finish (e.g. "Spider Chrome") |
| `party` | text | where it was sent |
| `qty` | number | pieces (**0 = voided**) |
| `gaadi` | text | vehicle number |
| `welderChallan` | text | e.g. `NAV-001` |
| `dispatched` | toggle | true once saved |
| `status` | text | 🔴 legacy, default "pending", **not used** |
| `batchId` | text | *future-compat (hidden):* groups all line items saved together |
| `productId` | text | *future-compat:* id from products master (catalogue link) |
| `workflowStage` | text | *future-compat:* `welding` (this app's stage) |
| `sourceApp` | text | *future-compat:* `welder` |
| `destinationApp` | text | *future-compat:* e.g. `platingjobwork` for plating finishes |
| `linkedChallanId` | text | *future-compat:* welder/plating challan link (= welderChallan) |
| `parentTransactionId` | text | *future-compat:* upstream txn (order/production) — blank for now |
| `createdByRole` | text | *future-compat:* `welder` / `incharge` / `owner` |
| `updatedAt` | text | *future-compat:* ISO timestamp, auto-stamped on every write |
| `factoryId` | text | *future-compat:* `main` (multi-factory ready) |

> **Future-compatibility note:** the 10 fields above are **optional and hidden** (no UI). They exist on every record so later apps (laser/plating/powder/assembly/packing/dispatch, multi-factory, ERP) can link to welder data **without any database redesign**. The normalizer backfills defaults onto old records on read; new records auto-fill the known values on save.

**rates** (owner-set piece rate — **historical & time-based**)
| Field | Type | Meaning |
|---|---|---|
| `id` (rateId) | string | record id |
| `process` | text | `welding` (now) / plating / powder / assembly / packing / dispatch (future) |
| `productId` | text | id from products master |
| `productName` | text | which product (matched against dispatches) |
| `contractor` | text | `""` = applies to all; a name = special override |
| `rate` | number | ₹ per piece |
| `effectiveFrom` | date | when this rate starts (`""` = since the beginning) |
| `effectiveTo` | date | when it ends (`""` = open / current) |
| `isActive` | toggle | false = deactivated (kept in history, never deleted) |
| `createdBy` | text | who set it |
| `createdAt`,`updatedAt` | string | auto-stamped |

> **Time-based rates:** rates are **never overwritten**. Changing a rate auto-closes the previous one (`effectiveTo` = day before the new start) and inserts a new record. Every dispatch is paid at the rate **in effect on its production date** — so a June statement keeps June's rate even after a July change. Priority: contractor-specific > common. Future-dated rates = scheduled changes. Old simple rates (legacy `product`, no dates) are read as "always in effect" so existing calculations are unchanged.

**payments** (auto slip number `UMP-PAY-0001…`, unique, crash-safe): `paymentSlipNo`, `contractor`, `amount`, `paymentMode` (Cash/UPI/Cheque/Bank), `remark`, `paymentDate`, `paidByUser`, `paidByRole` (Manager/Owner), `reversed`, plus legacy `date`/`note` (mirrored). No payment *time* — date only.
**ledger** (manual non-derived entries): `contractor`, `date`, `type` (`opening`/`advance`/`adjustment`), `direction` (`debit`=increases owed / `credit`=decreases), `amount`, `note`, `createdBy`, `reversed`.

> **Contractor Ledger (derived & audit-safe):** built live from three single sources — **Production** (`dispatches` × rate-on-production-date → **Debit**, increases owed), **Payment** (`payments` → **Credit**, reduces owed) and **Advance/Adjustment/Opening** (`ledger`). No figure stored twice. Columns: Date | Slip No | Type | Remark | Paid By | Debit | Credit | Running Balance. Running balance = Σ(debit − credit); positive = payable to contractor. A future rate change never reprices old production lines. **Reversal not deletion:** owner reverses a payment/entry → it stays in history (struck-through) at zero and the audit log records old→new/who/reason. Exports: **Ledger PDF** + signature-ready **Settlement PDF**.
**products / welders / parties**: `name`, `order`.
**plating_outbox**: `date`, `gaadi`, `party`, `items[{product, quantity}]`, `welderChallans[]`, `pushed`, `platingChallanNo`.
**logs**: `ts`, `action`, `detail`, `by`, `ref` (the dispatch id it relates to).
**meta/counters**: `{ challan: { Naveen: 3, Jitender: 1 } }`.

### 3.3 Relationships & data flow

```
products ─┐
welders ──┼─(names referenced by)─► dispatches ──(derive)──► report.js  ► Dashboard / Export
parties ──┘                              │
                                         ├─(plating finish + gaadi)──► plating_outbox ──► [Plating app]
rates ───────────(qty × rate)──────────► pay.js (statements) ◄── payments
                                                  │
meta/counters ──(next challan no.)──► dispatches  └─► Contractor Pay screen
logs ◄── every create/edit/void/delete/payment/rate-change
```

- **Relationships are by name, not by ID** (e.g. a dispatch stores `welder: "Naveen"`, not a welder document id). Simple, but renaming a master record does **not** retro-update old dispatches. 🟡
- **Stock/earnings are derived, never stored** — payable always recomputes from dispatches × rates, so there is no double-counting.

---

## 4. Automation Rules

| # | Automation | Trigger | Logic | Notes / Risk |
|---|---|---|---|---|
| 1 | **Welder challan number** | On Save | `PREFIX-###` derived from the **highest number this welder already used in the synced dispatches** (+1), with the legacy counter only as a same-session floor | ✅ **Fixed 2026-06-07.** Now safe across phones (dispatches sync in real time) and survives a crash; works offline. Residual: same welder on two devices *while both offline* (rare — each welder uses their own phone). |
| 2 | **Fan-out to dispatch rows** | On Save | One form → N dispatch docs, all sharing the challan number & `dispatched:true` | ✅ |
| 3 | **Plating challan preview** | On Save, **if** finish ∈ {chrome,gold,rosegold} **and** gaadi set | Create or merge a `plating_outbox` row for same gaadi+party+date; lines = `"NAV-001 Spider" × qty` | Powder is in-house, excluded. 🟡 Live push to Plating app **not enabled** (preview only). |
| 4 | **Status changes** | n/a | 🔴 No automatic status pipeline (approval removed). Cancel = qty→0. | Spec's "approved/reject" not implemented by owner's choice. |
| 5 | **Earnings calculation** | Live (derived) | `amount = qty × rate`; contractor-specific rate overrides the common rate; only qty>0 counts | ✅ Verified |
| 6 | **Balance calculation** | Live (derived) | `balance = payable − paid` (period); `outstanding = all-time payable − all-time paid` | ✅ |
| 7 | **Notifications** | — | 🔴 **None.** No push/WhatsApp alerts. Only on-screen toasts + manual PDF share. | Recommended later. |
| 8 | **Reject / rework logic** | — | 🔴 Not modeled. Only Void (qty→0). | No "repair" state. |
| 9 | **Dispatch logic** | On Save | Every entry is auto-`dispatched:true`; there is no separate dispatch step anymore | Simplified by design. |
| 10 | **Real-time sync + offline** | Always | Firestore `onSnapshot` + `persistentLocalCache` (IndexedDB). `?local=1` forces pure on-device mode. | ✅ |
| 11 | **Audit log** | Every action | Writes to `logs` with who/what/when | ✅ |

---

## 5. Workflow Diagram (target end-to-end vs. what this app covers)

```
   ┌─────────┐   ┌───────────┐   ┌──────────┐   ┌────────────────┐   ┌──────┐   ┌──────────┐   ┌──────────┐
   │  ORDER  │──►│ PRODUCTION│──►│ WELDING  │──►│ SURFACE FINISH │──►│  QC  │──►│ DISPATCH │──►│ PAYMENT  │
   │         │   │  (laser/  │   │          │   │ Chrome/Powder/ │   │      │   │          │   │          │
   │         │   │  cutting) │   │          │   │  Gold/Rose     │   │      │   │          │   │          │
   └─────────┘   └───────────┘   └──────────┘   └────────────────┘   └──────┘   └──────────┘   └──────────┘
        │              │              │                  │               │            │              │
     UNICO          🔴 not         ✅ THIS APP      ✅/🟡 THIS APP      🔴 not     🟡 partial    ✅ THIS APP
     Orders         built          (Entry →         (plating_outbox    built     (Plating       (Contractor
     app (sep.)                    challan)          preview →                    Outbox →        Pay)
                                                     Plating app)                 Plating app
                                                                                  push OFF)
```

**What the Welder app owns today:** Welding entry → welder challan → (for plating finishes) a combined plating challan preview → contractor payment.
**External / not yet connected:** Order (separate UNICO Orders app), Production/laser cutting (not built), QC (not built), live Dispatch push into the Plating app (preview only).

---

## 6. Edge Cases / Failure Cases

| Case | Current behaviour | Verdict |
|---|---|---|
| **Duplicate entry** (same product twice in one form) | Both rows saved and summed | 🟡 No dedupe; relies on the confirm popup |
| **Wrong quantity** | Fixable via "Fix qty" (same day) or History edit (≤2 days for In-Charge, any time for Owner); change is logged | ✅ |
| **Deleted challan / entry** | Void keeps it (qty 0, struck-through) for audit; hard delete is owner+password and logged | ✅ for void · 🟡 hard delete is irreversible |
| **Internet failure** | Works offline via IndexedDB cache; syncs when back online. `?local=1` = fully offline. | ✅ |
| **Duplicate Save click** | Confirm popup + form clears on save; "Yes, Save" is now **hard-blocked** after the first tap (ref guard + button disables to "Saving…") | ✅ Fixed 2026-06-07 |
| **Incorrect contractor assignment** | Welder name picked from a dropdown; locked link auto-sets it. Wrong pick → edit in History (re-assign not directly supported—only qty/date are editable!) | 🔴 **History cannot change the welder/product/party of an entry** — only qty & date. A wrong welder must be voided + re-entered. |
| **Two phones, same gaadi, offline** | Numbers derive from synced data, so online they never collide; only a *same-welder, both-offline* window remains (rare) | 🟡 Greatly reduced 2026-06-07 |
| **Rename a product/welder** | Old dispatches keep the old name (name-based links) | 🟡 Historical reports unaffected, but lists diverge |
| **Restore a backup** | Replaces ALL data after a confirm | 🟡 Destructive; no merge |

---

## 7. Security & Permission Risks

| Risk | Status | Detail & recommendation |
|---|---|---|
| **Role enforcement** | ✅ Addressed (welder) | Cloud mode now uses **Google sign-in** for Manager/Owner; roles come from `apps/welder/users` (+ bootstrap owner email). **Firestore rules enforce roles server-side:** operational data = any signed-in; rates/ledger = owner-write; payments = manager-create / owner edit-reverse; users = owner. Welders stay anonymous (link-based) for floor entry. ⚠️ Requires the new `firestore.rules` to be **published** in the console. |
| **Passwords in client code** | 🟡 Reduced | The hard-coded `6133923_N`/`nsp@123` now only apply in offline `?local=1` testing mode; cloud (production) uses Google auth, not these passwords. Consider removing them once cloud auth is confirmed in daily use. |
| **Anonymous-auth data exposure** | 🟡 Medium | Rules currently allow read/write to anyone signed in. Fine for a trusted small team; not safe for wider rollout. |
| **Firestore rules must be published** | 🟡 | The repo's `firestore.rules` covers `apps/welder/{collection}/{docId}` (so rates/payments are included). These **must be published in the Firebase console**; until then cloud reads/writes for new collections may be denied. |
| **GitHub token exposure** | 🔴 | Deploy token was exposed previously (noted to rotate, `ghp_zm8q…`). **Rotate it.** Firebase web config keys are *not* secret (safe to ship). |
| **No rate limiting / validation server-side** | 🟡 | All validation is client-side; a crafted request could write bad data. Acceptable for internal use; revisit before external exposure. |
| **Hard delete + restore are powerful** | 🟡 | Owner can wipe/replace data. Mitigated by password + JSON backup, but no versioned/cloud backup. |

---

## 8. Scalability Review

| Capability | Supported today? | What's needed |
|---|:--:|---|
| **Welding** | ✅ | Fully built |
| **Surface finish (Chrome/Powder/Gold/Rose)** | ✅ | Built as "finish" on each entry |
| **Plating** | 🟡 | Plating app exists separately; preview bridge built, **live push off** |
| **Powder coating** | 🟡 | Recorded as a finish here; no dedicated powder app/process pay yet |
| **Contractor payments** | ✅ | Built (this update). Per-process rate hooks ready. |
| **Laser cutting** | 🔴 | No app/screen; `process: 'laser'` could be added to rates, but no production capture |
| **Assembly** | 🟡 | A separate Fitting app exists; not linked to this pay engine yet. Rate `process: 'assembly'` reserved. |
| **Packing** | 🔴 | Reserved as a rate process only; no capture |
| **Dispatch** | 🟡 | Entries auto-dispatch; no standalone dispatch/delivery module |
| **Multi-factory** | 🔴 | Single namespace `apps/welder`; no `factory` field or per-site separation (Kansala Rohtak plant would need this) |
| **Export orders** | 🔴 | No export-order fields (buyer, port, currency, docs) |

**Architecture verdict:** The **foundation is genuinely scalable** — a shared cloud project, a reusable core framework (storage/repository/schema), name-based master lists, and a `process` dimension already designed into rates. The **pay engine is the natural hub** for all contractor processes. To truly scale you mainly need: (a) capture screens for the other processes (laser/packing/assembly feeding the same pay engine), (b) a `factory` field for multi-site, and (c) real auth.

---

## 9. Missing Features — Recommendations before production use

**Must-fix (security/integrity) before wider rollout**
1. 🔴 **Real owner authentication** (Google sign-in) + Firestore rules that restrict rates/payments/deletes to owner UIDs. Removes the "UI-only" bypass and the client-side passwords.
2. ✅ **Crash-safe challan numbering** — *done 2026-06-07* (derived from synced data). For absolute safety even in the rare same-welder-both-offline case, a Firestore transaction counter (like the Plating app) could be added later, at the cost of needing internet to save.
3. 🔴 **Rotate the exposed GitHub token.**
4. ✅ **Block double-submit** on the Save confirm button — *done 2026-06-07*.

**High-value functional gaps**
5. 🟡 **Edit welder/product/party of an entry** in History (today only qty/date are editable; wrong assignments need void + re-entry).
6. 🟡 **QC / Reject-Rework step** if you want "only good pieces are paid" — currently every piece is paid. (Owner chose simple model 2026-06-07; revisit if scrap becomes costly.)
7. 🟡 **Notifications** — daily WhatsApp summary auto-send; low-balance/owed alerts.
8. 🟡 **Decide rate visibility for In-Charge** (currently can view rates).

**Scale & reporting**
9. **`factory` field** for multi-site (Kansala Rohtak).
10. **Capture screens** for laser/assembly/packing feeding the same pay engine; turn on **live plating push**.
11. **Cloud/versioned backups** (current backup is a manual JSON download).
12. **Per-contractor ledger PDF** (opening balance → production → payments → closing) for monthly settlement signatures.

**Polish**
13. Combined **UNICO ERP dashboard** across all apps (already on the roadmap).
14. Product/welder **rename that updates references** (or switch to id-based links).

---

## 10. Document status

This documentation reflects the codebase as of **2026-06-07**, including the new Contractor Pay feature (rates per process/contractor, daily/monthly statements, PDF + Excel export). Items marked 🔴/🟡 are the honest gaps to address before treating this as a hardened production system; the core daily workflow is **live and working** for your team today.
