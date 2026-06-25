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
} from "lucide-react";
import Link from "next/link";

type Lang = "en" | "gu";

const t = (lang: Lang, en: string, gu: string) => lang === "en" ? en : gu;

/* ─── TOC items ─────────────────────────────────────────────── */
const getTOC = (lang: Lang) => [
  { id: "setup-steps",       label: t(lang, "Setup Steps", "સેટઅપ પગલાં") },
  { id: "transaction-types", label: t(lang, "Transaction Types", "ટ્રાન્ઝેક્શન પ્રકારો") },
  { id: "category-paidto",   label: t(lang, "Category & Paid To", "કેટેગરી અને પેઇડ ટુ") },
  { id: "add-money",         label: t(lang, "Add Money", "પૈસા ઉમેરો") },
  { id: "recheck-balances",  label: t(lang, "Recheck Balances", "બેલેન્સ ફરીથી તપાસો") },
];

/* ─── Step-by-step data ──────────────────────────────────────── */
const getSteps = (lang: Lang) => [
  {
    number: 1,
    title: t(lang, "Add a Bank Account", "બેંક ખાતું ઉમેરો"),
    description: t(lang,
      "First, set up where your money is coming from. Go to the Accounts page and add your bank accounts or cash on hand. You can also add investor / partner accounts here.",
      "પ્રથમ, તમારા પૈસા ક્યાંથી આવી રહ્યા છે તે સેટ કરો. એકાઉન્ટ્સ પૃષ્ઠ પર જાઓ અને તમારા બેંક ખાતા અથવા હાથ પરની રોકડ ઉમેરો. તમે અહીં રોકાણકાર/ભાગીદારના ખાતા પણ ઉમેરી શકો છો."
    ),
    icon: Landmark,
    actionLabel: t(lang, "Go to Accounts", "એકાઉન્ટ્સ પર જાઓ"),
    actionHref: "/accounts",
  },
  {
    number: 2,
    title: t(lang, "Add a Site", "સાઇટ ઉમેરો"),
    description: t(lang,
      "Next, create the construction sites or projects you are managing. Each site will have its own separate budget and expense tracking.",
      "આગળ, તમે જે બાંધકામ સાઇટ્સ અથવા પ્રોજેક્ટ્સનું સંચાલન કરી રહ્યાં છો તે બનાવો. દરેક સાઇટનું પોતાનું અલગ બજેટ અને ખર્ચ ટ્રેકિંગ હશે."
    ),
    icon: Building2,
    actionLabel: t(lang, "Go to Sites", "સાઇટ્સ પર જાઓ"),
    actionHref: "/projects",
  },
  {
    number: 3,
    title: t(lang, "Allocate Funds to the Site", "સાઇટને ભંડોળ ફાળવો"),
    description: t(lang,
      'Move money from your Bank Account into a Site. This sets the working budget for that site. Click the "+ New Transaction" button and choose "Add Site Fund".',
      'તમારા બેંક ખાતામાંથી સાઇટ પર પૈસા ટ્રાન્સફર કરો. આ સાઇટ માટે કાર્યકારી બજેટ સેટ કરે છે. "+ New Transaction" બટન પર ક્લિક કરો અને "Add Site Fund" પસંદ કરો.'
    ),
    icon: ArrowRightLeft,
    actionLabel: null,
    actionHref: null,
  },
  {
    number: 4,
    title: t(lang, "Record Expenses", "ખર્ચ નોંધો"),
    description: t(lang,
      'When you spend money on a site, record it as an expense. Click the "+ New Transaction" button and choose "Site Expense". You can pay from the Site\'s allocated funds or directly from a Bank Account.',
      'જ્યારે તમે સાઇટ પર પૈસા ખર્ચો છો, ત્યારે તેને ખર્ચ તરીકે નોંધો. "+ New Transaction" બટન પર ક્લિક કરો અને "Site Expense" પસંદ કરો. તમે સાઇટના ફાળવેલ ભંડોળમાંથી અથવા સીધા બેંક ખાતામાંથી ચૂકવણી કરી શકો છો.'
    ),
    icon: Receipt,
    actionLabel: null,
    actionHref: null,
  },
];

