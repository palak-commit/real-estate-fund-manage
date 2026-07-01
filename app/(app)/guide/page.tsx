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
  Languages,
  TrendingUp,
  Book,
  ClipboardList,
  ActivitySquare,
  FileText,
} from "lucide-react";
import Link from "next/link";

type Lang = "en" | "gu";

const t = (lang: Lang, en: string, gu: string) => lang === "en" ? en : gu;

/* ─── TOC items ─────────────────────────────────────────────── */
const getTOC = (lang: Lang) => [
  { id: "setup-steps",       label: t(lang, "Setup Steps", "શરૂઆતના સ્ટેપ્સ") },
  { id: "transaction-types", label: t(lang, "Transaction Types", "ટ્રાન્ઝેક્શન ના પ્રકાર") },
  { id: "category-paidto",   label: t(lang, "Category & Paid To", "કેટેગરી અને પેઇડ ટુ (Paid To)") },
  { id: "add-money",         label: t(lang, "Add Money", "પૈસા ઉમેરો (Add Money)") },
  { id: "site-page",         label: t(lang, "Site Page (Project Detail)", "સાઇટ પેજ (પ્રોજેક્ટની વિગતો)") },
  { id: "bank-cashbook",     label: t(lang, "Books (Bank, Cashbook & Partner)", "બુક્સ (બેંક, કેશબુક અને પાર્ટનર)") },
  { id: "rojmel",            label: t(lang, "Rojmel (Cash Daybook)", "રોજમેળ (Rojmel)") },
  { id: "ra-receipts",       label: t(lang, "Receipt of RA", "RA બિલ રસીદ (Receipt of RA)") },
  { id: "vendor-bills",      label: t(lang, "Vendor Bills", "વેન્ડર બિલ (Vendor Bills)") },
  { id: "activity-log",      label: t(lang, "Activity Log", "એક્ટિવિટી લોગ (Activity Log)") },
  { id: "recheck-balances",  label: t(lang, "Recheck Balances", "Recheck Balances (બેલેન્સ ચેક કરો)") },
];

/* ─── Step-by-step data ──────────────────────────────────────── */
const getSteps = (lang: Lang) => [
  {
    number: 1,
    title: t(lang, "Add a Bank Account", "બેંક ખાતું એડ કરો"),
    description: t(lang,
      "First, set up where your money is coming from. Go to the Accounts page and add your bank accounts or cash on hand. You can also add investor / partner accounts here.",
      "સૌથી પહેલા, પૈસા ક્યાથી આવશે તે સેટ કરો. Accounts પેજ પર જઈને તમારા બેંક ખાતા કે રોકડ (Cash) ની એન્ટ્રી કરો. તમે અહી તમારા પાર્ટનર કે ઇન્વેસ્ટર ના ખાતા પણ એડ કરી શકો છો."
    ),
    icon: Landmark,
    actionLabel: t(lang, "Go to Accounts", "Accounts પેજ પર જાવ"),
    actionHref: "/accounts",
  },
  {
    number: 2,
    title: t(lang, "Add a Site", "સાઇટ એડ કરો"),
    description: t(lang,
      "Next, create the construction sites or projects you are managing. Each site will have its own separate budget and expense tracking.",
      "પછી, તમે જે સાઇટ્સ અથવા પ્રોજેક્ટ્સનું કામ કરી રહ્યા છો તે એડ કરો. દરેક સાઇટનું પોતાનું અલગ બજેટ અને ખર્ચ ટ્રેક થશે."
    ),
    icon: Building2,
    actionLabel: t(lang, "Go to Sites", "Sites પેજ પર જાવ"),
    actionHref: "/projects",
  },
  {
    number: 3,
    title: t(lang, "Allocate Funds to the Site", "સાઇટમાં ફંડ મોકલો"),
    description: t(lang,
      'Move money from your Bank Account into a Site. This sets the working budget for that site. Click the "+ New Transaction" button and choose "Add Site Fund".',
      'બેંકમાંથી સાઇટ પર પૈસા ટ્રાન્સફર કરો. આનાથી સાઇટનું બજેટ સેટ થશે. "+ New Transaction" બટન પર ક્લિક કરો અને "Add Site Fund" પસંદ કરો.'
    ),
    icon: ArrowRightLeft,
    actionLabel: null,
    actionHref: null,
  },
  {
    number: 4,
    title: t(lang, "Record Expenses", "ખર્ચની એન્ટ્રી કરો"),
    description: t(lang,
      'When you spend money on a site, record it as an expense. Click the "+ New Transaction" button and choose "Site Expense". You can pay from the Site\'s allocated funds or directly from a Bank Account.',
      'જ્યારે સાઇટ પર ખર્ચો થાય, ત્યારે તેની એન્ટ્રી કરો. "+ New Transaction" બટન પર ક્લિક કરો અને "Site Expense" સિલેક્ટ કરો. તમે સાઇટના બજેટમાંથી અથવા સીધા બેંકમાંથી પેમેન્ટ કરી શકો છો.'
    ),
    icon: Receipt,
    actionLabel: null,
    actionHref: null,
  },
];

