// ---------------------------------------------------------------------------
// VC TOPUP — catalog templates. Products stay hidden from customers until a
// real provider item ID and a fresh provider price have been configured.
// ---------------------------------------------------------------------------

const pkg = (label, price, extra = {}) => ({
  id: extra.id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  label,
  price,
  ...extra,
  // No invented discounts, bonuses, or bestseller claims in the real catalog.
  oldPrice: null,
  bonus: null,
  popular: false,
});

// Compact tier helper: [label, price] pairs -> packages
const tiers = (list, popularIndex = -1) =>
  list.map(([label, price], i) => pkg(label, price, { popular: i === popularIndex }));

const product = (o) => ({
  id: o.slug,
  slug: o.slug,
  name: o.name,
  category: o.category,
  icon: o.icon,
  colors: o.colors,
  tag: null,
  featured: false,
  popular: false,
  rating: null,
  sold: 0,
  brand: o.brand || ({
    'pubg-mobile': 'pubg', 'valorant': 'valorant', 'roblox': 'roblox',
    'wild-rift': 'leagueoflegends', 'smart': 'smart', 'steam-wallet': 'steam',
    'playstation-card': 'playstation', 'google-play': 'googleplay', 'apple-gift-card': 'apple',
    netflix: 'netflix', spotify: 'spotify', 'youtube-premium': 'youtube',
    'tiktok-coins': 'tiktok', 'telegram-premium': 'telegram', 'discord-nitro': 'discord',
  })[o.slug] || null,
  requiresId: o.requiresId || 'player',
  idLabel: o.idLabel || { kh: 'លេខសម្គាល់អ្នកលេង (Player ID)', en: 'Player ID' },
  idPlaceholder: o.idPlaceholder || '123456789',
  currency: o.currency || 'units',
  desc: {
    kh: `ជ្រើសរើសកញ្ចប់ ${o.name} ដែលមានស្តុកពីអ្នកផ្គត់ផ្គង់ផ្លូវការ។ ការបញ្ចូលត្រូវបញ្ជាក់តាមប្រព័ន្ធ។`,
    en: `Choose an available ${o.name} package supplied by the configured provider. Delivery is confirmed by the provider.`,
  },
  instructions: o.instructions,
  delivery: { kh: 'ពេលវេលាបញ្ជាក់ដោយអ្នកផ្គត់ផ្គង់', en: 'Timing confirmed by provider' },
  packages: o.packages,
});

const standardInstructions = (name) => ({
  kh: [
    'ជ្រើសរើសកញ្ចប់ដែលអ្នកចង់បាន',
    `បញ្ចូលលេខសម្គាល់ ${name} របស់អ្នកឱ្យបានត្រឹមត្រូវ`,
    'បង់ប្រាក់តាម Bakong KHQR របស់ហាង',
    'ពិនិត្យស្ថានភាពបញ្ចូលតាមអ្នកផ្គត់ផ្គង់',
  ],
  en: [
    'Choose a package that is currently available',
    `Enter your ${name} account ID and verify it carefully`,
    'Pay using the merchant’s configured Bakong KHQR',
    'Delivery status is confirmed by the top-up provider',
  ],
});

export const categories = [
  { id: 'games', name: { kh: 'ហ្គេម', en: 'Games' }, icon: 'Gamepad2', colors: ['#8b5cf6', '#4f46e5'] },
  { id: 'mobile', name: { kh: 'បញ្ចូលទូរស័ព្ទ', en: 'Mobile Top Up' }, icon: 'Smartphone', colors: ['#06b6d4', '#0284c7'] },
  { id: 'giftcard', name: { kh: 'បណ្ណហ្គេម', en: 'Gift Cards' }, icon: 'Gift', colors: ['#f59e0b', '#ef4444'] },
  { id: 'streaming', name: { kh: 'ភាពយន្ត & តន្ត្រី', en: 'Streaming' }, icon: 'Clapperboard', colors: ['#ec4899', '#8b5cf6'] },
  { id: 'apps', name: { kh: 'កម្មវិធី & សង្គម', en: 'Apps & Social' }, icon: 'MessageCircle', colors: ['#22c55e', '#0ea5e9'] },
];

