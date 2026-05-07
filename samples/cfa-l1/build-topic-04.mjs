// Builder for Topic 04 — Financial Statement Analysis
// Outputs: topic-04-fsa.json
// Run: bun samples/cfa-l1/build-topic-04.mjs

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ts = "2026-05-06T00:00:00Z";
const TOPIC = "04";

const mkId = (lm, sec, leaf) =>
  `cfa${TOPIC}${String(lm).padStart(2, "0")}${String(sec).padStart(2, "0")}-${String(leaf).padStart(4, "0")}-4000-8000-000000000000`;

const R = {
  schweser: "Schweser SchweserNotes Book 3, Study Sessions 6-8",
  mm: "Mark Meldrum CFA L1 — Financial Statement Analysis videos",
  ap: "AnalystPrep CFA L1 — FSA QBank",
};
const stdRes = (rd) => [
  `CFA Institute Curriculum 2026, Volume 3, Reading '${rd}'`,
  R.schweser,
  R.mm,
];

function L(lm, sec, leaf, title, opts) {
  const {
    los = [],
    diff = 2,
    hrs = 0.25,
    prereq = [],
    formulas = [],
    pitfalls = [],
    resources = [],
    tags = [],
    notes = "—",
  } = opts || {};
  const md = `# ${title}\n\n**LOS:** ${los.length ? los.map((l) => "LOS " + l).join(", ") : "—"}\n**Difficulty:** ${diff} · **Estimated:** ${hrs}h\n\n## Opis\n${notes}\n\n## Formuły / kluczowe relacje\n${formulas.length ? formulas.map((f) => "- " + f).join("\n") : "- —"}\n\n## Prerequisites\n${prereq.length ? prereq.map((p) => "- " + p).join("\n") : "- —"}\n\n## Common pitfalls\n${pitfalls.map((p) => "- " + p).join("\n")}\n\n## Suggested resources\n${resources.map((r) => "- " + r).join("\n")}\n`;
  return {
    id: mkId(lm, sec, leaf),
    title,
    status: "not-started",
    type: "task",
    notes: md,
    createdAt: ts,
    updatedAt: ts,
    metadata: {
      los_codes: los,
      difficulty: diff,
      estimated_hours: hrs,
      prerequisites: prereq,
      formulas,
      common_pitfalls: pitfalls,
      suggested_resources: resources,
      tags,
    },
    children: [],
  };
}

function P(lm, sec, title, desc, children) {
  return {
    id: mkId(lm, sec, 0),
    title,
    status: "not-started",
    type: "plan",
    notes: `# ${title}\n\n${desc}\n`,
    createdAt: ts,
    updatedAt: ts,
    metadata: { section_index: String(sec).padStart(2, "0") },
    children,
  };
}

function PH(lm, title, desc, losCount, children) {
  return {
    id: mkId(lm, 0, 0),
    title,
    status: "not-started",
    type: "phase",
    notes: `# ${title}\n\n${desc}\n\n**Learning Modules:** 1 · **Egzamin weight (topic):** 12.5%\n`,
    createdAt: ts,
    updatedAt: ts,
    metadata: {
      lm_index: String(lm).padStart(2, "0"),
      lm_name_canonical: title,
      los_count: losCount,
      topic: "Financial Statement Analysis",
    },
    children,
  };
}

