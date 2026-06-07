# UNICO Welder App — Complete Workflow Flowcharts (Mermaid)

> Every screen, action, database write, and approval/correction path, as the app
> behaves today (2026-06-07). Database writes are highlighted in **orange**.
> Firestore collections all live under `apps/welder/…`.
>
> Tip: GitHub, VS Code (with a Mermaid extension), and most markdown viewers
> render these automatically.

---

## 1. Master flow — entry → roles → screens → actions → DB writes

```mermaid
flowchart TD
    Start(["User opens the app link"]) --> URL{"URL parameter?"}

    URL -->|"?welder=1&who=Name"| Staff["WELDER / STAFF VIEW<br/>locked, entry only"]
    URL -->|"?role=owner"| OG["Password Gate<br/>6133923_N"]
    URL -->|"?role=manager"| IG["Password Gate<br/>nsp@123 or owner pwd"]
    URL -->|"no parameter"| Chooser["ROLE CHOOSER screen"]

    Chooser -->|"In-Charge"| IG
    Chooser -->|"Owner"| OG

    IG --> InConsole["IN-CHARGE CONSOLE"]
    OG --> OwConsole["OWNER CONSOLE"]

    %% Welder can only reach Entry
    Staff --> Entry["SCREEN: Material Sent (Entry)"]

    %% In-Charge pages
    InConsole --> Entry
    InConsole --> History["SCREEN: Entries (History)"]
    InConsole --> Pay["SCREEN: Contractor Pay (view rates)"]

    %% Owner pages (everything)
    OwConsole --> Entry
    OwConsole --> History
    OwConsole --> Pay2["SCREEN: Contractor Pay (edit rates + pay)"]
    OwConsole --> Outbox["SCREEN: Plating Outbox"]
    OwConsole --> Dash["SCREEN: Dashboard"]
    OwConsole --> Export["SCREEN: Export / Share"]
    OwConsole --> Admin["SCREEN: Admin"]

    %% --- Actions to DB ---
    Entry -->|"Save challan"| Wdisp[("dispatches +N rows")]
    Entry -->|"plating finish + gaadi"| Wout[("plating_outbox create/merge")]
    Entry -->|"every save"| Wlog1[("logs: SENT")]
    Entry -->|"challan counter floor"| Wcnt[("meta/counters")]

    History -->|"Edit qty/date"| Wdisp
    History -->|"Void (qty to 0)"| Wdisp
    History -->|"Hard delete (owner+pwd)"| Wdisp
    History -->|"any change"| Wlog2[("logs: EDIT/VOID/DELETE")]

    Pay2 -->|"Set/change rate"| Wrate[("rates upsert")]
    Pay2 -->|"Record payment"| Wpay[("payments insert")]
    Pay2 -->|"rate/payment"| Wlog3[("logs: RATE/PAYMENT")]

    Admin -->|"Add/Delete product/welder/party"| Wmast[("products / welders / parties")]
    Admin -->|"Restore / Clear"| Wdisp
    Admin -->|"all actions"| Wlog4[("logs")]

    %% Read-only / export screens
    Dash -->|"reads"| Rdisp["dispatches (derived totals)"]
    Export -->|"reads → PDF (WhatsApp)"| Rdisp
    Outbox -->|"reads (preview only)"| Rout["plating_outbox"]
    Pay -->|"reads"| Rpay["dispatches × rates − payments"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    classDef screen fill:#e8f0fe,stroke:#4361ee,color:#1b2a6b;
    classDef role fill:#e7f7ee,stroke:#1f9d57,color:#0c3d23;
    class Wdisp,Wout,Wlog1,Wcnt,Wlog2,Wrate,Wpay,Wlog3,Wmast,Wlog4 db;
    class Entry,History,Pay,Pay2,Outbox,Dash,Export,Admin,Staff,Chooser screen;
    class InConsole,OwConsole role;
```

---

## 2. The Save action (Entry) — detailed automation & DB writes