export const products = [
  // ---------------------------------------------------------------- GAMES
  product({
    slug: 'mobile-legends', name: 'Mobile Legends: Bang Bang', category: 'games',
    icon: 'Swords', colors: ['#3b82f6', '#1e3a8a'], tag: 'HOT', featured: true, popular: true,
    currency: 'Diamonds', idLabel: { kh: 'Player ID (លេខតួអង្គ)', en: 'Player ID (with Zone ID)' },
    idPlaceholder: '123456789 (1234)',
    instructions: standardInstructions('MLBB'),
    packages: [
      pkg('86 Diamonds', 1.19, { popular: false }), pkg('172 Diamonds', 2.35),
      pkg('257 Diamonds', 3.49), pkg('706 Diamonds', 9.49, { popular: true, oldPrice: 10.49 }),
      pkg('1,050 Diamonds', 13.99), pkg('2,190 Diamonds', 27.99, { oldPrice: 30.99 }),
    ],
  }),
  product({
    slug: 'free-fire', name: 'Free Fire', category: 'games',
    icon: 'Flame', colors: ['#f97316', '#dc2626'], tag: 'HOT', featured: true, popular: true,
    currency: 'Diamonds', idLabel: { kh: 'Free Fire Player ID', en: 'Free Fire Player ID' },
    instructions: standardInstructions('Free Fire'),
    packages: [
      pkg('100 Diamonds', 1.05), pkg('210 Diamonds', 2.09), pkg('530 Diamonds', 5.19, { popular: true }),
      pkg('1,080 Diamonds', 10.29, { oldPrice: 11.29 }), pkg('2,180 Diamonds', 20.49),
    ],
  }),
  product({
    slug: 'pubg-mobile', name: 'PUBG Mobile', category: 'games',
    icon: 'Crosshair', colors: ['#eab308', '#a16207'], tag: 'POPULAR', featured: true, popular: true,
    currency: 'UC', idLabel: { kh: 'PUBG Player ID', en: 'PUBG Mobile Player ID' },
    instructions: standardInstructions('PUBG Mobile'),
    packages: [
      pkg('60 UC', 0.99), pkg('325 UC', 4.79), pkg('660 UC', 9.49, { popular: true }),
      pkg('1,800 UC', 24.99, { oldPrice: 26.99 }), pkg('3,850 UC', 49.99),
    ],
  }),
  product({
    slug: 'genshin-impact', name: 'Genshin Impact', category: 'games',
    icon: 'Sparkles', colors: ['#a78bfa', '#6366f1'], tag: 'NEW', featured: true,
    currency: 'Genesis Crystals', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែល / UID គណនី', en: 'Account Email / UID' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Genshin Impact'),
    packages: [
      pkg('60 + 6 Crystals', 0.99), pkg('330 + 30 Crystals', 4.99),
      pkg('1,090 + 110 Crystals', 14.99, { popular: true }),
      pkg('2,240 + 260 Crystals', 29.99), pkg('3,880 + 520 Crystals', 49.99),
      pkg('Welkin Moon (30 ថ្ងៃ)', 5.49),
    ],
  }),
  product({
    slug: 'honor-of-kings', name: 'Honor of Kings', category: 'games',
    icon: 'Crown', colors: ['#fbbf24', '#b45309'], tag: 'HOT', popular: true,
    currency: 'Tokens',
    instructions: standardInstructions('Honor of Kings'),
    packages: tiers([['80 Tokens', 1.15], ['240 Tokens', 3.39], ['400 Tokens', 5.59], ['800 Tokens', 10.99], ['1,200 Tokens', 16.49], ['2,400 Tokens', 32.99]], 2),
  }),
  product({
    slug: 'call-of-duty-mobile', name: 'Call of Duty: Mobile', category: 'games',
    icon: 'Target', colors: ['#71717a', '#18181b'], currency: 'CP',
    instructions: standardInstructions('COD Mobile'),
    packages: tiers([['80 CP', 0.99], ['400 CP', 4.79], ['800 CP', 9.49], ['2,000 CP', 22.99], ['4,000 CP', 44.99]], 1),
  }),
  product({
    slug: 'valorant', name: 'Valorant', category: 'games',
    icon: 'Shield', colors: ['#ef4444', '#7f1d1d'], tag: 'POPULAR', currency: 'VP',
    requiresId: 'text', idLabel: { kh: 'Riot ID (Name#TAG)', en: 'Riot ID (Name#TAG)' }, idPlaceholder: 'PlayerKH#1234',
    instructions: standardInstructions('Valorant'),
    packages: tiers([['475 VP', 4.99], ['1,050 VP', 9.99], ['2,050 VP', 19.99], ['3,650 VP', 34.99], ['5,350 VP', 49.99]], 1),
  }),
  product({
    slug: 'roblox', name: 'Roblox', category: 'games',
    icon: 'Boxes', colors: ['#ef4444', '#991b1b'], tag: 'NEW', currency: 'Robux',
    requiresId: 'text', idLabel: { kh: 'ឈ្មោះអ្នកប្រើ Roblox', en: 'Roblox Username' }, idPlaceholder: 'your_username',
    instructions: standardInstructions('Roblox'),
    packages: tiers([['80 Robux', 0.99], ['400 Robux', 4.99], ['800 Robux', 9.49,], ['1,700 Robux', 19.99], ['4,500 Robux', 49.99]], 1),
  }),
  product({
    slug: 'arena-of-valor', name: 'Arena of Valor', category: 'games',
    icon: 'Swords', colors: ['#0ea5e9', '#1e40af'], currency: 'Vouchers',
    instructions: standardInstructions('Arena of Valor'),
    packages: tiers([['80 Vouchers', 1.19], ['240 Vouchers', 3.49], ['450 Vouchers', 6.49], ['900 Vouchers', 12.79], ['1,800 Vouchers', 24.99]], 1),
  }),
  product({
    slug: 'clash-of-clans', name: 'Clash of Clans', category: 'games',
    icon: 'Shield', colors: ['#84cc16', '#3f6212'], currency: 'Gems',
    requiresId: 'text', idLabel: { kh: 'Player Tag (#)', en: 'Player Tag (#)' }, idPlaceholder: '#ABC123DEF',
    instructions: standardInstructions('Clash of Clans'),
    packages: tiers([['500 Gems', 4.49], ['1,200 Gems', 9.99], ['2,500 Gems', 19.99], ['6,500 Gems', 49.99]], 1),
  }),
  product({
    slug: 'wild-rift', name: 'League of Legends: Wild Rift', category: 'games',
    icon: 'Zap', colors: ['#06b6d4', '#1e3a8a'], currency: 'Wild Cores',
    requiresId: 'text', idLabel: { kh: 'Riot ID (Name#TAG)', en: 'Riot ID (Name#TAG)' }, idPlaceholder: 'PlayerKH#1234',
    instructions: standardInstructions('Wild Rift'),
    packages: tiers([['100 Wild Cores', 0.99], ['525 Wild Cores', 4.99], ['1,125 Wild Cores', 9.99], ['2,375 Wild Cores', 19.99], ['5,000 Wild Cores', 39.99]], 1),
  }),
  product({
    slug: 'fc-mobile', name: 'EA SPORTS FC™ Mobile', category: 'games',
    icon: 'Trophy', colors: ['#22c55e', '#065f46'], currency: 'FIFA Points',
    instructions: standardInstructions('FC Mobile'),
    packages: tiers([['500 Points', 4.99], ['1,050 Points', 9.99], ['2,200 Points', 19.99], ['5,750 Points', 49.99]], 1),
  }),

  // --------------------------------------------------------------- MOBILE
  product({
    slug: 'metfone', name: 'Metfone Top Up', category: 'mobile',
    icon: 'Smartphone', colors: ['#dc2626', '#7f1d1d'], tag: 'POPULAR', featured: true, popular: true,
    currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Metfone', en: 'Metfone Phone Number' }, idPlaceholder: '012 345 678',
    instructions: standardInstructions('Metfone'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [
      pkg('$1 ឥណទាន', 1.0), pkg('$2 ឥណទាន', 2.0), pkg('$3 ឥណទាន', 3.0, { popular: true }),
      pkg('$5 ឥណទាន', 5.0), pkg('$10 ឥណទាន', 10.0), pkg('$20 ឥណទាន', 20.0),
      pkg('$50 ឥណទាន', 50.0),
    ],
  }),
  product({
    slug: 'smart', name: 'Smart Top Up', category: 'mobile',
    icon: 'Signal', colors: ['#16a34a', '#14532d'], tag: 'HOT', featured: true, currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Smart', en: 'Smart Phone Number' }, idPlaceholder: '010 345 678',
    instructions: standardInstructions('Smart'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [1, 2, 3, 5, 10, 20, 50].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 2 })),
  }),
  product({
    slug: 'cellcard', name: 'Cellcard Top Up', category: 'mobile',
    icon: 'Radio', colors: ['#f59e0b', '#b45309'], currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Cellcard', en: 'Cellcard Phone Number' }, idPlaceholder: '011 345 678',
    instructions: standardInstructions('Cellcard'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [1, 2, 3, 5, 10, 20, 50].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 3 })),
  }),
  product({
    slug: 'cootel', name: 'CooTel Top Up', category: 'mobile',
    icon: 'Wifi', colors: ['#8b5cf6', '#4c1d95'], currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ CooTel', en: 'CooTel Phone Number' }, idPlaceholder: '038 345 678',
    instructions: standardInstructions('CooTel'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [2, 5, 10, 20].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 1 })),
  }),

  // ------------------------------------------------------------- GIFT CARD
  product({
    slug: 'steam-wallet', name: 'Steam Wallet Code', category: 'giftcard',
    icon: 'Gamepad2', colors: ['#334155', '#0f172a'], tag: 'POPULAR', featured: true, popular: true,
    currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Steam'),
    packages: [5, 10, 20, 25, 50, 100].map((v, i) => pkg(`$${v} Steam Code`, v * 1.06, { popular: i === 2 })),
  }),
  product({
    slug: 'playstation-card', name: 'PlayStation Store Gift Card', category: 'giftcard',
    icon: 'Gamepad2', colors: ['#3b82f6', '#1e3a8a'], currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('PlayStation'),
    packages: tiers([['$10 PSN Card', 11.5], ['$25 PSN Card', 27.5], ['$50 PSN Card', 54.0], ['$100 PSN Card', 106.0]], 1),
  }),
  product({
    slug: 'xbox-card', name: 'Xbox Gift Card', category: 'giftcard',
    icon: 'Boxes', colors: ['#22c55e', '#14532d'], currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Xbox'),
    packages: tiers([['$10 Xbox Card', 11.5], ['$25 Xbox Card', 27.5], ['$50 Xbox Card', 54.0]], 1),
  }),
  product({
    slug: 'google-play', name: 'Google Play Gift Card', category: 'giftcard',
    icon: 'Play', colors: ['#0ea5e9', '#16a34a'], currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Google Play'),
    packages: tiers([['$10 Google Play', 11.2], ['$25 Google Play', 27.0], ['$50 Google Play', 53.0]], 1),
  }),
  product({
    slug: 'apple-gift-card', name: 'Apple Gift Card', category: 'giftcard',
    icon: 'Apple', colors: ['#a1a1aa', '#3f3f46'], currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Apple'),
    packages: tiers([['$10 Apple Card', 11.4], ['$25 Apple Card', 27.4], ['$50 Apple Card', 53.9], ['$100 Apple Card', 106.5]], 1),
  }),
  product({
    slug: 'razer-gold', name: 'Razer Gold PIN', category: 'giftcard',
    icon: 'Zap', colors: ['#22c55e', '#065f46'], currency: 'USD PIN', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Razer Gold'),
    packages: tiers([['$10 Razer Gold', 10.8], ['$25 Razer Gold', 26.5], ['$50 Razer Gold', 52.0], ['$100 Razer Gold', 103.0]], 1),
  }),

  // ------------------------------------------------------------- STREAMING
  product({
    slug: 'netflix', name: 'Netflix Gift Card', category: 'streaming',
    icon: 'Clapperboard', colors: ['#ef4444', '#7f1d1d'], tag: 'HOT', featured: true, popular: true,
    currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Netflix'),
    packages: tiers([['$15 Netflix Card', 16.5], ['$25 Netflix Card', 27.0], ['$50 Netflix Card', 53.5]], 1),
  }),
  product({
    slug: 'spotify', name: 'Spotify Premium', category: 'streaming',
    icon: 'Music', colors: ['#22c55e', '#14532d'], currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី Spotify', en: 'Spotify account email' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Spotify'),
    packages: tiers([['1 ខែ / 1 Month', 3.49], ['3 ខែ / 3 Months', 9.49], ['6 ខែ / 6 Months', 17.99], ['12 ខែ / 12 Months', 33.99]], 1),
  }),
  product({
    slug: 'youtube-premium', name: 'YouTube Premium', category: 'streaming',
    icon: 'Play', colors: ['#ef4444', '#b91c1c'], tag: 'NEW', currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី Google', en: 'Google account email' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('YouTube'),
    packages: tiers([['1 ខែ / 1 Month', 3.99], ['3 ខែ / 3 Months', 10.99], ['12 ខែ / 12 Months', 39.99]], 1),
  }),
  product({
    slug: 'disney-plus', name: 'Disney+ Subscription', category: 'streaming',
    icon: 'Sparkles', colors: ['#3b82f6', '#312e81'], currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី', en: 'Account email' }, idPlaceholder: 'your@email.com',
    instructions: standardInstructions('Disney+'),
    packages: tiers([['1 ខែ / 1 Month', 5.49], ['3 ខែ / 3 Months', 14.99], ['12 ខែ / 12 Months', 54.99]], 1),
  }),

  // ----------------------------------------------------------------- APPS
  product({
    slug: 'tiktok-coins', name: 'TikTok Coins', category: 'apps',
    icon: 'Music', colors: ['#ec4899', '#0f172a'], tag: 'HOT', featured: true, popular: true,
    currency: 'Coins', requiresId: 'text',
    idLabel: { kh: 'ឈ្មោះអ្នកប្រើ TikTok (@)', en: 'TikTok username (@)' }, idPlaceholder: '@your_username',
    instructions: standardInstructions('TikTok'),
    packages: tiers([['70 Coins', 0.99], ['350 Coins', 4.69], ['700 Coins', 9.29], ['1,400 Coins', 18.49], ['3,500 Coins', 45.99], ['7,000 Coins', 91.99]], 1),
  }),
  product({
    slug: 'bigo-live', name: 'Bigo Live Diamonds', category: 'apps',
    icon: 'Video', colors: ['#8b5cf6', '#1e1b4b'], currency: 'Diamonds',
    instructions: standardInstructions('Bigo Live'),
    packages: tiers([['100 Diamonds', 1.99], ['500 Diamonds', 9.49], ['1,000 Diamonds', 18.49], ['2,500 Diamonds', 45.99]], 1),
  }),
  product({
    slug: 'telegram-premium', name: 'Telegram Premium', category: 'apps',
    icon: 'Send', colors: ['#0ea5e9', '#0284c7'], tag: 'NEW', currency: 'Months', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Telegram', en: 'Telegram phone number' }, idPlaceholder: '+855 12 345 678',
    instructions: standardInstructions('Telegram'),
    packages: tiers([['1 ខែ / 1 Month', 5.49], ['6 ខែ / 6 Months', 25.99], ['12 ខែ / 12 Months', 44.99]], 1),
  }),
  product({
    slug: 'discord-nitro', name: 'Discord Nitro', category: 'apps',
    icon: 'MessageCircle', colors: ['#6366f1', '#3730a3'], currency: 'Months', requiresId: 'text',
    idLabel: { kh: 'ឈ្មោះអ្នកប្រើ Discord', en: 'Discord username' }, idPlaceholder: 'your_username',
    instructions: standardInstructions('Discord'),
    packages: tiers([['1 ខែ Nitro Basic', 3.49], ['1 ខែ Nitro', 10.49], ['12 ខែ Nitro', 99.99]], 1),
  }),
];