// ---------- LM 01 ----------
const rd1 = "Introduction to Financial Statement Analysis";
const lm1 = PH(
  1,
  rd1,
  "Wprowadzenie do FSA: cele sprawozdawczości, standard setterzy, regulatorzy, opinie audytora i framework analizy.",
  6,
  [
    L(1, 0, 1, "Role and scope of financial reporting", { los: ["1.a"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie financial reporting (proces) z financial statement analysis (output)"], resources: stdRes(rd1), tags: ["concept"], notes: "Sprawozdawczość finansowa dostarcza informacji ekonomicznych użytkownikom zewnętrznym. Analyst używa tych danych do oceny wyników, ryzyka i wartości." }),
    L(1, 0, 2, "Primary financial statements (BS, IS, CF, equity, notes)", { los: ["1.a"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie notes — często zawierają najważniejsze ujawnienia dot. polityk rachunkowości"], resources: stdRes(rd1), tags: ["concept"], notes: "Pełen zestaw: balance sheet, income statement, statement of comprehensive income, statement of changes in equity, statement of cash flows oraz notes." }),
    L(1, 0, 3, "Standard setter — IASB (IFRS Foundation)", { los: ["1.b"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie IASB (standard setter) z IOSCO (regulator)"], resources: stdRes(rd1), tags: ["standard"], notes: "International Accounting Standards Board ustanawia IFRS. Działa pod IFRS Foundation; nie ma władzy egzekwowania." }),
    L(1, 0, 4, "Standard setter — FASB", { los: ["1.b"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie FASB z SEC — FASB tworzy GAAP, SEC egzekwuje"], resources: stdRes(rd1), tags: ["standard"], notes: "Financial Accounting Standards Board tworzy US GAAP. SEC deleguje to uprawnienie do FASB dla spółek publicznych." }),
    L(1, 0, 5, "Regulatory authority — SEC", { los: ["1.b"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie roli SEC ze standard setterem"], resources: stdRes(rd1), tags: ["regulator"], notes: "SEC egzekwuje sprawozdawczość spółek publicznych w USA — Forms 10-K, 10-Q, 8-K, S-1, DEF 14A." }),
    L(1, 0, 6, "Regulatory authority — ESMA", { los: ["1.b"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie ESMA z lokalnymi regulatorami państw członkowskich"], resources: stdRes(rd1), tags: ["regulator"], notes: "European Securities and Markets Authority koordynuje nadzór rynków UE; egzekwowanie pozostaje na poziomie krajowym." }),
    L(1, 0, 7, "Regulatory authority — IOSCO", { los: ["1.b"], diff: 1, hrs: 0.25, pitfalls: ["Traktowanie IOSCO jako standard settera — to forum regulatorów"], resources: stdRes(rd1), tags: ["regulator"], notes: "IOSCO zrzesza regulatorów rynków kapitałowych globalnie; promuje konwergencję IFRS." }),
    L(1, 0, 8, "Financial statement audit — purpose and scope", { los: ["1.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie audytu z gwarancją braku oszustwa — to reasonable assurance, nie absolute"], resources: stdRes(rd1), tags: ["audit"], notes: "Niezależny biegły rewident wydaje opinię, czy sprawozdania są zgodne z standardami i wolne od istotnych zniekształceń." }),
    L(1, 0, 9, "Audit report — Unqualified (clean) opinion", { los: ["1.c"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie 'emphasis-of-matter paragraph' w unqualified — może wskazywać ryzyka"], resources: stdRes(rd1), tags: ["audit"], notes: "Najlepszy typ opinii: sprawozdania we wszystkich istotnych aspektach prezentują wiernie sytuację finansową." }),
    L(1, 0, 10, "Audit report — Qualified opinion", { los: ["1.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie qualified z adverse — qualified to 'except for', adverse to 'do not present fairly'"], resources: stdRes(rd1), tags: ["audit"], notes: "Istotne, ale nie wszechobecne zniekształcenia lub ograniczenie zakresu. Zawiera frazę 'except for'." }),
    L(1, 0, 11, "Audit report — Adverse opinion", { los: ["1.c"], diff: 2, hrs: 0.25, pitfalls: ["Adverse oznacza, że sprawozdania znacząco wprowadzają w błąd"], resources: stdRes(rd1), tags: ["audit"], notes: "Zniekształcenia są istotne i wszechobecne; sprawozdania nie prezentują wiernie sytuacji." }),
    L(1, 0, 12, "Audit report — Disclaimer of opinion", { los: ["1.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie disclaimer z qualified — disclaimer to BRAK opinii"], resources: stdRes(rd1), tags: ["audit"], notes: "Audytor nie zebrał wystarczających dowodów (np. ogromne ograniczenia zakresu, going concern); odmawia opinii." }),
    L(1, 0, 13, "Internal controls and management's report", { los: ["1.c"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie SOX 404 — wymaga oceny ICFR przez management i audytora dla US issuers"], resources: stdRes(rd1), tags: ["audit", "standard"], notes: "Management odpowiada za system kontroli nad sprawozdawczością. SOX 302/404 wymaga certyfikacji CEO/CFO i opinii audytora." }),
    L(1, 0, 14, "Other information sources — MD&A, proxy, press releases", { los: ["1.d"], diff: 1, hrs: 0.25, pitfalls: ["Skupianie się tylko na sprawozdaniach — MD&A często zawiera forward-looking informacje"], resources: stdRes(rd1), tags: ["analysis"], notes: "MD&A, proxy statement, prasy i konferencje analityków uzupełniają obraz." }),
    L(1, 0, 15, "Financial statement analysis framework — six steps", { los: ["1.e"], diff: 2, hrs: 0.5, pitfalls: ["Pomijanie kroku define purpose — zła kalibracja celu prowadzi do złej analizy"], resources: stdRes(rd1), tags: ["framework"], notes: "Sześć kroków: (1) define purpose, (2) collect data, (3) process, (4) analyze, (5) conclusions, (6) follow-up." }),
  ],
);

// ---------- LM 02 — Analyzing Income Statements ----------
const rd2 = "Analyzing Income Statements";
const lm2 = PH(2, rd2, "Analiza rachunku zysków i strat: revenue recognition (IFRS 15 / ASC 606), expense recognition, non-recurring items, EPS oraz comprehensive income.", 7, [
  P(2, 1, "Revenue recognition (IFRS 15 / ASC 606)", "Pięcio-stopniowy model rozpoznania przychodu wg IFRS 15 i ASC 606.", [
    L(2, 1, 1, "IFRS 15 / ASC 606 — overview & convergence", { los: ["2.a"], diff: 2, hrs: 0.5, pitfalls: ["Założenie, że IFRS 15 i ASC 606 są identyczne — drobne różnice w licensing, shipping, collectibility"], resources: stdRes(rd2), tags: ["standard", "ifrs-gaap-diff"], notes: "Wspólny standard IFRS 15 / ASC 606 zastąpił rozproszone wcześniej zasady; cel — rozpoznać przychód odzwierciedlający transfer kontroli nad goods/services za oczekiwane wynagrodzenie." }),
    L(2, 1, 2, "Step 1 — Identify the contract with a customer", { los: ["2.a"], diff: 2, hrs: 0.25, pitfalls: ["Zakładanie, że ustny porozumienie nie jest kontraktem — może być, jeśli enforceable"], resources: stdRes(rd2), tags: ["standard"], notes: "Kontrakt: enforceable agreement, zatwierdzony, identyfikuje rights/payment terms, ma commercial substance, wpłata jest probable." }),
    L(2, 1, 3, "Step 2 — Identify the performance obligations", { los: ["2.a"], diff: 3, hrs: 0.5, pitfalls: ["Niepoprawne grupowanie — distinct goods/services muszą być oddzielnymi PO"], resources: stdRes(rd2), tags: ["standard"], notes: "Performance obligation = przyrzeczenie dostarczenia distinct good/service. Distinct: klient może z niego korzystać samodzielnie i jest osobno identyfikowalne w kontrakcie." }),
    L(2, 1, 4, "Step 3 — Determine the transaction price", { los: ["2.a"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie variable consideration — należy oszacować i ograniczyć"], resources: stdRes(rd2), tags: ["standard"], formulas: ["Transaction price = fixed + variable consideration (constrained) + non-cash + consideration payable to customer"], notes: "Kwota wynagrodzenia oczekiwanego za dostarczenie goods/services. Zawiera variable consideration (z ograniczeniem), significant financing component, non-cash." }),
    L(2, 1, 5, "Step 4 — Allocate the transaction price to performance obligations", { los: ["2.a"], diff: 3, hrs: 0.5, pitfalls: ["Stosowanie cen kontraktowych zamiast standalone selling prices (SSP)"], resources: stdRes(rd2), tags: ["standard"], notes: "Alokacja w oparciu o relative standalone selling prices każdego PO. Jeśli SSP nieobserwowalne — estymowane (adjusted market, expected cost plus margin, residual)." }),
    L(2, 1, 6, "Step 5 — Recognize revenue when (or as) performance obligation is satisfied", { los: ["2.a"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie point-in-time z over-time — kryteria over-time muszą być ściśle spełnione"], resources: stdRes(rd2), tags: ["standard"], notes: "Revenue rozpoznawane gdy kontrola przechodzi na klienta. Over-time gdy spełnione kryteria (klient otrzymuje benefits w trakcie, asset has no alternative use, etc.)." }),
    L(2, 1, 7, "Disclosures required by IFRS 15 / ASC 606", { los: ["2.a"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie disaggregation — istotne dla analizy segmentów i typów kontraktów"], resources: stdRes(rd2), tags: ["standard", "disclosure"], notes: "Wymagane: disaggregation of revenue, contract balances, performance obligations, significant judgments, costs to obtain/fulfill contracts." }),
  ]),
  P(2, 2, "Expense recognition", "Zasady ujmowania kosztów: matching, capitalize vs expense, oraz szacunki.", [
    L(2, 2, 1, "Expense recognition / matching principle", { los: ["2.b"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie matching z cash-basis — koszty matchowane do okresu przychodów, nie do daty płatności"], resources: stdRes(rd2), tags: ["concept"], notes: "Koszty bezpośrednio związane z przychodem ujmuje się w tym samym okresie (matching). Pozostałe — gdy poniesione (period costs)." }),
    L(2, 2, 2, "Capitalizing vs expensing — decision and impact", { los: ["2.c"], diff: 3, hrs: 0.5, pitfalls: ["Niedocenianie wpływu na trendy zysków: capitalize wygładza, expense w pełni obciąża okres"], resources: stdRes(rd2), tags: ["concept"], formulas: ["Capitalize → asset on BS, depreciation/amortization expense over life", "Expense → full hit to current period earnings"], notes: "Capitalize: wydatek staje się aktywem, koszt rozliczany przez useful life. Expense: pełny koszt w bieżącym okresie. Wpływ: na earnings, CFO vs CFI, leverage, ROA." }),
    L(2, 2, 3, "Capitalized interest", { los: ["2.c"], diff: 3, hrs: 0.5, pitfalls: ["Stosowanie wszystkich odsetek — kapitalizuje się tylko tę część związaną z aktywem w trakcie jego budowy"], resources: stdRes(rd2), tags: ["formula"], formulas: ["Capitalized interest = average accumulated expenditures × interest rate"], notes: "Odsetki od pożyczek finansujących budowę kwalifikującego się aktywa są kapitalizowane do kosztu wytworzenia (zarówno IFRS jak US GAAP)." }),
    L(2, 2, 4, "Accounting estimates — useful life, residual value, bad debts, warranty", { los: ["2.b"], diff: 2, hrs: 0.25, pitfalls: ["Niedocenianie subiektywności — agresywne szacunki zawyżają zyski"], resources: stdRes(rd2), tags: ["concept", "quality"], notes: "Sprawozdania wymagają licznych szacunków: useful life, salvage value, doubtful accounts, warranty, pension assumptions. Ujawnienia w notes — kluczowe dla quality of earnings." }),
  ]),
  P(2, 3, "Non-recurring items", "Discontinued operations, unusual items i ich rola w analizie.", [
    L(2, 3, 1, "Non-recurring items — concept and analytical treatment", { los: ["2.d"], diff: 2, hrs: 0.25, pitfalls: ["Włączanie non-recurring do bazy ekstrapolacji — zniekształca forecast"], resources: stdRes(rd2), tags: ["concept"], notes: "Pozycje nieoperacyjne lub nietypowe (gains/losses on disposal, restructuring, impairments) — analityk separuje od core earnings dla forecastu i wyceny." }),
    L(2, 3, 2, "Discontinued operations", { los: ["2.d"], diff: 2, hrs: 0.25, pitfalls: ["Ujmowanie discontinued ops w continuing earnings"], resources: stdRes(rd2), tags: ["concept"], notes: "Część biznesu sprzedana lub przeznaczona do sprzedaży, prezentowana oddzielnie poniżej linii continuing operations, net of tax. Comparative periods restated." }),
    L(2, 3, 3, "Unusual or infrequent items", { los: ["2.d"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że jednorazowe — często pojawiają się rok do roku w zmodyfikowanej formie"], resources: stdRes(rd2), tags: ["concept"], notes: "Rare/unusual albo infrequent (od 2015 brak kategorii 'extraordinary' w US GAAP). Ujawniane oddzielnie w continuing operations, gross of tax." }),
    L(2, 3, 4, "Changes in accounting policy, estimate, errors", { los: ["2.d"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie change in policy (retrospective) z change in estimate (prospective)"], resources: stdRes(rd2), tags: ["concept", "standard"], notes: "Change in policy: retrospective restatement. Change in estimate: prospective. Error: retrospective restatement of prior periods." }),
  ]),
  P(2, 4, "Earnings per share", "EPS basic, diluted (treasury stock method, if-converted), oraz interpretacja.", [
    L(2, 4, 1, "Capital structure — simple vs complex", { los: ["2.e"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że spółka bez warrantów ma simple structure — convertible debt też komplikuje"], resources: stdRes(rd2), tags: ["concept"], notes: "Simple: tylko common stock i non-convertible preferred. Complex: ma dilutive securities (options, warrants, convertibles) — wymaga diluted EPS." }),
    L(2, 4, 2, "Basic EPS", { los: ["2.e"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie preferred dividends w liczniku", "Niepoprawne ważenie shares przez okres"], resources: stdRes(rd2), tags: ["formula", "ratio"], formulas: ["Basic EPS = (Net income − Preferred dividends) / Weighted average common shares outstanding"], notes: "Wymagane do prezentacji na IS. Preferred dividends odejmowane bez względu na declaration jeśli cumulative." }),
    L(2, 4, 3, "Diluted EPS — treasury stock method (options & warrants)", { los: ["2.e"], diff: 3, hrs: 0.5, pitfalls: ["Stosowanie wszystkich opcji — tylko in-the-money są dilutive", "Pomijanie warunku 'dilutive' — anti-dilutive opcji nie wlicza się"], resources: stdRes(rd2), tags: ["formula", "ratio"], formulas: ["Incremental shares = N × (1 − exercise price / avg market price)"], notes: "Treasury stock method: zakłada wykonanie opcji za exercise price, a wpływy użyte do odkupu akcji po average market price. Net incremental shares dodawane do mianownika." }),
    L(2, 4, 4, "Diluted EPS — if-converted method (convertible debt)", { los: ["2.e"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie tax effect na interest add-back", "Stosowanie nawet gdy anti-dilutive"], resources: stdRes(rd2), tags: ["formula", "ratio"], formulas: ["Diluted EPS (conv debt) = (NI − Pref div + Interest × (1 − t)) / (WASO + Conv shares)"], notes: "Konwertowalny dług: zakładamy konwersję, dodajemy odsetki po podatku do licznika i nowe akcje do mianownika. Stosujemy tylko jeśli wynik jest dilutive." }),
    L(2, 4, 5, "Diluted EPS — if-converted method (convertible preferred)", { los: ["2.e"], diff: 3, hrs: 0.5, pitfalls: ["Zapominanie o dodaniu z powrotem preferred dividend do licznika"], resources: stdRes(rd2), tags: ["formula", "ratio"], formulas: ["Diluted EPS (conv pref) = NI / (WASO + Conv shares from preferred)"], notes: "Konwertowalne preferred: licznik = NI (nie odejmujemy preferred dividend), mianownik powiększony o akcje z konwersji. Tylko jeśli dilutive." }),
    L(2, 4, 6, "Anti-dilutive securities — exclusion rule", { los: ["2.e"], diff: 2, hrs: 0.25, pitfalls: ["Mechaniczne dodawanie wszystkich convertibles bez sprawdzenia, czy zwiększają EPS"], resources: stdRes(rd2), tags: ["concept"], notes: "Security jest anti-dilutive jeśli włączenie zwiększa EPS lub zmniejsza loss per share. Wykluczamy z diluted EPS calculation." }),
  ]),
  P(2, 5, "Common-size income statement and comprehensive income", "Common-size analysis IS, OCI i comprehensive income.", [
    L(2, 5, 1, "Common-size income statement", { los: ["2.f"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie horizontal (% change YoY) z vertical (% of revenue)"], resources: stdRes(rd2), tags: ["analysis"], formulas: ["Each line item / Revenue"], notes: "Każda pozycja IS jako % przychodów — pozwala porównywać firmy o różnej skali i analizować trendy marż." }),
    L(2, 5, 2, "Comprehensive income vs net income", { los: ["2.g"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie OCI przy ROE — comprehensive equity może istotnie różnić się od retained earnings"], resources: stdRes(rd2), tags: ["concept"], formulas: ["Comprehensive income = Net income + Other comprehensive income (OCI)"], notes: "Net income + OCI = comprehensive income. Pełen obraz zmian w equity z wyłączeniem transakcji z właścicielami." }),
    L(2, 5, 3, "OCI components", { los: ["2.g"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie 'recyclable' (FX, hedging) z 'non-recyclable' (revaluation, pension remeasurements)"], resources: stdRes(rd2), tags: ["concept", "standard"], notes: "OCI: foreign currency translation, cash flow hedge gains/losses, gains/losses on debt securities at FVOCI, defined benefit pension remeasurements, IFRS revaluation surplus." }),
  ]),
]);

// ---------- LM 03 — Analyzing Balance Sheets ----------
const rd3 = "Analyzing Balance Sheets";
const lm3 = PH(3, rd3, "Analiza bilansu: klasyfikacja aktywów/pasywów, wycena, equity, common-size BS, ratios bilansowe.", 6, [
  P(3, 1, "Asset classification and valuation", "Klasyfikacja current vs non-current i metody wyceny aktywów.", [
    L(3, 1, 1, "Current vs non-current asset classification", { los: ["3.a"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie kryterium 12 months z operating cycle — używamy dłuższego z dwóch"], resources: stdRes(rd3), tags: ["concept"], notes: "Current asset: oczekiwany do realizacji/konsumpcji w cyklu operacyjnym lub 12 miesięcy. Pozostałe — non-current." }),
    L(3, 1, 2, "Asset valuation — historical cost", { los: ["3.b"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że historical cost = obecna wartość rynkowa"], resources: stdRes(rd3), tags: ["concept"], notes: "Historical cost = cena nabycia plus koszty doprowadzenia do użytku. Default dla PP&E i intangibles z określonym życiem (US GAAP), początkowo również w IFRS." }),
    L(3, 1, 3, "Asset valuation — fair value", { los: ["3.b"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie fair value z replacement cost"], resources: stdRes(rd3), tags: ["concept", "standard"], notes: "Fair value (IFRS 13 / ASC 820): cena, którą otrzymano by za sprzedaż aktywa w transakcji rynkowej między uczestnikami rynku. Hierarchia poziomów 1/2/3." }),
    L(3, 1, 4, "Asset valuation — present value", { los: ["3.b"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie wpływu zmian stóp dyskontowych na wartość bieżącą"], resources: stdRes(rd3), tags: ["concept"], formulas: ["PV = future cash flows / (1 + r)^n"], notes: "Wycena oparta na zdyskontowanych przyszłych przepływach pieniężnych. Stosowana m.in. do leasingu, zobowiązań długoterminowych, aktywów emerytalnych." }),
  ]),
  P(3, 2, "Liability classification and equity", "Klasyfikacja zobowiązań i komponenty equity.", [
    L(3, 2, 1, "Current vs non-current liability classification", { los: ["3.a"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie clauses przyspieszających wymagalność (covenant breach) — może przeklasyfikować non-current na current"], resources: stdRes(rd3), tags: ["concept"], notes: "Current liability: oczekiwana do uregulowania w cyklu operacyjnym lub 12 miesięcy. Pozostałe — non-current." }),
    L(3, 2, 2, "Equity components", { los: ["3.c"], diff: 2, hrs: 0.5, pitfalls: ["Mylenie treasury stock (kontra-equity) z retained earnings"], resources: stdRes(rd3), tags: ["concept"], notes: "Komponenty: contributed capital (common, preferred, APIC), retained earnings, treasury stock (kontra), accumulated OCI (AOCI), non-controlling interest (jeśli skonsolidowany)." }),
    L(3, 2, 3, "Common-size balance sheet", { los: ["3.d"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie horizontal z vertical analysis BS"], resources: stdRes(rd3), tags: ["analysis"], formulas: ["Each line item / Total assets"], notes: "Każda pozycja BS jako % total assets — ułatwia porównanie struktury aktywów/pasywów między firmami i okresami." }),
  ]),
  P(3, 3, "Balance sheet ratios", "Główne ratios liczenione bezpośrednio z BS.", [
    L(3, 3, 1, "Liquidity ratios from BS — overview", { los: ["3.d"], diff: 1, hrs: 0.25, pitfalls: ["Założenie wysokiej liquidity bez analizy struktury current assets — inventory może być slow-moving"], resources: stdRes(rd3), tags: ["ratio"], notes: "Wskaźniki liczone z BS: current ratio, quick ratio, cash ratio. Pełna analiza w LM Financial Analysis Techniques." }),
    L(3, 3, 2, "Solvency ratios from BS — overview", { los: ["3.d"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie off-balance-sheet financing przy ocenie leverage"], resources: stdRes(rd3), tags: ["ratio"], notes: "Wskaźniki: debt-to-assets, debt-to-equity, financial leverage. Wszystkie z numerami z BS." }),
  ]),
]);

// ---------- LM 04 — Analyzing Statements of Cash Flows I ----------
const rd4 = "Analyzing Statements of Cash Flows I";
const lm4 = PH(4, rd4, "Konstrukcja statement of cash flows: sekcje operacyjna/inwestycyjna/finansowa, metody direct i indirect, IFRS vs US GAAP.", 6, [
  P(4, 1, "Cash flow sections", "Trzy sekcje statement of cash flows i ich zawartość.", [
    L(4, 1, 1, "Operating section (CFO)", { los: ["4.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie operating cash flow z net income"], resources: stdRes(rd4), tags: ["concept"], notes: "CFO: przepływy z core działalności (sprzedaż, dostawy, płace, podatki). Najważniejsza sekcja dla oceny zdolności generowania gotówki." }),
    L(4, 1, 2, "Investing section (CFI)", { los: ["4.a"], diff: 2, hrs: 0.25, pitfalls: ["Włączanie zakupów inventory do CFI — to operating"], resources: stdRes(rd4), tags: ["concept"], notes: "CFI: nabycie/sprzedaż long-lived assets (PP&E, intangibles), inwestycji w innych firmach, papierów (poza tradable). Capital expenditure (CapEx) tutaj." }),
    L(4, 1, 3, "Financing section (CFF)", { los: ["4.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie odsetek zapłaconych z financing — w US GAAP to CFO; IFRS daje wybór"], resources: stdRes(rd4), tags: ["concept"], notes: "CFF: emisja/spłata długu, emisja/skup akcji, dywidendy wypłacone. Pokazuje, jak firma pozyskuje i zwraca kapitał." }),
  ]),
  P(4, 2, "Direct vs indirect method", "Dwie metody prezentacji CFO.", [
    L(4, 2, 1, "Direct method", { los: ["4.b"], diff: 2, hrs: 0.5, pitfalls: ["Mylenie revenue z cash collected from customers"], resources: stdRes(rd4), tags: ["concept"], formulas: ["Cash collected from customers = Revenue − ΔAR", "Cash paid to suppliers = COGS + ΔInventory − ΔAP"], notes: "Bezpośrednio listuje cash inflows/outflows operacyjne (cash from customers, cash to suppliers). Preferowane przez analyst — bardziej informacyjne. IFRS i US GAAP zachęcają, ale rzadko stosowane." }),
    L(4, 2, 2, "Indirect method", { los: ["4.b"], diff: 2, hrs: 0.5, pitfalls: ["Niewłaściwy znak korekty — ΔAR↑ to use of cash, ΔAP↑ to source"], resources: stdRes(rd4), tags: ["concept"], formulas: ["CFO = NI + non-cash charges (D&A) − gains + losses + changes in working capital (− ΔAR − ΔInv + ΔAP itp.)"], notes: "Zaczyna od net income i koryguje o non-cash items (D&A, gain/loss z aktywów) oraz zmiany w working capital. Najczęściej stosowana praktyka." }),
    L(4, 2, 3, "Conversion from indirect to direct method", { los: ["4.b"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie roli zmian working capital przy konwersji — działają w obu kierunkach"], resources: stdRes(rd4), tags: ["formula"], formulas: ["Cash collected from customers = Sales − ΔAR + ΔUnearned revenue", "Cash paid to suppliers = −COGS − ΔInventory + ΔAP", "Cash paid for SG&A = −SG&A + ΔPrepaid expenses + ΔAccrued liabilities"], notes: "Konwersja wymaga rozłożenia każdej linii IS na cash component przez korekty z working capital." }),
  ]),
  P(4, 3, "IFRS vs US GAAP — interest and dividends classification", "Każda para interest/dividend paid/received jako oddzielny leaf IFRS-vs-GAAP difference.", [
    L(4, 3, 1, "Interest paid — IFRS vs US GAAP classification", { los: ["4.c"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że klasyfikacja jest taka sama — IFRS daje wybór CFO/CFF, US GAAP wymaga CFO"], resources: stdRes(rd4), tags: ["ifrs-gaap-diff"], notes: "US GAAP: odsetki zapłacone w CFO. IFRS: wybór CFO lub CFF; preferencja — gdy uznaje się za koszt finansowania, w CFF." }),
    L(4, 3, 2, "Interest received — IFRS vs US GAAP classification", { los: ["4.c"], diff: 2, hrs: 0.25, pitfalls: ["Symetryczne traktowanie z paid — w US GAAP też w CFO, ale logika ekonomiczna różna"], resources: stdRes(rd4), tags: ["ifrs-gaap-diff"], notes: "US GAAP: odsetki otrzymane w CFO. IFRS: wybór CFO lub CFI; często CFI gdy są zwrotem z inwestycji." }),
    L(4, 3, 3, "Dividends paid — IFRS vs US GAAP classification", { los: ["4.c"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie tej różnicy — może istotnie zmienić CFO przy porównaniach cross-border"], resources: stdRes(rd4), tags: ["ifrs-gaap-diff"], notes: "US GAAP: dywidendy wypłacone w CFF. IFRS: wybór CFO lub CFF; CFF najczęściej." }),
    L(4, 3, 4, "Dividends received — IFRS vs US GAAP classification", { los: ["4.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z dividends paid — kierunki ekonomiczne odwrotne"], resources: stdRes(rd4), tags: ["ifrs-gaap-diff"], notes: "US GAAP: dywidendy otrzymane w CFO. IFRS: wybór CFO lub CFI." }),
    L(4, 3, 5, "Taxes paid — IFRS vs US GAAP classification", { los: ["4.c"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie alternative klasyfikacji w IFRS"], resources: stdRes(rd4), tags: ["ifrs-gaap-diff"], notes: "US GAAP: zawsze CFO. IFRS: zazwyczaj CFO; ale jeśli można specifically zidentyfikować z investing/financing — wtedy tam." }),
  ]),
]);

// ---------- LM 05 — Analyzing Statements of Cash Flows II ----------
const rd5 = "Analyzing Statements of Cash Flows II";
const lm5 = PH(5, rd5, "Analiza CF: free cash flow (FCFF, FCFE), cash flow ratios, common-size CF.", 5, [
  P(5, 1, "Free cash flow", "FCFF i FCFE liczone z CFO.", [
    L(5, 1, 1, "FCFF calculation from CFO", { los: ["5.a"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie tax effect na interest add-back", "Mylenie FCFF z CFO − CapEx (to nie jest FCFF, jeśli odsetki w CFO)"], resources: stdRes(rd5), tags: ["formula", "valuation"], formulas: ["FCFF = CFO + Interest × (1 − t) − CapEx", "(jeśli interest jest w CFO, jak w US GAAP)"], notes: "Free cash flow to firm: gotówka dostępna dla wszystkich kapitałodawców (debt + equity) po pokryciu CapEx i potrzeb operacyjnych. Punkt wyjścia DCF." }),
    L(5, 1, 2, "FCFE calculation from CFO", { los: ["5.a"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie net borrowing — istotne źródło FCFE", "Mylenie FCFE z dywidendami"], resources: stdRes(rd5), tags: ["formula", "valuation"], formulas: ["FCFE = CFO − CapEx + Net borrowing", "FCFE = FCFF − Interest × (1 − t) + Net borrowing"], notes: "Free cash flow to equity: gotówka dostępna dla akcjonariuszy po pokryciu CapEx, opłaceniu kredytodawców i emisji/spłacie długu. Wykorzystywane w FCFE valuation model." }),
  ]),
  P(5, 2, "Cash flow analysis and ratios", "Analiza CF i kluczowe wskaźniki.", [
    L(5, 2, 1, "Common-size statement of cash flows", { los: ["5.b"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie revenue jako baza dla wszystkich pozycji — niektóre lepiej do total inflows/outflows"], resources: stdRes(rd5), tags: ["analysis"], notes: "Common-size CF: każda pozycja jako % revenue lub jako % total inflows/outflows w danej sekcji. Pozwala porównać efektywność konwersji NI na CFO." }),
    L(5, 2, 2, "Cash flow ratios — performance", { los: ["5.b"], diff: 2, hrs: 0.5, pitfalls: ["Mylenie cash flow margin z net margin"], resources: stdRes(rd5), tags: ["ratio"], formulas: ["Cash flow to revenue = CFO / Net revenue", "Cash return on assets = CFO / Average total assets", "Cash return on equity = CFO / Average shareholders equity", "Cash flow per share = (CFO − Preferred dividends) / Weighted avg common shares"], notes: "Wskaźniki performance oparte na CFO są bardziej odporne na manipulacje niż oparte na NI." }),
    L(5, 2, 3, "Cash flow ratios — coverage", { los: ["5.b"], diff: 2, hrs: 0.5, pitfalls: ["Pomijanie capex w ocenie wolnej gotówki"], resources: stdRes(rd5), tags: ["ratio"], formulas: ["Debt coverage = CFO / Total debt", "Interest coverage (CF) = (CFO + Interest paid + Taxes paid) / Interest paid", "Reinvestment ratio = CFO / Cash paid for long-term assets", "Dividend payment ratio (CF) = CFO / Dividends paid"], notes: "Coverage ratios mierzą zdolność CFO do pokrycia zobowiązań. Niski poziom — sygnał ostrzegawczy." }),
  ]),
]);

// ---------- LM 06 — Analysis of Inventories ----------
const rd6 = "Analysis of Inventories";
const lm6 = PH(6, rd6, "Analiza zapasów (IAS 2 / ASC 330): metody kosztowe, LIFO reserve, LIFO liquidation, writedowns, IFRS-vs-GAAP.", 6, [
  P(6, 1, "Cost flow methods", "FIFO, LIFO, weighted average, specific identification.", [
    L(6, 1, 1, "FIFO (first-in, first-out)", { los: ["6.a"], diff: 2, hrs: 0.5, pitfalls: ["Mylenie ze średnim kosztem — FIFO przypisuje konkretne ceny do konkretnych jednostek"], resources: stdRes(rd6), tags: ["concept", "standard"], notes: "FIFO: najstarsze koszty trafiają w COGS, najnowsze pozostają w ending inventory. W rosnących cenach: niższy COGS, wyższy zysk, wyższy ending inventory bliższy current cost." }),
    L(6, 1, 2, "LIFO (last-in, first-out)", { los: ["6.a"], diff: 2, hrs: 0.5, pitfalls: ["Stosowanie LIFO pod IFRS — IFRS zakazuje LIFO"], resources: stdRes(rd6), tags: ["concept", "standard", "ifrs-gaap-diff"], notes: "LIFO: najnowsze koszty w COGS, najstarsze w ending inventory. Dozwolone TYLKO w US GAAP. Korzystne podatkowo w okresach inflacji (LIFO conformity rule)." }),
    L(6, 1, 3, "Weighted average cost", { los: ["6.a"], diff: 2, hrs: 0.5, pitfalls: ["Niewłaściwa kalkulacja przy systemie perpetual vs periodic"], resources: stdRes(rd6), tags: ["concept", "standard"], formulas: ["Weighted avg cost per unit = Total cost of goods available / Total units available"], notes: "Średni koszt wszystkich jednostek dostępnych. Dozwolone pod IFRS i US GAAP. Wyniki pomiędzy FIFO a LIFO." }),
    L(6, 1, 4, "Specific identification", { los: ["6.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że jest praktyczne dla wszystkich firm — tylko dla wysokowartościowych unikatowych pozycji"], resources: stdRes(rd6), tags: ["concept", "standard"], notes: "Każda jednostka identyfikowana z konkretnym kosztem. Wymagane dla nie-wymiennych zapasów (np. samochody, biżuteria). Dozwolone pod IFRS i US GAAP." }),
  ]),
  P(6, 2, "Effect of method choice", "Wpływ na COGS, gross margin, ending inventory pod różnymi cenami.", [
    L(6, 2, 1, "Effect on COGS — rising vs falling prices", { los: ["6.b"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie kierunku — w rosnących cenach LIFO ma WYŻSZY COGS niż FIFO"], resources: stdRes(rd6), tags: ["concept"], notes: "Rosnące ceny: LIFO COGS > FIFO COGS. Spadające ceny: LIFO COGS < FIFO COGS. Weighted avg pomiędzy. W stabilnych cenach: identyczne." }),
    L(6, 2, 2, "Effect on gross margin and earnings", { los: ["6.b"], diff: 3, hrs: 0.25, pitfalls: ["Niedocenianie efektu na podatkach — LIFO przy rosnących cenach daje niższy zysk i niższe podatki"], resources: stdRes(rd6), tags: ["concept"], notes: "Rosnące ceny: LIFO niższy gross margin, niższy NI, niższe podatki, wyższy CFO (oszczędności podatkowe). FIFO odwrotnie." }),
    L(6, 2, 3, "Effect on ending inventory", { los: ["6.b"], diff: 3, hrs: 0.25, pitfalls: ["Założenie, że LIFO inventory na BS jest realistyczne — może być znacznie poniżej current cost"], resources: stdRes(rd6), tags: ["concept"], notes: "Rosnące ceny: LIFO ending inventory < FIFO (i < current cost — co zniekształca BS). FIFO ending inventory bliska current cost." }),
  ]),
  P(6, 3, "LIFO-specific issues", "LIFO reserve, liquidation, conversion.", [
    L(6, 3, 1, "LIFO reserve", { los: ["6.c"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie tax effect przy konwersji"], resources: stdRes(rd6), tags: ["formula", "ifrs-gaap-diff"], formulas: ["LIFO reserve = FIFO inventory − LIFO inventory"], notes: "Różnica między wyceną zapasów FIFO a LIFO. Ujawniana w notes przez US GAAP companies. Używana do konwersji LIFO→FIFO dla porównań." }),
    L(6, 3, 2, "LIFO liquidation", { los: ["6.c"], diff: 4, hrs: 0.5, pitfalls: ["Traktowanie zysku z liquidation jako sustainable — to jednorazowy efekt, nie core earnings"], resources: stdRes(rd6), tags: ["concept"], notes: "Gdy LIFO firm sprzedaje więcej niż kupuje — stare, niskie koszty trafiają w COGS, sztucznie zawyżając gross margin i NI. Analyst korygował earnings o ten efekt." }),
    L(6, 3, 3, "LIFO → FIFO conversion adjustment", { los: ["6.c"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie tax effect przy retained earnings"], resources: stdRes(rd6), tags: ["formula", "ifrs-gaap-diff"], formulas: ["FIFO inventory = LIFO inventory + LIFO reserve", "FIFO COGS = LIFO COGS − ΔLIFO reserve", "FIFO retained earnings = LIFO retained earnings + LIFO reserve × (1 − t)", "FIFO cash = LIFO cash − LIFO reserve × t"], notes: "Konwersja LIFO firm na pseudo-FIFO dla porównania z konkurencją. Standardowy zestaw 4 korekt: inventory↑, COGS↓, RE↑, cash↓ (po tax)." }),
  ]),
  P(6, 4, "Inventory writedowns", "LCM, NRV i reversal.", [
    L(6, 4, 1, "Inventory writedown — LCM (US GAAP)", { los: ["6.d"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie market w LCM (replacement cost ograniczone NRV i NRV − normal margin) z fair value"], resources: stdRes(rd6), tags: ["standard", "ifrs-gaap-diff"], notes: "Pre-2015 US GAAP (i nadal LIFO/retail): Lower of Cost or Market, gdzie Market = replacement cost ograniczone do NRV (ceiling) i NRV − normal profit margin (floor). Odpis trwały." }),
    L(6, 4, 2, "Inventory writedown — NRV (IFRS and US GAAP non-LIFO)", { los: ["6.d"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie NRV z fair value — NRV uwzględnia cost to complete i sell"], resources: stdRes(rd6), tags: ["standard", "ifrs-gaap-diff"], formulas: ["NRV = estimated selling price − costs to complete − costs to sell"], notes: "IFRS oraz post-2015 US GAAP (poza LIFO/retail): Lower of Cost or NRV. Odpis na różnicę między cost a NRV." }),
    L(6, 4, 3, "Reversal of inventory writedown — IFRS vs US GAAP", { los: ["6.d"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że US GAAP też pozwala na reversal — to FAŁSZ"], resources: stdRes(rd6), tags: ["ifrs-gaap-diff"], notes: "IFRS: dozwolone odwrócenie odpisu (do pierwotnego kosztu) jeśli przyczyna ustąpiła. US GAAP: ZAKAZ odwrócenia — odpis trwały." }),
  ]),
]);

// ---------- LM 07 — Analysis of Long-Term Assets ----------
const rd7 = "Analysis of Long-Term Assets";
const lm7 = PH(7, rd7, "Analiza długoterminowych aktywów (IAS 16, IAS 38, IAS 36, ASC 360, ASC 350): kapitalizacja, depreciation, impairment, revaluation, intangibles, goodwill, R&D.", 8, [
  P(7, 1, "Capitalization vs expensing", "Decyzja kapitalizacja vs expense oraz kapitalizowane odsetki.", [
    L(7, 1, 1, "Capitalization vs expensing — long-lived assets", { los: ["7.a"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że wybór jest dyskrecjonalny — istnieją kryteria standardów (przyszłe korzyści, mierzalność)"], resources: stdRes(rd7), tags: ["concept"], formulas: ["Capitalize → asset on BS, depreciation expense over useful life", "Expense → full hit to current period earnings"], notes: "Kapitalizujemy gdy aktywo zapewnia przyszłe korzyści > 1 rok. Wpływ na earnings smoothing, CFO vs CFI, ROA, leverage. Często analyst koryguje aggressive capitalizers." }),
    L(7, 1, 2, "Capitalization of subsequent expenditures", { los: ["7.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie repairs/maintenance (expense) z improvements/betterments (capitalize)"], resources: stdRes(rd7), tags: ["concept"], notes: "Wydatki zwiększające future benefits (extension of life, productivity) — kapitalizujemy. Repairs i maintenance — expense w okresie." }),
  ]),
  P(7, 2, "Depreciation methods", "Trzy metody amortyzacji oraz parametry.", [
    L(7, 2, 1, "Depreciation — straight-line method", { los: ["7.b"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie residual value w mianowniku"], resources: stdRes(rd7), tags: ["formula"], formulas: ["Depreciation expense = (Cost − Salvage value) / Useful life"], notes: "Najczęściej stosowana — równe obciążenie w każdym roku. Daje najwyższy NI we wczesnych latach (vs accelerated)." }),
    L(7, 2, 2, "Depreciation — double-declining balance method", { los: ["7.b"], diff: 2, hrs: 0.5, pitfalls: ["Stosowanie residual value w mianowniku — DDB nie odejmuje go początkowo, tylko zatrzymuje gdy carrying = salvage"], resources: stdRes(rd7), tags: ["formula"], formulas: ["DDB rate = 2 / Useful life", "Depreciation = (2 / N) × Beginning carrying value"], notes: "Accelerated method: większe obciążenie wcześnie, mniejsze późno. Stosujemy do BV minus salvage; przestajemy gdy BV = salvage." }),
    L(7, 2, 3, "Depreciation — units of production method", { los: ["7.b"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z time-based methods — UOP zależy od użycia, nie czasu"], resources: stdRes(rd7), tags: ["formula"], formulas: ["Depreciation per unit = (Cost − Salvage) / Total expected units", "Period depreciation = Per-unit × Units used in period"], notes: "Amortyzacja proporcjonalna do faktycznego użytkowania (godziny pracy, wyprodukowane jednostki). Stosowane gdy zużycie skorelowane z produkcją." }),
    L(7, 2, 4, "Useful life and residual value estimation", { los: ["7.b"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie subiektywności — agresywne wydłużenie useful life zaniża depreciation i zawyża zysk"], resources: stdRes(rd7), tags: ["concept", "quality"], notes: "Useful life i residual value to szacunki management. Zmiany — prospektywnie. Analyst porównuje z peer industry; długie życie i wysoki residual = sygnał ostrzegawczy." }),
    L(7, 2, 5, "Component depreciation — IFRS vs US GAAP", { los: ["7.b"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że US GAAP wymaga component depreciation — tylko IFRS wymaga"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 16): WYMAGA component depreciation — każda istotna część PP&E o różnym useful life amortyzowana oddzielnie (np. dach budynku osobno od konstrukcji). US GAAP: dopuszcza, ale nie wymaga." }),
  ]),
  P(7, 3, "Impairment and revaluation", "Impairment under IFRS vs US GAAP, revaluation, fair value option.", [
    L(7, 3, 1, "Impairment — IFRS one-step approach (IAS 36)", { los: ["7.c"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie recoverable amount z fair value alone — recoverable to MAX(FV less costs, value in use)"], resources: stdRes(rd7), tags: ["standard", "ifrs-gaap-diff"], formulas: ["Recoverable amount = max(Fair value less costs of disposal, Value in use)", "Impairment loss = Carrying amount − Recoverable amount"], notes: "IFRS test: jeśli carrying amount > recoverable amount → odpis do recoverable. Test gdy istnieją wskazania (indicators)." }),
    L(7, 3, 2, "Impairment — US GAAP two-step approach (ASC 360)", { los: ["7.c"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie kroku recoverability test — bez niego nie ma impairment"], resources: stdRes(rd7), tags: ["standard", "ifrs-gaap-diff"], formulas: ["Step 1 (recoverability): if Carrying > Sum of undiscounted future cash flows → impaired", "Step 2 (measurement): Impairment loss = Carrying − Fair value"], notes: "US GAAP: dwustopniowy test. Krok 1 — recoverability (undiscounted CF). Jeśli nie spełniony, krok 2 — pomiar odpisu jako carrying minus fair value." }),
    L(7, 3, 3, "Reversal of impairment — IFRS vs US GAAP (non-goodwill)", { los: ["7.c"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że oba pozwalają — US GAAP zakazuje (poza assets held for sale)"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff"], notes: "IFRS: dozwolone odwrócenie impairment (poza goodwill) do nowego carrying value (bez przekroczenia poprzedniego carrying minus normalna depreciation). US GAAP: ZAKAZ reversal (poza assets held for sale)." }),
    L(7, 3, 4, "Revaluation model under IFRS — IFRS vs US GAAP", { los: ["7.c"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że revaluation gain idzie na PnL — początkowo na OCI (revaluation surplus)"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 16): pozwala na model rewaluacji — okresowe przeszacowanie do fair value. Wzrosty: OCI (revaluation surplus). Spadki: PnL (chyba że odwracają wcześniejszy gain). US GAAP: ZAKAZ — tylko historical cost." }),
    L(7, 3, 5, "Investment property — IFRS fair value option (IAS 40)", { los: ["7.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie investment property z owner-occupied PP&E"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 40): dla investment property (real estate held for rental/appreciation, nie owner-occupied) dozwolone modele: cost lub fair value (z gain/loss przez PnL). US GAAP: brak osobnej kategorii — owner-occupied PP&E." }),
    L(7, 3, 6, "Derecognition / gain or loss on sale", { los: ["7.d"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie revaluation surplus przy disposal — w IFRS może być przeniesione do retained earnings"], resources: stdRes(rd7), tags: ["concept"], formulas: ["Gain (loss) on sale = Proceeds − Carrying value at sale date"], notes: "Aktywo usuwane z BS gdy sprzedane lub złomowane. Różnica między proceeds a carrying value → gain/loss w IS (zwykle continuing operations, ale czasem non-recurring)." }),
  ]),
  P(7, 4, "Intangibles, goodwill, R&D", "Intangible assets — finite vs indefinite, goodwill, internally developed.", [
    L(7, 4, 1, "Intangible assets — finite life", { los: ["7.e"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie testu impairment — finite life intangibles są amortyzowane I testowane na impairment gdy indicators"], resources: stdRes(rd7), tags: ["concept", "standard"], notes: "Intangibles z określonym życiem (patents, copyrights, customer lists) — amortyzowane przez useful life (zwykle straight-line). Test impairment gdy indicators." }),
    L(7, 4, 2, "Intangible assets — indefinite life", { los: ["7.e"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie indefinite life z infinite — indefinite oznacza brak foreseeable end, ale wymaga annual review"], resources: stdRes(rd7), tags: ["concept", "standard"], notes: "Intangibles z nieokreślonym życiem (trademarks, brands, broadcasting licenses) — NIE amortyzowane. Annual impairment test (i częściej gdy indicators)." }),
    L(7, 4, 3, "Goodwill — recognition", { los: ["7.f"], diff: 3, hrs: 0.25, pitfalls: ["Założenie, że goodwill jest amortyzowane — nie jest, tylko impairment-tested"], resources: stdRes(rd7), tags: ["concept", "standard"], formulas: ["Goodwill = Purchase price − Fair value of identifiable net assets acquired"], notes: "Goodwill powstaje WYŁĄCZNIE z business combination (acquisition method). Reprezentuje synergies, going concern value etc. Niematerialny; nie amortyzowany." }),
    L(7, 4, 4, "Goodwill impairment testing — IFRS vs US GAAP", { los: ["7.f"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie cash-generating unit (IFRS) z reporting unit (US GAAP)"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 36): testuje na poziomie CGU; jeden krok — carrying vs recoverable amount. US GAAP (ASC 350): testuje na poziomie reporting unit; po 2017 — jeden krok (carrying vs fair value), wcześniej dwustopniowy. Reversal goodwill impairment ZAKAZANY w obu." }),
    L(7, 4, 5, "Internally developed intangibles — recognition", { los: ["7.g"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że internally generated brand można aktywować — generalnie nie"], resources: stdRes(rd7), tags: ["concept", "standard"], notes: "Wewnętrznie wytworzone intangibles (poza specifically allowed development costs) — generalnie expensed. Nabyte intangibles — kapitalizowane po fair value." }),
    L(7, 4, 6, "R&D capitalization — IFRS vs US GAAP", { los: ["7.g"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że US GAAP zawsze expensuje R&D — wyjątek dla software development costs po technological feasibility"], resources: stdRes(rd7), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 38): RESEARCH costs zawsze expensed; DEVELOPMENT costs kapitalizowane jeśli spełnione 6 kryteriów (technical feasibility, intent, ability, future benefits, resources, measurability). US GAAP (ASC 730): wszystkie R&D expensed (poza software po technological feasibility — ASC 985)." }),
  ]),
]);

// ---------- LM 08 — Analysis of Income Taxes ----------
const rd8 = "Analysis of Income Taxes";
const lm8 = PH(8, rd8, "Analiza podatku dochodowego (IAS 12, ASC 740): permanent vs temporary differences, DTA/DTL, valuation allowance, effective tax rate reconciliation.", 5, [
  P(8, 1, "Differences between accounting and taxable income", "Permanent vs temporary differences.", [
    L(8, 1, 1, "Permanent differences", { los: ["8.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie permanent z temporary — permanent NIE generują DTA/DTL"], resources: stdRes(rd8), tags: ["concept"], notes: "Permanent differences: różnice między accounting i taxable income, które NIE odwracają się (np. tax-exempt interest, non-deductible expenses, dividend received deduction). Wpływają na effective tax rate, NIE generują DTA/DTL." }),
    L(8, 1, 2, "Temporary differences — origination and reversal", { los: ["8.a"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie kierunku — accelerated depreciation tax tworzy DTL (więcej tax-deductible teraz, mniej w przyszłości)"], resources: stdRes(rd8), tags: ["concept"], notes: "Temporary differences: różnice które ODWRACAJĄ się w przyszłości (depreciation, warranty accruals, doubtful accounts). Generują DTA (firma zapłaci mniej tax w przyszłości) lub DTL (zapłaci więcej)." }),
  ]),
  P(8, 2, "DTA, DTL, valuation allowance", "Aktywa i pasywa z odroczonego podatku.", [
    L(8, 2, 1, "Deferred tax assets (DTA)", { los: ["8.b"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie warunku 'probable' (IFRS) / 'more likely than not' (US GAAP) — bez tego nie rozpoznajemy"], resources: stdRes(rd8), tags: ["concept", "standard"], formulas: ["DTA = Future deductible amount × Future tax rate"], notes: "DTA powstaje gdy taxable income > accounting income teraz, więc firma zapłaci mniej tax w przyszłości. Przykłady: warranty accruals, NOL carryforwards, doubtful accounts. Recognition wymaga prawdopodobieństwa wykorzystania." }),
    L(8, 2, 2, "Deferred tax liabilities (DTL)", { los: ["8.b"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że DTL zawsze będzie zapłacony — w praktyce indefinite reinvestment może opóźnić bezterminowo"], resources: stdRes(rd8), tags: ["concept", "standard"], formulas: ["DTL = Future taxable amount × Future tax rate"], notes: "DTL powstaje gdy accounting income > taxable income teraz, firma zapłaci więcej tax w przyszłości. Klasyczny przykład: accelerated tax depreciation. Bez recognition test." }),
    L(8, 2, 3, "Valuation allowance (US GAAP)", { los: ["8.c"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie valuation allowance (US GAAP) z mechanizmem IFRS — IFRS nie używa VA, tylko nie rozpoznaje DTA"], resources: stdRes(rd8), tags: ["ifrs-gaap-diff", "standard"], notes: "US GAAP (ASC 740): rozpoznaje cały DTA, ale tworzy valuation allowance (kontra-account) jeśli more likely than not, że część nie zostanie zrealizowana. IFRS (IAS 12): rozpoznaje DTA tylko w zakresie probable utilization — brak VA." }),
    L(8, 2, 4, "Deferred tax classification — IFRS vs US GAAP", { los: ["8.d"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że US GAAP też current/non-current — od 2017 wszystkie DTA/DTL są non-current"], resources: stdRes(rd8), tags: ["ifrs-gaap-diff", "standard"], notes: "IFRS (IAS 12): WSZYSTKIE DTA/DTL klasyfikowane jako non-current. US GAAP (post-2017 ASC 740): RÓWNIEŻ wszystkie non-current. Konwergencja faktyczna; pre-2017 US GAAP rozdzielał current/non-current." }),
    L(8, 2, 5, "Effect of tax rate changes on DTA/DTL", { los: ["8.b"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie kierunku — wzrost tax rate ZWIĘKSZA istniejący DTL (więcej do zapłaty)"], resources: stdRes(rd8), tags: ["formula"], formulas: ["New DTA/DTL = Old × (New rate / Old rate)"], notes: "Zmiana stawki podatkowej wymaga remeasurement DTA/DTL. Wpływ na income tax expense w okresie uchwalenia (enacted), nie w okresie wejścia w życie." }),
  ]),
  P(8, 3, "Effective tax rate reconciliation", "Reconciliation efektywnej i statutory tax rate.", [
    L(8, 3, 1, "Effective tax rate vs statutory tax rate reconciliation", { los: ["8.e"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie permanent differences w reconciliation"], resources: stdRes(rd8), tags: ["formula"], formulas: ["Effective tax rate = Income tax expense / Pretax income", "Reconciliation: Statutory rate × Pretax income → adjustments → Effective tax expense"], notes: "Reconciliation w notes pokazuje, dlaczego ETR różni się od statutory rate: permanent differences, foreign income at different rates, valuation allowance changes, tax credits, state taxes." }),
    L(8, 3, 2, "Income tax expense components", { los: ["8.e"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie current tax expense z total income tax expense"], resources: stdRes(rd8), tags: ["concept"], formulas: ["Income tax expense = Current tax expense + Deferred tax expense", "Deferred tax expense = ΔDTL − ΔDTA"], notes: "Income tax expense ma dwa komponenty: current (płacony obecnie) i deferred (odroczony, z DTA/DTL changes). Analyst rozpoznaje też tax expense w OCI dla revaluation, hedging itp." }),
  ]),
]);

// ---------- LM 09 — Analysis of Non-Current Liabilities ----------
const rd9 = "Analysis of Non-Current Liabilities";
const lm9 = PH(9, rd9, "Analiza zobowiązań długoterminowych: bonds payable, leases (IFRS 16, ASC 842), pensions, off-balance-sheet financing.", 7, [
  P(9, 1, "Bonds payable", "Issuance at par/premium/discount, effective interest method, covenants.", [
    L(9, 1, 1, "Bonds payable — issuance at par", { los: ["9.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że emisja zawsze przy par — rzadko w praktyce"], resources: stdRes(rd9), tags: ["concept"], notes: "Bond issued at par: coupon rate = market rate. BV = face value przez całe życie. Interest expense = coupon payment. Brak amortyzacji premium/discount." }),
    L(9, 1, 2, "Bonds payable — issuance at premium", { los: ["9.a"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie kierunku amortyzacji premium — zmniejsza się BV i interest expense w czasie"], resources: stdRes(rd9), tags: ["formula"], formulas: ["Premium = Issue price − Face value (when coupon rate > market rate)", "Interest expense = Beginning BV × Market rate"], notes: "Bond issued at premium: coupon > market rate. BV początkowo > face, amortyzowane do face. Interest expense < coupon payment; premium amortization w CFO (US GAAP) lub CFF (IFRS często)." }),
    L(9, 1, 3, "Bonds payable — issuance at discount", { los: ["9.a"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie kierunku BV — przy discount BV ROŚNIE w kierunku face value"], resources: stdRes(rd9), tags: ["formula"], formulas: ["Discount = Face value − Issue price (when coupon rate < market rate)", "Interest expense = Beginning BV × Market rate"], notes: "Bond issued at discount: coupon < market rate. BV początkowo < face, amortyzowane do face. Interest expense > coupon payment; discount amortization zwiększa BV i interest expense w czasie." }),
    L(9, 1, 4, "Effective interest rate method amortization", { los: ["9.a"], diff: 3, hrs: 0.5, pitfalls: ["Stosowanie straight-line amortization — IFRS wymaga effective interest, US GAAP też (poza immaterial)"], resources: stdRes(rd9), tags: ["formula", "standard"], formulas: ["Interest expense = Beginning BV × Market rate at issuance", "Cash coupon = Face × Coupon rate", "Premium/discount amortization = Difference"], notes: "Effective interest method: każdego okresu interest expense = BV × historyczny YTM. Stała stopa zwrotu na BV, ale interest expense zmienia się w czasie. IFRS i US GAAP wymagają tej metody." }),
    L(9, 1, 5, "Debt covenants", { los: ["9.b"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie covenants w analizie kredytowej — naruszenie może zmienić non-current na current"], resources: stdRes(rd9), tags: ["concept"], notes: "Affirmative covenants (musisz robić X) i negative covenants (nie możesz Y). Naruszenie może spowodować acceleration; covenant headroom jest istotny w analizie." }),
    L(9, 1, 6, "Issuance costs and bond derecognition", { los: ["9.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie issuance costs (kapitalizowane jako reduction of carrying) z odsetkami"], resources: stdRes(rd9), tags: ["concept"], formulas: ["Gain (loss) on extinguishment = Carrying value − Reacquisition price"], notes: "Issuance costs zmniejszają carrying value bondu (post-2015 US GAAP), efektywnie zwiększają YTM. Early extinguishment: gain/loss między carrying a redemption price; ujmowane w continuing operations." }),
  ]),
  P(9, 2, "Leases", "IFRS 16 (single-model) vs ASC 842 (finance/operating).", [
    L(9, 2, 1, "Leases under IFRS 16 — lessee single-model", { los: ["9.c"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że leasing operacyjny pozostał off-BS pod IFRS 16 — IFRS 16 wymaga ROU asset i lease liability dla wszystkich (poza short-term/low-value)"], resources: stdRes(rd9), tags: ["standard", "ifrs-gaap-diff"], formulas: ["Initial: ROU asset = Lease liability = PV of lease payments", "P&L: Depreciation (ROU) + Interest (liability)"], notes: "IFRS 16: jeden model dla lessee. Wszystkie leasy (poza short-term ≤12 mies. i low-value) generują ROU asset i lease liability. Koszty: depreciation ROU + interest na liability (front-loaded total expense)." }),
    L(9, 2, 2, "Leases under ASC 842 — finance vs operating lessee — IFRS vs US GAAP", { los: ["9.c"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie operating lease P&L (single straight-line) z finance lease (depreciation + interest)"], resources: stdRes(rd9), tags: ["standard", "ifrs-gaap-diff"], notes: "ASC 842: finance lease (jak IFRS 16 — depreciation + interest, front-loaded) lub operating lease (single straight-line lease expense, ale ROU asset i lease liability na BS). Klasyfikacja na 5 kryteriów (transfer, purchase option, term, PV, specialized). Kluczowa różnica vs IFRS 16: dual model w US GAAP, single w IFRS." }),
    L(9, 2, 3, "Lessor accounting — sales-type, direct financing, operating", { los: ["9.c"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie sales-type lease z operating lease — sales-type rozpoznaje sprzedaż na początku"], resources: stdRes(rd9), tags: ["standard"], notes: "Lessor: trzy klasyfikacje. Sales-type lease (manufacturer/dealer — gain z initial sale + interest income), direct financing (interest income), operating (rent revenue). IFRS i US GAAP zachowały podobne reguły." }),
  ]),
  P(9, 3, "Pensions and post-employment benefits", "DC vs DB plans, basics.", [
    L(9, 3, 1, "Defined contribution pension plan", { los: ["9.d"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie DC z DB — DC firmy nie ponosi inwestycyjnego ryzyka"], resources: stdRes(rd9), tags: ["concept"], notes: "DC plan: firma wpłaca zdefiniowaną składkę; ryzyko inwestycyjne na pracowniku. Pension expense = contribution za okres. Brak DBO/PBO na BS." }),
    L(9, 3, 2, "Defined benefit pension plan basics", { los: ["9.d"], diff: 4, hrs: 0.5, pitfalls: ["Mylenie funded status z pension expense", "Pomijanie aktuarialnych założeń (discount rate, expected return) — kluczowe dla quality"], resources: stdRes(rd9), tags: ["concept", "standard"], formulas: ["Funded status = Plan assets fair value − PBO/DBO", "Pension expense (US GAAP, simplified) = Service cost + Interest cost − Expected return on plan assets + amortizations"], notes: "DB plan: firma gwarantuje benefit; ryzyko inwestycyjne i aktuarialne na firmie. Funded status (assets − obligation) raportowany na BS jako net pension asset/liability. Service cost i interest cost w P&L; remeasurements w OCI (IFRS) lub amortyzowane przez P&L (US GAAP)." }),
  ]),
  P(9, 4, "Off-balance-sheet financing", "Mechanizmy ukrywania dźwigni.", [
    L(9, 4, 1, "Off-balance-sheet financing", { los: ["9.e"], diff: 3, hrs: 0.25, pitfalls: ["Pomijanie operating leases pre-IFRS 16/ASC 842 — historycznie ogromna dźwignia ukryta"], resources: stdRes(rd9), tags: ["analysis"], notes: "OBS financing: structures unikające raportowania długu na BS (operating leases historycznie, special purpose entities, securitizations, take-or-pay contracts, factoring with recourse). Po IFRS 16 / ASC 842 — leasing operacyjny już on-BS." }),
  ]),
]);

// ---------- LM 10 — Financial Analysis Techniques ----------
const rd10 = "Financial Analysis Techniques";
const lm10 = PH(10, rd10, "Techniki analizy finansowej: ratio analysis (activity, liquidity, solvency, profitability, valuation), DuPont, common-size, segment.", 8, [
  P(10, 1, "Activity ratios", "Wskaźniki efektywności operacyjnej.", [
    L(10, 1, 1, "Inventory turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie revenue zamiast COGS w liczniku — to częsty błąd"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Inventory turnover = COGS / Average inventory"], notes: "Mierzy efektywność zarządzania zapasami. Wyższy = lepszy (do pewnego punktu — zbyt wysoki może oznaczać niedoborów). Industry-specific." }),
    L(10, 1, 2, "Days of inventory on hand (DOH)", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Liczenie z 360 zamiast 365 — używamy 365 chyba że wskazane inaczej"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["DOH = 365 / Inventory turnover", "DOH = Average inventory / (COGS / 365)"], notes: "Średnia liczba dni przechowywania zapasów. Niska DOH = szybki obrót; rośnie → potencjalne obsolescence lub spadek popytu." }),
    L(10, 1, 3, "Receivables turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Używanie net sales gdy dostępne są credit sales — credit sales jest bardziej precyzyjne"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Receivables turnover = Revenue / Average receivables"], notes: "Mierzy efektywność ściągania należności. Wysoki = szybkie ściąganie; spadek → potencjalne problemy z windykacją." }),
    L(10, 1, 4, "Days of sales outstanding (DSO)", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie sezonowości — koniec-roku AR może nie być reprezentatywne"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["DSO = 365 / Receivables turnover", "DSO = Average receivables / (Revenue / 365)"], notes: "Średnia liczba dni do otrzymania zapłaty. Wzrost DSO sygnalizuje pogorszenie credit quality klientów lub luźniejszą politykę kredytową." }),
    L(10, 1, 5, "Payables turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie purchases zamiast COGS — purchases jest bardziej precyzyjne, ale rzadko ujawnione"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Payables turnover = Purchases / Average accounts payable", "(Purchases ≈ COGS + ΔInventory)"], notes: "Mierzy częstość regulowania zobowiązań handlowych. Niski = firma korzysta z trade credit; bardzo niski → problemy z płynnością." }),
    L(10, 1, 6, "Days payables outstanding (DPO)", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie wzrostu DPO jako pozytywnego — może oznaczać liquidity stress"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["DPO = 365 / Payables turnover", "DPO = Average AP / (Purchases / 365)"], notes: "Średnia liczba dni do zapłaty dostawcom. Wysoki = firma korzysta z trade credit; trend rosnący może sygnalizować problemy z gotówką." }),
    L(10, 1, 7, "Working capital turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Niezdefiniowane gdy working capital ≈ 0 lub ujemne"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Working capital turnover = Revenue / Average working capital", "(Working capital = Current assets − Current liabilities)"], notes: "Efektywność wykorzystania kapitału obrotowego. Wyższy = bardziej efektywne. Często niezdefiniowane (firmy z negative WC, np. retail giants)." }),
    L(10, 1, 8, "Fixed asset turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie wpływu wieku aktywów — w pełni zamortyzowane firmy mają sztucznie wysoki ratio"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Fixed asset turnover = Revenue / Average net fixed assets"], notes: "Efektywność wykorzystania PP&E do generowania sprzedaży. Industry-specific; capital-intensive industries mają niskie wartości." }),
    L(10, 1, 9, "Total asset turnover", { los: ["10.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z fixed asset turnover — total uwzględnia wszystkie aktywa"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Total asset turnover = Revenue / Average total assets"], notes: "Najszerszy wskaźnik efektywności. Komponent DuPont. Wartość zależy od industry; usługi vs production." }),
  ]),
  P(10, 2, "Liquidity ratios", "Wskaźniki płynności krótkoterminowej.", [
    L(10, 2, 1, "Current ratio", { los: ["10.b"], diff: 1, hrs: 0.25, pitfalls: ["Założenie, że wysoki = zawsze dobry — może oznaczać nieefektywne zarządzanie inventory/cash"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Current ratio = Current assets / Current liabilities"], notes: "Najszerszy wskaźnik płynności. > 1 oznacza pokrycie current liabilities przez current assets. Industry-specific benchmarks." }),
    L(10, 2, 2, "Quick ratio (acid-test)", { los: ["10.b"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie short-term marketable securities — należą do quick assets"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Quick ratio = (Cash + Short-term marketable securities + Receivables) / Current liabilities"], notes: "Bardziej konserwatywny — wyklucza inventory (slow-moving) i prepaid expenses. Lepszy gdy inventory jest illiquid." }),
    L(10, 2, 3, "Cash ratio", { los: ["10.b"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że wysoki cash ratio = zawsze dobry — może sygnalizować brak inwestycji"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Cash ratio = (Cash + Short-term marketable securities) / Current liabilities"], notes: "Najbardziej konserwatywny — tylko gotówka i ekwiwalenty. Stosowany w stress scenarios; istotny dla credit analysis." }),
    L(10, 2, 4, "Defensive interval ratio", { los: ["10.b"], diff: 3, hrs: 0.25, pitfalls: ["Mylenie z cash ratio — defensive interval ujmuje liczbę DNI, nie wielokrotność"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Defensive interval = (Cash + ST securities + Receivables) / Daily cash expenditures", "Daily cash expenditures = (Operating expenses − Non-cash charges) / 365"], notes: "Liczba dni, przez które firma może operować z dostępnych liquid assets bez przychodów. Stosowany w sytuacjach kryzysowych." }),
    L(10, 2, 5, "Cash conversion cycle", { los: ["10.b"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie znaku DPO w formule — odejmujemy DPO"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Cash conversion cycle = DOH + DSO − DPO"], notes: "Liczba dni od wydania gotówki na inventory do otrzymania gotówki ze sprzedaży. Krótki = lepsza efektywność working capital. Negatywny CCC (np. Amazon, Dell) = supplier finansuje operacje." }),
  ]),
  P(10, 3, "Solvency ratios", "Wskaźniki długoterminowej wypłacalności.", [
    L(10, 3, 1, "Debt-to-assets ratio", { los: ["10.c"], diff: 1, hrs: 0.25, pitfalls: ["Niejednoznaczność 'debt' — interest-bearing tylko czy total liabilities"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Debt-to-assets = Total debt / Total assets"], notes: "Procent aktywów finansowanych długiem. Definicja debt zwykle = interest-bearing (long-term + short-term debt), nie total liabilities." }),
    L(10, 3, 2, "Debt-to-capital ratio", { los: ["10.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie capital z assets"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Debt-to-capital = Total debt / (Total debt + Total shareholders equity)"], notes: "Procent kapitalizacji finansowanej długiem. Capital = debt + equity. Wskaźnik z 0..1 zakresu, łatwy w interpretacji." }),
    L(10, 3, 3, "Debt-to-equity ratio", { los: ["10.c"], diff: 1, hrs: 0.25, pitfalls: ["Stosowanie book equity vs market equity — zwykle book"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Debt-to-equity = Total debt / Total shareholders equity"], notes: "Najpopularniejszy wskaźnik leverage. > 1 = więcej długu niż equity. Industry-specific (utilities tolerują wysokie, tech niskie)." }),
    L(10, 3, 4, "Financial leverage ratio (equity multiplier)", { los: ["10.c"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z debt-to-equity — leverage uwzględnia all assets, nie tylko debt"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Financial leverage = Average total assets / Average total equity"], notes: "Komponent DuPont. Pokazuje, jak many razy assets > equity (mnożnik dźwigni). Łączy operating i financing leverage." }),
    L(10, 3, 5, "Interest coverage ratio (Times interest earned)", { los: ["10.c"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie net income zamiast EBIT — interest jest 'before interest', więc EBIT"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Interest coverage = EBIT / Interest expense"], notes: "Pokrycie odsetek przez zyski operacyjne. Niski (< 2-3) = trudność w obsłudze długu. Kluczowy w credit analysis." }),
    L(10, 3, 6, "Fixed charge coverage ratio", { los: ["10.c"], diff: 3, hrs: 0.25, pitfalls: ["Pomijanie operating lease payments — w fixed charges są kluczowe (historycznie)"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Fixed charge coverage = (EBIT + Lease payments) / (Interest + Lease payments)"], notes: "Bardziej kompleksowy niż interest coverage — uwzględnia lease payments (głównie operating leases historycznie). Po IFRS 16/ASC 842 mniej istotne dla on-BS leases." }),
  ]),
  P(10, 4, "Profitability ratios", "Marże i zwroty z kapitału.", [
    L(10, 4, 1, "Gross profit margin", { los: ["10.d"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie z operating margin — gross uwzględnia tylko COGS"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Gross profit margin = (Revenue − COGS) / Revenue"], notes: "Marża po pokryciu kosztów wytworzenia. Industry-specific. Wzrost = better pricing power lub niższe koszty wytworzenia." }),
    L(10, 4, 2, "Operating profit margin", { los: ["10.d"], diff: 1, hrs: 0.25, pitfalls: ["Włączanie items non-recurring do operating income"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Operating profit margin = Operating income / Revenue"], notes: "Marża po pokryciu wszystkich kosztów operacyjnych (COGS, SG&A, R&D, depreciation). Bardziej stabilna niż gross — odzwierciedla efektywność operacyjną." }),
    L(10, 4, 3, "Pretax profit margin", { los: ["10.d"], diff: 1, hrs: 0.25, pitfalls: ["Mylenie z operating — pretax uwzględnia non-operating (interest, FX gains)"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Pretax profit margin = Pretax income / Revenue"], notes: "Marża przed podatkiem. Uwzględnia interest expense i non-operating items. Pokazuje wpływ struktury kapitałowej (interest)." }),
    L(10, 4, 4, "Net profit margin", { los: ["10.d"], diff: 1, hrs: 0.25, pitfalls: ["Pomijanie wpływu effective tax rate — zmiana stawki może zmienić net margin bez zmiany operations"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Net profit margin = Net income / Revenue"], notes: "Końcowa marża po wszystkich kosztach i podatkach. Najczęściej cytowany. Komponent DuPont 3-factor." }),
    L(10, 4, 5, "Return on assets (ROA)", { los: ["10.d"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie net income vs operating income — różne wersje ROA"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["ROA = Net income / Average total assets"], notes: "Zwrot z aktywów. Mierzy efektywność wykorzystania majątku. Zaniżony przez interest expense (idzie do creditors, nie equity holders)." }),
    L(10, 4, 6, "Operating ROA", { los: ["10.d"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z ROA — operating ROA używa EBIT, neutralizując strukturę kapitału"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Operating ROA = Operating income / Average total assets"], notes: "Wersja ROA ignorująca strukturę kapitału (używa EBIT zamiast NI). Lepsza dla porównań cross-firm o różnej dźwigni." }),
    L(10, 4, 7, "Return on equity (ROE)", { los: ["10.d"], diff: 2, hrs: 0.25, pitfalls: ["Wysokie ROE z high leverage — może być niesustainable"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["ROE = Net income / Average shareholders equity"], notes: "Zwrot z kapitału własnego. Najpopularniejszy wskaźnik dla equity investors. Komponent DuPont." }),
    L(10, 4, 8, "Return on common equity", { los: ["10.d"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie odjęcia preferred dividends w liczniku"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Return on common equity = (Net income − Preferred dividends) / Average common equity"], notes: "Wersja ROE specifically dla common shareholders — odejmuje preferred dividends z licznika i preferred equity z mianownika." }),
    L(10, 4, 9, "Return on total capital", { los: ["10.d"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z ROIC — total capital uwzględnia wszystkich kapitałodawców"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["Return on total capital = EBIT / Average total capital", "Total capital = Short-term debt + Long-term debt + Equity"], notes: "Zwrot dla wszystkich kapitałodawców (debt + equity). Używa EBIT (przed interest), więc neutralna względem struktury kapitału." }),
    L(10, 4, 10, "Return on invested capital (ROIC)", { los: ["10.d"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie ROIC z ROA — ROIC odlicza non-interest-bearing liabilities z denominator"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["ROIC = NOPAT / Average invested capital", "NOPAT = EBIT × (1 − t)", "Invested capital = Total assets − Non-interest-bearing current liabilities"], notes: "Najbardziej rygorystyczny wskaźnik efektywności kapitału. Porównanie z WACC pokazuje, czy firma kreuje wartość (ROIC > WACC) czy ją niszczy." }),
  ]),
  P(10, 5, "Valuation ratios", "Wskaźniki rynkowe wyceny.", [
    L(10, 5, 1, "P/E ratio — trailing", { los: ["10.e"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie EPS bez korekty o non-recurring items"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["Trailing P/E = Price per share / Trailing 12-month EPS"], notes: "P/E oparte na zrealizowanych zyskach z ostatnich 12 miesięcy. Najpowszechniej cytowane. Wrażliwe na non-recurring items — analyst koryguje." }),
    L(10, 5, 2, "P/E ratio — forward (leading)", { los: ["10.e"], diff: 2, hrs: 0.25, pitfalls: ["Niedoceniał błędu prognozy EPS — forward P/E zależy od jakości forecastu"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["Forward P/E = Price per share / Forecast next-year EPS"], notes: "P/E oparte na prognozowanym EPS. Lepszy dla growth companies; wrażliwy na revisions analystów." }),
    L(10, 5, 3, "Price-to-book (P/B) ratio", { los: ["10.e"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie intangibles i goodwill — niektóre branże (banki) mają book value bardziej znaczący niż inne"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["P/B = Price per share / Book value per share", "Book value per share = Common equity / Shares outstanding"], notes: "Cena vs book value of equity. Najsensowniejsze dla financials (banki) i asset-heavy firms; mniej dla tech/services." }),
    L(10, 5, 4, "Price-to-sales (P/S) ratio", { los: ["10.e"], diff: 2, hrs: 0.25, pitfalls: ["Stosowanie do firm z różnymi strukturami marży — wysokie P/S z niskimi marżami nie znaczy tanio"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["P/S = Price per share / Revenue per share"], notes: "Mniej manipulowane niż earnings (trudno fakeować revenue). Stosowane do startupów i firm z ujemnymi zyskami." }),
    L(10, 5, 5, "Price-to-cash-flow (P/CF) ratio", { los: ["10.e"], diff: 2, hrs: 0.25, pitfalls: ["Niejednoznaczność CF — CFO, FCFE, FCFF — zawsze sprawdzić definicję"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["P/CF = Price per share / Cash flow per share"], notes: "Cash-based valuation, mniej manipulowane niż earnings. Definicja CF różni się: CFO, FCFE, FCFF. Stosowane w capital-intensive industries." }),
    L(10, 5, 6, "Dividend yield", { los: ["10.e"], diff: 1, hrs: 0.25, pitfalls: ["Wysoki dividend yield może oznaczać spadającą cenę (yield trap), nie generosity"], resources: stdRes(rd10), tags: ["formula", "ratio", "valuation"], formulas: ["Dividend yield = Annual dividends per share / Price per share"], notes: "Stopa dywidendy. Dla income investors. Wysoka yield może być sygnałem ostrzegawczym (rynkowo zdyskontowana cena akcji) lub mature/value characteristic." }),
  ]),
  P(10, 6, "DuPont decomposition", "DuPont 3-factor i 5-factor.", [
    L(10, 6, 1, "3-factor DuPont decomposition of ROE", { los: ["10.f"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie interpretacji — wysokie ROE z high leverage to inny biznes niż z high margin"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["ROE = Net profit margin × Asset turnover × Financial leverage", "= (NI/Revenue) × (Revenue/Assets) × (Assets/Equity)"], notes: "Klasyczny 3-factor DuPont: ROE jako iloczyn rentowności (NPM), efektywności (TAT), i dźwigni (FL). Pozwala zidentyfikować źródło ROE i porównać z konkurencją." }),
    L(10, 6, 2, "5-factor DuPont decomposition of ROE", { los: ["10.f"], diff: 4, hrs: 0.5, pitfalls: ["Pomijanie tax burden i interest burden — kluczowe w analizie financial structure"], resources: stdRes(rd10), tags: ["formula", "ratio"], formulas: ["ROE = Tax burden × Interest burden × EBIT margin × Asset turnover × Financial leverage", "= (NI/EBT) × (EBT/EBIT) × (EBIT/Revenue) × (Revenue/Assets) × (Assets/Equity)"], notes: "Rozszerzony 5-factor DuPont rozkłada NPM na tax burden, interest burden i operating margin (EBIT margin). Pełna dekompozycja źródeł ROE — każdy komponent porównywalny cross-firm." }),
  ]),
  P(10, 7, "Other techniques", "Common-size analysis i segment reporting.", [
    L(10, 7, 1, "Common-size and trend analysis", { los: ["10.g"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie horizontal (year-over-year %) z vertical (% of base year/total)"], resources: stdRes(rd10), tags: ["analysis"], notes: "Vertical (common-size): każda pozycja jako % bazy (revenue dla IS, total assets dla BS). Horizontal (trend): zmiana % rok do roku lub vs base year. Razem dają pełen obraz trendów." }),
    L(10, 7, 2, "Segment reporting and analysis", { los: ["10.h"], diff: 2, hrs: 0.5, pitfalls: ["Pomijanie segmentów — często pojedynczy segment napędza całą firmę"], resources: stdRes(rd10), tags: ["analysis", "standard"], notes: "IFRS 8 i ASC 280 wymagają raportowania segmentów operacyjnych (10% revenue/assets/profit threshold). Analyst dekomponuje wskaźniki per segment, identyfikuje cross-subsidization." }),
  ]),
]);

// ---------- LM 11 — Financial Reporting Quality ----------
const rd11 = "Financial Reporting Quality";
const lm11 = PH(11, rd11, "Jakość sprawozdań finansowych: aggressive vs conservative accounting, earnings management, modele wykrywania manipulacji (Beneish, Altman, Sloan).", 6, [
  P(11, 1, "Quality dimensions", "Earnings, cash flow i balance sheet quality.", [
    L(11, 1, 1, "Earnings quality — concept and indicators", { los: ["11.a"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie quality (sustainability + accuracy) z quantity"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Earnings quality: stopień, w jakim raportowane zyski (a) odzwierciedlają rzeczywistą performance i (b) są sustainable. Wysokie quality = recurring, cash-backed, conservative estimates. Niskie = one-time gains, accruals-driven, aggressive estimates." }),
    L(11, 1, 2, "Cash flow quality", { los: ["11.a"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że CFO jest niemanipulowane — możliwe (sale of receivables, classification shifts)"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "CF quality: czy CFO jest sustainable i prawdziwie operacyjne. Sygnały niskiej quality: CFO < NI przez długi okres, CFO napędzane non-recurring items, klasyfikacyjne shifts między CFO/CFI/CFF." }),
    L(11, 1, 3, "Balance sheet quality", { los: ["11.a"], diff: 3, hrs: 0.25, pitfalls: ["Pomijanie off-balance-sheet items"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "BS quality: stopień, w jakim BS reprezentuje rzeczywisty stan finansowy. Sygnały niskiej quality: nadmiar intangibles/goodwill, off-BS financing, agresywna kapitalizacja, niedoszacowane provisions." }),
    L(11, 1, 4, "Aggressive vs conservative accounting choices", { los: ["11.b"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że agresywne = nielegalne — może być w granicach standardów ('cookie jar' management)"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Aggressive: zawyża current earnings/assets (early revenue recognition, długie useful lives, capitalization wątpliwych costs). Conservative: zaniża (delayed revenue, krótkie useful lives, expensing). Aggressive zwykle pożycza zysk z przyszłości." }),
  ]),
  P(11, 2, "Earnings management techniques", "Konkretne mechanizmy manipulacji.", [
    L(11, 2, 1, "Revenue recognition manipulation", { los: ["11.c"], diff: 4, hrs: 0.5, pitfalls: ["Pomijanie premature recognition — najczęstsza forma earnings management"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Techniki: premature recognition (przed transferem kontroli), fictitious revenue, gross-up (principal vs agent error), sales returns underestimation, multi-element arrangements abuse. Klasyk: Enron, WorldCom, Lucent." }),
    L(11, 2, 2, "Expense capitalization (aggressive)", { los: ["11.c"], diff: 4, hrs: 0.5, pitfalls: ["Klasyfikowanie wszystkich capitalizations jako manipulację — niektóre są legitne"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Aggressive capitalization: traktowanie expenses jako assets (line costs WorldCom, R&D), przedłużanie useful lives, niedoszacowanie depreciation. Wpływ: wyższe NI teraz, ale lower NI w przyszłości i wyższe assets/equity." }),
    L(11, 2, 3, "Cookie jar reserves", { los: ["11.c"], diff: 4, hrs: 0.5, pitfalls: ["Mylenie cookie jar z legitymymi rezerwami — różnica w intencji i wielkości"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Cookie jar reserves: nadmierne provisioning w dobrych latach (warranty, restructuring, allowance for doubtful accounts) i odwracanie ich w złych latach dla wygładzenia earnings. Forma 'big bath' lub income smoothing." }),
    L(11, 2, 4, "Channel stuffing", { los: ["11.c"], diff: 4, hrs: 0.5, pitfalls: ["Mylenie z legitymymi promocjami — channel stuffing nie ma economic substance"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Channel stuffing: pchanie nadmiernego inventory do dystrybutorów na koniec kwartału (z prawem zwrotu lub nadmiernymi rabatami), żeby zaraportować revenue. Pojawia się ΔAR, później wzrost returns/refunds. Sygnał: revenue spike + DSO spike." }),
    L(11, 2, 5, "Bill-and-hold transactions", { los: ["11.c"], diff: 4, hrs: 0.5, pitfalls: ["Założenie, że bill-and-hold zawsze nielegalny — IFRS 15 / ASC 606 dopuszczają w ścisłych warunkach"], resources: stdRes(rd11), tags: ["concept", "quality"], notes: "Bill-and-hold: revenue recognized przed dostawą (klient nie jeszcze nie odebrał goods). Dozwolone TYLKO gdy: substantive reason for arrangement, products separately identified as customer's, ready for delivery, no alternative use. Klasyczny abuse: Sunbeam." }),
  ]),
  P(11, 3, "Detection models", "Modele wykrywania manipulacji.", [
    L(11, 3, 1, "Beneish M-score", { los: ["11.d"], diff: 4, hrs: 0.5, pitfalls: ["Stosowanie M-score jako jedynego indicator — to screening tool, nie diagnoza"], resources: stdRes(rd11), tags: ["formula", "quality"], formulas: ["M-score = −4.84 + 0.92 × DSRI + 0.528 × GMI + 0.404 × AQI + 0.892 × SGI + 0.115 × DEPI − 0.172 × SGAI + 4.679 × Accruals − 0.327 × LEVI", "M-score > −1.78 → likely manipulator"], notes: "Beneish M-score: 8-zmiennych model wykrywający manipulacje. Wykorzystywany w forensic accounting; zidentyfikował m.in. Enron przed jego upadkiem." }),
    L(11, 3, 2, "Altman Z-score", { los: ["11.d"], diff: 3, hrs: 0.5, pitfalls: ["Stosowanie original Z-score do non-manufacturers — istnieją osobne modele Z' dla private i Z'' dla non-manufacturing"], resources: stdRes(rd11), tags: ["formula", "quality"], formulas: ["Z = 1.2 × WC/TA + 1.4 × RE/TA + 3.3 × EBIT/TA + 0.6 × MV equity/BV liab + 1.0 × Sales/TA", "Z < 1.81 → distress; Z > 2.99 → safe"], notes: "Altman Z-score: model przewidywania bankructwa oparty na 5 wskaźnikach. Wysokie Z = niskie ryzyko; niskie Z = high distress probability. Industry-specific wersje istnieją." }),
    L(11, 3, 3, "Sloan accruals ratio", { los: ["11.d"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie balance-sheet accruals z cash-flow accruals — Sloan użył BS approach"], resources: stdRes(rd11), tags: ["formula", "quality"], formulas: ["Accruals (BS) = (NIBE − CFO − CFI) / Average total assets", "Accruals (BS, simplified) = (Net operating assets end − Net operating assets begin) / Avg total assets"], notes: "Sloan (1996): firmy z wysokim accruals component of earnings under-perform; rynek nie w pełni rozróżnia accruals od cash earnings. Wysoki accruals ratio = sygnał ostrzegawczy o quality." }),
  ]),
]);

// ---------- LM 12 — Applications of Financial Statement Analysis ----------
const rd12 = "Applications of Financial Statement Analysis";
const lm12 = PH(12, rd12, "Zastosowania FSA: ocena kredytowa, equity screening, prognozowanie, korekty analityczne.", 4, [
  L(12, 0, 1, "Evaluating past performance", { los: ["12.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że past performance = future performance bez korekt"], resources: stdRes(rd12), tags: ["analysis"], notes: "Analiza historyczna: trendy, peer comparison, decomposition (DuPont). Cel: zidentyfikować drivers performance i sustainable elements vs one-offs." }),
  L(12, 0, 2, "Forecasting future performance", { los: ["12.b"], diff: 3, hrs: 0.5, pitfalls: ["Mechaniczna ekstrapolacja trendów bez analizy fundamentalnej"], resources: stdRes(rd12), tags: ["analysis"], notes: "Forecasting: top-down (industry/economy → company) lub bottom-up. Punkty wyjścia: revenue growth, margins, working capital ratios, capex needs. Sensitivity analysis dla key assumptions." }),
  L(12, 0, 3, "Credit analysis applications", { los: ["12.c"], diff: 3, hrs: 0.5, pitfalls: ["Skupianie się tylko na profitability — credit wymaga focus na cash flow generation i leverage"], resources: stdRes(rd12), tags: ["analysis"], notes: "Credit analysis: 4Cs framework (Capacity, Capital, Collateral, Character). Kluczowe ratios: leverage (Debt/EBITDA), coverage (EBIT/Interest), liquidity (current/quick). Rating agencies (Moody's, S&P, Fitch)." }),
  L(12, 0, 4, "Equity screening and valuation applications", { los: ["12.d"], diff: 3, hrs: 0.25, pitfalls: ["Pomijanie sektorowych specyfik przy screening (universal P/E threshold ignoruje industry context)"], resources: stdRes(rd12), tags: ["analysis"], notes: "Equity screening: screening firm na podstawie ratios (P/E, P/B, ROE, growth, leverage). Combined ze stylem: value, growth, quality. Multi-factor scoring (Magic Formula, F-score)." }),
  L(12, 0, 5, "Analyst adjustments to financial statements", { los: ["12.e"], diff: 4, hrs: 0.5, pitfalls: ["Pomijanie potrzeby korekt — comparability requires adjustments dla LIFO/FIFO, off-BS items, non-recurring"], resources: stdRes(rd12), tags: ["analysis"], notes: "Analyst adjustments: LIFO→FIFO conversion, capitalize operating leases (pre-IFRS 16), add back non-recurring items, normalize tax rate, adjust for one-time items. Cel: comparability across firms i normalizacja core earnings." }),
  L(12, 0, 6, "Intercorporate investments — overview", { los: ["12.f"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie passive (FVTPL/FVOCI) z significant influence (equity method) z control (consolidation)"], resources: stdRes(rd12), tags: ["concept", "standard"], notes: "Trzy kategorie: financial assets (< 20% — passive, FVTPL/FVOCI), associates (20-50% lub significant influence — equity method), subsidiaries (> 50% lub control — consolidation/acquisition method). IFRS 9 i ASC 320/323/810." }),
  L(12, 0, 7, "Equity method", { los: ["12.f"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie equity method z proportionate consolidation"], resources: stdRes(rd12), tags: ["concept", "standard"], formulas: ["Investment account = Initial cost + Investor's share of investee earnings − Dividends received − Investor's share of impairments"], notes: "Equity method: dla associates (significant influence). Investment na BS jako pojedyncza linia, share of investee earnings w P&L. Dividend received zmniejsza investment, nie revenue." }),
  L(12, 0, 8, "Acquisition method (overview only at L1)", { los: ["12.f"], diff: 3, hrs: 0.5, pitfalls: ["Mylenie acquisition method z pooling of interests — pooling zniesione w obu standardach"], resources: stdRes(rd12), tags: ["concept", "standard"], notes: "Acquisition method (IFRS 3, ASC 805): dla business combinations. Identifiable assets/liabilities at fair value, residual = goodwill. Non-controlling interest (NCI) at fair value (full goodwill, IFRS option) lub proportionate share (partial goodwill)." }),
]);

// ---------- LM 13 — Introduction to Financial Statement Modeling ----------
const rd13 = "Introduction to Financial Statement Modeling";
const lm13 = PH(13, rd13, "Wprowadzenie do modelowania finansowego: struktura modelu, prognozowanie linii IS/BS/CF, behavioral biases.", 4, [
  L(13, 0, 1, "Financial statement modeling — purpose and structure", { los: ["13.a"], diff: 2, hrs: 0.25, pitfalls: ["Budowanie modelu bez weryfikacji circular references i balancing"], resources: stdRes(rd13), tags: ["concept"], notes: "FS model: integrated 3-statement model (IS, BS, CF) projecting future periods. Cele: valuation, scenario analysis, stress testing. Wymagania: balance, circularity (interest on debt), supporting schedules (D&A, debt, working capital)." }),
  L(13, 0, 2, "Revenue forecasting approaches", { los: ["13.b"], diff: 3, hrs: 0.5, pitfalls: ["Single-method forecast — bottom-up i top-down razem dają lepszy wynik"], resources: stdRes(rd13), tags: ["concept"], notes: "Revenue forecasting: top-down (TAM × market share × penetration), bottom-up (units × price, store count × same-store sales), hybrydowy. Driver-based forecasting (volume × price × mix). Cyclicality i seasonality adjustments." }),
  L(13, 0, 3, "Cost forecasting and operating leverage", { los: ["13.b"], diff: 3, hrs: 0.5, pitfalls: ["Założenie, że wszystkie koszty skalują się liniowo z revenue"], resources: stdRes(rd13), tags: ["concept"], formulas: ["Operating leverage (DOL) = % Δ EBIT / % Δ Revenue", "DOL = (Revenue − Variable costs) / EBIT"], notes: "Koszty: fixed (rent, depreciation, salaries) vs variable (COGS-related materials, commissions). Operating leverage = % Δ EBIT / % Δ Revenue. Wysoki DOL → magnifikacja wpływu volume changes." }),
  L(13, 0, 4, "Working capital and capex modeling", { los: ["13.b"], diff: 3, hrs: 0.5, pitfalls: ["Pomijanie maintenance capex vs growth capex distinction"], resources: stdRes(rd13), tags: ["concept"], notes: "Working capital: zazwyczaj jako % revenue (DSO, DOH, DPO targets). Capex: maintenance (= D&A approximately) + growth (zależny od scale ambitions). Net debt schedule + interest expense (circular reference)." }),
  L(13, 0, 5, "Behavioral biases in forecasting", { los: ["13.c"], diff: 3, hrs: 0.25, pitfalls: ["Pomijanie biases — overconfidence i anchoring są pervasive"], resources: stdRes(rd13), tags: ["concept", "behavioral"], notes: "Biases: overconfidence (zbyt wąskie ranges), confirmation bias (selective evidence), anchoring (cele attached to historical numbers), management's bias (incentivized to be optimistic), illusion of control. Mitigation: pre-mortem, base rates, peer review." }),
]);

// ---------- LM 14 — IFRS vs US GAAP — Cumulative Differences (synthesis) ----------
const rd14 = "IFRS vs US GAAP — Cumulative Differences";
const lm14 = PH(14, rd14, "Synteza wszystkich kluczowych różnic IFRS vs US GAAP relevantnych dla L1 — checklist do egzaminu.", 1, [
  L(14, 0, 1, "LIFO permitted in US GAAP, prohibited under IFRS — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie różnicy w cross-border comparisons"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "US GAAP zezwala na LIFO (z LIFO conformity rule dla tax). IFRS (IAS 2) ZAKAZUJE LIFO — wyłącznie FIFO, weighted average lub specific identification." }),
  L(14, 0, 2, "Reversal of inventory writedowns — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie symetrii"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS: dozwolone odwrócenie inventory writedown gdy NRV recovers, ale tylko do pierwotnego cost. US GAAP: ZAKAZ odwrócenia (poza LIFO/retail — i tak rzadko)." }),
  L(14, 0, 3, "Revaluation model for PP&E — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że revaluation gain idzie zawsze w P&L"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS (IAS 16): pozwala na model rewaluacji PP&E do fair value (gains do OCI/revaluation surplus). US GAAP: ZAKAZ — tylko historical cost." }),
  L(14, 0, 4, "Investment property fair value option — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie owner-occupied z investment property"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS (IAS 40): osobna kategoria investment property z opcją cost lub fair value model (gains/losses w P&L). US GAAP: brak osobnej kategorii — owner-occupied PP&E." }),
  L(14, 0, 5, "Development costs capitalization — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że R&D zawsze expensed"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS (IAS 38): research expensed; development capitalized jeśli spełnione 6 kryteriów. US GAAP: wszystkie R&D expensed (poza software development costs po technological feasibility — ASC 985)." }),
  L(14, 0, 6, "Impairment reversals (non-goodwill) — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Mylenie z goodwill — goodwill reversal ZAKAZ w obu"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS: dozwolone odwrócenie impairment dla non-goodwill assets gdy recoverable amount wzrasta. US GAAP: ZAKAZ reversal (poza assets held for sale)." }),
  L(14, 0, 7, "Goodwill impairment testing procedure — synthesis", { los: ["14.a"], diff: 3, hrs: 0.25, pitfalls: ["Mylenie cash-generating unit (IFRS) z reporting unit (US GAAP)"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS: test na poziomie CGU; jeden krok (carrying vs recoverable amount = max(FVLCD, ViU)). US GAAP (post-2017): test na poziomie reporting unit; jeden krok (carrying vs fair value)." }),
  L(14, 0, 8, "Deferred tax classification — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Założenie, że US GAAP nadal ma current/non-current"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS i post-2017 US GAAP: WSZYSTKIE DTA/DTL są non-current. Pre-2017 US GAAP rozdzielał — częsty błąd w starszych źródłach." }),
  L(14, 0, 9, "Lease classification criteria — synthesis", { los: ["14.a"], diff: 3, hrs: 0.25, pitfalls: ["Założenie, że IFRS 16 i ASC 842 są identyczne"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS 16: single lessee model (wszystkie leases on-BS, depreciation + interest). ASC 842: dual model — finance lease (jak IFRS) lub operating lease (single straight-line lease expense, ale ROU asset i lease liability na BS)." }),
  L(14, 0, 10, "Component depreciation requirement — synthesis", { los: ["14.a"], diff: 2, hrs: 0.25, pitfalls: ["Pomijanie tej różnicy w analizie capital-intensive firms"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "IFRS (IAS 16): WYMAGA component depreciation (każdy istotny komponent o różnym useful life amortyzowany oddzielnie). US GAAP: dopuszcza, ale nie wymaga — większość firm stosuje composite." }),
  L(14, 0, 11, "CFO classification of interest/dividends paid/received — synthesis", { los: ["14.a"], diff: 2, hrs: 0.5, pitfalls: ["Pomijanie wpływu na cross-border CFO comparisons"], resources: stdRes(rd14), tags: ["ifrs-gaap-diff", "synthesis"], notes: "US GAAP rygorystyczne: interest paid/received i dividends received w CFO; dividends paid w CFF. IFRS elastyczne: interest paid w CFO lub CFF; interest received i dividends received w CFO lub CFI; dividends paid w CFO lub CFF." }),
]);

// All LMs collected at end
const lms = [lm1, lm2, lm3, lm4, lm5, lm6, lm7, lm8, lm9, lm10, lm11, lm12, lm13, lm14];

// ---------- ASSEMBLE MILESTONE ----------
const allLeaves = [];
function walk(n) {
  if (n.type === "task") allLeaves.push(n);
  if (n.children) n.children.forEach(walk);
}
lms.forEach(walk);
const totalHours = allLeaves.reduce((s, n) => s + n.metadata.estimated_hours, 0);

const milestone = {
  id: mkId(0, 0, 0),
  title: "Financial Statement Analysis",
  status: "not-started",
  type: "milestone",
  notes: `# Financial Statement Analysis\n\nNajwiększy obszar egzaminu CFA Level I: konstrukcja i analiza balance sheet, income statement i cash flow statement; ratio analysis; wybór polityk rachunkowości (inventories, long-lived assets, income taxes, long-term liabilities); jakość sprawozdań finansowych. Stanowi fundament dla equity, fixed income i corporate issuers.\n\n**Exam weight (mid-point):** 12.5%\n**Learning Modules:** ${lms.length}\n**Estimated study time:** 50-70h\n`,
  createdAt: ts,
  updatedAt: ts,
  metadata: {
    topic_number: TOPIC,
    topic_name: "Financial Statement Analysis",
    exam_weight_share: 12.5,
    lm_count: lms.length,
    estimated_hours_total: Math.round(totalHours * 100) / 100,
  },
  children: lms,
};

// ---------- VALIDATION ----------
const ids = new Set();
const errors = [];
function vWalk(n) {
  if (ids.has(n.id)) errors.push(`Duplicate ID: ${n.id}`);
  ids.add(n.id);
  if (n.type === "task") {
    const m = n.metadata;
    if (!m.suggested_resources || m.suggested_resources.length < 2)
      errors.push(`${n.id} ${n.title}: <2 resources`);
    if (!m.common_pitfalls || m.common_pitfalls.length < 1)
      errors.push(`${n.id} ${n.title}: 0 pitfalls`);
    if (typeof m.difficulty !== "number")
      errors.push(`${n.id} ${n.title}: missing difficulty`);
    if (typeof m.estimated_hours !== "number")
      errors.push(`${n.id} ${n.title}: missing hours`);
    if ((!m.formulas || m.formulas.length === 0) && !n.notes)
      errors.push(`${n.id} ${n.title}: no formulas and no notes`);
  }
  if (n.children) n.children.forEach(vWalk);
}
vWalk(milestone);

if (milestone.metadata.lm_count !== lms.length)
  errors.push(`lm_count mismatch`);

const out = resolve(import.meta.dirname, "topic-04-fsa.json");
writeFileSync(out, JSON.stringify(milestone, null, 2), "utf8");

const summary = {
  file: out,
  leafCount: allLeaves.length,
  totalLeafHours: Math.round(totalHours * 100) / 100,
  lmCount: lms.length,
  errors,
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error("VALIDATION ERRORS:", errors.length);
  process.exit(1);
}
