// src/lib/cardTypeConfig.ts
//
// The 8-type card configuration, lifted out of src/app/upload/page.tsx so it
// can be shared with the bulk-grading intake page (/submissions/new) without
// importing a page module — Next's typed-routes check rejects non-standard
// named exports from a page.tsx file (OmitWithTag/"{ [x: string]: never }").
//
// src/app/upload/page.tsx re-exports these two names for anything else that
// imported them from there before this split.

export const CARD_TYPES = {
  Sports: {
    label: 'Sports Card',
    icon: '',
    category: 'Sports',
    apiEndpoint: '/api/sports',
    route: '/sports',
    description: {
      title: 'Sports Cards',
      items: [
        'All major sports: Baseball, Basketball, Football, Hockey, Soccer',
        'Professional and vintage cards',
        'Rookie cards and special editions',
        'Complete player and team analysis'
      ]
    }
  },
  Pokemon: {
    label: 'Pokémon Card',
    icon: '',
    category: 'Pokemon',
    apiEndpoint: '/api/pokemon',
    route: '/pokemon',
    description: {
      title: 'Pokémon TCG',
      items: [
        'All Pokémon TCG sets and expansions',
        'English and Japanese cards',
        'Automatic card identification via API',
        'Rarity and market value analysis'
      ]
    }
  },
  MTG: {
    label: 'Magic: The Gathering Card',
    icon: '',
    category: 'MTG',
    apiEndpoint: '/api/mtg',
    route: '/mtg',
    description: {
      title: 'Magic: The Gathering',
      items: [
        'All MTG sets and formats',
        'Vintage, Legacy, Modern, Standard',
        'Foil and special treatments',
        'Rarity and playability assessment'
      ]
    }
  },
  Lorcana: {
    label: 'Disney Lorcana Card',
    icon: '',
    category: 'Lorcana',
    apiEndpoint: '/api/lorcana',
    route: '/lorcana',
    description: {
      title: 'Disney Lorcana',
      items: [
        'All Disney Lorcana sets',
        'Character and action cards',
        'Foil and enchanted variants',
        'Inkable status and gameplay analysis'
      ]
    }
  },
  'One Piece': {
    label: 'One Piece TCG Card',
    icon: '',
    category: 'One Piece',
    apiEndpoint: '/api/onepiece',
    route: '/onepiece',
    description: {
      title: 'One Piece TCG',
      items: [
        'All One Piece TCG sets and starter decks',
        'Leader, Character, Event, and Stage cards',
        'Parallel, Manga, and SP variants',
        'Color and power/cost analysis'
      ]
    }
  },
  'Yu-Gi-Oh': {
    label: 'Yu-Gi-Oh! TCG Card',
    icon: '',
    category: 'Yu-Gi-Oh',
    apiEndpoint: '/api/yugioh',
    route: '/yugioh',
    description: {
      title: 'Yu-Gi-Oh! TCG',
      items: [
        'All Yu-Gi-Oh! TCG sets and editions',
        'Monster, Spell, and Trap cards',
        'Fusion, Synchro, XYZ, Link, and Pendulum',
        'Rarity and attribute analysis'
      ]
    }
  },
  // Naruto is a first-class dropdown choice but NOT a navigation category:
  // cards grade through the Other pipeline (category 'Other', sub_category
  // 'Naruto / Kayou'), where the Kayou identification enrichment picks them up.
  Naruto: {
    label: 'Naruto Card (Kayou)',
    icon: '',
    category: 'Other',
    apiEndpoint: '/api/other',
    route: '/other',
    description: {
      title: 'Naruto (Kayou) Cards',
      items: [
        'Kayou Naruto trading cards (NA releases)',
        'Heaven Scroll, Earth Scroll, Chapter Jin series',
        'Automatic identification by card number',
        'Rarity tier and character verification'
      ]
    }
  },
  Other: {
    label: 'Other Collectible Card',
    icon: '',
    category: 'Other',
    apiEndpoint: '/api/other',
    route: '/other',
    description: {
      title: 'Other Collectible Cards',
      items: [
        'Trading cards (non-sports, non-TCG)',
        'Entertainment cards (movies, TV, music)',
        'Art cards and limited editions',
        'Promotional and historical cards'
      ]
    }
  }
} as const;

// Sub-categories for "Other" card type, grouped by theme
export const OTHER_SUB_CATEGORIES = {
  TCG: [
    'Digimon', 'Dragon Ball', 'Flesh and Blood', 'Cardfight!! Vanguard',
    'Weiss Schwarz', 'MetaZoo', 'Force of Will', 'Final Fantasy TCG',
    'Universus', 'Battle Spirits', 'Shadowverse Evolve', 'Union Arena',
    'Naruto / Kayou'
  ],
  Entertainment: [
    'Star Wars', 'Marvel', 'DC Comics', 'Disney', 'Garbage Pail Kids',
    'Wacky Packages', 'WWE / Wrestling', 'Movie / TV', 'Music', 'Anime'
  ],
  Vintage: [
    'Non-Sport Vintage', 'Art Cards', 'Promotional', 'Racing', 'Historical'
  ],
  Other: [
    'Other'
  ]
} as const;

export type CardType = keyof typeof CARD_TYPES;