// ------------------------------------------------------------------ PROMOS
export const promos = [];

export const reviews = [];

export const faqs = [];

export const paymentMethods = [
  { id: 'bakong', name: 'Bakong KHQR', nameKh: 'Bakong KHQR', icon: 'QrCode', colors: ['#2563eb', '#1d4ed8'], kind: 'khqr', account: '', number: '', popular: true },
];

/**
 * Catalog templates intentionally have NO real partner SKU. A real deployment must
 * map each package to the provider's numeric catalogue ID in
 * Admin → Real integrations (saved on the product as `partnerSku`), or set
 * SHOP2TOPUP_ITEM_MAP / PARTNER_SKU_MAP. The live gate refuses unmapped items,
 * so a demo label can never be mistaken for a real diamond product.
 */
for (const p of products) {
  for (const pk of p.packages) {
    if (pk.partnerSku === undefined) pk.partnerSku = null;
  }
}

export const settings = {
  siteName: 'VC TOPUP',
  tagline: { kh: 'ហាង top-up ឌីជីថល', en: 'Digital top-up storefront' },
  exchangeRate: null,
  currency: 'USD',
  phone: '',
  telegram: '',
  email: '',
  address: { kh: '', en: '' },
  announcement: { kh: '', en: '' },
  stats: { orders: 0, customers: 0, games: 0, uptime: null },
};
