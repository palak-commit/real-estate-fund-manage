"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  Landmark,
  Building2,
  ArrowRightLeft,
  Receipt,
  CheckCircle2,
  Banknote,
  HardHat,
  Repeat2,
  UserMinus,
  Info,
  Wallet,
  CreditCard,
  Tag,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

/* ─── TOC items ─────────────────────────────────────────────── */
const TOC = [
  { id: "setup-steps",       label: "Setup Steps" },
  { id: "transaction-types", label: "Transaction Types" },
  { id: "category-paidto",   label: "Category & Paid To" },
  { id: "add-money",         label: "Add Money" },
  { id: "recheck-balances",  label: "Recheck Balances" },
];

/* ─── Step-by-step data ──────────────────────────────────────── */
const steps = [
  {
    number: 1,
    title: "Add a Bank Account",
    description:
      "First, set up where your money is coming from. Go to the Accounts page and add your bank accounts or cash on hand. You can also add investor / partner accounts here.",
    icon: Landmark,
    actionLabel: "Go to Accounts",
    actionHref: "/accounts",
  },
  {
    number: 2,
    title: "Add a Site",
    description:
      "Next, create the construction sites or projects you are managing. Each site will have its own separate budget and expense tracking.",
    icon: Building2,
    actionLabel: "Go to Sites",
    actionHref: "/projects",
  },
  {
    number: 3,
    title: "Allocate Funds to the Site",
    description:
      'Move money from your Bank Account into a Site. This sets the working budget for that site. Click the "+ New Transaction" button and choose "Add Site Fund".',
    icon: ArrowRightLeft,
    actionLabel: null,
    actionHref: null,
  },
  {
    number: 4,
    title: "Record Expenses",
    description:
      'When you spend money on a site, record it as an expense. Click the "+ New Transaction" button and choose "Site Expense". You can pay from the Site\'s allocated funds or directly from a Bank Account.',
    icon: Receipt,
    actionLabel: null,
    actionHref: null,
  },
];

/* ─── Transaction type explanations ─────────────────────────── */
const features = [
  {
    label: "Add Site Fund",
    color: "bg-primary/10 text-primary border-primary/20",
    iconColor: "text-primary",
    icon: Banknote,
    what: "Send money from your bank or cash into a specific site.",
    example:
      'Example: You have ₹5,00,000 in HDFC Bank. You move ₹1,50,000 to "Site A" so workers can start buying materials.',
    when: "Use this whenever a site needs more budget to operate.",
    fields: [
      { name: "From Account", desc: "Which bank or cash account to take the money from." },
      { name: "To Site", desc: "Which site gets the money." },
    ],
  },
  {
    label: "Site Expense",
    color: "bg-danger/10 text-danger border-danger/20",
    iconColor: "text-danger",
    icon: HardHat,
    showPaymentMethods: true,
    what: "Record a cost that happened at a specific site (cement, labour, electrician, etc.).",
    example:
      'Example: You paid ₹12,000 for bricks at "Site B". Record it as a Site Expense and the app instantly shows the site\'s remaining balance.',
    when: "Use this every time money is spent on a site.",
    fields: [
      { name: "Category", desc: "What type of expense — Labour, Material, Transport, etc." },
      { name: "Site", desc: "Which site the money was spent on." },
      { name: "Paid From", desc: "Choose one of the two payment methods explained below." },
      { name: "Paid To (optional)", desc: "The contractor, vendor, or worker who received the money." },
    ],
  },
  {
    label: "Transfer",
    color: "bg-info/10 text-info border-info/20",
    iconColor: "text-info",
    icon: Repeat2,
    what: "Move money between two of your own accounts (e.g., from HDFC Bank to ICICI Bank, or from Bank to Cash).",
    example:
      "Example: You withdraw ₹50,000 from HDFC Bank as cash for daily payments. Record it as a Transfer from HDFC Bank → Office Cash.",
    when: "Use this when cash moves between your own accounts, not to a site.",
    fields: [
      { name: "Source Account", desc: "The account sending the money." },
      { name: "Destination Account", desc: "The account receiving the money." },
    ],
  },
  {
    label: "Partner Payout",
    color: "bg-warning/10 text-warning border-warning/20",
    iconColor: "text-warning",
    icon: UserMinus,
    what: "Record when an investor (partner) takes money out of the business.",
    example:
      "Example: Investor Amit contributed ₹10,00,000 earlier. He now wants ₹2,00,000 back. Record it as a Partner Payout from Amit's account.",
    when: "Use this when returning money to an investor or paying out a profit share.",
    fields: [
      { name: "Partner", desc: "Which investor is withdrawing money." },
    ],
  },
];

