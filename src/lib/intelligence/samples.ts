/**
 * Sample researches shown before any live run — realistic, hand-curated
 * examples of the pipeline's output so the page demos instantly without
 * burning Apify/Anthropic quota. Live runs replace these on screen.
 */

import type { Research } from "@/lib/intelligence/types";

export const SAMPLE_RESEARCHES: Research[] = [
  {
    query: "home security",
    kind: "keyword",
    country: "US",
    fetchedAt: "2026-07-03T14:20:00Z",
    source: "sample",
    ads: [
      {
        id: "hs-1",
        pageName: "SimpliSafe",
        body: "Package thieves hate this. Our outdoor camera + siren scares them off before they touch your porch. No contract. No wiring. Set up in 30 minutes — protect your whole home for less than $1/day.",
        ctaType: "SHOP_NOW",
        title: "Whole-home security, no contract",
        mediaUrl: null,
        mediaKind: "video",
        landingUrl: "https://simplisafe.com/home-security-shop",
        startedRunning: "2026-03-11",
        platforms: ["facebook", "instagram"],
      },
      {
        id: "hs-2",
        pageName: "ADT",
        body: "Your neighbors just got broken into. Would your home be next? Get a FREE quote in 60 seconds and see why 6 million homes trust ADT.",
        ctaType: "GET_QUOTE",
        title: "Free Quote in 60 Seconds",
        mediaUrl: null,
        mediaKind: "image",
        landingUrl: "https://www.adt.com/get-a-quote",
        startedRunning: "2026-05-02",
        platforms: ["facebook"],
      },
      {
        id: "hs-3",
        pageName: "Vivint Smart Home",
        body: "I caught the delivery driver throwing my package on camera 📦 …and got a replacement in one tap. Smart security that actually does something. See if your address qualifies for pro install this month.",
        ctaType: "LEARN_MORE",
        title: "See If Your Address Qualifies",
        mediaUrl: null,
        mediaKind: "video",
        landingUrl: "https://www.vivint.com/packages",
        startedRunning: "2026-01-28",
        platforms: ["facebook", "instagram", "audience_network"],
      },
      {
        id: "hs-4",
        pageName: "Deep Sentinel",
        body: "Cameras record crime. Guards STOP it. Real humans watch your property and intervene in under 30 seconds. Watch a real break-in get stopped live →",
        ctaType: "WATCH_MORE",
        title: "Guards, not just cameras",
        mediaUrl: null,
        mediaKind: "video",
        landingUrl: "https://www.deepsentinel.com/",
        startedRunning: "2025-12-15",
        platforms: ["facebook", "instagram"],
      },
    ],
    analyses: [
      {
        adId: "hs-1",
        hook: "\"Package thieves hate this.\" — a pattern-interrupt villain framing in the first 3 words",
        angle: "problem-agitation + price anchor",
        format: "doorbell-cam footage montage video",
        emotion: "vigilance",
        whyItWorks:
          "Opens on the highest-frequency fear (porch piracy) that nearly every homeowner has experienced, then defuses every objection in sequence: no contract, no wiring, 30-minute setup, under $1/day. Running since March — 4 months of spend says the economics work.",
        reproductionPrompt:
          "15-second vertical video. Open with 2 seconds of real-looking doorbell-cam footage: a hooded figure approaching a porch at dusk, freeze-frame with a red outline as a siren chirp plays. Cut to a homeowner casually arming the system from a phone at a kitchen counter. Text overlays in order: 'Package thieves hate this' → 'No contract. No wiring.' → 'Under $1/day'. Warm domestic lighting for the interior, cold blue for the exterior threat. End card: product shot with a 'Shop Now' button and a 30-minute-setup badge.",
      },
      {
        adId: "hs-2",
        hook: "\"Your neighbors just got broken into.\" — proximity fear, second person",
        angle: "fear of loss + social proof",
        format: "static image with quote-style headline",
        emotion: "fear",
        whyItWorks:
          "Classic lead-gen construction: a visceral opening line, a 60-second effort promise, and a 6-million-home trust stat. The GET_QUOTE CTA routes straight to a form — this is a pure cost-per-lead play, the same economics an affiliate would run.",
        reproductionPrompt:
          "Static image ad. Nighttime suburban street scene, one house lit by a police light bar glow (implied, no officers visible). Bold white headline over a dark gradient: 'Your neighbors just got broken into.' Subhead: 'Would your home be next?' Bottom third: bright CTA bar 'Get your FREE quote in 60 seconds' with a trust line '6,000,000+ homes protected'. High contrast, editorial-photo style, no illustration.",
      },
      {
        adId: "hs-3",
        hook: "First-person caught-on-camera story: \"I caught the delivery driver throwing my package\"",
        angle: "UGC storytelling + qualification scarcity",
        format: "UGC selfie video with screen-recording insert",
        emotion: "satisfaction",
        whyItWorks:
          "The story sells a moment of justice, not hardware — the camera 'actually does something'. The 'see if your address qualifies' close converts a product pitch into an application, which lifts CTR and pre-frames the lead form. Running 5+ months.",
        reproductionPrompt:
          "20-second UGC-style vertical video, single continuous selfie take. Casting: 30s homeowner, natural light, driveway setting. Script beats: (1) 'You will not believe what my camera caught yesterday' (2) cut to 3-second 'camera footage' insert of a package being tossed (3) back to selfie: 'one tap and I had a replacement coming' (4) close: 'they're doing professional install in [state] this month — check if your address qualifies, link below.' Captions on, slightly imperfect framing for authenticity. CTA: Learn More.",
      },
      {
        adId: "hs-4",
        hook: "\"Cameras record crime. Guards STOP it.\" — category reframe in 7 words",
        angle: "category differentiation + live proof",
        format: "real-footage proof video",
        emotion: "trust",
        whyItWorks:
          "Instead of competing on camera specs, it reframes the entire category as inadequate ('recording isn't protection') and owns the alternative. The 'watch a real break-in get stopped' promise is irresistible curiosity bait and doubles as proof. Longest-running ad in the set — 7 months.",
        reproductionPrompt:
          "30-second video built around one piece of real-looking security footage. Structure: (1) 3s title card, white on black: 'Cameras record crime.' (2) hard cut: 'Guards STOP it.' (3) 15s of night-vision footage of an intruder approaching, then a loudspeaker voice: 'You in the red jacket — police have been called' — intruder flees (4) cut to a calm guard-station operator (5) end card: 'Real humans. Under 30 seconds.' CTA: Watch More. Keep the footage grade grainy and timestamped for authenticity.",
      },
    ],
    patterns: [
      "Every ad leads with a threat narrative (porch theft, break-in, package abuse) before naming the product — fear does the targeting.",
      "Effort-minimizing quantifiers everywhere: '60 seconds', '30 minutes', 'one tap', 'under $1/day'.",
      "Video ads use surveillance-style footage as proof; authenticity beats production value in this vertical.",
      "Two distinct funnels: quote/lead-capture (ADT, Vivint) vs direct purchase (SimpliSafe) — the lead-gen funnels match affiliate economics best.",
      "Qualification framing ('see if your address qualifies') converts pitches into applications and lifts form completion.",
    ],
    recommendations: [
      "Build a UGC 'caught on camera' hook batch for the home-security offer — it's the proven format across three competitors and cheap to produce.",
      "Test a qualification-framed lead form ('check if your address qualifies') against the current direct quote form.",
      "Anchor CPL math to a 60-second quote promise in the ad copy; competitors have trained users to expect it.",
      "The category-reframe angle (Deep Sentinel) is unclaimed in native — test it as a Taboola advertorial headline.",
    ],
    landingPageNotes:
      "The top ad routes to a package-builder funnel: a 4-step configurator (home size → doors → priorities → quote) rather than a static form, which qualifies leads while feeling like a product experience. Trust bar with review count and media logos appears above the fold; pricing is withheld until step 4 to keep configurator momentum.",
  },
  {
    query: "GLP-1 weight loss",
    kind: "keyword",
    country: "US",
    fetchedAt: "2026-07-03T15:05:00Z",
    source: "sample",
    ads: [
      {
        id: "glp-1",
        pageName: "Hers",
        body: "Weight loss that doesn't feel like a fight. Access GLP-1s through a licensed provider — if you qualify, your personalized plan ships free. No insurance needed. Take the 60-second quiz.",
        ctaType: "TAKE_QUIZ",
        title: "See if you qualify",
        mediaUrl: null,
        mediaKind: "image",
        landingUrl: "https://www.forhers.com/weight-loss",
        startedRunning: "2026-04-19",
        platforms: ["facebook", "instagram"],
      },
      {
        id: "glp-2",
        pageName: "Ro",
        body: "\"I tried everything for 15 years. This is the first thing that worked.\" — Maria, lost 43 lbs. Real patients, real providers, real results. Find out if GLP-1s are right for you.",
        ctaType: "LEARN_MORE",
        title: "Real patients. Real results.",
        mediaUrl: null,
        mediaKind: "video",
        landingUrl: "https://ro.co/weight-loss/",
        startedRunning: "2026-02-07",
        platforms: ["facebook", "instagram"],
      },
      {
        id: "glp-3",
        pageName: "Noom",
        body: "GLP-1s work better with the right habits. Noom's GLP-1 Companion helps you keep the weight off — even after the meds. Muscle preservation, nausea management, and a plan for week 53, not just week 1.",
        ctaType: "SIGN_UP",
        title: "The GLP-1 Companion",
        mediaUrl: null,
        mediaKind: "image",
        landingUrl: "https://www.noom.com/glp1",
        startedRunning: "2026-05-26",
        platforms: ["facebook"],
      },
    ],
    analyses: [
      {
        adId: "glp-1",
        hook: "\"Weight loss that doesn't feel like a fight\" — relief framing instead of transformation framing",
        angle: "effort removal + medical legitimacy",
        format: "clean static, clinical-soft aesthetic",
        emotion: "relief",
        whyItWorks:
          "Skips the before/after cliché and sells the absence of struggle. 'If you qualify' does double duty: regulatory cover and scarcity. The 60-second quiz is the classic telehealth lead funnel — low commitment, high completion.",
        reproductionPrompt:
          "Static image ad, soft neutral palette (sage/cream). Photography: a woman mid-30s laughing at a kitchen table with a water bottle — no scale, no tape measure, no before/after. Headline in a modern serif: 'Weight loss that doesn't feel like a fight.' Sub: 'Licensed providers · Ships free if you qualify · No insurance needed'. CTA button: 'Take the 60-second quiz'. The tone is a wellness brand, not a pharmacy.",
      },
      {
        adId: "glp-2",
        hook: "Patient quote with a number: \"15 years… first thing that worked… 43 lbs\"",
        angle: "testimonial + statistical specificity",
        format: "UGC testimonial video with lower-third stats",
        emotion: "hope",
        whyItWorks:
          "Specific numbers (15 years, 43 lbs) read as true where round numbers read as marketing. Running since February — a five-month testimonial is a strong signal this creative carries the account.",
        reproductionPrompt:
          "25-second testimonial video. Casting: woman 40s, natural home lighting, seated. Script structure: (1) the failure montage line — 'I tried everything for 15 years' (2) the turn — 'this is the first thing that actually worked' (3) lower-third overlay: 'Maria — 43 lbs' (4) 5-second clip of her provider video-call (5) end card: 'Find out if it's right for you' with a licensed-provider badge. Interview framing, subtle handheld movement, captions on. No needles, no product shots (platform policy).",
      },
      {
        adId: "glp-3",
        hook: "\"GLP-1s work better with the right habits\" — rides the wave instead of selling the drug",
        angle: "complement positioning + churn objection",
        format: "static with product-UI inset",
        emotion: "security",
        whyItWorks:
          "Noom can't sell the medication, so it sells week 53 — what happens after. Naming the real anxieties (rebound weight, muscle loss, nausea) makes it the adult in the room and captures demand competitors created.",
        reproductionPrompt:
          "Static image ad, split composition: left side a phone UI mock showing a weekly habit plan titled 'GLP-1 Companion', right side headline: 'The meds start it. Your habits keep it.' Three checkmark bullets: 'Muscle preservation' / 'Nausea management' / 'A plan for week 53'. Brand-bright accent color on the checkmarks. CTA: Sign Up. Aesthetic: friendly consumer app, not medical.",
      },
    ],
    patterns: [
      "Nobody shows the medication — creative leans on people, quizzes, and plans; compliance shapes the entire visual language.",
      "'If you qualify' appears across advertisers: regulatory necessity converted into scarcity mechanics.",
      "Quiz funnels dominate (60-second quiz, eligibility check) — the lead magnet IS the qualification step.",
      "Longevity leader is the specific-numbers testimonial, not the polished brand spot.",
    ],
    recommendations: [
      "For any GLP-1/telehealth offer, build the funnel as an eligibility quiz, not a form — every winning competitor does.",
      "Brief testimonial creative with hyper-specific numbers (years struggled, lbs lost, weeks on plan) — specificity is the pattern behind the longest-running ad.",
      "Test 'week 53' retention-anxiety messaging as a differentiated angle; only one player owns it.",
      "Mirror the compliance-safe visual language (no meds, no needles, no before/after) to keep account health on Meta.",
    ],
    landingPageNotes:
      "The top funnel opens directly into a multi-step eligibility quiz (state → goals → BMI calculator → health history) with a progress bar and reassurance microcopy under each step. Pricing appears only after qualification, framed per-month with the medication cost separated from the membership. Licensed-provider credentials and a money-back guarantee sit in a sticky footer throughout.",
  },
];
