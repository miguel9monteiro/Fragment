// Pure-function classifier. Used by the Edge Function pollers to bucket each
// detected job into role_category and programme_type.
//
// Keep this deterministic, side-effect free, and dependency-free so it runs
// identically in Deno (Edge Functions) and Node (Next.js server components).
//
// Refinement strategy: when the /jobs page surfaces a misclassification, add
// a keyword to the relevant rule and add a regression case in the eventual
// test file. Do NOT replace the heuristic with an LLM call. The whole point
// is sub-second classification at poll time.

export type RoleCategory =
  | 'investment_banking'
  | 'sales_trading'
  | 'research'
  | 'asset_management'
  | 'wealth_management'
  | 'private_equity'
  | 'private_credit'
  | 'hedge_fund'
  | 'quant'
  | 'risk_compliance'
  | 'technology'
  | 'corporate_functions'
  | 'other'
  // Deprecated. Retained so the DB enum stays in sync; never emitted by classify().
  | 'risk';

// Programme type doubles as the "tenure ladder" — internships and grad schemes
// at the top, then post-grad tiers entry/mid/senior. Order in this union does
// not encode priority; PROGRAMME_RULES below does.
export type ProgrammeType =
  | 'spring_week'
  | 'summer_internship'
  | 'off_cycle_internship'
  | 'industrial_placement'
  | 'graduate'
  | 'entry_level'
  | 'mid_level'
  | 'senior'
  // Deprecated. Retained so the DB enum stays in sync; never emitted by classify().
  // Legacy rows still carry this value until reclassified by migration 0013.
  | 'experienced'
  | 'unknown';

interface Rule<T> {
  value: T;
  // Any one match wins; rules are ordered by specificity so more specific
  // categories (e.g. "private credit") fire before broader ones (e.g. "credit").
  patterns: readonly RegExp[];
}

