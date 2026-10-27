// ---------------------------------------------------------------------------
// VC TOPUP — initial catalog / demo data
// Everything is plain data so the demo can be re-seeded by deleting data/db.json
// ---------------------------------------------------------------------------

const pkg = (label, price, extra = {}) => ({
  id: extra.id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  label,
  price,
  oldPrice: extra.oldPrice || null,
  bonus: extra.bonus || null,
  popular: !!extra.popular,
  ...extra,
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
  tag: o.tag || null,
  featured: !!o.featured,
  popular: !!o.popular,
  rating: o.rating || (4.7 + ((o.slug.length % 3) * 0.1)),
  sold: o.sold || 1200 + (o.slug.length * 437),
  requiresId: o.requiresId || 'player',
  idLabel: o.idLabel || { kh: 'លេខសម្គាល់អ្នកលេង (Player ID)', en: 'Player ID' },
  idPlaceholder: o.idPlaceholder || '123456789',
  currency: o.currency || 'units',
  desc: o.desc,
  instructions: o.instructions,
  delivery: o.delivery || { kh: '១–៥ នាទី · ផ្ញើដោយស្វ័យប្រវត្តិ', en: '1–5 min · Instant delivery' },
  packages: o.packages,
});

const playerDesc = (kh, en) => ({
  kh,
  en,
});