```mermaid
flowchart TD
    A(["Welder fills the form"]) --> B["Pick welder · date · finish · party · gaadi<br/>add product rows (product + qty)"]
    B --> C["Tap SAVE"]

    C --> V{"Validation"}
    V -->|"no welder"| E1["Toast: Pick your name"] --> B
    V -->|"no party"| E2["Toast: Pick where it is sent"] --> B
    V -->|"plating finish & no gaadi"| E3["Toast: Enter gaadi number"] --> B
    V -->|"no product+qty"| E4["Toast: Add at least one product"] --> B
    V -->|"OK"| Confirm["Confirm popup:<br/>preview welder → party (finish), gaadi, items"]

    Confirm -->|"Cancel"| B
    Confirm -->|"Yes, Save"| Guard{"Already saving?<br/>(double-tap guard)"}
    Guard -->|"yes"| Ignore(["Ignored"])
    Guard -->|"no → lock button"| Num["Generate welder challan no.<br/>NAV-### = max used in synced data + 1"]

    Num --> Loop["For EACH filled product line"]
    Loop --> Wd[("WRITE dispatches:<br/>one row per product<br/>date, welder, productName, finish,<br/>finishedName, party, qty, gaadi,<br/>welderChallan, dispatched=true")]

    Wd --> Plate{"Plating finish?<br/>(chrome / gold / rose)<br/>AND gaadi set"}
    Plate -->|"yes, existing gaadi+party+date"| Wo1[("UPDATE plating_outbox:<br/>append items + challan")]
    Plate -->|"yes, new"| Wo2[("CREATE plating_outbox row")]
    Plate -->|"no (powder/in-house)"| Skip["(no outbox)"]

    Wo1 --> Lg
    Wo2 --> Lg
    Skip --> Lg
    Lg[("WRITE logs: SENT …")] --> Cn[("WRITE meta/counters + last_used")]
    Cn --> Done["Toast: Saved ✓ · form resets · today's list updates live"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Wd,Wo1,Wo2,Lg,Cn db;
```

---

## 3. Approval / correction path (current model — no approval gate)

> The old pending→passed→approved pipeline was removed. **Every saved entry
> counts immediately.** Corrections happen via Edit / Void / Hard-delete, all logged.

```mermaid
flowchart TD
    New(["Entry saved"]) --> Counts["COUNTS IMMEDIATELY<br/>in Dashboard, Export & Pay"]

    Counts --> Need{"Need to correct it?"}
    Need -->|"no"| Stay(["Stays as production"])

    Need -->|"wrong quantity"| Who1{"Who & how old?"}
    Who1 -->|"Welder, same day (≤2d)"| FixFloor["Fix qty on Entry screen"]
    Who1 -->|"In-Charge, ≤2 days old"| EditIC["History → Edit qty/date"]
    Who1 -->|"In-Charge, >2 days old"| Lock["🔒 Locked — admin only"]
    Who1 -->|"Owner, any age"| EditOwner["History → Edit qty/date"]
    FixFloor --> Wupd[("UPDATE dispatches.qty")]
    EditIC --> Wupd
    EditOwner --> Wupd

    Need -->|"cancel / scrap"| Void["Void (asks reason)"]
    Void --> Wvoid[("UPDATE dispatches.qty = 0<br/>row kept, struck-through")]

    Need -->|"remove permanently"| HD{"Owner only"}
    HD -->|"enter admin password"| Wdel[("DELETE dispatches row")]
    HD -->|"wrong password"| Deny["Not deleted"]

    Need -->|"wrong welder/product/party"| Reentry["⚠ History edits only qty/date —<br/>must Void + re-enter correctly"]
    Reentry --> Wvoid

    Wupd --> LogA[("WRITE logs: EDIT")]
    Wvoid --> LogB[("WRITE logs: VOID")]
    Wdel --> LogC[("WRITE logs: DELETE")]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Wupd,Wvoid,Wdel,LogA,LogB,LogC db;
```

---

## 4. Contractor payment flow (Contractor Pay screen)

```mermaid
flowchart TD
    Open(["Owner opens Contractor Pay"]) --> Setup["Set filters:<br/>Month or Day · contractor · product · finish"]

    Setup --> Rates{"Set piece rates?<br/>(owner only)"}
    Rates -->|"pick process + contractor + effective-from"| RateIn["Enter ₹/piece per product"]
    RateIn --> Changed{"Rate actually changed?"}
    Changed -->|"no"| Skip2["(no record)"]
    Changed -->|"yes"| Close[("UPDATE prev rate:<br/>effectiveTo = day before new start")]
    Close --> Wr[("INSERT new rate:<br/>effectiveFrom, effectiveTo='',<br/>isActive=true (never overwrite)")]
    Wr --> WrL[("WRITE logs: RATE")]

    Setup --> Calc["DERIVED CALCULATION (nothing double-stored)"]
    Calc --> C1["countable = dispatches where<br/>welder match, qty>0, in date range,<br/>+ product/finish filters"]
    C1 --> C2["amount = Σ(qty × rate)<br/>contractor-specific rate beats common rate"]
    C2 --> C3["payable, paid (from payments),<br/>balance = payable − paid,<br/>all-time outstanding"]

    C3 --> View["Per-contractor statement card<br/>today pcs · period pcs · product breakdown"]

    View --> Payd{"Record payment?<br/>(owner only)"}
    Payd -->|"amount + date + note"| Wp[("INSERT payments")]
    Wp --> WpL[("WRITE logs: PAYMENT")]
    WpL --> Recalc["Balance recomputes instantly"] --> View

    View --> Exp{"Export?"}
    Exp -->|"per contractor"| PDF["PDF (jsPDF) → download/share"]
    Exp -->|"all contractors"| CSV["Excel/CSV → download"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Close,Wr,WrL,Wp,WpL db;
```