const ROLE_RULES: readonly Rule<RoleCategory>[] = [
  // === Quant (high priority — catches algo trading before sales_trading) ===
  {
    value: 'quant',
    patterns: [
      /\bquant(itative)?\s+(?:analyst|developer|researcher|trader|strategist|engineer|dev)\b/i,
      /\bquantitative\s+(research|trading|strategy|finance)\b/i,
      /\balgo(?:rithmic)?\s+trad(?:ing|er)\b/i,
      /\b(?:hft|mft|lft)\s+(?:trader|trading|research|focus)\b/i,
      /\b(?:high|mid|low)[\s-]?frequency\s+(?:trad(?:ing|er)|research)\b/i,
      /\bmarket\s+making\b/i,
      /\bsystematic\s+(?:trad(?:ing|er)|strategy)\b/i,
      /\bstat(?:istical)?\s+arb(?:itrage)?\b/i,
    ],
  },

  // === Private credit (before private_equity / asset_management) ===
  {
    value: 'private_credit',
    patterns: [
      /\bprivate\s+credit\b/i,
      /\bdirect\s+lending\b/i,
      /\bdistressed\s+(?:debt|credit)\b/i,
      /\bspecial\s+situations\b/i,
      /\bmezzanine\b/i,
      /\bprivate\s+debt\b/i,
    ],
  },

  // === Private equity (catches VC, infra, real estate PE) ===
  {
    value: 'private_equity',
    patterns: [
      /\bprivate\s+equity\b/i,
      /\bbuyout(s)?\b/i,
      /\bgrowth\s+equity\b/i,
      /\bpe\s+(analyst|associate|intern)\b/i,
      /\bventure\s+capital\b/i,
      /\bvc\s+(analyst|associate|intern)\b/i,
      /\binfrastructure\s+(?:fund|invest(?:ment|ing)?|equity)\b/i,
      /\binvestment\s+(?:internship|intern|analyst|associate)\b.*\binfrastructure/i,
      /\binfrastructure\s+investment\b/i,
      /\binvestment\s+intern(?:ship)?\b/i,
      /\breal\s+estate\s+(?:private\s+equity|investment|invest(?:ing|or))\b/i,
      /\bsecondaries\b/i,
      /\bco[\s-]?invest(?:ment)?\b/i,
    ],
  },

  // === Hedge fund ===
  {
    value: 'hedge_fund',
    patterns: [
      /\bhedge\s+fund\b/i,
      /\blong[\s-]?short\b/i,
      /\bmulti[\s-]?strat(egy)?\b/i,
      /\bglobal\s+macro\b/i,
      /\bevent[\s-]?driven\b/i,
    ],
  },

  // === Wealth management ===
  {
    value: 'wealth_management',
    patterns: [
      /\bwealth\s+management\b/i,
      /\bprivate\s+bank(?:ing|er)?\b/i,
      /\bprivate\s+wealth\b/i,
      /\bfamily\s+office\b/i,
      /\brelationship\s+manager\b/i,
    ],
  },

  // === Research (Equity / Credit / Macro / Strategy) ===
  {
    value: 'research',
    patterns: [
      /\b(?:equity|credit|macro|fixed[\s-]?income|fx|rates|commodit(?:ies|y))\s+research\b/i,
      /\bresearch\s+(?:analyst|associate)\b/i,
      /\bequity\s+analyst\b/i,
      /\bsell[\s-]?side\s+research\b/i,
      /\bbuy[\s-]?side\s+research\b/i,
      /\bstrategist\b/i,
      /\bglobal\s+industry\s+analyst\b/i,
      /\bresearch\s+associate\b/i,
    ],
  },

  // === Asset management ===
  {
    value: 'asset_management',
    patterns: [
      /\basset\s+management\b/i,
      /\bportfolio\s+manag(?:er|ement)\b/i,
      /\bfund\s+manag(?:er|ement)\b/i,
      /\bmulti[\s-]?asset\b/i,
      /\bfixed\s+income\s+(?:portfolio|investment|solutions)\b/i,
      /\bindex\s+(?:portfolio|investment)\b/i,
      /\betf\s+(?:portfolio|investment|strategist)\b/i,
      /\binvestment\s+(?:management|specialist|strategist|advisor|adviser|analyst|solutions)\b/i,
      /\b(?:dc|defined\s+contribution)\s+(?:investment|pension)\b/i,
      /\bpensions?\s+capital\b/i,
      /\bprivate\s+markets\b/i,
      /\balternatives\b/i,
      /\baladdin\b/i, // BlackRock's AM platform — Aladdin roles are AM-adjacent
    ],
  },

  // === Sales & trading ===
  {
    value: 'sales_trading',
    patterns: [
      /\bsales\s*(?:&|and|\/)\s*trading\b/i,
      /\bs\s*&\s*t\b/i,
      /\b(?:equity|fixed[\s-]?income|fx|rates|credit|commodities|emerging\s+markets|macro)\s+(?:sales|trading|trader|salesperson)\b/i,
      /\b(?:trader|trading)\s+(?:analyst|associate|intern)\b/i,
      /\binstitutional\s+sales\b/i,
      /\bprime\s+(?:brokerage|services|structuring)\b/i,
      /\bexecution\s+trader\b/i,
      /\bderivatives\s+(?:sales|trader|trading|structurer)\b/i,
      /\bsecurities\s+lending\s+trader\b/i,
      /\bstructurer\b/i,
      /\bmacro\s+trader\b/i,
    ],
  },

  // === Investment banking ===
  {
    value: 'investment_banking',
    patterns: [
      /\binvestment\s+bank(?:ing|er)\b/i,
      /\bm\s*&\s*a\b/i,
      /\bmergers?\s*(?:&|and)\s*acquisitions?\b/i,
      /\bcapital\s+markets\b/i,
      /\bdcm\b/i,
      /\becm\b/i,
      /\b(?:lev|leveraged)\s+finance\b/i,
      /\bcoverage\s+(?:banker|analyst|associate)\b/i,
      /\b(?:tmt|fig|healthcare|industrials|consumer|natural\s+resources|power\s+&\s+utilities)\s+(?:banking|coverage|advisory|group)\b/i,
      /\bfinancial\s+institutions\s+group\b/i,
      /\bib\s+(?:analyst|associate|intern)\b/i,
      /\brestructuring\s+(?:analyst|associate|banker|advisory)\b/i,
      /\bsponsors?\s+(?:coverage|group)\b/i,
      /\bcorporate\s+debt\s+structuring\b/i,
      /\bstructured\s+(?:trade|finance|export\s+finance)\b/i,
      /\bliquid\s+financing\b/i,
      /\b(?:associate\s+)?banker\b/i,
    ],
  },

  // === Risk & compliance & audit & tax ===
  {
    value: 'risk_compliance',
    patterns: [
      /\b(?:credit|market|operational|liquidity|enterprise|model|counterparty|climate|portfolio|conduct)\s+risk\b/i,
      /\brisk\s+(?:manag(?:er|ement)|analyst|associate|officer|modeling|modelling)\b/i,
      /\bcompliance\b/i,
      /\baml\b/i,
      /\banti[\s-]?money[\s-]?laundering\b/i,
      /\bkyc\b/i,
      /\bfinancial\s+crime\b/i,
      /\bregulatory\s+(?:reporting|affairs|compliance)\b/i,
      /\b(?:internal|business|operational)\s+audit\b/i,
      /\bauditor\b/i,
      /\b(?:group\s+)?tax\b/i,
      /\bfund\s+tax\b/i,
      /\btransaction\s+monitoring\b/i,
      /\bhedge\s+accounting\b/i,
      /\bfund\s+accounting\b/i,
      /\baccountant\b/i,
      /\boversight\b/i,
    ],
  },

  // === Technology (engineering, data, ML, product) ===
  {
    value: 'technology',
    patterns: [
      // Engineers
      /\b(?:software|backend|frontend|full[\s-]?stack|platform|infrastructure(?:\s+support)?|cloud|devops|site\s+reliability|sre|test|qa|systems?|network|security|application|research|ai[\s-]?enabled)\s+engineer\b/i,
      /\bengineer(?:ing)?\s+(?:lead|manager|associate|intern|team\s+(?:lead|director))\b/i,
      /\bproduct\s+engineering\b/i,
      /\bsenior\s+engineer\b/i,
      // Developers
      /\b(?:java|python|c\+\+|c#|go|rust|javascript|typescript|react|scala|kdb\+?|\.net|node)\s+(?:engineer|developer|dev|software\s+developer)\b/i,
      /\b(?:senior|lead|junior|principal|staff)\s+(?:developer|software\s+(?:developer|engineer))\b/i,
      /\bsoftware\s+(?:developer|development|engineer)\b/i,
      /\b(?:full[\s-]?stack|backend|frontend|front[\s-]?office|security|core)\s+developer\b/i,
      /\b(?:database|databse)\s+administrator\b/i,
      // Data & ML & AI
      /\bdata\s+(?:engineer|scientist|analyst|architect|platform|modeller|modeler|operations|onboarding|protection|strategy|governance|stewardship|guardian)\b/i,
      /\bdata\s+(?:and\s+records\s+governance)\b/i,
      /\bmachine\s+learning\s+(?:engineer|researcher|scientist)\b/i,
      /\bml\s+(?:engineer|researcher|scientist|ops)\b/i,
      /\bai\s+(?:engineer|researcher|scientist|enabled|transformation)\b/i,
      /\bai\s*\/?\s*ml\b/i,
      /\bkdb\+?\b/i,
      /\banalytics\s+(?:specialist|engineer|manager|stewardship)\b/i,
      /\banalytics\s*(?:&|and)\s+reporting\b/i,
      /\bsystems?\s+analyst\b/i,
      /\btechnical\s+(?:ba|data\s+lead|lead)\b/i,
      /\bai\s+and\s+data\b/i,
      // Product
      /\bproduct\s+(?:manag(?:er|ement)|owner|analyst|marketing\s+manager|strategy(?:\s+lead)?)\b/i,
      /\btechnology\s+(?:product|analyst|associate|consultant|management)\b/i,
      /\btechnical\s+(?:product|programme|project|program|analyst|data\s+lead|business\s+analyst)\s+(?:manager|lead)?\b/i,
      /\b(?:trading|trade)\s+(?:platform|systems?)\s+(?:developer|engineer)\b/i,
      /\bcore\s+developer\b/i,
      // Security / cyber / infra
      /\b(?:devops|sre)\b/i,
      /\bcyber\s*(?:security|operations)\b/i,
      /\binformation\s+security\b/i,
      /\bcloud\s+(?:architect|engineer)\b/i,
      /\bsolution\s+architect\b/i,
      // Other tech roles
      /\bui\s*\/?\s*ux\s+designer\b/i,
      /\bux\s+designer\b/i,
      /\bservicenow\b/i,
      /\bagile\s+(?:lead|coach)\b/i,
      /\bscrum\s+master\b/i,
    ],
  },

  // === Corporate functions (HR, marketing, legal, BD, ops, finance/controller, real estate ops) ===
  {
    value: 'corporate_functions',
    patterns: [
      // HR
      /\bhuman\s+resources\b/i,
      /\bhr\s+(?:business\s+partner|generalist|manager|associate|analyst)\b/i,
      /\b(?:campus|graduate|talent)\s+(?:recruit(?:ment|ing|er)|acquisition)\b/i,
      /\brecruiter\b/i,
      /\btotal\s+rewards\b/i,
      /\blearning\s+(?:and|&)\s+development\b/i,
      /\bbenefits\s+(?:analyst|manager|specialist)\b/i,
      // Marketing / Comms / PR
      /\b(?:marketing|brand|content|communications?|comms|pr|public\s+relations|media\s+relations)\s+(?:manager|associate|analyst|director|specialist|lead|strategist)\b/i,
      /\bproduct\s+marketing\b/i,
      /\bcampaign\s+marketing\b/i,
      /\bmedia\s+relations\b/i,
      /\banalyst,?\s+surveys?\b/i,
      // Legal
      /\blegal\s+(?:counsel|associate|advisor|adviser|manager)\b/i,
      /\bgeneral\s+counsel\b/i,
      /\bcorporate\s+secretary\b/i,
      // BD / Sales (non-trading) / Client
      /\bbusiness\s+development\b/i,
      /\bpartnerships?\s+(?:manager|director|associate|lead)\b/i,
      /\b(?:client\s+service|client\s+success|customer\s+success|account\s+management|customer\s+(?:service|care))\b/i,
      /\bcommercialization\b/i,
      /\brelationship\s+(?:management|manager)\b/i,
      /\bclient\s+(?:transitions|cio)\b/i,
      /\bcorporate\s+access\b/i,
      // Operations
      /\b(?:trade|operations|settlement|reconciliation|middle\s+office|back\s+office)\s+(?:analyst|associate|manager|specialist|coordinator)\b/i,
      /\boperations\s+(?:analyst|associate|manager|specialist|lead)\b/i,
      /\bderivatives\s+operations\b/i,
      /\binvestment\s+operations\b/i,
      /\btrade\s+(?:capture|coordinator|support)\b/i,
      /\binnovation\s+(?:operations|delivery|strategy)\b/i,
      // Finance / Treasury / Accounting (corporate)
      /\b(?:financial\s+control|finance\s+manag|financial\s+manag|fp\s*&\s*a|fpna|treasury|controller|group\s+accountant|group\s+finance|strategic\s+finance)\b/i,
      /\bfx\s+hedging\b/i,
      /\bfinancial\s+modell?er\b/i,
      /\b(?:procurement|sourcing)\s+(?:associate|analyst|manager)\b/i,
      /\bsupplier\s+(?:service|manag)/i,
      // Strategy / change / chief of staff / governance
      /\b(?:group\s+)?strategy\b/i,
      /\bstrategic\s+(?:change|initiatives|finance)\b/i,
      /\bstrategy\s*(?:&|and)\s+(?:change|analytics|planning)\b/i,
      /\bchange\s+manager\b/i,
      /\bgovernance\s+manager\b/i,
      /\bchief\s+of\s+staff\b/i,
      /\bplanning\s+and\s+logistics\b/i,
      /\bexecution\s+offic\w+/i,
      /\bexecutive\s+assistant\b/i,
      /\bbusiness\s+(?:planning|manager)\b/i,
      // Real estate / property / facilities
      /\bsurveyor\b/i,
      /\b(?:real\s+estate|property)\s+(?:management|manager|services|surveyor|associate)\b/i,
      /\bfacilities\b/i,
      /\bhospitality\b/i,
      /\bevent\s+(?:coordinator|co[\s-]?ordinator|manager)\b/i,
      // ESG / sustainability
      /\bsustainability\b/i,
      /\besg\b/i,
      // Consulting / advisory (catch-all for consulting firms)
      /\b(?:consultant|consulting|advisory)\b/i,
      // Ambassador / generic outreach
      /\bambassador\b/i,
      // Revenue / global revenue
      /\bglobal\s+revenue\b/i,
    ],
  },
];

// Programme classifier doubles as tenure ladder. Rules are ordered by
// specificity, top to bottom: structured early-career programmes first
// (Spring Week > Summer > Industrial Placement > Off-cycle > Graduate),
// then post-grad tenure tiers (Senior > Mid > Entry).
//
// Order matters where titles ambiguously match multiple rules:
//   - "Senior Investment Analyst" => senior (not entry_level)
//   - "Vice President, Transaction Monitoring Analyst" => mid_level (not entry_level)
//   - "Graduate, Associate Product Manager" => graduate (not entry_level)
//   - "Investment Internship" => off_cycle_internship (fallback when no season)
const PROGRAMME_RULES: readonly Rule<ProgrammeType>[] = [
  {
    value: 'spring_week',
    patterns: [
      /\bspring\s+(?:week|insight|programme|program)\b/i,
      /\bspring\s+intern(?:ship)?\b/i,
      /\bspring\s+into\b/i,
    ],
  },
  {
    value: 'summer_internship',
    patterns: [
      /\bsummer\s+(?:analyst|associate|intern(?:ship)?|programme|program|insight)\b/i,
      /\bsummer\s+20\d{2}\b/i,
    ],
  },
  {
    value: 'industrial_placement',
    patterns: [
      /\bindustrial\s+placement\b/i,
      /\bplacement\s+(?:year|student|programme|program)\b/i,
      /\b12[\s-]?month\s+(?:placement|intern(?:ship)?)\b/i,
      /\bsandwich\s+(?:placement|year)\b/i,
    ],
  },
  {
    value: 'off_cycle_internship',
    patterns: [
      /\boff[\s-]?cycle\b/i,
      /\b(?:winter|autumn|fall)\s+intern(?:ship)?\b/i,
      // Fallback: any "intern" / "internship" not caught by a more specific
      // seasonal rule above. Bare "Investment Internship" lives here.
      /\bintern(?:ship)?\b/i,
    ],
  },
  {
    value: 'graduate',
    patterns: [
      // Bare "graduate" anywhere in the title is a strong grad-scheme signal,
      // and the previous rule required "graduate <token>" adjacency which
      // missed titles like "Graduate, Associate Product Manager".
      /\bgraduate\b/i,
      /\bgrad\s+scheme\b/i,
      /\bcampus\s+hire\b/i,
      /\bnew\s+(?:analyst|associate)\b/i,
      /\bfull[\s-]?time\s+analyst\b/i,
      /\bapprentice\b/i,
      /\btrainee\b/i,
      /\bclass\s+of\s+20\d{2}\b/i,
    ],
  },
  {
    value: 'senior',
    patterns: [
      /\bmanaging\s+director\b/i,
      /\bdirector\b/i,
      /\bhead\s+of\b/i,
      /\bprincipal\b/i,
      /\bpartner\b/i,
      /\bchief\b/i,
      /\bmd\b/i,
      /\bsenior\b/i,
      /\bstaff\b/i,
      /\blead\b/i,
    ],
  },
  {
    value: 'mid_level',
    patterns: [
      /\bvice\s+president\b/i,
      /\bvp\b/i,
      /\bassistant\s+vice\s+president\b/i,
      /\bavp\b/i,
      /\bmanager\b/i,
      // Explicit tier markers (e.g. "Mid-level Backend Engineer", "Mid Level Analyst")
      /\bmid[\s-]?level\b/i,
      /\bmid[\s-]?career\b/i,
    ],
  },
  {
    value: 'entry_level',
    patterns: [
      /\banalyst\b/i,
      /\bassociate\b/i,
      /\bjunior\b/i,
    ],
  },
];

export function classifyRole(title: string): RoleCategory {
  for (const rule of ROLE_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.value;
  }
  return 'other';
}

export function classifyProgramme(title: string): ProgrammeType {
  for (const rule of PROGRAMME_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.value;
  }
  return 'unknown';
}

export function classify(title: string): { category: RoleCategory; programme: ProgrammeType } {
  return {
    category: classifyRole(title),
    programme: classifyProgramme(title),
  };
}