const standardInstructions = (name) => ({
  kh: [
    'ជ្រើសរើសកញ្ចប់ដែលអ្នកចង់បាន',
    `បញ្ចូលលេខសម្គាល់ ${name} របស់អ្នកឱ្យបានត្រឹមត្រូវ`,
    'បង់ប្រាក់តាមវិធីដែលងាយស្រួល',
    'ទទួលបានឥណទានក្នុងគណនីរបស់អ្នកភ្លាមៗ',
  ],
  en: [
    'Choose the package you want',
    `Enter your correct ${name} account ID`,
    'Pay with your preferred payment method',
    'Credits are added to your account instantly',
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
    sold: 18420, currency: 'Diamonds', idLabel: { kh: 'Player ID (លេខតួអង្គ)', en: 'Player ID (with Zone ID)' },
    idPlaceholder: '123456789 (1234)',
    desc: playerDesc('បញ្ចូលពេជ្រ (Diamonds) សម្រាប់ Mobile Legends: Bang Bang លឿន ងាយ និងមានសុវត្ថិភាព។', 'Top up Diamonds for Mobile Legends: Bang Bang — fast, easy and secure.'),
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
    sold: 15230, currency: 'Diamonds', idLabel: { kh: 'Free Fire Player ID', en: 'Free Fire Player ID' },
    desc: playerDesc('បញ្ចូលពេជ្រ Free Fire គ្រប់ចំនួន ដឹកជញ្ជូនភ្លាមៗ 24 ម៉ោង។', 'Instant Free Fire Diamonds top up, available 24/7.'),
    instructions: standardInstructions('Free Fire'),
    packages: [
      pkg('100 Diamonds', 1.05), pkg('210 Diamonds', 2.09), pkg('530 Diamonds', 5.19, { popular: true }),
      pkg('1,080 Diamonds', 10.29, { oldPrice: 11.29 }), pkg('2,180 Diamonds', 20.49),
    ],
  }),
  product({
    slug: 'pubg-mobile', name: 'PUBG Mobile', category: 'games',
    icon: 'Crosshair', colors: ['#eab308', '#a16207'], tag: 'POPULAR', featured: true, popular: true,
    sold: 12980, currency: 'UC', idLabel: { kh: 'PUBG Player ID', en: 'PUBG Mobile Player ID' },
    desc: playerDesc('ទិញ UC សម្រាប់ PUBG Mobile ក្នុងតម្លៃល្អបំផុត។ ទទួលបានក្នុងរយៈពេលប៉ុន្មាននាទី។', 'Buy PUBG Mobile UC at the best price. Delivered within minutes.'),
    instructions: standardInstructions('PUBG Mobile'),
    packages: [
      pkg('60 UC', 0.99), pkg('325 UC', 4.79), pkg('660 UC', 9.49, { popular: true }),
      pkg('1,800 UC', 24.99, { oldPrice: 26.99 }), pkg('3,850 UC', 49.99),
    ],
  }),
  product({
    slug: 'genshin-impact', name: 'Genshin Impact', category: 'games',
    icon: 'Sparkles', colors: ['#a78bfa', '#6366f1'], tag: 'NEW', featured: true,
    sold: 6420, currency: 'Genesis Crystals', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែល / UID គណនី', en: 'Account Email / UID' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បញ្ចូល Genesis Crystals សម្រាប់ Genshin Impact។ ទទួលបាន Welkin Moon ផងដែរ។', 'Top up Genesis Crystals for Genshin Impact. Blessing of the Welkin Moon also available.'),
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
    sold: 9870, currency: 'Tokens',
    desc: playerDesc('បញ្ចូល Tokens សម្រាប់ Honor of Kings ភ្លាមៗ ដោយគ្រាន់តែបញ្ចូល Player ID។', 'Instant Tokens top up for Honor of Kings with just your Player ID.'),
    instructions: standardInstructions('Honor of Kings'),
    packages: tiers([['80 Tokens', 1.15], ['240 Tokens', 3.39], ['400 Tokens', 5.59], ['800 Tokens', 10.99], ['1,200 Tokens', 16.49], ['2,400 Tokens', 32.99]], 2),
  }),
  product({
    slug: 'call-of-duty-mobile', name: 'Call of Duty: Mobile', category: 'games',
    icon: 'Target', colors: ['#71717a', '#18181b'], sold: 7640, currency: 'CP',
    desc: playerDesc('បញ្ចូល COD Points សម្រាប់ Call of Duty: Mobile លឿន និងងាយស្រួល។', 'Fast and easy COD Points top up for Call of Duty: Mobile.'),
    instructions: standardInstructions('COD Mobile'),
    packages: tiers([['80 CP', 0.99], ['400 CP', 4.79], ['800 CP', 9.49], ['2,000 CP', 22.99], ['4,000 CP', 44.99]], 1),
  }),
  product({
    slug: 'valorant', name: 'Valorant', category: 'games',
    icon: 'Shield', colors: ['#ef4444', '#7f1d1d'], tag: 'POPULAR', sold: 8110, currency: 'VP',
    requiresId: 'text', idLabel: { kh: 'Riot ID (Name#TAG)', en: 'Riot ID (Name#TAG)' }, idPlaceholder: 'PlayerKH#1234',
    desc: playerDesc('បញ្ចូល Valorant Points (VP) សម្រាប់ទិញ Skins និង Battle Pass។', 'Top up Valorant Points (VP) for skins and the Battle Pass.'),
    instructions: standardInstructions('Valorant'),
    packages: tiers([['475 VP', 4.99], ['1,050 VP', 9.99], ['2,050 VP', 19.99], ['3,650 VP', 34.99], ['5,350 VP', 49.99]], 1),
  }),
  product({
    slug: 'roblox', name: 'Roblox', category: 'games',
    icon: 'Boxes', colors: ['#ef4444', '#991b1b'], tag: 'NEW', sold: 5330, currency: 'Robux',
    requiresId: 'text', idLabel: { kh: 'ឈ្មោះអ្នកប្រើ Roblox', en: 'Roblox Username' }, idPlaceholder: 'your_username',
    desc: playerDesc('ទិញ Robux សម្រាប់ Roblox ក្នុងតម្លៃសមរម្យបំផុត។', 'Buy Robux for Roblox at the most affordable price.'),
    instructions: standardInstructions('Roblox'),
    packages: tiers([['80 Robux', 0.99], ['400 Robux', 4.99], ['800 Robux', 9.49,], ['1,700 Robux', 19.99], ['4,500 Robux', 49.99]], 1),
  }),
  product({
    slug: 'arena-of-valor', name: 'Arena of Valor', category: 'games',
    icon: 'Swords', colors: ['#0ea5e9', '#1e40af'], sold: 4210, currency: 'Vouchers',
    desc: playerDesc('បញ្ចូល Vouchers សម្រាប់ Arena of Valor (RoV)។', 'Top up Vouchers for Arena of Valor (RoV).'),
    instructions: standardInstructions('Arena of Valor'),
    packages: tiers([['80 Vouchers', 1.19], ['240 Vouchers', 3.49], ['450 Vouchers', 6.49], ['900 Vouchers', 12.79], ['1,800 Vouchers', 24.99]], 1),
  }),
  product({
    slug: 'clash-of-clans', name: 'Clash of Clans', category: 'games',
    icon: 'Shield', colors: ['#84cc16', '#3f6212'], sold: 3980, currency: 'Gems',
    requiresId: 'text', idLabel: { kh: 'Player Tag (#)', en: 'Player Tag (#)' }, idPlaceholder: '#ABC123DEF',
    desc: playerDesc('បញ្ចូល Gems សម្រាប់ Clash of Clans លឿនទាន់ចិត្ត។', 'Quick Gems top up for Clash of Clans.'),
    instructions: standardInstructions('Clash of Clans'),
    packages: tiers([['500 Gems', 4.49], ['1,200 Gems', 9.99], ['2,500 Gems', 19.99], ['6,500 Gems', 49.99]], 1),
  }),
  product({
    slug: 'wild-rift', name: 'League of Legends: Wild Rift', category: 'games',
    icon: 'Zap', colors: ['#06b6d4', '#1e3a8a'], sold: 3560, currency: 'Wild Cores',
    requiresId: 'text', idLabel: { kh: 'Riot ID (Name#TAG)', en: 'Riot ID (Name#TAG)' }, idPlaceholder: 'PlayerKH#1234',
    desc: playerDesc('បញ្ចូល Wild Cores សម្រាប់ Wild Rift ដើម្បីទិញ Skins ថ្មីៗ។', 'Top up Wild Cores for Wild Rift to unlock new skins.'),
    instructions: standardInstructions('Wild Rift'),
    packages: tiers([['100 Wild Cores', 0.99], ['525 Wild Cores', 4.99], ['1,125 Wild Cores', 9.99], ['2,375 Wild Cores', 19.99], ['5,000 Wild Cores', 39.99]], 1),
  }),
  product({
    slug: 'fc-mobile', name: 'EA SPORTS FC™ Mobile', category: 'games',
    icon: 'Trophy', colors: ['#22c55e', '#065f46'], sold: 2890, currency: 'FIFA Points',
    desc: playerDesc('បញ្ចូល FIFA Points សម្រាប់ EA SPORTS FC Mobile។', 'Top up FIFA Points for EA SPORTS FC Mobile.'),
    instructions: standardInstructions('FC Mobile'),
    packages: tiers([['500 Points', 4.99], ['1,050 Points', 9.99], ['2,200 Points', 19.99], ['5,750 Points', 49.99]], 1),
  }),

  // --------------------------------------------------------------- MOBILE
  product({
    slug: 'metfone', name: 'Metfone Top Up', category: 'mobile',
    icon: 'Smartphone', colors: ['#dc2626', '#7f1d1d'], tag: 'POPULAR', featured: true, popular: true,
    sold: 25400, currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Metfone', en: 'Metfone Phone Number' }, idPlaceholder: '012 345 678',
    desc: playerDesc('បញ្ចូលលុយទូរស័ព្ទ Metfone ភ្លាមៗ គ្រប់ចំនួន។ មិនគិតថ្លៃសេវា។', 'Instant Metfone mobile credit top up, any amount. No hidden fees.'),
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
    icon: 'Signal', colors: ['#16a34a', '#14532d'], tag: 'HOT', featured: true, sold: 21100,
    currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Smart', en: 'Smart Phone Number' }, idPlaceholder: '010 345 678',
    desc: playerDesc('បញ្ចូលលុយទូរស័ព្ទ Smart ភ្លាមៗ ដោយសុវត្ថិភាព។', 'Safe and instant Smart mobile credit top up.'),
    instructions: standardInstructions('Smart'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [1, 2, 3, 5, 10, 20, 50].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 2 })),
  }),
  product({
    slug: 'cellcard', name: 'Cellcard Top Up', category: 'mobile',
    icon: 'Radio', colors: ['#f59e0b', '#b45309'], sold: 12300, currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Cellcard', en: 'Cellcard Phone Number' }, idPlaceholder: '011 345 678',
    desc: playerDesc('បញ្ចូលលុយទូរស័ព្ទ Cellcard / CamGSM។', 'Cellcard / CamGSM mobile credit top up.'),
    instructions: standardInstructions('Cellcard'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [1, 2, 3, 5, 10, 20, 50].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 3 })),
  }),
  product({
    slug: 'cootel', name: 'CooTel Top Up', category: 'mobile',
    icon: 'Wifi', colors: ['#8b5cf6', '#4c1d95'], sold: 3420, currency: 'Credit', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ CooTel', en: 'CooTel Phone Number' }, idPlaceholder: '038 345 678',
    desc: playerDesc('បញ្ចូលលុយទូរស័ព្ទ CooTel រហ័ស។', 'Fast CooTel mobile credit top up.'),
    instructions: standardInstructions('CooTel'),
    delivery: { kh: 'ភ្លាមៗ · ០–៣០ វិនាទី', en: 'Instant · 0–30 seconds' },
    packages: [2, 5, 10, 20].map((v, i) => pkg(`$${v} ឥណទាន`, v, { popular: i === 1 })),
  }),

  // ------------------------------------------------------------- GIFT CARD
  product({
    slug: 'steam-wallet', name: 'Steam Wallet Code', category: 'giftcard',
    icon: 'Gamepad2', colors: ['#334155', '#0f172a'], tag: 'POPULAR', featured: true, popular: true,
    sold: 14200, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ Steam Wallet Code គ្រប់តម្លៃ។ ផ្ញើកូដទៅអ៊ីមែលរបស់អ្នកភ្លាមៗ។', 'Steam Wallet Codes in all values. Code delivered to your email instantly.'),
    instructions: standardInstructions('Steam'),
    packages: [5, 10, 20, 25, 50, 100].map((v, i) => pkg(`$${v} Steam Code`, v * 1.06, { popular: i === 2 })),
  }),
  product({
    slug: 'playstation-card', name: 'PlayStation Store Gift Card', category: 'giftcard',
    icon: 'Gamepad2', colors: ['#3b82f6', '#1e3a8a'], sold: 6210, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ PlayStation Store សម្រាប់ទិញហ្គេម និង PS Plus។', 'PlayStation Store cards for games and PS Plus.'),
    instructions: standardInstructions('PlayStation'),
    packages: tiers([['$10 PSN Card', 11.5], ['$25 PSN Card', 27.5], ['$50 PSN Card', 54.0], ['$100 PSN Card', 106.0]], 1),
  }),
  product({
    slug: 'xbox-card', name: 'Xbox Gift Card', category: 'giftcard',
    icon: 'Boxes', colors: ['#22c55e', '#14532d'], sold: 3980, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ Xbox Gift Card សម្រាប់ Game Pass និងហ្គេម។', 'Xbox Gift Cards for Game Pass and games.'),
    instructions: standardInstructions('Xbox'),
    packages: tiers([['$10 Xbox Card', 11.5], ['$25 Xbox Card', 27.5], ['$50 Xbox Card', 54.0]], 1),
  }),
  product({
    slug: 'google-play', name: 'Google Play Gift Card', category: 'giftcard',
    icon: 'Play', colors: ['#0ea5e9', '#16a34a'], sold: 5670, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ Google Play សម្រាប់ទិញ Apps, ហ្គេម និងភាពយន្ត។', 'Google Play cards for apps, games and movies.'),
    instructions: standardInstructions('Google Play'),
    packages: tiers([['$10 Google Play', 11.2], ['$25 Google Play', 27.0], ['$50 Google Play', 53.0]], 1),
  }),
  product({
    slug: 'apple-gift-card', name: 'Apple Gift Card', category: 'giftcard',
    icon: 'Apple', colors: ['#a1a1aa', '#3f3f46'], sold: 4890, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ Apple Gift Card សម្រាប់ App Store, iCloud និង Apple Music។', 'Apple Gift Cards for App Store, iCloud and Apple Music.'),
    instructions: standardInstructions('Apple'),
    packages: tiers([['$10 Apple Card', 11.4], ['$25 Apple Card', 27.4], ['$50 Apple Card', 53.9], ['$100 Apple Card', 106.5]], 1),
  }),
  product({
    slug: 'razer-gold', name: 'Razer Gold PIN', category: 'giftcard',
    icon: 'Zap', colors: ['#22c55e', '#065f46'], sold: 3120, currency: 'USD PIN', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('Razer Gold PIN សម្រាប់បញ្ចូលហ្គេមរាប់រយមុខ។', 'Razer Gold PIN for hundreds of games.'),
    instructions: standardInstructions('Razer Gold'),
    packages: tiers([['$10 Razer Gold', 10.8], ['$25 Razer Gold', 26.5], ['$50 Razer Gold', 52.0], ['$100 Razer Gold', 103.0]], 1),
  }),

  // ------------------------------------------------------------- STREAMING
  product({
    slug: 'netflix', name: 'Netflix Gift Card', category: 'streaming',
    icon: 'Clapperboard', colors: ['#ef4444', '#7f1d1d'], tag: 'HOT', featured: true, popular: true,
    sold: 9840, currency: 'USD Code', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលទទួលកូដ', en: 'Email to receive code' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('បណ្ណ Netflix សម្រាប់មើលភាពយន្ត និងស៊េរីគ្មានដែនកំណត់។', 'Netflix cards for unlimited movies and series.'),
    instructions: standardInstructions('Netflix'),
    packages: tiers([['$15 Netflix Card', 16.5], ['$25 Netflix Card', 27.0], ['$50 Netflix Card', 53.5]], 1),
  }),
  product({
    slug: 'spotify', name: 'Spotify Premium', category: 'streaming',
    icon: 'Music', colors: ['#22c55e', '#14532d'], sold: 7230, currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី Spotify', en: 'Spotify account email' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('Spotify Premium គ្មានពាណិជ្ជកម្ម ស្តាប់ចម្រៀងគ្រប់ទីកន្លែង។', 'Spotify Premium — ad-free music anywhere.'),
    instructions: standardInstructions('Spotify'),
    packages: tiers([['1 ខែ / 1 Month', 3.49], ['3 ខែ / 3 Months', 9.49], ['6 ខែ / 6 Months', 17.99], ['12 ខែ / 12 Months', 33.99]], 1),
  }),
  product({
    slug: 'youtube-premium', name: 'YouTube Premium', category: 'streaming',
    icon: 'Play', colors: ['#ef4444', '#b91c1c'], tag: 'NEW', sold: 6540, currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី Google', en: 'Google account email' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('YouTube Premium គ្មានពាណិជ្ជកម្ម + YouTube Music។', 'Ad-free YouTube Premium including YouTube Music.'),
    instructions: standardInstructions('YouTube'),
    packages: tiers([['1 ខែ / 1 Month', 3.99], ['3 ខែ / 3 Months', 10.99], ['12 ខែ / 12 Months', 39.99]], 1),
  }),
  product({
    slug: 'disney-plus', name: 'Disney+ Subscription', category: 'streaming',
    icon: 'Sparkles', colors: ['#3b82f6', '#312e81'], sold: 4210, currency: 'Months', requiresId: 'email',
    idLabel: { kh: 'អ៊ីមែលគណនី', en: 'Account email' }, idPlaceholder: 'your@email.com',
    desc: playerDesc('Disney+ ជាមួយ Marvel, Star Wars, Pixar និងច្រើនទៀត។', 'Disney+ with Marvel, Star Wars, Pixar and more.'),
    instructions: standardInstructions('Disney+'),
    packages: tiers([['1 ខែ / 1 Month', 5.49], ['3 ខែ / 3 Months', 14.99], ['12 ខែ / 12 Months', 54.99]], 1),
  }),

  // ----------------------------------------------------------------- APPS
  product({
    slug: 'tiktok-coins', name: 'TikTok Coins', category: 'apps',
    icon: 'Music', colors: ['#ec4899', '#0f172a'], tag: 'HOT', featured: true, popular: true,
    sold: 11300, currency: 'Coins', requiresId: 'text',
    idLabel: { kh: 'ឈ្មោះអ្នកប្រើ TikTok (@)', en: 'TikTok username (@)' }, idPlaceholder: '@your_username',
    desc: playerDesc('បញ្ចូល TikTok Coins ដើម្បីផ្ញើអំណោយក្នុង LIVE។', 'Top up TikTok Coins to send gifts during LIVE.'),
    instructions: standardInstructions('TikTok'),
    packages: tiers([['70 Coins', 0.99], ['350 Coins', 4.69], ['700 Coins', 9.29], ['1,400 Coins', 18.49], ['3,500 Coins', 45.99], ['7,000 Coins', 91.99]], 1),
  }),
  product({
    slug: 'bigo-live', name: 'Bigo Live Diamonds', category: 'apps',
    icon: 'Video', colors: ['#8b5cf6', '#1e1b4b'], sold: 5120, currency: 'Diamonds',
    desc: playerDesc('បញ្ចូល Bigo Live Diamonds ភ្លាមៗ។', 'Instant Bigo Live Diamonds top up.'),
    instructions: standardInstructions('Bigo Live'),
    packages: tiers([['100 Diamonds', 1.99], ['500 Diamonds', 9.49], ['1,000 Diamonds', 18.49], ['2,500 Diamonds', 45.99]], 1),
  }),
  product({
    slug: 'telegram-premium', name: 'Telegram Premium', category: 'apps',
    icon: 'Send', colors: ['#0ea5e9', '#0284c7'], tag: 'NEW', sold: 3870, currency: 'Months', requiresId: 'phone',
    idLabel: { kh: 'លេខទូរស័ព្ទ Telegram', en: 'Telegram phone number' }, idPlaceholder: '+855 12 345 678',
    desc: playerDesc('Telegram Premium ជាមួយមុខងារពិសេសៗ និងគ្មានពាណិជ្ជកម្ម។', 'Telegram Premium with exclusive features and no ads.'),
    instructions: standardInstructions('Telegram'),
    packages: tiers([['1 ខែ / 1 Month', 5.49], ['6 ខែ / 6 Months', 25.99], ['12 ខែ / 12 Months', 44.99]], 1),
  }),
  product({
    slug: 'discord-nitro', name: 'Discord Nitro', category: 'apps',
    icon: 'MessageCircle', colors: ['#6366f1', '#3730a3'], sold: 2980, currency: 'Months', requiresId: 'text',
    idLabel: { kh: 'ឈ្មោះអ្នកប្រើ Discord', en: 'Discord username' }, idPlaceholder: 'your_username',
    desc: playerDesc('Discord Nitro ជាមួយ Emoji, Boosts និង HD Streaming។', 'Discord Nitro with emojis, boosts and HD streaming.'),
    instructions: standardInstructions('Discord'),
    packages: tiers([['1 ខែ Nitro Basic', 3.49], ['1 ខែ Nitro', 10.49], ['12 ខែ Nitro', 99.99]], 1),
  }),
];