---

## 4b. Contractor Ledger flow (derived, audit-safe)

```mermaid
flowchart TD
    Open(["Owner/In-Charge opens Ledger"]) --> Pick["Pick contractor + month/range"]
    Pick --> Build["buildLedger (DERIVED from 3 single sources)"]

    D[("dispatches")] -->|"qty × rate-on-date = CREDIT"| Build
    Pmt[("payments")] -->|"DEBIT"| Build
    Lg[("ledger: advance / adjustment / opening")] -->|"DEBIT or CREDIT"| Build

    Build --> Calc["Sort by date → opening (b/f) →<br/>running balance = Σ(credit − debit) → closing"]
    Calc --> View["Table: Date | Type | Description | Debit | Credit | Balance"]

    View --> Owner{"Owner adds entry?"}
    Owner -->|"Payment"| Wp[("INSERT payments")]
    Owner -->|"Advance / Adjustment / Opening"| Wl[("INSERT ledger")]
    Wp --> Relog[("logs")] --> View
    Wl --> Relog

    View --> Ex{"Export"}
    Ex -->|"detailed"| PDF1["Ledger PDF"]
    Ex -->|"signature-ready"| PDF2["Settlement PDF (Contractor / Owner sign)"]

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class D,Pmt,Lg,Wp,Wl,Relog db;
```

---

## 5. Database collections & data flow

```mermaid
flowchart LR
    subgraph Masters["Master lists (Admin-managed)"]
        P[("products")]
        W[("welders")]
        Pt[("parties")]
    end

    subgraph Txn["Transactions"]
        D[("dispatches")]
        OB[("plating_outbox")]
        Pay[("payments")]
        R[("rates")]
        Led[("ledger")]
        Cnt[("meta/counters")]
        L[("logs")]
    end

    P -. "name used by" .-> D
    W -. "name used by" .-> D
    Pt -. "name used by" .-> D

    D -->|"plating finish + gaadi"| OB
    OB -->|"future live push"| PJW["Plating Job Work app"]

    D -->|"× rate"| Calc{{"Pay engine (derived)"}}
    R --> Calc
    Pay --> Calc
    Calc --> Stmt["Statements: payable / paid / balance"]

    D --> Ldg{{"Ledger engine (derived)"}}
    Pay --> Ldg
    Led --> Ldg
    R --> Ldg
    Ldg --> LedView["Ledger: running balance + settlement PDF"]

    D --> Rep{{"Report engine (derived)"}}
    Rep --> DashOut["Dashboard + Export PDF"]

    Cnt -.->|"challan no. floor"| D
    D -.->|"every action logs to"| L
    OB -.-> L
    Pay -.-> L
    R -.-> L

    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class P,W,Pt,D,OB,Pay,R,Led,Cnt,L db;
```

---

## 6. Where this app sits in the factory pipeline

```mermaid
flowchart LR
    O["ORDER<br/>(separate UNICO Orders app)"] --> Prod["PRODUCTION / LASER<br/>(not built)"]
    Prod --> Weld["WELDING<br/>✅ THIS APP (Entry)"]
    Weld --> Fin["SURFACE FINISH<br/>Chrome/Powder/Gold/Rose<br/>✅/🟡 THIS APP"]
    Fin --> QC["QC<br/>(not built)"]
    QC --> Disp["DISPATCH<br/>🟡 plating_outbox preview"]
    Disp --> PayP["PAYMENT<br/>✅ THIS APP (Contractor Pay)"]

    Weld -. "auto" .-> Ch[("welder challan NAV-###")]
    Fin -. "auto" .-> OBp[("plating_outbox")]
    PayP -. "derived" .-> St["statements & balances"]

    classDef done fill:#e7f7ee,stroke:#1f9d57,color:#0c3d23;
    classDef todo fill:#fdeaea,stroke:#d64545,color:#6b1212;
    classDef db fill:#fff3e0,stroke:#e8930c,stroke-width:2px,color:#7a4b00;
    class Weld,Fin,PayP done;
    class O,Prod,QC,Disp todo;
    class Ch,OBp db;
```

---

### Legend
- 🟧 **Orange `[( )]` nodes** = a Firestore write (`apps/welder/<collection>`).
- 🟦 **Blue** = a screen. 🟩 **Green** = a role/console or a built pipeline stage. 🟥 **Red** = not built yet.
- "Derived" = computed live from other collections, never stored twice (no double-counting).
- Reflects the codebase on **2026-06-07**, including Contractor Pay, crash-safe challan numbering, and the double-submit guard.