/* ─── Page ───────────────────────────────────────────────────── */
export default function GuidePage() {
  const [activeId, setActiveId] = useState<string>("setup-steps");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    /* Outer wrapper: content + sticky TOC side-by-side on large screens */
    <div className="relative mx-auto flex max-w-5xl gap-10">

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1 space-y-10">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Getting Started Guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these 4 simple steps to set up and start managing your real estate funds.
        </p>
      </div>

      {/* ── Step-by-step flow ── */}
      <section id="setup-steps">
        <h2 className="mb-4 text-base font-semibold text-foreground">Setup Steps</h2>
        <div className="relative space-y-4">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-10 h-[calc(100%-5rem)] w-px bg-border" />

          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex gap-4">
                {/* Step icon circle */}
                <div className="relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-primary bg-card">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <Card className="flex-1 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {step.number}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  {step.actionHref && step.actionLabel && (
                    <div className="mt-3">
                      <Link
                        href={step.actionHref}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                      >
                        {step.actionLabel} →
                      </Link>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}

          {/* Done */}
          <div className="relative flex items-center gap-4">
            <div className="relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm font-medium text-success">
              You&apos;re all set! Check your Dashboard to see your fund status at a glance.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features Explained ── */}
      <section id="transaction-types">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          Transaction Types Explained
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          When you click the <span className="font-semibold">+ New Transaction</span> button,
          you will see 4 options. Here is what each one means:
        </p>

        <div className="space-y-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.label} className="p-5">
                {/* Badge + title */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${f.color}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${f.iconColor}`} />
                    {f.label}
                  </span>
                </div>

                {/* What it does */}
                <p className="mt-3 text-sm font-medium text-foreground">{f.what}</p>

                {/* Example */}
                <div className="mt-3 flex gap-2 rounded-lg bg-muted p-3">
                  <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.example}</p>
                </div>

                {/* When to use */}
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">When to use: </span>
                  {f.when}
                </p>

                {/* Fields */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fields in this form
                  </p>
                  {f.fields.map((field) => (
                    <div key={field.name} className="flex gap-2 text-sm">
                      <span className="font-medium text-foreground whitespace-nowrap">
                        {field.name}:
                      </span>
                      <span className="text-muted-foreground">{field.desc}</span>
                    </div>
                  ))}
                </div>

                {/* 2-way payment method section — only for Site Expense */}
                {(f as any).showPaymentMethods && (
                  <div className="mt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      2 Ways to Pay for a Site Expense
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* Option 1 – Site Funds */}
                      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                            <Wallet className="h-4 w-4 text-primary" />
                          </div>
                          <p className="text-sm font-semibold text-primary">Option 1 — Site Funds</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">Pay from the site's own budget</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            Money is taken from the funds you already sent to this site.
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            Site balance goes down. Bank balance stays the same.
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            The app will warn you if the site does not have enough funds.
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-primary/10 p-2.5 text-xs text-primary">
                          Example: Site A has ₹50,000. You pay ₹5,000 for cement → Site A now has ₹45,000.
                        </div>
                      </div>

                      {/* Option 2 – Direct from Account */}
                      <div className="rounded-xl border-2 border-border bg-muted/50 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">Option 2 — Direct from Account</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">Pay from Bank, Partner, or Cash</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            Money is taken straight from your Bank, Cash, or Partner account.
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            The site's allocated budget is <span className="font-semibold">not touched</span>.
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            Use this when you pay a worker directly from your pocket or bank.
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                          Example: You pay ₹8,000 labour directly from HDFC Bank → Bank reduces, Site budget stays.
                        </div>
                      </div>

                    </div>

                    {/* Summary rule */}
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                      <Info className="mt-0.5 h-4 w-4 flex-none text-warning" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Simple rule: </span>
                        If the money came from the site's budget → choose <span className="font-semibold">Site Funds</span>.
                        If you paid from your bank, cash in hand, or an investor's money → choose
                        <span className="font-semibold"> Direct from Account</span>.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Category & Paid To ── */}
      <section id="category-paidto">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          Category &amp; &quot;Paid To&quot; — Explained
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          These two fields appear when you record a <span className="font-semibold">Site Expense</span>.
          They help you track <span className="font-semibold">what</span> the money was spent on and
          <span className="font-semibold"> who</span> received it.
        </p>

        <div className="space-y-4">

          {/* ── Category ── */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Category</p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  A label that describes <span className="font-semibold">what type of work or purchase</span> the expense is for.
                  This is required for every Site Expense so you can see exactly where your money is going.
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            {/* Built-in chips */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it works
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Tap an existing category chip</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You will see buttons like <span className="font-semibold">Labour, Material, Diesel, Contractor, JCB, Legal, Miscellaneous</span>.
                    Just tap the one that fits and it is selected (turns purple).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Don&apos;t see the right category? Tap &quot;+ Add&quot;</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A small text box appears. Type the new category name (e.g. &quot;Plumbing&quot; or &quot;Security&quot;)
                    and press the ✓ button. It is created instantly and selected automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Saved permanently for future use</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Any new category you add will appear as a chip for all future expenses — you only need to create it once.
                  </p>
                </div>
              </div>
            </div>

            {/* Why it matters */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Why this matters: </span>
                The Reports page uses categories to show you a breakdown like
                &quot;You spent ₹2,50,000 on Labour, ₹80,000 on Material, and ₹40,000 on Diesel this month.&quot;
                Without categories, you cannot see where the most money is going.
              </p>
            </div>
          </Card>

          {/* ── Paid To ── */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-warning/10">
                <UserMinus className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Paid To <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  The name of the <span className="font-semibold">person, contractor, or vendor</span> who received the money.
                  This is optional, but highly recommended so you can track who has been paid and how much.
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it works — Smart Auto-Memory
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Click the &quot;Paid To&quot; box</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A dropdown opens showing all the names you have used before (e.g. &quot;Ramesh Contractor&quot;, &quot;Ganesh Kaak&quot;).
                    You can scroll or search by typing a few letters.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">New name? Just type it and press Enter</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    If the person does not appear in the list, just type their name and press Enter.
                    The name is used immediately for this expense.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Remembered automatically after saving</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    As soon as you save the transaction, the name is stored. Next time you type that person&apos;s
                    name, it will appear as a suggestion automatically — no need to type the full name again.
                  </p>
                </div>
              </div>
            </div>

            {/* Difference from Category */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Tag className="mt-0.5 h-4 w-4 flex-none text-primary" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Category</span> = <span className="font-semibold">what</span> the money was for
                  (e.g. Labour, Diesel)
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                <UserMinus className="mt-0.5 h-4 w-4 flex-none text-warning" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Paid To</span> = <span className="font-semibold">who</span> received the money
                  (e.g. Ramesh, Amit Bhai)
                </p>
              </div>
            </div>

            {/* Example */}
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted p-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Example: </span>
                You pay ₹15,000 to Ramesh for digging work at Site A.
                Select <span className="font-semibold">Labour</span> as the Category and type
                <span className="font-semibold"> Ramesh Contractor</span> in Paid To.
                Now you can always see — &quot;How much total have I paid Ramesh across all sites?&quot;
              </p>
            </div>
          </Card>

        </div>
      </section>

      {/* ── Add Money Feature ── */}
      <section id="add-money">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          The &quot;+ Add Money&quot; Button — Explained
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          On the <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts page</Link>, every
          account has a <span className="font-semibold">+ Add Money</span> button next to it.
          Here is exactly what it does and when to use it.
        </p>

        <Card className="p-5">

          {/* What it does */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-success/10">
              <Banknote className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">What it does</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                It records new money arriving into a specific account — like a cash deposit, bank
                transfer received, or a partner putting in their investment. The account balance
                goes up instantly.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* 3 account types side by side */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Use it differently for each account type
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            {/* Bank */}
            <div className="rounded-xl border border-info/30 bg-info/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/15">
                  <Landmark className="h-3.5 w-3.5 text-info" />
                </div>
                <p className="text-sm font-semibold text-info">Bank Account</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">When to use:</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> You deposited cash into your bank
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> A payment was received from a client
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> A loan was credited to the account
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-info/10 p-2 text-xs text-info">
                Example: ₹5,00,000 loan credited to HDFC Bank → click &quot;Add Money&quot; on HDFC Bank and enter ₹5,00,000.
              </div>
            </div>

            {/* Cash */}
            <div className="rounded-xl border border-success/30 bg-success/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                </div>
                <p className="text-sm font-semibold text-success">Cash Account</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">When to use:</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> You withdrew cash from the bank
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> Someone gave you cash in hand
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> You received a cash payment
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-success/10 p-2 text-xs text-success">
                Example: You withdrew ₹50,000 from ATM as cash → Add Money to &quot;Office Cash&quot; for ₹50,000.
              </div>
            </div>

            {/* Partner */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15">
                  <UserMinus className="h-3.5 w-3.5 text-warning" />
                </div>
                <p className="text-sm font-semibold text-warning">Partner Account</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">When to use:</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> An investor sends their capital
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> A partner adds more funds
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> You record a new investment round
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-warning/10 p-2 text-xs text-warning">
                Example: Investor Amit sends ₹10,00,000 → Add Money to &quot;Amit Partner&quot; for ₹10,00,000.
              </div>
            </div>

          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Fields */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fields in the Add Money form
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">Amount:</span>
              <span className="text-muted-foreground">How much money is being added to this account.</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">Date:</span>
              <span className="text-muted-foreground">The date the money actually arrived (today by default).</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">Note (optional):</span>
              <span className="text-muted-foreground">A short description like &quot;Loan from SBI&quot; or &quot;Amit investment round 1&quot;.</span>
            </div>
          </div>

          {/* Important note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Important: </span>
              The &quot;+ Add Money&quot; button is only for recording money that comes <span className="font-semibold">into</span> your business.
              To move money between accounts, use the <span className="font-semibold">Transfer</span> option in the New Transaction form.
              To send money to a site, use <span className="font-semibold">Add Site Fund</span>.
            </p>
          </div>

        </Card>
      </section>

      {/* ── Recheck Balances ── */}
      <section id="recheck-balances">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          The &quot;Recheck Balances&quot; Button — Explained
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          This button appears at the top-right of the{" "}
          <Link href="/accounts" className="font-semibold text-primary hover:underline">
            Accounts page
          </Link>
          . It is a safety tool that you will rarely need, but it is very important to understand.
        </p>

        <Card className="p-5">

          {/* What it does */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-info/10">
              <RefreshCw className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">What it does</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                It re-reads every single transaction ever saved in the app and
                re-calculates what each account balance <span className="font-semibold">should</span> be
                from scratch. If the number it calculates is different from what is displayed,
                it automatically corrects the balance to the right number.
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Real world analogy */}
          <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-4">
            <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Simple analogy</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Think of it like a <span className="font-semibold">bank reconciliation</span> that your accountant does
                at the end of the month. They go through every receipt and every payment to verify
                the closing balance is correct. This button does the exact same thing — instantly,
                automatically, for all your accounts.
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* What you will see */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What will happen when you click it?
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">✅ &quot;All balances already match&quot;</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Everything is correct. All your account balances match every transaction recorded.
                  No action needed — you are fully up to date.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <RefreshCw className="mt-0.5 h-5 w-5 flex-none text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">⚠️ &quot;Corrected X account balance(s)&quot;</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A mismatch was found and has been automatically fixed. The balance shown
                  on screen will update to the correct number. This is rare, but can happen
                  if a transaction was edited or deleted after it was first saved.
                </p>
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* When to use */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            When should you use it?
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                The balance shown for an account looks wrong or surprising.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                You just deleted or edited an old transaction and want to be sure everything updated correctly.
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                At the end of the month, as a quick health check before sharing reports.
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Safe to use */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Is it safe? Yes, completely. </span>
              This button never deletes any transaction or changes any history.
              It only fixes the final balance number shown on screen.
              It does not matter how many times you press it — it will always give you the right answer.
            </p>
          </div>

        </Card>
      </section>

       {/* ── Pro Tip ── */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-foreground">💡 Pro Tip</p>
        <p className="mt-1 text-sm text-muted-foreground">
          After completing setup, your Dashboard will show total capital available, how much is
          locked inside each site, and a real-time warning if any site is running low on funds.
        </p>
        <div className="mt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Go to Dashboard →
          </Link>
        </div>
      </Card>

      </div>{/* end main content col */}

      {/* ── Sticky TOC ── */}
      <aside className="hidden xl:block">
        <div className="sticky top-6 w-44">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            On this page
          </p>
          <nav className="space-y-0.5">
            {TOC.map(({ id, label }) => {
              const active = activeId === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActiveId(id);
                  }}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {/* Active indicator dot */}
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full transition-colors ${
                      active ? "bg-primary" : "bg-border"
                    }`}
                  />
                  {label}
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

    </div>/* end outer flex */
  );
}