// ------------------------------------------------------------------ PROMOS
export const promos = [
  { code: 'VC10', type: 'percent', value: 10, minOrder: 5, maxUses: 1000, uses: 0, active: true, note: { kh: 'បញ្ចុះតម្លៃ ១០% សម្រាប់គ្រប់ការបញ្ជាទិញ', en: '10% off every order' } },
  { code: 'WELCOME5', type: 'fixed', value: 1, minOrder: 8, maxUses: 500, uses: 0, active: true, note: { kh: 'បញ្ចុះតម្លៃ $1 សម្រាប់អតិថិជនថ្មី', en: '$1 off for new customers' } },
  { code: 'KHMER2026', type: 'percent', value: 15, minOrder: 20, maxUses: 200, uses: 0, active: true, note: { kh: 'បញ្ចុះតម្លៃ ១៥% សម្រាប់ការបញ្ជាទិញលើស $20', en: '15% off orders over $20' } },
  { code: 'FREESHIP', type: 'fixed', value: 0.5, minOrder: 3, maxUses: 100, uses: 0, active: false, note: { kh: 'កូដចាស់ (បិទហើយ)', en: 'Legacy code (disabled)' } },
];

export const reviews = [
  { id: 1, name: 'ដារ៉ា សុភាព', nameEn: 'Dara Sopheap', role: { kh: 'អ្នកលេង MLBB', en: 'MLBB player' }, rating: 5, text: { kh: 'លឿនណាស់! កម្មវិធីបញ្ចូលពេជ្រតិចជាង ២ នាទី។ តម្លៃក៏ថោកជាងកន្លែងផ្សេងដែរ។ ណែនាំឱ្យប្រើ!', en: 'Super fast! Diamonds arrived in under 2 minutes and cheaper than anywhere else. Highly recommended!' }, avatar: 'DS', color: '#8b5cf6' },
  { id: 2, name: 'វិចិត្រ ចាន់ថា', nameEn: 'Vichetr Chantha', role: { kh: 'អតិថិជនប្រចាំ', en: 'Regular customer' }, rating: 5, text: { kh: 'ខ្ញុំបញ្ចូលលុយទូរស័ព្ទ Metfone រាល់ខែនៅទីនេះ។ ងាយស្រួល បង់តាម ABA ហើយបានភ្លាម។ ជំនួយក៏ល្អណាស់។', en: 'I top up my Metfone here every month. Easy, pay with ABA and it is instant. Great support too.' }, avatar: 'VC', color: '#06b6d4' },
  { id: 3, name: 'សុភាវី រិទ្ធី', nameEn: 'Sopheavy Rithy', role: { kh: 'អ្នកលេង Free Fire', en: 'Free Fire player' }, rating: 5, text: { kh: 'បញ្ចូល Free Fire Diamonds ច្រើនដងហើយ មិនដែលមានបញ្ហាទេ។ មានប្រាក់រង្វាន់ Points ទៀត។ ល្អណាស់!', en: 'Topped up Free Fire Diamonds many times, never had an issue. There are reward points too. Excellent!' }, avatar: 'SR', color: '#ec4899' },
  { id: 4, name: 'ម៉ាឡែន ពិសិដ្ឋ', nameEn: 'Malen Piseth', role: { kh: 'អ្នកប្រើ Steam', en: 'Steam user' }, rating: 5, text: { kh: 'ទិញ Steam Code បានកូដភ្លាមៗតាមអ៊ីមែល។ គេហទំព័រស្អាត និងងាយប្រើ ជាភាសាខ្មែរទៀត។', en: 'Bought a Steam code and got it by email instantly. Beautiful website, easy to use, and in Khmer.' }, avatar: 'MP', color: '#f59e0b' },
];