/* ─── Transaction type explanations ─────────────────────────── */
const getFeatures = (lang: Lang) => [
  {
    label: t(lang, "Add Site Fund", "સાઇટમાં ફંડ એડ કરો"),
    color: "bg-primary/10 text-primary border-primary/20",
    iconColor: "text-primary",
    icon: Banknote,
    what: t(lang, "Send money from your bank or cash into a specific site.", "તમારી બેંક કે કેશ (Cash) માંથી કોઈ એક સાઇટમાં પૈસા મોકલો."),
    example: t(lang,
      'Example: You have ₹5,00,000 in HDFC Bank. You move ₹1,50,000 to "Site A" so workers can start buying materials.',
      'ઉદાહરણ તરીકે: તમારી પાસે HDFC બેંકમાં ₹5,00,000 છે. તમે તેમાંથી ₹1,50,000 "સાઇટ A" માં ટ્રાન્સફર કરો છો જેથી મટીરીયલ ખરીદી શકાય.'
    ),
    when: t(lang, "Use this whenever a site needs more budget to operate.", "જ્યારે પણ સાઇટ પર કામ માટે વધુ બજેટની જરૂર હોય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "From Account", "કયા ખાતામાંથી"), desc: t(lang, "Which bank or cash account to take the money from.", "કયા બેંક કે કેશ ખાતામાંથી પૈસા લેવા છે.") },
      { name: t(lang, "To Site", "કઈ સાઇટ પર"), desc: t(lang, "Which site gets the money.", "કઈ સાઇટને પૈસા આપવા છે.") },
    ],
  },
  {
    label: t(lang, "Site Expense", "સાઇટનો ખર્ચ"),
    color: "bg-danger/10 text-danger border-danger/20",
    iconColor: "text-danger",
    icon: HardHat,
    showPaymentMethods: true,
    what: t(lang, "Record a cost that happened at a specific site (cement, labour, electrician, etc.).", "કોઈ સાઇટ પર થયેલા ખર્ચની એન્ટ્રી કરો (જેમ કે સિમેન્ટ, મજૂરી, ઇલેક્ટ્રિશિયન)."),
    example: t(lang,
      'Example: You paid ₹12,000 for bricks at "Site B". Record it as a Site Expense and the app instantly shows the site\'s remaining balance.',
      'ઉદાહરણ તરીકે: તમે "સાઇટ B" પર ઈંટો માટે ₹12,000 ચૂકવ્યા. આને સાઇટ ખર્ચ (Site Expense) માં એન્ટર કરો અને એપ તરત જ બતાવી દેશે કે સાઇટ પર હવે કેટલા પૈસા બચ્યા છે.'
    ),
    when: t(lang, "Use this every time money is spent on a site.", "જ્યારે પણ સાઇટ પર કોઈ ખર્ચો થાય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "Category", "કેટેગરી"), desc: t(lang, "What type of expense — Labour, Material, Transport, etc.", "કયા પ્રકારનો ખર્ચો છે — મજૂરી, મટીરીયલ, ટ્રાન્સપોર્ટ વગેરે.") },
      { name: t(lang, "Site", "કઈ સાઇટ"), desc: t(lang, "Which site the money was spent on.", "કઈ સાઇટ પર ખર્ચો થયો છે.") },
      { name: t(lang, "Paid From", "ક્યાંથી ચૂકવ્યા"), desc: t(lang, "Choose one of the two payment methods explained below.", "નીચે સમજાવેલી બે પેમેન્ટ રીતમાંથી કોઈ એક સિલેક્ટ કરો.") },
      { name: t(lang, "Paid To (optional)", "કોને ચૂકવ્યા (ઓપ્શનલ)"), desc: t(lang, "The contractor, vendor, or worker who received the money.", "કોન્ટ્રાક્ટર, વેન્ડર કે મજૂર જેને પૈસા આપ્યા તેનું નામ.") },
    ],
  },
/*
  {
    label: t(lang, "Income", "આવક (Income)"),
    color: "bg-success/10 text-success border-success/20",
    iconColor: "text-success",
    icon: TrendingUp,
    what: t(lang, "Record money received from a site (e.g., selling scrap, client payments) into an account.", "કોઈ સાઇટ પરથી મળેલી આવક (જેમ કે ભંગાર વેચવો, ક્લાયન્ટ પેમેન્ટ) ની એન્ટ્રી કોઈ ખાતામાં કરો."),
    example: t(lang,
      'Example: You sold scrap material at "Site A" for ₹5,000 and received cash. Record it as Income from Site A → Office Cash.',
      'ઉદાહરણ તરીકે: તમે "સાઇટ A" પરથી ₹5,000 નો ભંગાર વેચ્યો અને રોકડા મળ્યા. તો આને સાઇટ A થી Office Cash ની આવક (Income) તરીકે એન્ટર કરો.'
    ),
    when: t(lang, "Use this when a site generates money that goes into your bank, cash, or partner account.", "જ્યારે કોઈ સાઇટ પરથી પૈસા આવે અને તે તમારા બેંક, કેશ કે પાર્ટનરના ખાતામાં જાય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "From", "ક્યાંથી (From)"), desc: t(lang, "The site this income came from.", "જે સાઇટ પરથી આ આવક થઈ હોય.") },
      { name: t(lang, "To", "શેમાં (To)"), desc: t(lang, "The account that receives the money (bank, cash, or partner).", "જે ખાતામાં પૈસા આવે (બેંક, કેશ અથવા પાર્ટનર).") },
    ],
  },
*/
  {
    label: t(lang, "Transfer", "ટ્રાન્સફર (એક ખાતામાંથી બીજામાં)"),
    color: "bg-info/10 text-info border-info/20",
    iconColor: "text-info",
    icon: Repeat2,
    what: t(lang,
      "Move money between two of your own accounts (e.g., from HDFC Bank to ICICI Bank, or from Bank to Cash).",
      "પોતાના જ બે ખાતાઓ વચ્ચે પૈસા ટ્રાન્સફર કરવા (જેમ કે HDFC બેંકમાંથી ICICI બેંકમાં, અથવા બેંકમાંથી કેશમાં)."
    ),
    example: t(lang,
      "Example: You withdraw ₹50,000 from HDFC Bank as cash for daily payments. Record it as a Transfer from HDFC Bank → Office Cash.",
      "દાખલા તરીકે: રોજના ખર્ચ માટે તમે HDFC બેંકમાંથી ₹50,000 રોકડા ઉપાડો છો. તો એની એન્ટ્રી HDFC Bank → Office Cash ટ્રાન્સફર તરીકે કરો."
    ),
    when: t(lang, "Use this when cash moves between your own accounts, not to a site.", "જ્યારે પૈસા પોતાના જ ખાતાઓમાં ફરે ત્યારે આનો ઉપયોગ કરો, સાઇટ પર નહિ."),
    fields: [
      { name: t(lang, "Source Account", "કયા ખાતામાંથી"), desc: t(lang, "The account sending the money.", "જે ખાતામાંથી પૈસા જાય છે.") },
      { name: t(lang, "Destination Account", "કયા ખાતામાં"), desc: t(lang, "The account receiving the money.", "જે ખાતામાં પૈસા આવે છે.") },
    ],
  },
  {
    label: t(lang, "Partner Payout", "પાર્ટનરને પેમેન્ટ"),
    color: "bg-warning/10 text-warning border-warning/20",
    iconColor: "text-warning",
    icon: UserMinus,
    what: t(lang, "Record when an investor (partner) takes money out of the business.", "જ્યારે કોઈ ઇન્વેસ્ટર (પાર્ટનર) બિઝનેસમાંથી પોતાના પૈસા પાછા લે ત્યારે એની એન્ટ્રી કરો."),
    example: t(lang,
      "Example: Investor Amit contributed ₹10,00,000 earlier. He now wants ₹2,00,000 back. Record it as a Partner Payout from Amit's account.",
      "દાખલા તરીકે: પાર્ટનર અમિતે પહેલા ₹10,000,000 આપ્યા હતા. હવે તે ₹2,00,000 પાછા લે છે. તો આને અમિતના ખાતામાંથી Partner Payout તરીકે એન્ટર કરો."
    ),
    when: t(lang, "Use this when returning money to an investor or paying out a profit share.", "જ્યારે પાર્ટનરને પૈસા પાછા આપવાના હોય અથવા પ્રોફિટ શેર આપવાનો હોય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "Partner", "પાર્ટનર"), desc: t(lang, "Which investor is withdrawing money.", "કયા પાર્ટનર પૈસા પાછા લે છે.") },
    ],
  },
];

