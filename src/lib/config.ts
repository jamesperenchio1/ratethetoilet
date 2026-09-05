/**
 * Single source of truth for every tunable constant in the app.
 *
 * Change a value here and it changes everywhere it's used — no more hunting
 * across files. Two things deliberately live outside this file:
 *
 *  - CSS design tokens (colors, fonts, radii) → src/styles/tokens.css.
 *    They must be CSS custom properties; the app references them by name
 *    (e.g. `var(--score-great)`) so the *names* never need to appear here.
 *  - Env vars (VITE_SUPABASE_*) → .env.local.
 *
 * SQL mirrors (keep in sync when changing these):
 *  - `api.postRateLimitPerHour` (10)  → supabase/migrations/0002_raise_rate_limit.sql
 *  - `venue.matchRadiusM` (100)       → supabase/migrations/0003_floor_and_venues.sql
 *  - `venue.lookupRadiusM` (500)      → supabase/migrations/0003_floor_and_venues.sql
 *  - venue type seed                  → supabase/migrations/0004_venue_types_multiselect.sql
 */
export const CONFIG = {
  map: {
    /** Fallback map center (Bangkok) used when device GPS is unavailable. */
    defaultCenter: { lat: 13.7563, lng: 100.5018 },
    /** Cap for programmatic zoom (fitBounds/easeTo) so revisits don't dive into a cluster. */
    maxZoom: 16,
    /** Escalating search radii for the nearby list (meters). */
    searchRadiiM: [3000, 15000, 60000],
    /** Collapsed height of the nearby sheet on Home (px). */
    sheetPeekPx: 132,
    /** Screen distance (px) at/below which map pins are treated as overlapping. */
    pinSpreadThresholdPx: 36,
    /** Ring circumference budget per pin (px) when spreading an overlapping cluster. */
    pinSpreadStepPx: 40,
    tileStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
    /** Device geolocation request timeout (ms). */
    geolocationTimeoutMs: 8000,
  },

  wizard: {
    /** Max photos per toilet (single-restroom and per-floor). */
    maxPhotos: 6,
    /** Default slider value for cleanliness/smell/privacy. */
    defaultScore: 50,
    venueNameMaxLength: 120,
    /** Mirrors the `char_length(body) between 1 and 500` check on reviews. */
    reviewMaxLength: 500,
    /** Mirrors the `hint_note_length` check added in 0006_audit_hardening.sql. */
    hintNoteMaxLength: 2000,
    supplies: ["Paper", "Hose", "Bring your own", "Not sure"],
    floorPresets: ["G", "1", "2", "3", "B1", "B2"],
    hintChips: [
      "Round the back",
      "Behind the building",
      "Upstairs",
      "Downstairs",
      "No sign",
      "Easy to miss",
      "Near the entrance",
    ],
    /** Debounce for reverse-geocoding a dropped pin (ms). */
    reverseGeocodeDelayMs: 300,
    /** Debounce for the place-search box (ms). */
    placeSearchDelayMs: 350,
    /** How many photos to compress+upload in parallel (a flaky link is better
     * served by a couple of small transfers than one big serial queue). */
    photoUploadConcurrency: 2,
  },

  labels: {
    venue: {
      mall: "Mall",
      gas: "Gas station",
      temple: "Temple",
      transit: "Transit",
      public: "Public",
      cafe: "Café",
      hotel: "Hotel",
      street: "Street",
    } as Record<string, string>,
    access: {
      free: "Free",
      paid: "Paid",
      customers_only: "Customers only",
      ask_for_key: "Ask for key",
    } as Record<string, string>,
  },

  score: {
    /** scoreColor() band cutoffs (inclusive, descending). */
    color: { great: 80, good: 65, ok: 45 },
    /** scoreLabel() band cutoffs (inclusive, descending). */
    label: { spotless: 90, clean: 75, usable: 60, rough: 40 },
  },

  handle: {
    adjectives: [
      "Splashy", "Giggling", "Soggy", "Squeaky", "Mysterious", "Wobbly", "Sneaky",
      "Dripping", "Plucky", "Fancy", "Grumpy", "Zesty", "Sparkly", "Bashful",
      "Cheeky", "Nifty", "Rowdy", "Cozy", "Breezy", "Bubbly", "Tidy", "Hasty",
      "Jolly", "Sassy", "Quiet", "Loud", "Swift", "Lucky", "Gassy", "Fresh",
      "Polished", "Shy", "Bold", "Curious", "Dapper", "Wild", "Calm", "Chirpy",
      "Frosty", "Sunny", "Misty", "Glossy", "Tiny", "Mighty", "Silky", "Damp",
      "Crafty", "Spry",
    ],
    nouns: [
      "Otter", "Penguin", "Raccoon", "Platypus", "Walrus", "Badger", "Hedgehog",
      "Sloth", "Ferret", "Llama", "Beaver", "Gopher", "Pigeon", "Toad", "Newt",
      "Weasel", "Moose", "Yak", "Armadillo", "Wombat", "Meerkat", "Narwhal",
      "Iguana", "Possum", "Plunger", "Stall", "Faucet", "Cistern", "Throne",
      "Loo", "Flush", "Bidet", "Urinal", "Commode", "Drain", "Nozzle", "Bowl",
      "Handle", "Tank", "Seat", "Sink", "Mop", "Puddle", "Geyser", "Sprinkle",
      "Splash", "Trickle", "Gurgle", "Ripple",
    ],
    maxLength: 24,
    /** Probability a generated handle gets a numeric suffix. */
    suffixProbability: 0.5,
    /** Number of suggestions shown in the picker sheet. */
    suggestionCount: 4,
  },

  api: {
    photoBucket: "toilet-photos",
    defaultRadiusM: 3000,
    searchLimit: 20,
    /** Mirrors the `limit` in the toilets_near() RPC. */
    nearbyLimit: 200,
    /** Hard cap on listAllToilets() — loose on purpose (the app is small),
     * but an unbounded "select *" isn't safe to leave in forever. */
    allToiletsLimit: 3000,
    /** Posts (toilets + reviews combined) per rolling hour. SQL mirror above. */
    postRateLimitPerHour: 10,
    /** Photon geocoding fetch timeout (ms). */
    geocodeTimeoutMs: 6000,
    geocodeSearchLimit: 6,
    /** Photon (photon.komoot.io) keyless OSM geocoder base URL. */
    geocodeBaseUrl: "https://photon.komoot.io",
    /** Thailand bounding box [minLon, minLat, maxLon, maxLat] — a HARD filter so
     * "root bar" returns Bangkok venues instead of higher-traffic US ones. */
    geocodeCountryBbox: [97.34, 5.61, 105.64, 20.46],
  },

  venue: {
    /** Proximity (m) within which find_or_create_venue() reuses a venue. */
    matchRadiusM: 100,
    /** Proximity (m) the wizard's "attach to existing venue" lookup searches. */
    lookupRadiusM: 500,
  },

  storage: {
    draftKey: "toilet-draft:v1",
    recentsKey: "recent-searches",
    nudgeKey: "ratethetoilet:nudge-dismissed",
    queuePrefix: "queue:",
    /** Max remembered searches shown on the search page. */
    recentsMax: 5,
    /** Service-worker update poll interval (ms). */
    swPollMs: 60_000,
  },

  search: {
    /** Debounce for the search page's query box (ms). */
    debounceMs: 250,
  },

  report: {
    photoReasons: [
      "Shows a person or a face",
      "Not a toilet at all",
      "Photo is not of this toilet",
      "Graphic or disgusting shot",
      "Advertising or spam",
      "Something else — closed, duplicate, wrong pin…",
    ],
    contentReasons: [
      "Wrong or outdated — I was just there",
      "Directions send you somewhere else",
      "Abusive or personal attack",
      "Advertising or spam",
      "Names a staff member",
      "Something else",
    ],
  },
};