export const faqs = [
  { q: { kh: 'តើខ្ញុំទទួលឥណទានរយៈពេលប៉ុន្មាន?', en: 'How long until I receive my credits?' }, a: { kh: 'ការបញ្ចូលភាគច្រើនបញ្ចប់ក្នុងរយៈពេល ១–៥ នាទី បន្ទាប់ពីការទូទាត់ត្រូវបានបញ្ជាក់។ ការបញ្ចូលលុយទូរស័ព្ទគឺភ្លាមៗ។', en: 'Most top ups complete within 1–5 minutes after payment is confirmed. Mobile credit top ups are instant.' } },
  { q: { kh: 'តើខ្ញុំអាចបង់ប្រាក់តាមវិធីណាខ្លះ?', en: 'What payment methods do you accept?' }, a: { kh: 'យើងទទួល ABA Bank (KHQR), ACLEDA, Wing, TrueMoney និងប្រាក់ក្នុងគណនី VC Wallet។ គ្រប់ប្រតិបត្តិការមានសុវត្ថិភាព។', en: 'We accept ABA Bank (KHQR), ACLEDA, Wing, TrueMoney and your VC Wallet balance. All transactions are secure.' } },
  { q: { kh: 'ចុះបើខ្ញុំបញ្ចូលលេខគណនីខុស?', en: 'What if I enter the wrong account ID?' }, a: { kh: 'សូមពិនិត្យឱ្យបានហ្មត់ចត់មុនបង់ប្រាក់។ ប្រសិនបើមានបញ្ហា សូមទាក់ទងមកកាន់ Telegram របស់យើងភ្លាមៗ យើងនឹងជួយដោះស្រាយ។', en: 'Please double-check before paying. If something goes wrong, contact our Telegram support right away and we will help resolve it.' } },
  { q: { kh: 'តើមានប្រាក់រង្វាន់សម្រាប់អតិថិជនប្រចាំទេ?', en: 'Are there rewards for regular customers?' }, a: { kh: 'មាន! រាល់ការបញ្ជាទិញទទួលបាន VC Points។ ប្រមូល Points ដើម្បីប្តូរយកប្រាក់បញ្ចុះតម្លៃនៅការបញ្ជាទិញបន្ទាប់។', en: 'Yes! Every order earns VC Points. Collect points and redeem them for discounts on your next order.' } },
  { q: { kh: 'តើតម្លៃបង្ហាញជារូបិយប័ណ្ណអ្វី?', en: 'Which currency are the prices in?' }, a: { kh: 'តម្លៃទាំងអស់បង្ហាញជាដុល្លារអាមេរិក (USD) និងប្រាក់រៀល (KHR) យោងតាមអត្រា ១ ដុល្លារ = ៤.១០០ រៀល។', en: 'All prices are shown in US Dollars (USD) and Cambodian Riel (KHR) at a rate of 1 USD = 4,100 KHR.' } },
  { q: { kh: 'តើខ្ញុំអាចតាមដានការបញ្ជាទិញដោយរបៀបណា?', en: 'How can I track my order?' }, a: { kh: 'អ្នកអាចប្រើទំព័រ «តាមដានការបញ្ជាទិញ» ដោយបញ្ចូលលេខកូដបញ្ជាទិញ (VC-...) និងលេខទូរស័ព្ទរបស់អ្នក។ ឬចូលគណនីរបស់អ្នក។', en: 'Use the Track Order page with your order code (VC-...) and phone number, or simply sign in to your account.' } },
];