/* ─── Page ───────────────────────────────────────────────────── */
export default function GuidePage() {
  const [activeId, setActiveId] = useState<string>("setup-steps");
  const [lang, setLang] = useState<Lang>("en");

  const TOC = getTOC(lang);
  const steps = getSteps(lang);
  const features = getFeatures(lang);

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
  }, [lang, TOC]);

  return (
    /* Outer wrapper: content + sticky TOC side-by-side on large screens */
    <div className="relative mx-auto flex max-w-5xl gap-10">

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1 space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t(lang, "Getting Started Guide", "શરૂઆતની માહિતી (Guide)")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(lang,
              "Follow these 4 simple steps to set up and start managing your real estate funds.",
              "તમારું એકાઉન્ટ સેટ કરવા અને રિયલ એસ્ટેટના ફંડ મેનેજ કરવા માટે આ 4 સિમ્પલ સ્ટેપ્સ ફોલો કરો."
            )}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setLang("en")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Languages className="h-4 w-4" />
            English
          </button>
          <button
            onClick={() => setLang("gu")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              lang === "gu" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Languages className="h-4 w-4" />
            ગુજરાતી
          </button>
        </div>
      </div>

      {/* ── Step-by-step flow ── */}
      <section id="setup-steps">
        <h2 className="mb-4 text-base font-semibold text-foreground">{t(lang, "Setup Steps", "શરૂઆતના સ્ટેપ્સ")}</h2>
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
                    {t(lang, `Step ${step.number}`, `સ્ટેપ ${step.number}`)}
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
              {t(lang,
                "You're all set! Check your Dashboard to see your fund status at a glance.",
                "બધું સેટ થઈ ગયું છે! તમારું ફંડ સ્ટેટસ જોવા માટે Dashboard ચેક કરો."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Features Explained ── */}
      <section id="transaction-types">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Transaction Types Explained", "ટ્રાન્ઝેક્શનના પ્રકારો વિશે માહિતી")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              When you click the <span className="font-semibold">+ New Transaction</span> button,
              you will see 4 options. Here is what each one means:
            </>
          ) : (
            <>
              જ્યારે તમે <span className="font-semibold">+ New Transaction</span> બટન પર ક્લિક કરશો,
              ત્યારે 4 ઓપ્શન દેખાશે. આ બધાનો શું અર્થ થાય છે તે નીચે મુજબ છે:
            </>
          )}
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
                  <span className="font-semibold text-foreground">{t(lang, "When to use: ", "ક્યારે વાપરવું: ")}</span>
                  {f.when}
                </p>

                {/* Fields */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(lang, "Fields in this form", "આ ફોર્મમાં શું ભરવું")}
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
                      {t(lang, "2 Ways to Pay for a Site Expense", "સાઇટનો ખર્ચ ચૂકવવાની 2 રીતો")}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* Option 1 – Site Funds */}
                      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                            <Wallet className="h-4 w-4 text-primary" />
                          </div>
                          <p className="text-sm font-semibold text-primary">{t(lang, "Option 1 — Site Funds", "ઓપ્શન 1 — સાઇટ ફંડમાંથી")}</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">{t(lang, "Pay from the site's own budget", "સાઇટના પોતાના બજેટમાંથી પેમેન્ટ કરો")}</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "Money is taken from the funds you already sent to this site.", "તમે પહેલાથી જ જે ફંડ આ સાઇટમાં મોકલ્યું છે તેમાંથી પૈસા કપાશે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "Site balance goes down. Bank balance stays the same.", "સાઇટનું બેલેન્સ ઘટશે. બેંકનું બેલેન્સ એમ જ રહેશે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "The app will warn you if the site does not have enough funds.", "જો સાઇટમાં પૂરતું બેલેન્સ નહિ હોય તો એપ તમને વોર્નિંગ આપશે.")}
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-primary/10 p-2.5 text-xs text-primary">
                          {t(lang, "Example: Site A has ₹50,000. You pay ₹5,000 for cement → Site A now has ₹45,000.", "દાખલા તરીકે: સાઇટ A માં ₹50,000 છે. તમે ₹5,000 નું સિમેન્ટ લીધું → સાઇટ A માં હવે ₹45,000 બચશે.")}
                        </div>
                      </div>

                      {/* Option 2 – Direct from Account */}
                      <div className="rounded-xl border-2 border-border bg-muted/50 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">{t(lang, "Option 2 — Direct from Account", "ઓપ્શન 2 — સીધા બેંક એકાઉન્ટમાંથી")}</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">{t(lang, "Pay from Bank, Partner, or Cash", "બેંક, પાર્ટનર અથવા કેશમાંથી પેમેન્ટ કરો")}</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {t(lang, "Money is taken straight from your Bank, Cash, or Partner account.", "પૈસા સીધા તમારી બેંક, કેશ અથવા પાર્ટનરના ખાતામાંથી કપાશે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {lang === "en" ? (
                              <>The site's allocated budget is <span className="font-semibold">not touched</span>.</>
                            ) : (
                              <>સાઇટના બજેટમાંથી <span className="font-semibold">પૈસા નહિ કપાય</span>.</>
                            )}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {t(lang, "Use this when you pay a worker directly from your pocket or bank.", "જ્યારે તમે સીધા તમારા બેંકમાંથી અથવા પોતાના ખિસ્સામાંથી મજૂરને પૈસા આપો ત્યારે આનો ઉપયોગ કરો.")}
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                          {t(lang, "Example: You pay ₹8,000 labour directly from HDFC Bank → Bank reduces, Site budget stays.", "દાખલા તરીકે: તમે સીધા HDFC બેંકમાંથી ₹8,000 મજૂરી આપી → તો બેંકનું બેલેન્સ ઘટશે, સાઇટનું બજેટ એમ જ રહેશે.")}
                        </div>
                      </div>

                    </div>

                    {/* Summary rule */}
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                      <Info className="mt-0.5 h-4 w-4 flex-none text-warning" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {lang === "en" ? (
                          <>
                            <span className="font-semibold text-foreground">Simple rule: </span>
                            If the money came from the site's budget → choose <span className="font-semibold">Site Funds</span>.
                            If you paid from your bank, cash in hand, or an investor's money → choose
                            <span className="font-semibold"> Direct from Account</span>.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-foreground">સિમ્પલ રૂલ: </span>
                            જો પૈસા સાઇટના બજેટમાંથી આપ્યા હોય → તો <span className="font-semibold">Site Funds</span> સિલેક્ટ કરો.
                            જો તમે સીધા બેંકમાંથી, રોકડેથી કે ઇન્વેસ્ટરના પૈસાથી ચૂકવ્યા હોય → તો 
                            <span className="font-semibold"> Direct from Account</span> સિલેક્ટ કરો.
                          </>
                        )}
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
          {t(lang, 'Category & "Paid To" — Explained', 'કેટેગરી અને "કોને ચૂકવ્યા" વિશે માહિતી')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              These two fields appear when you record a <span className="font-semibold">Site Expense</span>.
              They help you track <span className="font-semibold">what</span> the money was spent on and
              <span className="font-semibold"> who</span> received it.
            </>
          ) : (
            <>
              જ્યારે તમે <span className="font-semibold">Site Expense</span> ની એન્ટ્રી કરો છો ત્યારે આ બે વસ્તુઓ દેખાય છે.
              આનાથી ખબર પડશે કે પૈસા <span className="font-semibold">શેના માટે</span> વપરાયા અને
              તે <span className="font-semibold">કોને</span> આપવામાં આવ્યા.
            </>
          )}
        </p>

        <div className="space-y-4">

          {/* ── Category ── */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{t(lang, "Category", "કેટેગરી")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <>
                      A label that describes <span className="font-semibold">what type of work or purchase</span> the expense is for.
                      This is required for every Site Expense so you can see exactly where your money is going.
                    </>
                  ) : (
                    <>
                      એક એવું નામ જે બતાવે છે કે ખર્ચો <span className="font-semibold">કયા કામ માટે</span> થયો છે.
                      દરેક ખર્ચ માટે આ જરૂરી છે જેથી ખબર પડે કે તમારા પૈસા ક્યાં જઈ રહ્યા છે.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            {/* Built-in chips */}
            {/* Built-in chips */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(lang, "How it works: Head & Sub-Head", "કેવી રીતે કામ કરે છે: મુખ્ય અને પેટા કેટેગરી (Head & Sub-Head)")}
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Choose a Head (Main Category)", "સ્ટેપ 1: મુખ્ય કેટેગરી (Head) પસંદ કરો")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "en" ? (
                      <>You will see main categories like <span className="font-semibold">Labour, Material, Diesel, Contractor, JCB</span>. Tap the one that fits. If you don't see it, tap <span className="font-semibold">+ Add head</span> to create a new one.</>
                    ) : (
                      <>તમને મુખ્ય કેટેગરી દેખાશે જેમ કે <span className="font-semibold">Labour, Material, Diesel, Contractor, JCB</span>. જે બરાબર હોય તેના પર ક્લિક કરો. જો તમારી કેટેગરી ના દેખાય તો <span className="font-semibold">+ Add head</span> પર ક્લિક કરીને નવી બનાવો.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Choose a Type of Head (Sub-Category)", "સ્ટેપ 2: પેટા કેટેગરી (Type of Head) પસંદ કરો")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "en" ? (
                      <>This is <span className="font-semibold">optional</span>. After choosing a Head, you can pick a specific type. For example, under <span className="font-semibold">Material</span>, you can pick <span className="font-semibold">Cement</span> or <span className="font-semibold">Steel</span>. Tap <span className="font-semibold">+ Add</span> to create a new sub-category.</>
                    ) : (
                      <>આ <span className="font-semibold">ઓપ્શનલ</span> છે. મુખ્ય કેટેગરી પસંદ કર્યા પછી, તમે પેટા-કેટેગરી પસંદ કરી શકો છો. દા.ત. <span className="font-semibold">Material</span> માં તમે <span className="font-semibold">Cement</span> કે <span className="font-semibold">Steel</span> પસંદ કરી શકો. નવી પેટા-કેટેગરી માટે <span className="font-semibold">+ Add</span> દબાવો.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Saved permanently for future use", "આગળના ઉપયોગ માટે સેવ થઇ જશે")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "Any new Head or Sub-Head you add will appear for all future expenses — you only need to create it once.",
                      "તમે બનાવેલી નવી મુખ્ય કે પેટા કેટેગરી પછી હંમેશા દેખાશે — તમારે એને ખાલી એક જ વાર બનાવવાની રહેશે."
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Why it matters */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    <span className="font-semibold text-foreground">Why this matters: </span>
                    The Reports page uses this structure to show you a detailed breakdown like
                    "You spent ₹2,50,000 on Labour, and under Material you spent ₹80,000 (₹50k Cement, ₹30k Steel)."
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">આ કેમ જરૂરી છે: </span>
                    રિપોર્ટ્સ પેજમાં તમે વિગતવાર હિસાબ જોઈ શકશો કે
                    "આ મહિને મજૂરીમાં ₹2,50,000 નો ખર્ચ થયો, અને મટીરીયલમાં ₹80,000 (₹50k સિમેન્ટ, ₹30k સ્ટીલ)."
                  </>
                )}
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
                <p className="text-sm font-semibold text-foreground">{t(lang, "Paid To", "કોને ચૂકવ્યા (Paid To)")} <span className="text-xs font-normal text-muted-foreground">({t(lang, "optional", "ઓપ્શનલ")})</span></p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <>
                      The name of the <span className="font-semibold">person, contractor, or vendor</span> who received the money.
                      This is optional, but highly recommended so you can track who has been paid and how much.
                    </>
                  ) : (
                    <>
                      જે <span className="font-semibold">માણસ, કોન્ટ્રાક્ટર કે વેન્ડરને</span> પૈસા મળ્યા તેનું નામ.
                      આ ઓપ્શનલ છે, પણ લખવું સારું છે જેથી તમે ટ્રેક કરી શકો કે કોને કેટલા પૈસા આપ્યા.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(lang, "How it works — Smart Auto-Memory", "કેવી રીતે કામ કરે છે — સ્માર્ટ ઓટો-મેમરી")}
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, 'Click the "Paid To" box', '"Paid To" બોક્સ પર ક્લિક કરો')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      'A dropdown opens showing all the names you have used before (e.g. "Ramesh Contractor", "Ganesh Kaak"). You can scroll or search by typing a few letters.',
                      'જેમ તમે ક્લિક કરશો, બધા જુના નામ દેખાશે (દા.ત. "રમેશ કોન્ટ્રાક્ટર"). તમે થોડા અક્ષરો ટાઈપ કરીને સર્ચ પણ કરી શકો છો.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "New name? Just type it and press Enter", "નવું નામ છે? બસ લખીને Enter દબાવો")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "If the person does not appear in the list, just type their name and press Enter. The name is used immediately for this expense.",
                      "જો એ વ્યક્તિનું નામ લિસ્ટમાં ના હોય, તો ખાલી ટાઈપ કરી દો અને Enter દબાવો. એ નામ સિલેક્ટ થઇ જશે."
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Remembered automatically after saving", "સેવ કર્યા પછી એપ એ નામ યાદ રાખશે")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "As soon as you save the transaction, the name is stored. Next time you type that person's name, it will appear as a suggestion automatically — no need to type the full name again.",
                      "જ્યારે પણ તમે ટ્રાન્ઝેક્શન સેવ કરશો, એ નામ સેવ થઇ જશે. આગલી વખતે તમે થોડા અક્ષર લખશો એટલે એપ જાતે જ નામ બતાવશે."
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Difference from Category */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Tag className="mt-0.5 h-4 w-4 flex-none text-primary" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <><span className="font-semibold text-foreground">Category</span> = <span className="font-semibold">what</span> the money was for (e.g. Labour, Diesel)</>
                  ) : (
                    <><span className="font-semibold text-foreground">કેટેગરી</span> = <span className="font-semibold">શેના માટે</span> પૈસા વાપર્યા (દા.ત. મજૂરી, ડીઝલ)</>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                <UserMinus className="mt-0.5 h-4 w-4 flex-none text-warning" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <><span className="font-semibold text-foreground">Paid To</span> = <span className="font-semibold">who</span> received the money (e.g. Ramesh, Amit Bhai)</>
                  ) : (
                    <><span className="font-semibold text-foreground">Paid To</span> = <span className="font-semibold">કોને</span> પૈસા આપ્યા (દા.ત. રમેશ, અમિત ભાઈ)</>
                  )}
                </p>
              </div>
            </div>

            {/* Example */}
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted p-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    <span className="font-semibold text-foreground">Example: </span>
                    You pay ₹15,000 to Ramesh for digging work at Site A. Select <span className="font-semibold">Labour</span> as the Category and type <span className="font-semibold">Ramesh Contractor</span> in Paid To. Now you can always see — "How much total have I paid Ramesh across all sites?"
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">દાખલા તરીકે: </span>
                    તમે સાઇટ A પર કામ માટે રમેશને ₹15,000 આપ્યા. તો કેટેગરીમાં <span className="font-semibold">Labour</span> સિલેક્ટ કરો અને Paid To માં <span className="font-semibold">Ramesh Contractor</span> લખો. આનાથી તમે ભવિષ્યમાં જોઈ શકશો કે "મેં અત્યાર સુધી રમેશને કુલ કેટલા પૈસા આપ્યા છે?"
                  </>
                )}
              </p>
            </div>
          </Card>

        </div>
      </section>

      {/* ── Add Money Feature ── */}
      <section id="add-money">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, 'The "+ Add Money" Button — Explained', '"+ Add Money" બટનનો ઉપયોગ')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              On the <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts page</Link>, every
              account has a <span className="font-semibold">+ Add Money</span> button next to it. Here is exactly what it does and when to use it.
            </>
          ) : (
            <>
              <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts પેજ</Link> પર, દરેક
              ખાતાની બાજુમાં <span className="font-semibold">+ Add Money</span> બટન હોય છે. આ બટન શું કામ કરે છે અને ક્યારે વાપરવું તે અહીં સમજાવ્યું છે.
            </>
          )}
        </p>

        <Card className="p-5">

          {/* What it does */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-success/10">
              <Banknote className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "What it does", "આ શું કામ કરે છે?")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {t(lang,
                  "It records new money arriving into a specific account — like a cash deposit, bank transfer received, or a partner putting in their investment. The account balance goes up instantly.",
                  "આનો ઉપયોગ ત્યારે થાય જ્યારે ખાતામાં નવા પૈસા આવે — જેમ કે કેશ જમા કરવી, કોઈના તરફથી પેમેન્ટ મળવું, અથવા પાર્ટનર પૈસા લાવે. આનાથી ખાતાનું બેલેન્સ વધી જશે."
                )}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* 3 account types side by side */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "Use it differently for each account type", "અલગ અલગ ખાતા માટે આવી રીતે વાપરો")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            {/* Bank */}
            <div className="rounded-xl border border-info/30 bg-info/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/15">
                  <Landmark className="h-3.5 w-3.5 text-info" />
                </div>
                <p className="text-sm font-semibold text-info">{t(lang, "Bank Account", "બેંક ખાતું (Bank Account)")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે વાપરવું:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "You deposited cash into your bank", "જ્યારે તમે બેંકમાં કેશ જમા કરાવી હોય")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "A payment was received from a client", "ક્લાયન્ટ તરફથી પેમેન્ટ આવ્યું હોય")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "A loan was credited to the account", "ખાતામાં કોઈ લોન જમા થઇ હોય")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-info/10 p-2 text-xs text-info">
                {t(lang, 'Example: ₹5,00,000 loan credited to HDFC Bank → click "Add Money" on HDFC Bank and enter ₹5,00,000.', 'દાખલા તરીકે: HDFC બેંકમાં ₹5,00,000 ની લોન જમા થઈ → તો HDFC બેંક સામે "Add Money" પર ક્લિક કરો અને ₹5,00,000 લખો.')}
              </div>
            </div>

            {/* Cash */}
            <div className="rounded-xl border border-success/30 bg-success/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                </div>
                <p className="text-sm font-semibold text-success">{t(lang, "Cash Account", "કેશ ખાતું (Cash Account)")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે વાપરવું:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "You withdrew cash from the bank", "જ્યારે તમે બેંકમાંથી કેશ ઉપાડી હોય")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "Someone gave you cash in hand", "કોઈએ તમને હાથમાં રોકડ પૈસા આપ્યા હોય")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "You received a cash payment", "તમને કોઈ કેશ પેમેન્ટ મળ્યું હોય")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-success/10 p-2 text-xs text-success">
                {t(lang, 'Example: You withdrew ₹50,000 from ATM as cash → Add Money to "Office Cash" for ₹50,000.', 'દાખલા તરીકે: તમે બેંકમાંથી ₹50,000 રોકડા ઉપાડ્યા → તો "Office Cash" ખાતામાં જઈને Add Money કરો.')}
              </div>
            </div>

            {/* Partner */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15">
                  <UserMinus className="h-3.5 w-3.5 text-warning" />
                </div>
                <p className="text-sm font-semibold text-warning">{t(lang, "Partner Account", "પાર્ટનર ખાતું (Partner Account)")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે વાપરવું:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "An investor sends their capital", "જ્યારે કોઈ પાર્ટનર પૈસા રોકે")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "A partner adds more funds", "પાર્ટનર બિઝનેસમાં વધુ ફંડ લાવે")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "You record a new investment round", "જ્યારે કોઈ નવું ઇન્વેસ્ટમેન્ટ આવે")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-warning/10 p-2 text-xs text-warning">
                {t(lang, 'Example: Investor Amit sends ₹10,00,000 → Add Money to "Amit Partner" for ₹10,00,000.', 'દાખલા તરીકે: પાર્ટનર અમિત ₹10,00,000 લાવે છે → તો "Amit Partner" ખાતામાં જઈને Add Money કરો.')}
              </div>
            </div>

          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Fields */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "Fields in the Add Money form", "Add Money ફોર્મમાં શું ભરવું")}
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Amount:", "રકમ (Amount):")}</span>
              <span className="text-muted-foreground">{t(lang, "How much money is being added to this account.", "ખાતામાં કેટલા પૈસા આવી રહ્યા છે.")}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Date:", "તારીખ (Date):")}</span>
              <span className="text-muted-foreground">{t(lang, "The date the money actually arrived (today by default).", "જે તારીખે પૈસા ખરેખર આવ્યા હોય (ડિફોલ્ટ આજની તારીખ હોય છે).")}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Note (optional):", "નોંધ (Note):")}</span>
              <span className="text-muted-foreground">{t(lang, 'A short description like "Loan from SBI" or "Amit investment round 1".', '"SBI ની લોન" કે "અમિતના પૈસા" એવી ટૂંકી નોટ લખી શકો.')}</span>
            </div>
          </div>

          {/* Important note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "en" ? (
                <>
                  <span className="font-semibold text-foreground">Important: </span>
                  The "+ Add Money" button is only for recording money that comes <span className="font-semibold">into</span> your business.
                  To move money between accounts, use the <span className="font-semibold">Transfer</span> option in the New Transaction form.
                  To send money to a site, use <span className="font-semibold">Add Site Fund</span>.
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">ધ્યાન રાખો: </span>
                  "+ Add Money" બટનનો ઉપયોગ માત્ર ત્યારે જ કરવો જ્યારે તમારા બિઝનેસમાં નવા પૈસા <span className="font-semibold">આવે</span>.
                  જો તમારે એક ખાતામાંથી બીજા ખાતામાં પૈસા ફેરવવા હોય તો <span className="font-semibold">Transfer</span> ઓપ્શન વાપરો.
                  અને સાઇટ પર પૈસા મોકલવા માટે <span className="font-semibold">Add Site Fund</span> વાપરો.
                </>
              )}
            </p>
          </div>

        </Card>
      </section>

      {/* ── Site Page ── */}
      <section id="site-page">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Site Page (Project Detail)", "સાઇટ પેજ (પ્રોજેક્ટની વિગતો)")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              When you click on a specific site from the <Link href="/projects" className="font-semibold text-primary hover:underline">Sites page</Link>, you open its detailed dashboard. This page is a complete mini-app for that single project.
            </>
          ) : (
            <>
              જ્યારે તમે <Link href="/projects" className="font-semibold text-primary hover:underline">Sites પેજ</Link> પરથી કોઈ ચોક્કસ સાઇટ પર ક્લિક કરો છો, ત્યારે તેનું ડિટેલ પેજ ખુલે છે. આ પેજ તે પ્રોજેક્ટ માટે એક સંપૂર્ણ મીની-એપ જેવું કામ કરે છે.
            </>
          )}
        </p>

        <Card className="p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t(lang, "1. Balance & Profit Summary", "1. બેલેન્સ અને પ્રોફિટ/લોસ")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {lang === "en" ? (
                <>
                  At the top, you instantly see the <span className="font-semibold">Site Fund</span> (money left in the site's budget) and the <span className="font-semibold">Profit / Loss</span>. It breaks down Total Spent into two parts: money paid from <span className="font-semibold">Site funds</span> vs money paid straight from your <span className="font-semibold">Accounts</span>.
                </>
              ) : (
                <>
                  સૌથી ઉપર તમને <span className="font-semibold">Site Fund</span> (સાઇટના બજેટમાં બચેલા પૈસા) અને <span className="font-semibold">Profit / Loss</span> દેખાશે. આ કુલ ખર્ચને બે ભાગમાં વહેંચે છે: <span className="font-semibold">સાઇટ ફંડમાંથી</span> ચૂકવેલા પૈસા અને સીધા <span className="font-semibold">બેંક/કેશમાંથી</span> ચૂકવેલા પૈસા.
                </>
              )}
            </p>
          </div>
          
          <div className="border-t border-border" />

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t(lang, "2. The 6 Sub-Tabs", "2. સાઇટના 6 સબ-ટેબ્સ")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Transactions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "A full ledger of every expense and fund transfer just for this site.", "આ સાઇટના તમામ ખર્ચ અને ફંડ ટ્રાન્સફરનું લિસ્ટ.")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Books</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "The Bank, Cashbook, and Partner payment registers, filtered strictly for this site.", "બેંક, કેશબુક અને પાર્ટનરનું પેમેન્ટ રજિસ્ટર, જે ફક્ત આ સાઇટનો ખર્ચ બતાવે છે.")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Rojmel</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "The daily cash daybook embedded right inside the site.", "સાઇટની અંદર જ રોજમેળ (કેશનો રોજીંદો હિસાબ).")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Heads</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "Site spend grouped by Category (Head). Click a Head to see every expense under it.", "કેટેગરી (Head) મુજબ સાઇટનો કુલ ખર્ચ. ખર્ચ જોવા માટે Head પર ક્લિક કરો.")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Receipt of RA</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "RA bills and received payments tagged to this site.", "આ સાઇટના RA બિલ અને તેના મળેલા પેમેન્ટની વિગતો.")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">Vendor Bills</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(lang, "Accounts Payable (vendor bills) and payments just for this site.", "આ સાઇટના વેન્ડર બિલ (બાકી પેમેન્ટ) અને તેની ચૂકવણીનો હિસાબ.")}
                </p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-border" />

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "en" ? (
                <>
                  <span className="font-semibold text-foreground">Smart Navigation: </span>
                  When you click on a transaction in the <span className="font-semibold">Transactions</span> tab, the app will automatically jump to the correct tab (like Vendor Bills or Books) and highlight the exact row!
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">સ્માર્ટ નેવિગેશન: </span>
                  જ્યારે તમે <span className="font-semibold">Transactions</span> ટેબમાં કોઈ એન્ટ્રી પર ક્લિક કરશો, ત્યારે એપ જાતે જ યોગ્ય ટેબ (જેમ કે Vendor Bills કે Books) ખોલીને તે એન્ટ્રી હાઇલાઇટ કરી દેશે!
                </>
              )}
            </p>
          </div>
        </Card>
      </section>

      {/* ── Bank, Cashbook & Partner ── */}
      <section id="bank-cashbook">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Books (Bank, Cashbook & Partner)", "બુક્સ (Books - બેંક, કેશબુક અને પાર્ટનર)")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              The <Link href="/books" className="font-semibold text-primary hover:underline">Books</Link> page is a unified hub containing the Bank, Cashbook, Partner, and Rojmel registers in one place. It gives you a familiar ledger view of money paid out, just like your Excel sheets.
            </>
          ) : (
            <>
              <Link href="/books" className="font-semibold text-primary hover:underline">Books</Link> પેજ એક જ જગ્યાએ બેંક, કેશબુક, પાર્ટનર અને રોજમેળ રજિસ્ટર બતાવે છે. તે તમને ખર્ચેલા પૈસાનો હિસાબ બતાવે છે, બિલકુલ તમારી Excel શીટની જેમ.
            </>
          )}
        </p>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
              <Book className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "How data appears here", "અહીં એન્ટ્રી ક્યાંથી આવે છે?")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    When you add a <span className="font-semibold">Site Expense</span> and select a Bank account in "Paid From", it automatically shows up in the <span className="font-semibold">Bank</span> register. If you select a Cash account, it appears in the <span className="font-semibold">Cashbook</span>, and if you select a Partner account, it appears in the <span className="font-semibold">Partner</span> register. Also, whenever you use <span className="font-semibold">Add Site Fund</span> to send money from a Bank, Cash, or Partner account to a site, that entry is also recorded in its respective register.
                  </>
                ) : (
                  <>
                    જ્યારે તમે કોઈ <span className="font-semibold">Site Expense (સાઇટનો ખર્ચ)</span> ઉમેરો છો અને "Paid From" માં જો તમે બેંક એકાઉન્ટ પસંદ કરશો, તો તે એન્ટ્રી સીધી <span className="font-semibold">Bank</span> રજિસ્ટરમાં દેખાશે. જો તમે Cash એકાઉન્ટ પસંદ કરશો, તો તે <span className="font-semibold">Cashbook</span> માં દેખાશે, અને જો તમે Partner એકાઉન્ટ પસંદ કરશો, તો તે <span className="font-semibold">Partner</span> રજિસ્ટરમાં દેખાશે. આ ઉપરાંત, જ્યારે તમે <span className="font-semibold">Add Site Fund</span> નો ઉપયોગ કરીને બેંક, કેશ, કે પાર્ટનર એકાઉન્ટમાંથી કોઈ સાઇટમાં ફંડ મોકલો છો, ત્યારે તે પણ તેના સંબંધિત રજિસ્ટરમાં દેખાશે.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How it works: Books Page", "કેવી રીતે કામ કરે છે: બુક્સ પેજ")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Enter an Expense or Fund Transfer", "સ્ટેપ 1: ખર્ચ કે ફંડ ટ્રાન્સફરની એન્ટ્રી કરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Whenever you save a <span className="font-semibold">Site Expense</span> or <span className="font-semibold">Add Site Fund</span> from the New Transaction form, choose the "Paid From" account.</>
                  ) : (
                    <>જ્યારે પણ તમે નવું <span className="font-semibold">સાઇટ એક્સપેન્સ (Site Expense)</span> કે <span className="font-semibold">Add Site Fund</span> કરો, ત્યારે ખાલી "Paid From" માં એકાઉન્ટ પસંદ કરો.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-info text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Auto-Update in Books", "સ્ટેપ 2: બુક્સમાં આપમેળે એન્ટ્રી")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>The app automatically places that entry into the correct tab — <span className="font-semibold">Bank</span>, <span className="font-semibold">Cashbook</span>, or <span className="font-semibold">Partner</span>. No manual ledger entry is needed.</>
                  ) : (
                    <>એપ આપમેળે તે એન્ટ્રીને યોગ્ય ટેબમાં — <span className="font-semibold">Bank</span>, <span className="font-semibold">Cashbook</span>, કે <span className="font-semibold">Partner</span> માં મૂકી દેશે. તમારે અલગથી રજિસ્ટરમાં એન્ટ્રી કરવાની જરૂર નથી.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Filter & Export", "ફિલ્ટર અને એક્સપોર્ટ (Export)")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Use the filters at the top to search by Account, Site, or Category. Click Export to download the exact filtered data to Excel.</>
                  ) : (
                    <>ઉપરના ફિલ્ટરથી એકાઉન્ટ, સાઇટ કે કેટેગરી મુજબ સર્ચ કરો. પછી Export પર ક્લિક કરીને તે ડેટા સીધો Excel માં ડાઉનલોડ કરો.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "en" ? (
                <>
                  <span className="font-semibold text-foreground">Tip: </span>
                  You can use the filters at the top to search by Account, Date, Party Name (Paid To), Site, or Head (Category).
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">ટીપ: </span>
                  તમે ઉપર આપેલા ફિલ્ટરથી એકાઉન્ટ, તારીખ, પાર્ટી (Paid To), સાઇટ, અથવા હેડ (Category) મુજબ સર્ચ કરી શકો છો.
                </>
              )}
            </p>
          </div>
        </Card>
      </section>

      {/* ── Rojmel ── */}
      <section id="rojmel">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Rojmel (Cash Daybook)", "રોજમેળ (Rojmel)")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              The <Link href="/rojmel" className="font-semibold text-primary hover:underline">Rojmel</Link> page gives you a daily cash daybook for any of your Cash accounts, grouping every cash receipt and expense day by day.
            </>
          ) : (
            <>
              <Link href="/rojmel" className="font-semibold text-primary hover:underline">Rojmel (રોજમેળ)</Link> પેજ તમારા કોઈપણ કેશ ખાતાનો દૈનિક હિસાબ બતાવે છે, જેમાં દરેક દિવસની આવક અને જાવક (ખર્ચ) અલગ અલગ નોંધાયેલી હોય છે.
            </>
          )}
        </p>
        
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-success/10">
              <Book className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Opening & Closing Balance", "શરૂઆતનું અને આખરનું બેલેન્સ (Opening & Closing)")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    For every single day, the system automatically calculates the <span className="font-semibold">Opening Balance</span> (money you had at the start of the day) and the <span className="font-semibold">Closing Balance</span> (money left at the end of the day after all receipts and expenses).
                  </>
                ) : (
                  <>
                    દરેક દિવસ માટે, સિસ્ટમ આપમેળે <span className="font-semibold">શરૂઆતનું બેલેન્સ (Opening Balance)</span> (દિવસની શરૂઆતમાં તમારી પાસે કેટલા રોકડા હતા) અને <span className="font-semibold">આખરનું બેલેન્સ (Closing Balance)</span> (બધી આવક અને ખર્ચ પછી દિવસના અંતે કેટલા રોકડા બચ્યા) ની ગણતરી કરે છે.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="my-4 border-t border-border" />
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-warning/10">
              <ClipboardList className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Day Income & Total Expense", "દિવસની આવક અને કુલ ખર્ચ")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    The transactions are neatly organized. First, you see the total money received for the day. Then, every expense is listed line by line with its Category and Description. Finally, the day ends with the total expense calculation, making it incredibly easy to match with your physical cash register.
                  </>
                ) : (
                  <>
                    ટ્રાન્ઝેક્શન્સ ખૂબ જ સરળ રીતે ગોઠવાયેલા હોય છે. પહેલા, તમને દિવસ દરમિયાન મળેલી કુલ આવક દેખાશે. પછી, દરેક ખર્ચ તેની કેટેગરી અને વિગત સાથે લાઈન બાય લાઈન બતાવવામાં આવે છે. છેલ્લે, દિવસના કુલ ખર્ચની ગણતરી કરવામાં આવે છે, જેથી તમારા સાચા રોજમેળ (કેશ રજિસ્ટર) સાથે હિસાબ મેળવવો ખૂબ જ સરળ બની જાય છે.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How it works: Rojmel", "કેવી રીતે કામ કરે છે: રોજમેળ")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Select a Cash Account", "સ્ટેપ 1: કેશ એકાઉન્ટ પસંદ કરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Open Rojmel and select the specific cash account you want to check.</>
                  ) : (
                    <>રોજમેળ ખોલો અને તમારે જે કેશ એકાઉન્ટ ચેક કરવું હોય તે પસંદ કરો.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-info text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Review Daily Entries", "સ્ટેપ 2: રોજના હિસાબ ચેક કરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>The app groups all money received and spent day-by-day, starting with the opening balance.</>
                  ) : (
                    <>એપ બધી આવક અને જાવક (ખર્ચ) ને દિવસ મુજબ અલગ અલગ બતાવશે, જે શરૂઆતના બેલેન્સથી ચાલુ થશે.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Match Closing Balance", "આખરનું બેલેન્સ મેળવો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Look at the <span className="font-semibold">Closing Balance</span> at the end of the day. It should exactly match the physical cash in your drawer.</>
                  ) : (
                    <>દિવસના અંતે દેખાતું <span className="font-semibold">આખરનું બેલેન્સ (Closing Balance)</span> જુઓ. તે તમારા ગલ્લામાં રહેલી રોકડ સાથે બિલકુલ મેચ થવું જોઈએ.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Receipt of RA ── */}
      <section id="ra-receipts">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Receipt of RA", "RA બિલ રસીદ (Receipt of RA)")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              The <Link href="/ra-receipts" className="font-semibold text-primary hover:underline">Receipt of RA</Link> page tracks Running Account bills and their deductions (GST, TDS, etc.).
            </>
          ) : (
            <>
              <Link href="/ra-receipts" className="font-semibold text-primary hover:underline">Receipt of RA</Link> પેજ તમારા Running Account ના બિલો અને તેની કપાત (GST, TDS, વગેરે) ટ્રેક કરે છે.
            </>
          )}
        </p>
        
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-info/10">
              <ClipboardList className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Bill details & Auto-calculation", "બિલની વિગતો અને ગણતરી")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    Enter your basic bill details, and the system automatically calculates deductions like GST, TDS, SD, and Net Receivable.
                  </>
                ) : (
                  <>
                    તમારા બિલની મૂળભૂત વિગતો નાખો, અને સિસ્ટમ આપમેળે GST, TDS, SD અને હાથમાં આવનાર ચોખ્ખી રકમ (Net Receivable) ની ગણતરી કરશે.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="my-4 border-t border-border" />
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-success/10">
              <Banknote className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Partial Payments & Account Balance", "પેમેન્ટ (Partially Pay) અને ખાતાનું બેલેન્સ")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    Just creating an RA bill <span className="font-semibold">does not</span> add money to your accounts. To actually receive the money, click on the bill row to add a <span className="font-semibold">Partial Payment</span>. When you enter the received amount and select a "Received In" account (like your Bank), that amount is immediately added to your actual bank balance as Income. You can add multiple payments until the full bill amount is recovered.
                  </>
                ) : (
                  <>
                    માત્ર RA બિલ બનાવવાથી તમારા ખાતામાં પૈસા જમા <span className="font-semibold">નથી</span> થતા. ખાતામાં પૈસા લાવવા માટે, બિલની હરોળ પર ક્લિક કરો અને <span className="font-semibold">Payment</span> ઉમેરો. જ્યારે તમે પેમેન્ટની રકમ નાખીને "Received In" (કયા ખાતામાં પૈસા આવ્યા) સિલેક્ટ કરશો, ત્યારે એ રકમ તરત જ તમારા બેંક કે કેશ ખાતામાં આવક (Income) તરીકે ઉમેરાઈ જશે. જ્યાં સુધી બિલના પૂરા પૈસા ન મળે ત્યાં સુધી તમે થોડા-થોડા પેમેન્ટ (Partially Pay) ની એન્ટ્રી કરી શકો છો.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How it works: RA Receipts & Payments", "કેવી રીતે કામ કરે છે: RA બિલ અને પેમેન્ટ")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-info text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Enter Bill Details", "સ્ટેપ 1: બિલની વિગતો નાખો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Add the RA bill amount and details. The system automatically calculates deductions like GST and TDS to show the <span className="font-semibold">Net Receivable</span>.</>
                  ) : (
                    <>RA બિલની રકમ અને વિગતો નાખો. સિસ્ટમ આપમેળે GST અને TDS જેવી કપાત ગણીને <span className="font-semibold">Net Receivable</span> (હાથમાં આવતી રકમ) બતાવશે.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Log a Payment", "સ્ટેપ 2: પેમેન્ટની નોંધ કરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Click the bill row to add a payment. Enter the received amount and select the Bank/Cash account where the money arrived.</>
                  ) : (
                    <>પેમેન્ટ ઉમેરવા માટે બિલ પર ક્લિક કરો. જેટલા પૈસા મળ્યા હોય તે રકમ નાખો અને કયા બેંક/કેશ ખાતામાં પૈસા આવ્યા તે પસંદ કરો.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Automatic Income Entry", "આપમેળે આવકની એન્ટ્રી")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Saving the payment automatically posts an <span className="font-semibold">Income</span> transaction, instantly increasing your actual bank balance.</>
                  ) : (
                    <>પેમેન્ટ સેવ કરતાની સાથે જ સિસ્ટમ આપમેળે એક <span className="font-semibold">Income (આવક)</span> ટ્રાન્ઝેક્શન નોંધશે, જેનાથી તરત જ તમારું બેંક બેલેન્સ વધી જશે.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Vendor Bills ── */}
      <section id="vendor-bills">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Vendor Bills (Accounts Payable)", "વેન્ડર બિલ (Vendor Bills)")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              The <Link href="/vendor-bills" className="font-semibold text-primary hover:underline">Vendor Bills</Link> page tracks the money you owe to your vendors or contractors, functioning as your Accounts Payable register.
            </>
          ) : (
            <>
              <Link href="/vendor-bills" className="font-semibold text-primary hover:underline">Vendor Bills</Link> પેજ તમે વેન્ડર કે કોન્ટ્રાક્ટરને ચૂકવવાના બાકી નાણાંનો રેકોર્ડ રાખે છે, જે તમારી એકાઉન્ટ્સ પેયેબલ (Accounts Payable) રજિસ્ટર તરીકે કામ કરે છે.
            </>
          )}
        </p>
        
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-danger/10">
              <FileText className="h-5 w-5 text-danger" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Recording Bills & No Money Movement", "બિલની એન્ટ્રી અને પૈસાની લેવડ-દેવડ નહિ")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    When you create a Vendor Bill, it only records what you <span className="font-semibold">owe</span> (Amount + GST = Total Bill). It <span className="font-semibold">does not</span> instantly move money out of your accounts or site funds. A Site is required for each bill, allowing you to track expenses specific to a project.
                  </>
                ) : (
                  <>
                    જ્યારે તમે કોઈ વેન્ડર બિલ બનાવો છો, ત્યારે તે ફક્ત તમારે <span className="font-semibold">કેટલા ચૂકવવાના બાકી છે</span> તે નોંધે છે (Amount + GST = Total Bill). આનાથી તરત જ તમારા ખાતામાંથી કે સાઇટના ફંડમાંથી પૈસા <span className="font-semibold">કપાતા નથી</span>. દરેક બિલ માટે સાઇટ (Site) પસંદ કરવી ફરજિયાત છે, જેથી પ્રોજેક્ટ મુજબ ખર્ચ ટ્રેક કરી શકાય.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="my-4 border-t border-border" />
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "Payments & Automatic Expense", "પેમેન્ટ અને આપમેળે ખર્ચ નોંધાવવો")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    To clear the balance, click a bill row to add a <span className="font-semibold">Payment</span>. You can pay from an <span className="font-semibold">Account</span> (Bank, Cash, etc.) or directly from <span className="font-semibold">Site Funds</span>. As soon as you log a payment, the system automatically posts a real <span className="font-semibold">Site Expense</span> transaction to deduct the funds.
                  </>
                ) : (
                  <>
                    બાકી રકમ ક્લિયર કરવા માટે, બિલ પર ક્લિક કરી <span className="font-semibold">Payment</span> ઉમેરો. તમે કોઈપણ <span className="font-semibold">એકાઉન્ટ</span> (બેંક, રોકડ, વગેરે) માંથી અથવા સીધા <span className="font-semibold">સાઇટ ફંડ (Site Funds)</span> માંથી ચૂકવણી કરી શકો છો. જેવું તમે પેમેન્ટ ઉમેરશો, સિસ્ટમ આપમેળે નાણાં કાપવા માટે એક સાચું <span className="font-semibold">સાઇટ એક્સપેન્સ (Site Expense)</span> ટ્રાન્ઝેક્શન નોંધશે.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How it works: Vendor Bills & Payments", "કેવી રીતે કામ કરે છે: વેન્ડર બિલ અને પેમેન્ટ")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-danger text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Create a Vendor Bill", "સ્ટેપ 1: વેન્ડર બિલ બનાવો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Enter details like Vendor name, Site, Amount, and GST. This saves the bill as <span className="font-semibold">Pending</span> and records how much you owe without moving any money.</>
                  ) : (
                    <>વેન્ડરનું નામ, સાઇટ, રકમ અને GST જેવી વિગતો નાખો. આ બિલને <span className="font-semibold">Pending</span> તરીકે સેવ કરશે અને પૈસા કાપ્યા વગર નોંધશે કે તમારે કેટલા ચૂકવવાના છે.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Add a Payment", "સ્ટેપ 2: પેમેન્ટ ઉમેરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Click on the saved bill to open the Payments panel. Add the amount you are paying and choose whether it's from <span className="font-semibold">Site Funds</span> or a <span className="font-semibold">Bank/Cash Account</span>.</>
                  ) : (
                    <>પેમેન્ટ પેનલ ખોલવા માટે સેવ કરેલા બિલ પર ક્લિક કરો. તમે જેટલા પૈસા આપતા હોવ તે રકમ લખો અને પસંદ કરો કે પૈસા <span className="font-semibold">સાઇટ ફંડમાંથી</span> આપ્યા છે કે <span className="font-semibold">બેંક/કેશ એકાઉન્ટમાંથી</span>.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Automatic Expense Entry", "આપમેળે ખર્ચની એન્ટ્રી")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>As soon as you save the payment, the app automatically creates a <span className="font-semibold">Site Expense</span> for that amount. You don't need to enter it twice!</>
                  ) : (
                    <>જેવું તમે પેમેન્ટ સેવ કરશો, એપ આપમેળે તે રકમની <span className="font-semibold">સાઇટ એક્સપેન્સ (Site Expense)</span> એન્ટ્રી કરી દેશે. તમારે બે વાર એન્ટ્રી કરવાની જરૂર નથી!</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How to handle Vendor Advances", "વેન્ડર એડવાન્સ કેવી રીતે મેનેજ કરવા")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-danger text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Create an Advance Bill", "સ્ટેપ 1: એડવાન્સ માટે બિલ બનાવો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Create a Vendor Bill for the advance amount (e.g. ₹2,00,000) and immediately add a payment for it. The bill status will become <span className="font-semibold">Complete</span>.</>
                  ) : (
                    <>તમે જેટલો એડવાન્સ આપતા હોવ તેટલી રકમનું (દા.ત. ₹2,00,000) એક બિલ બનાવો અને તરત જ એનું પેમેન્ટ એડ કરી દો. બિલનું સ્ટેટસ <span className="font-semibold">Complete</span> થઈ જશે.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Update when Final Bill Arrives", "સ્ટેપ 2: સાચું બિલ આવે ત્યારે રકમ વધારો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Later, when the real bill arrives for a larger amount (e.g. ₹5,00,000), search for the vendor, click the <span className="font-semibold">Pencil (Edit)</span> icon on that exact same advance bill, and change the amount to ₹5,00,000.</>
                  ) : (
                    <>ભવિષ્યમાં જ્યારે સાચું બિલ મોટી રકમનું (દા.ત. ₹5,00,000) આવે, ત્યારે વેન્ડરનું નામ સર્ચ કરો અને પેલા જૂના એડવાન્સ બિલ પર <span className="font-semibold">Pencil (Edit)</span> આઇકોન દબાવીને રકમ ₹5,00,000 કરી નાખો.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Automatic Pending Balance", "આપમેળે બાકીની રકમનો હિસાબ")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>The system automatically recalculates (Total Bill 5L - Paid 2L = Remaining 3L) and switches the status to <span className="font-semibold">Partially Paid</span>. You now have a perfect record of the remaining payable balance!</>
                  ) : (
                    <>સિસ્ટમ જાતે જ હિસાબ કરશે (નવું બિલ 5L - ચૂકવેલા 2L = બાકી 3L) અને સ્ટેટસ બદલીને <span className="font-semibold">Partially Paid</span> કરી દેશે. એટલે તમારે હજી કેટલા આપવાના છે તેનો પાક્કો હિસાબ જળવાઈ રહેશે!</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "How to Split Expenses (Multiple Heads in One Bill)", "એક જ બિલમાં અલગ-અલગ ખર્ચ (Split Expense) કેવી રીતે બતાવવા")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-danger text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 1: Create a Single Bill", "સ્ટેપ 1: એક જ સળંગ બિલ બનાવો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Create a single Vendor Bill for the total amount (e.g. ₹70,000) and leave the Head blank (or select a generic one). In the Note, you can write "Steel 40k, Labour 20k, Transport 10k".</>
                  ) : (
                    <>ટોટલ રકમનું (દા.ત. ₹70,000) એક જ બિલ બનાવો. બિલ બનાવતી વખતે Head નું ખાનું ખાલી છોડી દો. Note માં લખી દો: "Steel 40k, Labour 20k, Transport 10k".</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Step 2: Split While Paying", "સ્ટેપ 2: પેમેન્ટ વખતે અલગ-અલગ Head સિલેક્ટ કરો")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Click on the bill to open the Payments panel. Here, you can add multiple payments. The magic is in the <span className="font-semibold">"Head (optional)"</span> field at the bottom of the payment form!</>
                  ) : (
                    <>બિલ પર ક્લિક કરો એટલે પેમેન્ટની પેનલ ખુલશે. અહી તમે અલગ-અલગ પેમેન્ટ એડ કરી શકો છો. પેમેન્ટ ફોર્મમાં નીચે <span className="font-semibold">"Head (optional)"</span> નું ખાનું આપેલું છે!</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, "Perfect Reports", "રિપોર્ટ્સમાં એકદમ ચોખ્ખો હિસાબ")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === "en" ? (
                    <>Add a 40k payment and select "Steel". Add a 20k payment and select "Labour". Add a 10k payment and select "Transport". The Reports page will show 3 separate expenses perfectly separated!</>
                  ) : (
                    <>પેમેન્ટમાં 40k લખી "Steel" સિલેક્ટ કરો, પછી 20k નું પેમેન્ટ કરી "Labour" સિલેક્ટ કરો, અને છેલ્લે 10k નું પેમેન્ટ કરી "Transport" સિલેક્ટ કરો. રિપોર્ટ્સમાં આ ત્રણેય ખર્ચ એકદમ અલગ-અલગ દેખાશે!</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Activity Log ── */}
      <section id="activity-log">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Activity Log", "એક્ટિવિટી લોગ")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              The <Link href="/activity" className="font-semibold text-primary hover:underline">Activity Log</Link> keeps a permanent record of everything that happens in the app.
            </>
          ) : (
            <>
              <Link href="/activity" className="font-semibold text-primary hover:underline">એક્ટિવિટી લોગ</Link> માં એપ્લિકેશનમાં થયેલી દરેક વસ્તુનો કાયમી રેકોર્ડ સચવાય છે.
            </>
          )}
        </p>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-warning/10">
              <ActivitySquare className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "What it tracks", "આ શું ટ્રેક કરે છે?")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    Every time someone creates, edits, or deletes a transaction, account, site, or RA bill, it is securely logged here with the date and exact details. It is read-only, ensuring a reliable audit trail.
                  </>
                ) : (
                  <>
                    જ્યારે પણ કોઈ ટ્રાન્ઝેક્શન, ખાતું, સાઇટ કે RA બિલ બનાવે, એડિટ કરે કે ડીલીટ કરે, ત્યારે તેની સંપૂર્ણ વિગતો તારીખ સાથે અહીં નોંધાઈ જાય છે. તેને બદલી શકાતો નથી, જેથી તમારો હિસાબ હંમેશા સુરક્ષિત રહે.
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ── Recheck Balances ── */}
      <section id="recheck-balances">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, 'The "Recheck Balances" Button — Explained', '"Recheck Balances" બટન વિશે માહિતી')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              This button appears at the top-right of the{" "}
              <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts page</Link>.
              It is a safety tool that you will rarely need, but it is very important to understand.
            </>
          ) : (
            <>
              આ બટન <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts પેજ</Link> ની ઉપર જમણી બાજુએ દેખાશે.
              આ એક સેફટી ફીચર છે જેની બહુ ઓછી જરૂર પડશે, પણ એના વિશે જાણવું જરૂરી છે.
            </>
          )}
        </p>

        <Card className="p-5">

          {/* What it does */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-info/10">
              <RefreshCw className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t(lang, "What it does", "આ શું કામ કરે છે?")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    It re-reads every single transaction ever saved in the app and re-calculates what each account balance <span className="font-semibold">should</span> be from scratch. If the number it calculates is different from what is displayed, it automatically corrects the balance to the right number.
                  </>
                ) : (
                  <>
                    તે એપ્લિકેશનમાં સાચવેલા દરેક વ્યવહારને ફરીથી વાંચે છે અને દરેક ખાતાનું બેલેન્સ શરૂઆતથી <span className="font-semibold">શું હોવું જોઈએ</span> તેની ફરીથી ગણતરી કરે છે. જો તે જે ગણતરી કરે છે તે દર્શાવેલ નંબર કરતા અલગ હોય, તો તે આપમેળે બેલેન્સને સાચા નંબરમાં સુધારે છે.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Real world analogy */}
          <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-4">
            <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t(lang, "Simple analogy", "સિમ્પલ ભાષામાં સમજીએ તો")}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {lang === "en" ? (
                  <>
                    Think of it like a <span className="font-semibold">bank reconciliation</span> that your accountant does at the end of the month. They go through every receipt and every payment to verify the closing balance is correct. This button does the exact same thing — instantly, automatically, for all your accounts.
                  </>
                ) : (
                  <>
                    આને તમારા એકાઉન્ટન્ટ દ્વારા મહિનાના અંતે કરવામાં આવતા <span className="font-semibold">બેંક સમાધાન (bank reconciliation)</span> જેવું વિચારો. તેઓ ક્લોઝિંગ બેલેન્સ સાચું છે કે કેમ તે ચકાસવા માટે દરેક રસીદ અને દરેક ચુકવણી તપાસે છે. આ બટન બરાબર એ જ વસ્તુ કરે છે — તરત જ, આપમેળે, તમારા બધા ખાતાઓ માટે.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* What you will see */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "What will happen when you click it?", "જ્યારે તમે ક્લિક કરશો ત્યારે શું થશે?")}
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, '✅ "All balances already match"', '✅ "બધા બેલેન્સ મેચ થાય છે"')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(lang, "Everything is correct. All your account balances match every transaction recorded. No action needed — you are fully up to date.", "એટલે કે બધું બરાબર છે. તમારા બધા બેલેન્સ બરાબર મેચ થઇ રહ્યા છે.")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <RefreshCw className="mt-0.5 h-5 w-5 flex-none text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, '⚠️ "Corrected X account balance(s)"', '⚠️ "X ખાતાના બેલેન્સ રિપેર કર્યા"')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(lang, "A mismatch was found and has been automatically fixed. The balance shown on screen will update to the correct number. This is rare, but can happen if a transaction was edited or deleted after it was first saved.", "ક્યાંક ભૂલ હતી જે ઓટોમેટિક સોલ્વ થઇ ગઈ છે. સ્ક્રીન પર હવે સાચું બેલેન્સ દેખાશે. આવું ભાગ્યે જ થાય છે, પણ ક્યારેક કોઈ જુનું ટ્રાન્ઝેક્શન ડીલીટ કે એડિટ કરીએ ત્યારે થઇ શકે છે.")}
                </p>
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* When to use */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "When should you use it?", "તમારે આ ક્યારે વાપરવું?")}
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "The balance shown for an account looks wrong or surprising.", "જ્યારે તમને લાગે કે કોઈ ખાતાનું બેલેન્સ ખોટું દેખાઈ રહ્યું છે.")}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "You just deleted or edited an old transaction and want to be sure everything updated correctly.", "જ્યારે તમે કોઈ જુનું ટ્રાન્ઝેક્શન ડીલીટ કે એડિટ કર્યું હોય અને તમે ખાતરી કરવા માંગતા હોવ કે બધું બરાબર અપડેટ થઇ ગયું છે.")}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "At the end of the month, as a quick health check before sharing reports.", "મહિનાના અંતે રિપોર્ટ કાઢતા પહેલા એક વાર ચેક કરવા માટે.")}
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* Safe to use */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "en" ? (
                <>
                  <span className="font-semibold text-foreground">Is it safe? Yes, completely. </span>
                  This button never deletes any transaction or changes any history. It only fixes the final balance number shown on screen. It does not matter how many times you press it — it will always give you the right answer.
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">શું આ બટન દબાવવું સેફ છે? હા, 100%. </span>
                  આનાથી તમારું કોઈ ટ્રાન્ઝેક્શન ડીલીટ નહિ થાય. આ ફક્ત છેલ્લું બેલેન્સ ગણીને સાચું બતાવે છે. તમે ચાહો એટલી વાર આ બટન દબાવી શકો છો.
                </>
              )}
            </p>
          </div>

        </Card>
      </section>

       {/* ── Pro Tip ── */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-foreground">{t(lang, "💡 Pro Tip", "💡 પ્રો ટીપ")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(lang,
            "After completing setup, your Dashboard will show total capital available, how much is locked inside each site, and a real-time warning if any site is running low on funds.",
            "એક વાર બધું સેટ થઇ જાય એટલે તમારું Dashboard બતાવશે કે તમારી પાસે કુલ કેટલા પૈસા છે, કઈ સાઇટ પર કેટલા પૈસા વાપરવાના બાકી છે અને જો કોઈ સાઇટ પર બેલેન્સ ઓછું થઇ જાય તો તમને એલર્ટ પણ આપશે."
          )}
        </p>
        <div className="mt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {t(lang, "Go to Dashboard →", "Dashboard પર જાવ →")}
          </Link>
        </div>
      </Card>

      </div>{/* end main content col */}

      {/* ── Sticky TOC ── */}
      <aside className="hidden xl:block">
        <div className="sticky top-6 w-44">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t(lang, "On this page", "આ પેજ પર")}
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