/* ─── Transaction type explanations ─────────────────────────── */
const getFeatures = (lang: Lang) => [
  {
    label: t(lang, "Add Site Fund", "સાઇટ ફંડ ઉમેરો"),
    color: "bg-primary/10 text-primary border-primary/20",
    iconColor: "text-primary",
    icon: Banknote,
    what: t(lang, "Send money from your bank or cash into a specific site.", "તમારી બેંક અથવા રોકડમાંથી ચોક્કસ સાઇટમાં પૈસા મોકલો."),
    example: t(lang,
      'Example: You have ₹5,00,000 in HDFC Bank. You move ₹1,50,000 to "Site A" so workers can start buying materials.',
      'ઉદાહરણ: તમારી પાસે HDFC બેંકમાં ₹5,00,000 છે. તમે ₹1,50,000 "સાઇટ A" માં ટ્રાન્સફર કરો છો જેથી કામદારો સામગ્રી ખરીદવાનું શરૂ કરી શકે.'
    ),
    when: t(lang, "Use this whenever a site needs more budget to operate.", "જ્યારે પણ સાઇટને કામ કરવા માટે વધુ બજેટની જરૂર હોય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "From Account", "આ ખાતામાંથી"), desc: t(lang, "Which bank or cash account to take the money from.", "કયા બેંક અથવા રોકડ ખાતામાંથી પૈસા લેવા.") },
      { name: t(lang, "To Site", "સાઇટ પર"), desc: t(lang, "Which site gets the money.", "કઈ સાઇટને પૈસા મળશે.") },
    ],
  },
  {
    label: t(lang, "Site Expense", "સાઇટ ખર્ચ"),
    color: "bg-danger/10 text-danger border-danger/20",
    iconColor: "text-danger",
    icon: HardHat,
    showPaymentMethods: true,
    what: t(lang, "Record a cost that happened at a specific site (cement, labour, electrician, etc.).", "ચોક્કસ સાઇટ પર થયેલા ખર્ચની નોંધ કરો (સિમેન્ટ, મજૂરી, ઇલેક્ટ્રિશિયન, વગેરે)."),
    example: t(lang,
      'Example: You paid ₹12,000 for bricks at "Site B". Record it as a Site Expense and the app instantly shows the site\'s remaining balance.',
      'ઉદાહરણ: તમે "સાઇટ B" પર ઇંટો માટે ₹12,000 ચૂકવ્યા. તેને સાઇટ ખર્ચ તરીકે નોંધો અને એપ્લિકેશન તરત જ સાઇટનું બાકીનું બેલેન્સ બતાવે છે.'
    ),
    when: t(lang, "Use this every time money is spent on a site.", "દરેક વખતે જ્યારે સાઇટ પર પૈસા ખર્ચવામાં આવે ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "Category", "કેટેગરી"), desc: t(lang, "What type of expense — Labour, Material, Transport, etc.", "કયા પ્રકારનો ખર્ચ — મજૂરી, સામગ્રી, પરિવહન વગેરે.") },
      { name: t(lang, "Site", "સાઇટ"), desc: t(lang, "Which site the money was spent on.", "કઈ સાઇટ પર પૈસા ખર્ચવામાં આવ્યા.") },
      { name: t(lang, "Paid From", "ચૂકવણી ક્યાંથી કરી"), desc: t(lang, "Choose one of the two payment methods explained below.", "નીચે સમજાવેલ બે ચુકવણી પદ્ધતિઓમાંથી એક પસંદ કરો.") },
      { name: t(lang, "Paid To (optional)", "કોને ચૂકવ્યા (વૈકલ્પિક)"), desc: t(lang, "The contractor, vendor, or worker who received the money.", "કોન્ટ્રાક્ટર, વિક્રેતા અથવા કામદાર જેને પૈસા મળ્યા.") },
    ],
  },
  {
    label: t(lang, "Transfer", "ટ્રાન્સફર"),
    color: "bg-info/10 text-info border-info/20",
    iconColor: "text-info",
    icon: Repeat2,
    what: t(lang,
      "Move money between two of your own accounts (e.g., from HDFC Bank to ICICI Bank, or from Bank to Cash).",
      "તમારા પોતાના બે ખાતાઓ વચ્ચે પૈસા ટ્રાન્સફર કરો (દા.ત. HDFC બેંકથી ICICI બેંક, અથવા બેંકમાંથી રોકડમાં)."
    ),
    example: t(lang,
      "Example: You withdraw ₹50,000 from HDFC Bank as cash for daily payments. Record it as a Transfer from HDFC Bank → Office Cash.",
      "ઉદાહરણ: તમે રોજિંદા ચુકવણી માટે HDFC બેંકમાંથી રોકડ તરીકે ₹50,000 ઉપાડો છો. તેને HDFC બેંક → ઓફિસ કેશ ટ્રાન્સફર તરીકે નોંધો."
    ),
    when: t(lang, "Use this when cash moves between your own accounts, not to a site.", "જ્યારે રોકડ તમારા પોતાના ખાતાઓ વચ્ચે ટ્રાન્સફર થાય ત્યારે આનો ઉપયોગ કરો, સાઇટ પર નહીં."),
    fields: [
      { name: t(lang, "Source Account", "આ ખાતામાંથી"), desc: t(lang, "The account sending the money.", "જે ખાતામાંથી પૈસા મોકલવામાં આવી રહ્યા છે.") },
      { name: t(lang, "Destination Account", "આ ખાતામાં"), desc: t(lang, "The account receiving the money.", "જે ખાતામાં પૈસા જમા થશે.") },
    ],
  },
  {
    label: t(lang, "Partner Payout", "પાર્ટનર પેઆઉટ"),
    color: "bg-warning/10 text-warning border-warning/20",
    iconColor: "text-warning",
    icon: UserMinus,
    what: t(lang, "Record when an investor (partner) takes money out of the business.", "જ્યારે રોકાણકાર (ભાગીદાર) વ્યવસાયમાંથી પૈસા પાછા ખેંચે ત્યારે નોંધો."),
    example: t(lang,
      "Example: Investor Amit contributed ₹10,00,000 earlier. He now wants ₹2,00,000 back. Record it as a Partner Payout from Amit's account.",
      "ઉદાહરણ: રોકાણકાર અમિતે અગાઉ ₹10,00,000 આપ્યા હતા. તે હવે ₹2,00,000 પાછા માંગે છે. તેને અમિતના ખાતામાંથી પાર્ટનર પેઆઉટ તરીકે નોંધો."
    ),
    when: t(lang, "Use this when returning money to an investor or paying out a profit share.", "જ્યારે રોકાણકારને પૈસા પાછા આપવા અથવા નફાનો હિસ્સો ચૂકવવો હોય ત્યારે આનો ઉપયોગ કરો."),
    fields: [
      { name: t(lang, "Partner", "પાર્ટનર"), desc: t(lang, "Which investor is withdrawing money.", "કયા રોકાણકાર પૈસા પાછા ખેંચી રહ્યા છે.") },
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
            {t(lang, "Getting Started Guide", "શરૂઆતની માર્ગદર્શિકા")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(lang,
              "Follow these 4 simple steps to set up and start managing your real estate funds.",
              "તમારા રિયલ એસ્ટેટ ફંડ્સ સેટ અપ કરવા અને મેનેજ કરવાનું શરૂ કરવા માટે આ 4 સરળ પગલાં અનુસરો."
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
        <h2 className="mb-4 text-base font-semibold text-foreground">{t(lang, "Setup Steps", "સેટઅપ પગલાં")}</h2>
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
                    {t(lang, `Step ${step.number}`, `પગલું ${step.number}`)}
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
                "બધું સેટ થઈ ગયું છે! તમારા ફંડની સ્થિતિ એક નજરમાં જોવા માટે તમારું ડેશબોર્ડ તપાસો."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Features Explained ── */}
      <section id="transaction-types">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, "Transaction Types Explained", "ટ્રાન્ઝેક્શન પ્રકારો સમજાવેલ છે")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              When you click the <span className="font-semibold">+ New Transaction</span> button,
              you will see 4 options. Here is what each one means:
            </>
          ) : (
            <>
              જ્યારે તમે <span className="font-semibold">+ New Transaction</span> બટન પર ક્લિક કરો છો,
              ત્યારે તમને 4 વિકલ્પો દેખાશે. અહીં દરેકનો અર્થ શું છે તે દર્શાવેલ છે:
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
                  <span className="font-semibold text-foreground">{t(lang, "When to use: ", "ક્યારે ઉપયોગ કરવો: ")}</span>
                  {f.when}
                </p>

                {/* Fields */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(lang, "Fields in this form", "આ ફોર્મમાં ફીલ્ડ્સ")}
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
                      {t(lang, "2 Ways to Pay for a Site Expense", "સાઇટ ખર્ચ ચૂકવવાની 2 રીતો")}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* Option 1 – Site Funds */}
                      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                            <Wallet className="h-4 w-4 text-primary" />
                          </div>
                          <p className="text-sm font-semibold text-primary">{t(lang, "Option 1 — Site Funds", "વિકલ્પ 1 — સાઇટ ફંડ્સ")}</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">{t(lang, "Pay from the site's own budget", "સાઇટના પોતાના બજેટમાંથી ચૂકવો")}</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "Money is taken from the funds you already sent to this site.", "તમે આ સાઇટ પર પહેલાથી જ મોકલેલા ભંડોળમાંથી પૈસા લેવામાં આવે છે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "Site balance goes down. Bank balance stays the same.", "સાઇટ બેલેન્સ ઘટે છે. બેંક બેલેન્સ સમાન રહે છે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">✓</span>
                            {t(lang, "The app will warn you if the site does not have enough funds.", "જો સાઇટ પાસે પૂરતું ભંડોળ નહીં હોય તો એપ્લિકેશન તમને ચેતવણી આપશે.")}
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-primary/10 p-2.5 text-xs text-primary">
                          {t(lang, "Example: Site A has ₹50,000. You pay ₹5,000 for cement → Site A now has ₹45,000.", "ઉદાહરણ: સાઇટ A પાસે ₹50,000 છે. તમે સિમેન્ટ માટે ₹5,000 ચૂકવો છો → સાઇટ A પાસે હવે ₹45,000 છે.")}
                        </div>
                      </div>

                      {/* Option 2 – Direct from Account */}
                      <div className="rounded-xl border-2 border-border bg-muted/50 p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">{t(lang, "Option 2 — Direct from Account", "વિકલ્પ 2 — સીધા ખાતામાંથી")}</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground font-medium">{t(lang, "Pay from Bank, Partner, or Cash", "બેંક, ભાગીદાર અથવા રોકડમાંથી ચૂકવો")}</p>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {t(lang, "Money is taken straight from your Bank, Cash, or Partner account.", "પૈસા સીધા તમારી બેંક, રોકડ અથવા ભાગીદારના ખાતામાંથી લેવામાં આવે છે.")}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {lang === "en" ? (
                              <>The site's allocated budget is <span className="font-semibold">not touched</span>.</>
                            ) : (
                              <>સાઇટના ફાળવેલ બજેટને <span className="font-semibold">સ્પર્શ કરવામાં આવતો નથી</span>.</>
                            )}
                          </li>
                          <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-success">✓</span>
                            {t(lang, "Use this when you pay a worker directly from your pocket or bank.", "જ્યારે તમે કામદારને સીધા તમારા ખિસ્સામાંથી અથવા બેંકમાંથી ચૂકવો ત્યારે આનો ઉપયોગ કરો.")}
                          </li>
                        </ul>
                        <div className="mt-3 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                          {t(lang, "Example: You pay ₹8,000 labour directly from HDFC Bank → Bank reduces, Site budget stays.", "ઉદાહરણ: તમે સીધા HDFC બેંકમાંથી ₹8,000 મજૂરી ચૂકવો છો → બેંક બેલેન્સ ઘટે છે, સાઇટ બજેટ સમાન રહે છે.")}
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
                            <span className="font-semibold text-foreground">સરળ નિયમ: </span>
                            જો પૈસા સાઇટના બજેટમાંથી આવ્યા હોય → પસંદ કરો <span className="font-semibold">Site Funds</span>.
                            જો તમે તમારી બેંક, હાથ પરની રોકડ અથવા રોકાણકારના પૈસાથી ચૂકવણી કરી હોય → પસંદ કરો
                            <span className="font-semibold"> Direct from Account</span>.
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
          {t(lang, 'Category & "Paid To" — Explained', 'કેટેગરી અને "કોને ચૂકવ્યા" — સમજાવેલ')}
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
              જ્યારે તમે <span className="font-semibold">સાઇટ ખર્ચ (Site Expense)</span> નોંધો છો ત્યારે આ બે ફીલ્ડ્સ દેખાય છે.
              તેઓ તમને ટ્રેક કરવામાં મદદ કરે છે કે પૈસા <span className="font-semibold">શેના માટે</span> ખર્ચવામાં આવ્યા અને
              તે <span className="font-semibold">કોને</span> મળ્યા.
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
                      એક લેબલ જે વર્ણવે છે કે ખર્ચ <span className="font-semibold">કયા પ્રકારના કામ અથવા ખરીદી</span> માટે છે.
                      દરેક સાઇટ ખર્ચ માટે આ જરૂરી છે જેથી તમે બરાબર જોઈ શકો કે તમારા પૈસા ક્યાં જઈ રહ્યા છે.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            {/* Built-in chips */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(lang, "How it works", "તે કેવી રીતે કામ કરે છે")}
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Tap an existing category chip", "હાલની કેટેગરી ચિપ પર ટેપ કરો")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "en" ? (
                      <>You will see buttons like <span className="font-semibold">Labour, Material, Diesel, Contractor, JCB, Legal, Miscellaneous</span>. Just tap the one that fits and it is selected (turns purple).</>
                    ) : (
                      <>તમને <span className="font-semibold">Labour, Material, Diesel, Contractor, JCB, Legal, Miscellaneous</span> જેવા બટનો દેખાશે. ફક્ત જે અનુકૂળ હોય તેને ટેપ કરો અને તે પસંદ થઈ જશે (જાંબલી રંગમાં ફેરવાશે).</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, 'Don\'t see the right category? Tap "+ Add"', 'યોગ્ય કેટેગરી દેખાતી નથી? "+ Add" પર ટેપ કરો')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      'A small text box appears. Type the new category name (e.g. "Plumbing" or "Security") and press the ✓ button. It is created instantly and selected automatically.',
                      'એક નાનું ટેક્સ્ટ બોક્સ દેખાય છે. નવી કેટેગરીનું નામ લખો (દા.ત. "Plumbing" અથવા "Security") અને ✓ બટન દબાવો. તે તરત જ બની જાય છે અને આપમેળે પસંદ થઈ જાય છે.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Saved permanently for future use", "ભવિષ્યના ઉપયોગ માટે કાયમી ધોરણે સાચવેલ")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "Any new category you add will appear as a chip for all future expenses — you only need to create it once.",
                      "તમે ઉમેરેલી કોઈપણ નવી કેટેગરી ભવિષ્યના તમામ ખર્ચાઓ માટે ચિપ તરીકે દેખાશે — તમારે તેને માત્ર એક જ વાર બનાવવાની જરૂર છે."
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
                    The Reports page uses categories to show you a breakdown like
                    "You spent ₹2,50,000 on Labour, ₹80,000 on Material, and ₹40,000 on Diesel this month."
                    Without categories, you cannot see where the most money is going.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">આ શા માટે મહત્વપૂર્ણ છે: </span>
                    રિપોર્ટ્સ પેજ કેટેગરીઝનો ઉપયોગ કરીને તમને એવું બ્રેકડાઉન બતાવશે જેમ કે
                    "તમે આ મહિને મજૂરી પર ₹2,50,000, સામગ્રી પર ₹80,000 અને ડીઝલ પર ₹40,000 ખર્ચ્યા છે."
                    કેટેગરીઝ વિના, તમે જોઈ શકતા નથી કે સૌથી વધુ પૈસા ક્યાં જઈ રહ્યા છે.
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
                <p className="text-sm font-semibold text-foreground">{t(lang, "Paid To", "કોને ચૂકવ્યા")} <span className="text-xs font-normal text-muted-foreground">({t(lang, "optional", "વૈકલ્પિક")})</span></p>
                <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <>
                      The name of the <span className="font-semibold">person, contractor, or vendor</span> who received the money.
                      This is optional, but highly recommended so you can track who has been paid and how much.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">વ્યક્તિ, કોન્ટ્રાક્ટર અથવા વિક્રેતા</span> નું નામ જેને પૈસા મળ્યા.
                      આ વૈકલ્પિક છે, પરંતુ ખૂબ ભલામણ કરવામાં આવે છે જેથી તમે ટ્રેક કરી શકો કે કોને અને કેટલી રકમ ચૂકવવામાં આવી છે.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-border" />

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(lang, "How it works — Smart Auto-Memory", "તે કેવી રીતે કામ કરે છે — સ્માર્ટ ઓટો-મેમરી")}
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, 'Click the "Paid To" box', '"Paid To" બોક્સ પર ક્લિક કરો')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      'A dropdown opens showing all the names you have used before (e.g. "Ramesh Contractor", "Ganesh Kaak"). You can scroll or search by typing a few letters.',
                      'એક ડ્રોપડાઉન ખૂલે છે જેમાં તમે પહેલાં ઉપયોગ કરેલા તમામ નામો (દા.ત. "રમેશ કોન્ટ્રાક્ટર", "ગણેશ કાકા") દર્શાવવામાં આવે છે. તમે થોડા અક્ષરો લખીને શોધી શકો છો.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning text-xs font-bold text-white">2</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "New name? Just type it and press Enter", "નવું નામ? બસ તેને લખો અને Enter દબાવો")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "If the person does not appear in the list, just type their name and press Enter. The name is used immediately for this expense.",
                      "જો વ્યક્તિ યાદીમાં દેખાતી નથી, તો બસ તેમનું નામ લખો અને Enter દબાવો. આ ખર્ચ માટે નામનો તરત જ ઉપયોગ થાય છે."
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-xs font-bold text-white">✓</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(lang, "Remembered automatically after saving", "સેવ કર્યા પછી આપમેળે યાદ રહે છે")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(lang,
                      "As soon as you save the transaction, the name is stored. Next time you type that person's name, it will appear as a suggestion automatically — no need to type the full name again.",
                      "જેમ તમે વ્યવહાર સાચવો છો, નામ સંગ્રહિત થાય છે. આગલી વખતે જ્યારે તમે તે વ્યક્તિનું નામ ટાઇપ કરશો, ત્યારે તે આપમેળે સૂચન તરીકે દેખાશે - ફરીથી સંપૂર્ણ નામ લખવાની જરૂર નથી."
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
                    <><span className="font-semibold text-foreground">કેટેગરી</span> = <span className="font-semibold">શેના માટે</span> પૈસા હતા (દા.ત. મજૂરી, ડીઝલ)</>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-3">
                <UserMinus className="mt-0.5 h-4 w-4 flex-none text-warning" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "en" ? (
                    <><span className="font-semibold text-foreground">Paid To</span> = <span className="font-semibold">who</span> received the money (e.g. Ramesh, Amit Bhai)</>
                  ) : (
                    <><span className="font-semibold text-foreground">કોને ચૂકવ્યા</span> = <span className="font-semibold">કોને</span> પૈસા મળ્યા (દા.ત. રમેશ, અમિત ભાઈ)</>
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
                    <span className="font-semibold text-foreground">ઉદાહરણ: </span>
                    તમે સાઇટ A પર ખોદકામ માટે રમેશને ₹15,000 ચૂકવો છો. કેટેગરી તરીકે <span className="font-semibold">Labour</span> પસંદ કરો અને Paid To માં <span className="font-semibold">Ramesh Contractor</span> લખો. હવે તમે હંમેશા જોઈ શકશો — "મેં તમામ સાઇટ્સ પર રમેશને કુલ કેટલા પૈસા ચૂકવ્યા છે?"
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
          {t(lang, 'The "+ Add Money" Button — Explained', '"+ Add Money" બટન — સમજાવેલ')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lang === "en" ? (
            <>
              On the <Link href="/accounts" className="font-semibold text-primary hover:underline">Accounts page</Link>, every
              account has a <span className="font-semibold">+ Add Money</span> button next to it. Here is exactly what it does and when to use it.
            </>
          ) : (
            <>
              <Link href="/accounts" className="font-semibold text-primary hover:underline">એકાઉન્ટ્સ પેજ</Link> પર, દરેક
              ખાતાની બાજુમાં <span className="font-semibold">+ Add Money</span> બટન હોય છે. અહીં બરાબર સમજાવેલ છે કે તે શું કરે છે અને ક્યારે તેનો ઉપયોગ કરવો.
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
              <p className="text-sm font-semibold text-foreground">{t(lang, "What it does", "તે શું કરે છે")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {t(lang,
                  "It records new money arriving into a specific account — like a cash deposit, bank transfer received, or a partner putting in their investment. The account balance goes up instantly.",
                  "તે ચોક્કસ ખાતામાં આવતા નવા પૈસાની નોંધ કરે છે — જેમ કે રોકડ જમા, બેંક ટ્રાન્સફર મળેલ છે, અથવા ભાગીદાર તેમના રોકાણ મૂકી રહ્યા છે. એકાઉન્ટ બેલેન્સ તરત જ વધી જાય છે."
                )}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* 3 account types side by side */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "Use it differently for each account type", "દરેક પ્રકારના ખાતા માટે અલગ રીતે ઉપયોગ કરો")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            {/* Bank */}
            <div className="rounded-xl border border-info/30 bg-info/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/15">
                  <Landmark className="h-3.5 w-3.5 text-info" />
                </div>
                <p className="text-sm font-semibold text-info">{t(lang, "Bank Account", "બેંક ખાતું")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે ઉપયોગ કરવો:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "You deposited cash into your bank", "તમે તમારી બેંકમાં રોકડ જમા કરાવી")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "A payment was received from a client", "ક્લાયન્ટ તરફથી ચુકવણી મળી")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-info">✓</span> {t(lang, "A loan was credited to the account", "ખાતામાં લોન જમા કરવામાં આવી હતી")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-info/10 p-2 text-xs text-info">
                {t(lang, 'Example: ₹5,00,000 loan credited to HDFC Bank → click "Add Money" on HDFC Bank and enter ₹5,00,000.', 'ઉદાહરણ: HDFC બેંકમાં ₹5,00,000 ની લોન જમા થઈ → HDFC બેંક પર "Add Money" ક્લિક કરો અને ₹5,00,000 દાખલ કરો.')}
              </div>
            </div>

            {/* Cash */}
            <div className="rounded-xl border border-success/30 bg-success/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                </div>
                <p className="text-sm font-semibold text-success">{t(lang, "Cash Account", "રોકડ ખાતું")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે ઉપયોગ કરવો:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "You withdrew cash from the bank", "તમે બેંકમાંથી રોકડ ઉપાડી")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "Someone gave you cash in hand", "કોઈએ તમને હાથમાં રોકડ આપી")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-success">✓</span> {t(lang, "You received a cash payment", "તમને રોકડ ચુકવણી મળી")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-success/10 p-2 text-xs text-success">
                {t(lang, 'Example: You withdrew ₹50,000 from ATM as cash → Add Money to "Office Cash" for ₹50,000.', 'ઉદાહરણ: તમે ATM માંથી રોકડ તરીકે ₹50,000 ઉપાડ્યા → "Office Cash" માં ₹50,000 માટે Add Money કરો.')}
              </div>
            </div>

            {/* Partner */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15">
                  <UserMinus className="h-3.5 w-3.5 text-warning" />
                </div>
                <p className="text-sm font-semibold text-warning">{t(lang, "Partner Account", "પાર્ટનર ખાતું")}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">{t(lang, "When to use:", "ક્યારે ઉપયોગ કરવો:")}</p>
              <ul className="mt-1 space-y-1">
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "An investor sends their capital", "કોઈ રોકાણકાર તેમની મૂડી મોકલે છે")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "A partner adds more funds", "ભાગીદાર વધુ ભંડોળ ઉમેરે છે")}
                </li>
                <li className="flex items-start gap-1 text-xs text-muted-foreground">
                  <span className="text-warning">✓</span> {t(lang, "You record a new investment round", "તમે નવા રોકાણ રાઉન્ડની નોંધ કરો છો")}
                </li>
              </ul>
              <div className="mt-2.5 rounded-lg bg-warning/10 p-2 text-xs text-warning">
                {t(lang, 'Example: Investor Amit sends ₹10,00,000 → Add Money to "Amit Partner" for ₹10,00,000.', 'ઉદાહરણ: રોકાણકાર અમિત ₹10,00,000 મોકલે છે → "Amit Partner" માં ₹10,00,000 માટે Add Money કરો.')}
              </div>
            </div>

          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Fields */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "Fields in the Add Money form", "Add Money ફોર્મમાં ફીલ્ડ્સ")}
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Amount:", "રકમ:")}</span>
              <span className="text-muted-foreground">{t(lang, "How much money is being added to this account.", "આ ખાતામાં કેટલા પૈસા ઉમેરવામાં આવી રહ્યા છે.")}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Date:", "તારીખ:")}</span>
              <span className="text-muted-foreground">{t(lang, "The date the money actually arrived (today by default).", "જે તારીખે પૈસા ખરેખર આવ્યા (ડિફૉલ્ટ રૂપે આજની).")}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-medium text-foreground whitespace-nowrap">{t(lang, "Note (optional):", "નોંધ (વૈકલ્પિક):")}</span>
              <span className="text-muted-foreground">{t(lang, 'A short description like "Loan from SBI" or "Amit investment round 1".', '"SBI તરફથી લોન" અથવા "અમિત ઇન્વેસ્ટમેન્ટ રાઉન્ડ 1" જેવું ટૂંકું વર્ણન.')}</span>
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
                  <span className="font-semibold text-foreground">મહત્વપૂર્ણ: </span>
                  "+ Add Money" બટન માત્ર એવા પૈસા રેકોર્ડ કરવા માટે છે જે તમારા વ્યવસાયમાં <span className="font-semibold">આવે</span> છે.
                  ખાતાઓ વચ્ચે પૈસા ટ્રાન્સફર કરવા માટે, New Transaction ફોર્મમાં <span className="font-semibold">Transfer</span> વિકલ્પનો ઉપયોગ કરો.
                  સાઇટ પર પૈસા મોકલવા માટે, <span className="font-semibold">Add Site Fund</span> નો ઉપયોગ કરો.
                </>
              )}
            </p>
          </div>

        </Card>
      </section>

      {/* ── Recheck Balances ── */}
      <section id="recheck-balances">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t(lang, 'The "Recheck Balances" Button — Explained', '"Recheck Balances" બટન — સમજાવેલ')}
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
              આ બટન <Link href="/accounts" className="font-semibold text-primary hover:underline">એકાઉન્ટ્સ પેજ</Link> ની ટોચ-જમણી બાજુએ દેખાય છે.
              તે એક સુરક્ષા સાધન છે જેની તમને ભાગ્યે જ જરૂર પડશે, પરંતુ તે સમજવું ખૂબ જ મહત્વપૂર્ણ છે.
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
              <p className="text-sm font-semibold text-foreground">{t(lang, "What it does", "તે શું કરે છે")}</p>
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
              <p className="text-sm font-medium text-foreground">{t(lang, "Simple analogy", "સરળ સામ્યતા")}</p>
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
            {t(lang, "What will happen when you click it?", "જ્યારે તમે તેના પર ક્લિક કરશો ત્યારે શું થશે?")}
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, '✅ "All balances already match"', '✅ "બધા બેલેન્સ પહેલાથી જ મેચ થાય છે"')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(lang, "Everything is correct. All your account balances match every transaction recorded. No action needed — you are fully up to date.", "બધું બરાબર છે. તમારા બધા ખાતાના બેલેન્સ નોંધાયેલા દરેક વ્યવહાર સાથે મેળ ખાય છે. કોઈ પગલાંની જરૂર નથી — તમે સંપૂર્ણપણે અપ ટુ ડેટ છો.")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5">
              <RefreshCw className="mt-0.5 h-5 w-5 flex-none text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">{t(lang, '⚠️ "Corrected X account balance(s)"', '⚠️ "X ખાતાના બેલેન્સ સુધાર્યા"')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(lang, "A mismatch was found and has been automatically fixed. The balance shown on screen will update to the correct number. This is rare, but can happen if a transaction was edited or deleted after it was first saved.", "અસમાનતા જોવા મળી હતી અને તે આપમેળે સુધારી દેવામાં આવી છે. સ્ક્રીન પર દર્શાવેલ બેલેન્સ સાચા નંબર પર અપડેટ થશે. આ દુર્લભ છે, પરંતુ જો કોઈ વ્યવહાર પ્રથમ વખત સાચવ્યા પછી સંપાદિત કરવામાં આવ્યો હોય અથવા કાઢી નાખવામાં આવ્યો હોય તો આવું થઈ શકે છે.")}
                </p>
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {/* When to use */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(lang, "When should you use it?", "તમારે તેનો ઉપયોગ ક્યારે કરવો જોઈએ?")}
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "The balance shown for an account looks wrong or surprising.", "ખાતા માટે દર્શાવેલ બેલેન્સ ખોટું અથવા આશ્ચર્યજનક લાગે છે.")}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "You just deleted or edited an old transaction and want to be sure everything updated correctly.", "તમે હમણાં જ જૂનો વ્યવહાર કાઢી નાખ્યો છે અથવા સંપાદિત કર્યો છે અને ખાતરી કરવા માંગો છો કે બધું યોગ્ય રીતે અપડેટ થયું છે.")}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-success font-bold">✓</span>
              <span className="text-muted-foreground">
                {t(lang, "At the end of the month, as a quick health check before sharing reports.", "મહિનાના અંતે, રિપોર્ટ્સ શેર કરતા પહેલા ઝડપી આરોગ્ય તપાસ તરીકે.")}
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
                  <span className="font-semibold text-foreground">શું તે સુરક્ષિત છે? હા, સંપૂર્ણપણે. </span>
                  આ બટન ક્યારેય કોઈ વ્યવહાર કાઢી નાખતું નથી અથવા કોઈ ઇતિહાસ બદલતું નથી. તે માત્ર સ્ક્રીન પર દર્શાવેલ અંતિમ બેલેન્સ નંબરને સુધારે છે. તમે તેને કેટલી વાર દબાવો છો તેનાથી કોઈ ફરક પડતો નથી — તે હંમેશા તમને સાચો જવાબ આપશે.
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
            "સેટઅપ પૂર્ણ કર્યા પછી, તમારું ડેશબોર્ડ ઉપલબ્ધ કુલ મૂડી બતાવશે, દરેક સાઇટની અંદર કેટલી રકમ લૉક કરેલી છે, અને જો કોઈ સાઇટ પર ભંડોળ ઓછું હોય તો રીઅલ-ટાઇમ ચેતવણી આપશે."
          )}
        </p>
        <div className="mt-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {t(lang, "Go to Dashboard →", "ડેશબોર્ડ પર જાઓ →")}
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