export const paymentMethods = [
  { id: 'aba', name: 'ABA Bank', nameKh: 'ធនាគារ ABA', icon: 'Landmark', colors: ['#e11d48', '#9f1239'], kind: 'khqr', account: 'VC TOPUP CO., LTD', number: '000 123 456', popular: true },
  { id: 'acleda', name: 'ACLEDA Bank', nameKh: 'ធនាគារ អេស៊ីលីដា', icon: 'Building2', colors: ['#1d4ed8', '#1e3a8a'], kind: 'khqr', account: 'VC TOPUP CO., LTD', number: '000 654 321' },
  { id: 'wing', name: 'Wing', nameKh: 'វីង', icon: 'Wallet', colors: ['#7c3aed', '#4c1d95'], kind: 'wallet', account: 'VC TOPUP', number: '012 345 678' },
  { id: 'truemoney', name: 'TrueMoney', nameKh: 'គ្រុម៉ានី', icon: 'CreditCard', colors: ['#f97316', '#c2410c'], kind: 'wallet', account: 'VC TOPUP', number: '010 987 654' },
  { id: 'wallet', name: 'VC Wallet', nameKh: 'កាបូប VC', icon: 'Gem', colors: ['#06b6d4', '#0e7490'], kind: 'balance' },
];

export const settings = {
  siteName: 'VC TOPUP',
  tagline: { kh: 'បញ្ចូលលុយហ្គេម លឿន ងាយ សុវត្ថិភាព', en: 'Fast, easy & secure game top ups' },
  exchangeRate: 4100,
  currency: 'USD',
  phone: '+855 12 345 678',
  telegram: '@vctopup',
  email: 'support@vctopup.com',
  address: { kh: 'ផ្លូវព្រះមុនីវង្ស, រាជធានីភ្នំពេញ, កម្ពុជា', en: 'Monivong Blvd, Phnom Penh, Cambodia' },
  announcement: { kh: 'ផ្តល់ជូនពិសេស៖ ប្រើកូដ VC10 ដើម្បីទទួលបានបញ្ចុះតម្លៃ ១០%!', en: 'Special offer: use code VC10 to get 10% off your order!' },
  stats: { orders: 128450, customers: 42900, games: 30, uptime: 99.9 },
};
