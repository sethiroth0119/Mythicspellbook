import { useState, useRef, useEffect } from 'react';

// ===== AUTH / GAME LINKS =====
// Where the PLAY NOW / LOGIN buttons send players. Set this to wherever your
// game's deploy lives. Append `?mode=signup` or `?mode=signin` so the auth
// gate inside the game opens in the right state.
const GAME_URL = "/play"; // e.g. "https://play.mythicspellbook.com"or "./Files/Humanity Contain-gambit.html"const PLAY_URL = `${GAME_URL}?mode=signup`;
const LOGIN_URL = `${GAME_URL}?mode=signin`;

// ===== CARD DATA =====
// Live game cards drawn from the production catalog. cost = energy required.
// Stats: HP / ATK / DEF / MAG / RES / SPD (matches the in-game schema). Kalon
// flag = unit has a transformation form unlockable mid-match.
// `image` points to the actual card-art PNG in assets/artwork/. If the file
// doesn't exist yet the Card component falls back to the SVG placeholder.
const cards = [
 { id: 1, name: "Abraxas, Creator of Source", type: "Mythic Hero · Cosmic", faction: "Mage", rarity: "Mythic", cost: 8, hp: 60, atk: 22, def: 18, mag: 48, res: 32, spd: 2, frame: "gold", frameColor: "#a16207", glowColor: "rgba(168, 85, 247, 0.7)", flavor: "First wielder. First name. First fire.", effect: "Cosmic Sovereign — On play, draw 2 cards and gain +2 max energy. While alive, allied spells cost -1. Once per match, transforms into Abraxas, Source Kalon (HP 90, MAG 75, AOE breath: 40 dmg to all enemies).", element: "Shadow + Light", power: 97, kalon: true, image: "./assets/artwork/Abraxas.png"},
 { id: 2, name: "Garden of Eden", type: "Mythic Location · Sanctuary", faction: "Celestial", rarity: "Mythic", cost: 6, hp: null, atk: null, def: null, mag: null, res: null, spd: null, frame: "blue", frameColor: "#1e3a8a", glowColor: "rgba(168, 230, 255, 0.8)", flavor: "Where the first life was made — and is made again.", effect: "Field Spell — Allies heal 5 HP at the start of each of your turns. Allied Celestial / Plant / Fairy gain +2 ATK / +2 MAG. Replaces any active location.", element: "Light + Nature", power: 94, kalon: false, image: "./assets/artwork/Garden Of Eden.png"},
 { id: 3, name: "Giant Spider", type: "Bug Unit", faction: "Bug", rarity: "Rare", cost: 2, hp: 18, atk: 12, def: 6, mag: 8, res: 6, spd: 2, frame: "purple", frameColor: "#581c87", glowColor: "rgba(120, 113, 108, 0.7)", flavor: "Venomous forest hunter. Strikes from above.", effect: "Venomous — 30% chance to Poison on hit (5 dmg/turn for 2t). Bite + Poison Sting in learnset. Kalon Mode: Voltage Legs (HP 32, ATK 18, applies Paralysis).", element: "Shadow + Nature", power: 70, kalon: true, image: "./assets/artwork/giant Spider.png"},
 { id: 4, name: "Medical Center", type: "Location · Sanctuary", faction: "Celestial", rarity: "Uncommon", cost: 3, hp: null, atk: null, def: null, mag: null, res: null, spd: null, frame: "green", frameColor: "#15803d", glowColor: "rgba(34, 197, 94, 0.7)", flavor: "Some emergencies never end. Some never started.", effect: "Field Spell — All of your units heal 4 HP per turn. Replaces any active location. Lasts until destroyed by Erosion / Dispel Field / Geomancer passive.", element: "Light", power: 68, kalon: false, image: "./assets/artwork/Medical Center.png"},
 { id: 5, name: "Tar Pit", type: "Spell · Slow", faction: "Mage", rarity: "Common", cost: 1, hp: null, atk: null, def: null, mag: null, res: null, spd: null, frame: "silver", frameColor: "#1e3a8a", glowColor: "rgba(60, 60, 80, 0.7)", flavor: "Anomalous tar. Site-19 containment failure. Run.", effect: "Spell — Slows the target enemy for 3 turns. Slow shortens their attack range, drops accuracy by 15%, and reduces movement by 1. No damage; pure tempo denial.", element: "Shadow + Earth", power: 55, kalon: false, image: "./assets/artwork/Tar Pit.png"},
];

const SUPPLY_CRATES = [
 { name: "Apprentice Codex", tier: "Starter", price: "200 / $4.99", cards: 8, rarity: { common: 6, uncommon: 1, rare: 1 }, color: "from-stone-700 to-stone-900", accent: "border-orange-600", description: "Eight-card primer pack. Common-tier units, spells, and traps to build your first deck.", factions: ["Random"], threat: "STARTER"},
 { name: "Wielder's Cache", tier: "Standard", price: "500 / $14.99", cards: 8, rarity: { common: 5, uncommon: 2, rare: 1 }, color: "from-orange-800 to-red-900", accent: "border-orange-400", description: "Balanced rarity weights. Hero drops enabled — chance for a brand-new deck core.", factions: ["All 39"], threat: "STANDARD", featured: true },
 { name: "Mythic Spellbook", tier: "Premium", price: "2000 / $49.99", cards: 12, rarity: { common: 4, uncommon: 4, rare: 3, mythic: 1 }, color: "from-red-900 to-black", accent: "border-red-500", description: "Twelve cards. One Mythic guaranteed (Bahamut, Zarra, Divine Rain, Abraxas, more). Held items + Kalon-capable heroes in the pool.", factions: ["All 39"], threat: "PREMIUM"},
];

// 5 featured factions out of the game's 39. Each has its own passive synergy
// (e.g. Warrior's Oath, Dragon's Boon, Xeno Bond) that triggers based on
// allied-faction count.
const FACTIONS = [
 { name: 'Dragonkin', short: 'Dragonkin', color: 'from-amber-700 to-red-950', glowColor: 'rgba(212, 175, 55, 0.6)', image: './assets/artwork/gameicons/factions/Dragonkin.png', desc: 'Wyverns, drakes, ancient lords of the sky. Heavy hitters with passive-fed power scaling.', motto: 'WE BURN', strength: 'Burst Damage & Flying', playstyle: 'Aggro', pledged: 4287, perk: "Dragon's Boon: +2 ATK / +2 MAG per ally Dragonkin (max +6 each)."},
 { name: 'Alien', short: 'Alien', color: 'from-green-800 to-purple-950', glowColor: 'rgba(122, 208, 122, 0.6)', image: './assets/artwork/gameicons/factions/Alien.png', desc: 'Xenomorphs, parasites, carriers of the Infection. New for Season 1 — they spread the plague naturally.', motto: 'WE SPREAD', strength: 'Status / DoT', playstyle: 'Control', pledged: 3998, perk: 'Xeno Bond: 25% chance to Infect on hit (halves all target stats for 3t). Immune to Infection.'},
 { name: 'Mage', short: 'Mage', color: 'from-purple-700 to-indigo-950', glowColor: 'rgba(168, 85, 247, 0.6)', image: './assets/artwork/gameicons/factions/Mage.png', desc: 'Wizards, archmages, scholars. Range-focused with potent spell synergies and Power-Altar combos.', motto: 'WE WIELD', strength: 'Magic & Spell Synergy', playstyle: 'Combo', pledged: 5621, perk: 'Archmage: every spell costs -1 when 3+ ally Mages are on the field.'},
 { name: 'Celestial', short: 'Celestial', color: 'from-yellow-600 to-sky-900', glowColor: 'rgba(255, 209, 102, 0.6)', image: './assets/artwork/gameicons/factions/Divine.png', desc: 'Angels, seraphim, divine envoys. Counter Aliens, Undead, and Demons with weapon-of-light damage modifiers.', motto: 'WE PROTECT', strength: 'Healing & Anti-Dark', playstyle: 'Midrange', pledged: 3194, perk: 'Holy Aura: Heal 1 HP/turn per ally Celestial (max 4). Bonus damage to Undead / Demon / Alien.'},
 { name: 'Undead', short: 'Undead', color: 'from-zinc-700 to-zinc-950', glowColor: 'rgba(180, 180, 200, 0.6)', image: './assets/artwork/gameicons/factions/Undead.png', desc: 'Zombies, liches, vampires. Necropolis field-spell synergy and Lifesteal-on-hit. Hard to kill.', motto: 'WE RISE', strength: 'Lifesteal & Sustain', playstyle: 'Attrition', pledged: 2847, perk: 'Lifesteal: heal 25% of damage dealt. Necropolis field spell gives +3 ATK + heal 2/turn.'},
];

// ===== HEROES (CHAMPIONS) =====
// Playable heroes from the live game. Each is the player-controlled unit at
// the heart of a deck — they level 1→50, learn moves, equip held items, and
// pick a subclass at Lv 3 that shapes the rest of their kit.
const HEROES = [
 {
 id: 'max', name: 'Max', title: 'The Scrap Mage', faction: 'Mage', rarity: 'Mythic',
 elements: ['Storm', 'Earth'],
 accent: '#cd6b3a', glow: 'rgba(56, 189, 248, 0.75)',
 passive: { name: 'Walking Forge', desc: 'Max rides a salvaged war-frame: +2 DEF / +2 RES while at full HP. The mana crystal in his staff recharges 1 energy at the start of each turn.'},
 stats: { hp: 52, atk: 18, def: 22, mag: 42, res: 26, spd: 1 },
 subclasses: [
 { name: 'Crystal Caster', icon: '', desc: 'Pure burst — arcane blast, lightning, ice shard. Crystal staff overcharges every 3rd cast.'},
 { name: 'Iron Tinker', icon: '', desc: 'Tech + traps — spike trap, frost glyph, bone crusher. Repairs the frame mid-fight.'},
 { name: 'Storm Reactor', icon: '', desc: 'Chained lightning — lightning, shadow bolt, fireball. Each cast fuels the next.'},
 ],
 signature: 'Crystal Lance — 38 power magic strike that pierces 1 line of enemies',
 flavor: 'Found the staff in a junk pile. Welded the mech around himself. Says the crystal hums when the dead get close.',
 image: './assets/artwork/Max%20The%20Scrap%20Mage.png',
 },
 {
 id: 'cedric', name: 'Sir Cedric', title: 'The Iron Vow', faction: 'Warrior', rarity: 'Starter',
 elements: ['Light'],
 accent: '#d4af37', glow: 'rgba(255, 209, 102, 0.6)',
 passive: { name: 'Warlord', desc: '+2 ATK to all allied units while Cedric is on the field. Anchors the front line.'},
 stats: { hp: 32, atk: 18, def: 15, mag: 8, res: 10, spd: 1 },
 subclasses: [
 { name: 'Champion', icon: '', desc: 'Relentless martial — heavy strike, cleave, smash.'},
 { name: 'Bastion', icon: '', desc: 'Defender — divine shield, bash, rallying cry.'},
 { name: 'Holy Knight',icon: '', desc: 'Light-blessed — heal, arcane blast, cleanse.'},
 ],
 signature: 'Rallying Cry — +1 ATK stage to all allies for 3 turns',
 flavor: 'The vow holds when the city does not. Last marshal of the broken line.',
 image: './assets/artwork/heor Survivor 1.png',
 },
 {
 id: 'lyra', name: 'Lyra the Wise', title: 'Keeper of the Spellbook', faction: 'Mage', rarity: 'Starter',
 elements: ['Storm', 'Light'],
 accent: '#a070d9', glow: 'rgba(168, 85, 247, 0.6)',
 passive: { name: 'Archmage', desc: '+4 MAG. Magic moves gain +10% accuracy. Spells trigger combo chains.'},
 stats: { hp: 28, atk: 8, def: 8, mag: 22, res: 18, spd: 1 },
 subclasses: [
 { name: 'Evoker', icon: '', desc: 'Burst caster — fireball, lightning, arcane blast.'},
 { name: 'Diviner', icon: '', desc: 'Foresight — focus, sharpen, meditate.'},
 { name: 'Abjurer', icon: '', desc: 'Protector — divine shield, cleanse, heal.'},
 ],
 signature: 'Arcane Blast — 36 power magic strike with 90% accuracy',
 flavor: 'She found the book in the rubble. The book found her back.',
 image: './assets/artwork/heor Survivor 3.png',
 },
 {
 id: 'vex', name: 'Vex Nightblade', title: 'The Shadow Dance', faction: 'Rogue', rarity: 'Starter',
 elements: ['Shadow', 'Wind'],
 accent: '#7d8590', glow: 'rgba(125, 133, 144, 0.6)',
 passive: { name: 'Lifesteal', desc: 'Heal 25% of damage dealt with physical attacks. Strikes from the dark.'},
 stats: { hp: 28, atk: 16, def: 10, mag: 14, res: 12, spd: 2 },
 subclasses: [
 { name: 'Assassin', icon: '', desc: 'Burst single-target — crippling strike, drain life, shadow bolt.'},
 { name: 'Shadowdancer', icon: '', desc: 'Speed + bleed — quick jab, bleed slash, trip strike.'},
 { name: 'Trickster', icon: '', desc: 'Chaos — intimidate, poison sting, helping hand.'},
 ],
 signature: 'Drain Life — 24 dmg + heal Vex for the damage dealt',
 flavor: 'Two blades. No quarter. The hood hides what the city did to him.',
 image: './assets/artwork/heor Survivor 4.png',
 },
 {
 id: 'thane', name: 'Thane Ironheart', title: 'The Bulwark', faction: 'Warrior', rarity: 'Starter',
 elements: ['Earth'],
 accent: '#8a6f4a', glow: 'rgba(138, 111, 74, 0.6)',
 passive: { name: 'Guardian', desc: 'Allied units adjacent to Thane gain +3 DEF / +3 RES while he stands.'},
 stats: { hp: 36, atk: 14, def: 20, mag: 6, res: 14, spd: 1 },
 subclasses: [
 { name: 'Sentinel', icon: '', desc: 'Tank — thorns, divine shield, bash.'},
 { name: 'Berserker', icon: '', desc: 'Rage — outrage, berserker roar, cleave.'},
 { name: 'Earthshaker',icon: '', desc: 'Smash — heavy strike, smash, lightning.'},
 ],
 signature: 'Divine Shield — Block the next attack on any ally',
 flavor: 'Riot shield. Spiked mace. He stands where others fall.',
 image: './assets/artwork/hero survior 5.png',
 },
 {
 id: 'aria', name: 'Aria Stormrider', title: 'The Stormbreaker', faction: 'Mage', rarity: 'Starter',
 elements: ['Storm', 'Wind'],
 accent: '#6cb6f2', glow: 'rgba(108, 182, 242, 0.6)',
 passive: { name: 'Stormborn (Flying)', desc: 'Flying — moves over walls and traps. Lightning moves gain +20% accuracy.'},
 stats: { hp: 30, atk: 12, def: 10, mag: 16, res: 14, spd: 2 },
 subclasses: [
 { name: 'Stormbringer', icon: '', desc: 'Pure lightning — lightning, fireball, arcane blast.'},
 { name: 'Windrunner', icon: '', desc: 'Mobility — gusting winds, sharpen, ice shard.'},
 { name: 'Tempest', icon: '', desc: 'Storm fury — ice shard, shadow bolt, cripple strike.'},
 ],
 signature: 'Lightning — 28 magic strike, +20% accuracy under storm weather',
 flavor: 'She lost the sky. Found a club. Made the ground answer instead.',
 image: './assets/artwork/hero survior 2.png',
 },
 {
 id: 'zarra', name: 'Zarra', title: 'The Infected Survivor', faction: 'Alien', rarity: 'Mythic',
 elements: ['Shadow', 'Nature'],
 accent: '#7ad07a', glow: 'rgba(122, 208, 122, 0.7)',
 passive: { name: 'Xeno Bond', desc: 'Immune to Infected. 25% chance to Infect on hit (halves all target stats for 3 turns).'},
 stats: { hp: 30, atk: 14, def: 11, mag: 16, res: 12, spd: 2 },
 subclasses: [
 { name: 'Plaguebearer', icon: '', desc: 'Pure Infection — spore cloud, drain life, hive call.'},
 { name: 'Hive Mother', icon: '', desc: 'Wide magic + control — hive call, arcane blast, shadow bolt.'},
 { name: 'Devourer', icon: '', desc: 'Melee bruiser — xenobite, bleed slash, cleave.'},
 ],
 signature: 'Spore Cloud — Guaranteed 4-turn Infection on target',
 flavor: 'The host is gone. The tail remembers her name. Whatever wears her skin still walks the survivors’ road.',
 image: './assets/artwork/hero survior 7.png',
 },
];

// ===== GRUNGE UTILITIES =====

const BloodSplatter = ({ className = "", size = 100, opacity = 0.4, color = "#7f1d1d"}) => (
 <svg viewBox="0 0 100 100" className={`absolute pointer-events-none ${className}`} style={{ width: size, height: size, opacity }}>
 <g fill={color}>
 <circle cx="50" cy="40" r="14"/>
 <circle cx="30" cy="30" r="7"/>
 <circle cx="68" cy="25" r="5"/>
 <circle cx="75" cy="55" r="4"/>
 <circle cx="22" cy="55" r="3"/>
 <circle cx="58" cy="68" r="6"/>
 <circle cx="40" cy="72" r="3"/>
 <circle cx="82" cy="42" r="2"/>
 <circle cx="15" cy="42" r="2"/>
 <circle cx="65" cy="80" r="2"/>
 <ellipse cx="50" cy="48" rx="3" ry="12" transform="rotate(20 50 48)"/>
 <ellipse cx="38" cy="52" rx="1.5" ry="8" transform="rotate(-15 38 52)"/>
 <circle cx="88" cy="65" r="1.5"/>
 <circle cx="10" cy="60" r="1.2"/>
 <circle cx="55" cy="88" r="1.5"/>
 <circle cx="35" cy="15" r="1"/>
 <circle cx="72" cy="10" r="1.2"/>
 </g>
 </svg>
);

const BulletHole = ({ className = "", size = 24 }) => (
 <svg viewBox="0 0 24 24" className={`absolute pointer-events-none ${className}`} style={{ width: size, height: size }}>
 <defs>
 <radialGradient id={`hole-${size}`}>
 <stop offset="0%" stopColor="#000"/>
 <stop offset="40%" stopColor="#0a0a0a"/>
 <stop offset="70%" stopColor="#292524"/>
 <stop offset="100%" stopColor="transparent"/>
 </radialGradient>
 </defs>
 <circle cx="12" cy="12" r="10" fill={`url(#hole-${size})`} opacity="0.8"/>
 <circle cx="12" cy="12" r="4" fill="#000"/>
 <g stroke="#1c1917" strokeWidth="0.6" opacity="0.7">
 <line x1="12" y1="12" x2="20" y2="6"/>
 <line x1="12" y1="12" x2="4" y2="18"/>
 <line x1="12" y1="12" x2="19" y2="18"/>
 <line x1="12" y1="12" x2="5" y2="5"/>
 <line x1="12" y1="12" x2="2" y2="12"/>
 </g>
 </svg>
);

const RustStain = ({ className = ""}) => (
 <div
 className={`absolute pointer-events-none ${className}`}
 style={{
 background: 'radial-gradient(ellipse, rgba(154, 52, 18, 0.5) 0%, rgba(124, 45, 18, 0.3) 30%, transparent 70%)',
 mixBlendMode: 'multiply',
 }}
 />
);

const HazardStripe = ({ className = ""}) => (
 <div
 className={`h-2 ${className}`}
 style={{
 background: 'repeating-linear-gradient(45deg, #facc15 0, #facc15 12px, #0a0a0a 12px, #0a0a0a 24px)',
 opacity: 0.7,
 filter: 'contrast(1.1) brightness(0.85)',
 }}
 />
);

const TornEdge = ({ position = "top"}) => (
 <div
 className={`absolute left-0 right-0 ${position === 'top'? 'top-0': 'bottom-0'} h-3 pointer-events-none`}
 style={{
 background: '#0a0a0a',
 clipPath: position === 'top'? 'polygon(0 0, 100% 0, 100% 50%, 97% 100%, 95% 30%, 92% 80%, 88% 40%, 85% 90%, 82% 50%, 78% 80%, 75% 30%, 71% 75%, 68% 50%, 64% 85%, 60% 40%, 56% 80%, 52% 50%, 48% 90%, 44% 35%, 40% 80%, 36% 50%, 32% 75%, 28% 40%, 24% 85%, 20% 50%, 16% 80%, 12% 30%, 8% 75%, 5% 50%, 3% 90%, 0 60%)': 'polygon(0 100%, 100% 100%, 100% 50%, 97% 0%, 95% 70%, 92% 20%, 88% 60%, 85% 10%, 82% 50%, 78% 20%, 75% 70%, 71% 25%, 68% 50%, 64% 15%, 60% 60%, 56% 20%, 52% 50%, 48% 10%, 44% 65%, 40% 20%, 36% 50%, 32% 25%, 28% 60%, 24% 15%, 20% 50%, 16% 20%, 12% 70%, 8% 25%, 5% 50%, 3% 10%, 0 40%)',
 }}
 />
);

const DuctTape = ({ rotation = 0, className = ""}) => (
 <div
 className={`absolute ${className}`}
 style={{
 width: '80px',
 height: '24px',
 background: 'linear-gradient(180deg, #44403c 0%, #57534e 50%, #44403c 100%)',
 transform: `rotate(${rotation}deg)`,
 boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
 clipPath: 'polygon(2% 10%, 100% 0%, 98% 90%, 0% 100%)',
 opacity: 0.85,
 }}
 >
 <div className="absolute inset-0 opacity-30" style={{
 background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.4) 4px, rgba(0,0,0,0.4) 5px)',
 }} />
 </div>
);

// Distressed heading
const DistressedHeading = ({ children, className = "", level = 'h2'}) => {
 const Tag = level;
 return (
 <Tag
 className={`relative ${className}`}
 style={{
 textShadow: `
 1px 1px 0 rgba(0,0,0,0.9),
 -1px -1px 0 rgba(120, 53, 15, 0.4),
 2px 2px 4px rgba(0,0,0,0.6),
 0 0 20px rgba(249, 115, 22, 0.3)
 `,
 letterSpacing: '0.05em',
 }}
 >
 {children}
 </Tag>
 );
};

// ===== CARD ART =====
const CardArt = ({ type }) => {
 const arts = {
 cosmic: (
 <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
 <defs>
 <radialGradient id="cosmic-bg" cx="60%" cy="70%"><stop offset="0%" stopColor="#312e81"/><stop offset="50%" stopColor="#1e1b4b"/><stop offset="100%" stopColor="#000"/></radialGradient>
 <radialGradient id="cosmic-galaxy" cx="70%" cy="80%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9"/><stop offset="30%" stopColor="#a78bfa" stopOpacity="0.5"/><stop offset="100%" stopColor="transparent"/></radialGradient>
 <filter id="cosmic-glow"><feGaussianBlur stdDeviation="2"/></filter>
 </defs>
 <rect width="200" height="200" fill="url(#cosmic-bg)"/>
 {Array.from({ length: 60 }).map((_, i) => <circle key={i} cx={(i * 37) % 200} cy={(i * 53) % 200} r={(i % 3) * 0.5 + 0.3} fill="white" opacity={0.3 + (i % 7) * 0.1} />)}
 <ellipse cx="140" cy="160" rx="60" ry="20" fill="url(#cosmic-galaxy)" transform="rotate(-30 140 160)"/>
 <g filter="url(#cosmic-glow)" opacity="0.95">
 <path d="M 60 60 Q 30 50 25 100 Q 35 80 65 85 Z" fill="#3b82f6" opacity="0.7"/>
 <path d="M 90 60 Q 130 45 145 95 Q 125 75 95 85 Z" fill="#3b82f6" opacity="0.7"/>
 <ellipse cx="78" cy="85" rx="12" ry="20" fill="#60a5fa"/>
 <circle cx="78" cy="58" r="9" fill="#93c5fd"/>
 <path d="M 88 80 Q 110 100 125 130" stroke="#bfdbfe" strokeWidth="2" fill="none" opacity="0.9"/>
 </g>
 </svg>
 ),
 sorceress: (
 <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
 <defs>
 <linearGradient id="sorc-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#451a03"/><stop offset="100%" stopColor="#1c1917"/></linearGradient>
 <radialGradient id="orb-blue"><stop offset="0%" stopColor="#dbeafe"/><stop offset="40%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#1e3a8a" stopOpacity="0"/></radialGradient>
 <radialGradient id="orb-pink"><stop offset="0%" stopColor="#fce7f3"/><stop offset="40%" stopColor="#ec4899"/><stop offset="100%" stopColor="#831843" stopOpacity="0"/></radialGradient>
 <linearGradient id="sorc-body" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#1e1b4b"/></linearGradient>
 </defs>
 <rect width="200" height="200" fill="url(#sorc-bg)"/>
 <polygon points="0,200 0,120 15,110 20,140 35,100 45,130 55,90 65,125 0,200" fill="#0c0a09" opacity="0.9"/>
 <polygon points="200,200 200,100 185,115 175,90 165,135 150,95 140,140 130,110 200,200" fill="#0c0a09" opacity="0.9"/>
 <ellipse cx="100" cy="100" rx="18" ry="40" fill="url(#sorc-body)"/>
 <circle cx="100" cy="60" r="10" fill="#312e81"/>
 <path d="M 90 55 Q 85 40 95 35 Q 110 30 115 50 Q 110 60 100 58 Z" fill="#5b21b6"/>
 <line x1="88" y1="85" x2="65" y2="90" stroke="#312e81" strokeWidth="3"/>
 <line x1="112" y1="85" x2="135" y2="90" stroke="#312e81" strokeWidth="3"/>
 <circle cx="60" cy="90" r="14" fill="url(#orb-blue)"/>
 <circle cx="60" cy="90" r="6" fill="white" opacity="0.6"/>
 <circle cx="140" cy="90" r="14" fill="url(#orb-pink)"/>
 <circle cx="140" cy="90" r="6" fill="white" opacity="0.6"/>
 </svg>
 ),
 ruins: (
 <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
 <defs>
 <linearGradient id="ruin-bg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1f2937"/><stop offset="60%" stopColor="#0f172a"/><stop offset="100%" stopColor="#000"/></linearGradient>
 <filter id="fog"><feGaussianBlur stdDeviation="3"/></filter>
 </defs>
 <rect width="200" height="200" fill="url(#ruin-bg)"/>
 <ellipse cx="100" cy="40" rx="120" ry="25" fill="#374151" opacity="0.6" filter="url(#fog)"/>
 <path d="M 150 10 Q 145 35 160 55 Q 175 65 170 80 Q 165 75 155 70" stroke="#000" strokeWidth="8" fill="none" opacity="0.8"/>
 <rect x="20" y="100" width="20" height="100" fill="#000"/>
 <rect x="45" y="80" width="15" height="120" fill="#0c0a09"/>
 <rect x="65" y="120" width="25" height="80" fill="#000"/>
 <rect x="95" y="90" width="18" height="110" fill="#0c0a09"/>
 <rect x="118" y="110" width="22" height="90" fill="#000"/>
 <rect x="145" y="95" width="16" height="105" fill="#0c0a09"/>
 <rect x="165" y="115" width="20" height="85" fill="#000"/>
 <rect x="0" y="140" width="200" height="60" fill="#374151" opacity="0.3"/>
 <rect x="0" y="160" width="200" height="40" fill="#1f2937" opacity="0.5"/>
 </svg>
 ),
 spider: (
 <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
 <defs>
 <radialGradient id="cave-bg" cx="60%" cy="20%"><stop offset="0%" stopColor="#44403c"/><stop offset="60%" stopColor="#1c1917"/><stop offset="100%" stopColor="#000"/></radialGradient>
 </defs>
 <rect width="200" height="200" fill="url(#cave-bg)"/>
 <g stroke="#a8a29e" strokeWidth="0.3" fill="none" opacity="0.5">
 <path d="M 0 30 Q 100 80 200 30"/><path d="M 0 60 Q 100 100 200 60"/><path d="M 0 90 Q 100 130 200 90"/>
 <path d="M 30 0 Q 80 100 30 200"/><path d="M 70 0 Q 100 100 70 200"/><path d="M 130 0 Q 100 100 130 200"/>
 </g>
 <g>
 <ellipse cx="150" cy="50" rx="18" ry="14" fill="#1c1917"/>
 <circle cx="145" cy="48" r="1.2" fill="#fbbf24"/>
 <circle cx="148" cy="46" r="1" fill="#fbbf24"/>
 <circle cx="152" cy="46" r="1" fill="#fbbf24"/>
 <circle cx="155" cy="48" r="1.2" fill="#fbbf24"/>
 <path d="M 138 45 L 120 25 L 115 40" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 <path d="M 138 50 L 115 50 L 110 65" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 <path d="M 138 55 L 115 65 L 110 80" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 <path d="M 162 45 L 180 30 L 185 45" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 <path d="M 162 50 L 185 50 L 195 65" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 <path d="M 162 55 L 185 65 L 195 80" stroke="#0c0a09" strokeWidth="2" fill="none"/>
 </g>
 <g transform="translate(70 130)">
 <ellipse cx="0" cy="0" rx="35" ry="20" fill="#3f3f46" opacity="0.7"/>
 <path d="M 10 -5 L 30 -25 L 35 -20" stroke="#78716c" strokeWidth="3" fill="none"/>
 </g>
 </svg>
 ),
 hospital: (
 <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
 <defs>
 <linearGradient id="hosp-sky" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#374151"/><stop offset="100%" stopColor="#1f2937"/></linearGradient>
 </defs>
 <rect width="200" height="200" fill="url(#hosp-sky)"/>
 <rect x="40" y="40" width="120" height="100" fill="#57534e"/>
 <rect x="40" y="40" width="120" height="100" fill="#44403c" opacity="0.6"/>
 <g fill="#000" opacity="0.7">
 {Array.from({ length: 5 }).map((_, row) =>
 Array.from({ length: 7 }).map((_, col) => <rect key={`${row}-${col}`} x={48 + col * 16} y={48 + row * 16} width="10" height="10"/>)
 )}
 </g>
 <rect x="64" y="64" width="10" height="10" fill="#fbbf24" opacity="0.3"/>
 <rect x="128" y="96" width="10" height="10" fill="#84cc16" opacity="0.4"/>
 <rect x="75" y="100" width="50" height="10" fill="#7f1d1d"/>
 <rect x="40" y="30" width="120" height="12" fill="#292524"/>
 <rect x="0" y="140" width="200" height="60" fill="#1c1917"/>
 <rect x="150" y="120" width="35" height="20" fill="#e7e5e4" opacity="0.7"/>
 <circle cx="158" cy="142" r="3" fill="#000"/>
 <circle cx="178" cy="142" r="3" fill="#000"/>
 <g fill="#166534" opacity="0.6"><ellipse cx="40" cy="135" rx="8" ry="3"/><ellipse cx="160" cy="138" rx="6" ry="2"/><ellipse cx="100" cy="142" rx="10" ry="2"/></g>
 </svg>
 ),
 };
 return arts[type] || arts.cosmic;
};

// ===== APOCALYPSE BACKGROUND =====
const Wasteland = () => {
 const embers = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100, size: (i % 4) * 0.8 + 1, delay: (i % 10) * 0.8, duration: 8 + (i % 6), drift: -10 + (i % 20) }));
 const dustMotes = Array.from({ length: 80 }, (_, i) => ({ x: (i * 17) % 100, y: (i * 23) % 100, size: (i % 2) * 0.4 + 0.4, delay: (i % 8) * 0.6, duration: 4 + (i % 5) }));

 return (
 <div className="fixed inset-0 overflow-hidden pointer-events-none">
 <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #0a0a0a 0%, #1c1917 30%, #292524 60%, #44190a 85%, #7c2d12 100%)'}} />
 <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 10%, rgba(132, 204, 22, 0.08), transparent 40%), radial-gradient(ellipse at 20% 30%, rgba(220, 38, 38, 0.1), transparent 45%), radial-gradient(ellipse at 50% 90%, rgba(234, 88, 12, 0.18), transparent 60%)'}} />
 <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, rgba(120, 113, 108, 0.25), transparent)'}} />
 {dustMotes.map((d, i) => (
 <div key={`dust-${i}`} className="absolute bg-stone-400 rounded-full" style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.size}px`, height: `${d.size}px`, opacity: 0.3, animation: `dust ${d.duration}s ease-in-out ${d.delay}s infinite` }} />
 ))}
 {embers.map((e, i) => (
 <div key={`ember-${i}`} className="absolute rounded-full" style={{ left: `${e.x}%`, bottom: '-20px', width: `${e.size}px`, height: `${e.size}px`, background: i % 3 === 0 ? '#f97316': i % 3 === 1 ? '#dc2626': '#fbbf24', boxShadow: i % 3 === 0 ? '0 0 6px #f97316': i % 3 === 1 ? '0 0 6px #dc2626': '0 0 6px #fbbf24', animation: `ember ${e.duration}s linear ${e.delay}s infinite`, '--drift': `${e.drift}vw` }} />
 ))}
 <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)'}} />
 <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\'xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\'baseFrequency=\'0.9\'numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100%25\'height=\'100%25\'filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
 {/* Rust stains */}
 <div className="absolute top-20 left-10 w-40 h-40 opacity-30" style={{ background: 'radial-gradient(ellipse, rgba(154, 52, 18, 0.6), transparent 70%)', mixBlendMode: 'multiply'}} />
 <div className="absolute top-1/3 right-20 w-60 h-32 opacity-25" style={{ background: 'radial-gradient(ellipse, rgba(124, 45, 18, 0.7), transparent 70%)', mixBlendMode: 'multiply'}} />
 <div className="absolute bottom-1/4 left-1/3 w-48 h-48 opacity-20" style={{ background: 'radial-gradient(ellipse, rgba(154, 52, 18, 0.8), transparent 70%)', mixBlendMode: 'multiply'}} />
 <style>{`
 @keyframes ember { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 0.9; } 90% { opacity: 0.7; } 100% { transform: translateY(-110vh) translateX(var(--drift)); opacity: 0; } }
 @keyframes dust { 0%, 100% { opacity: 0.1; transform: translateY(0); } 50% { opacity: 0.4; transform: translateY(-10px); } }
 @keyframes float-card { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
 @keyframes rise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
 @keyframes spark { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.5); opacity: 1; } }
 @keyframes pulse-red { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
 @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } 75% { opacity: 0.9; } }
 @keyframes glitch { 0%, 100% { transform: translate(0); } 20% { transform: translate(-1px, 1px); } 40% { transform: translate(1px, -1px); } 60% { transform: translate(-1px, -1px); } 80% { transform: translate(1px, 1px); } }
 @keyframes scroll-x { from { transform: translateX(0); } to { transform: translateX(-50%); } }
 @keyframes shake { 0%, 100% { transform: translate(0); } 25% { transform: translate(-2px, 1px); } 50% { transform: translate(2px, -1px); } 75% { transform: translate(-1px, 2px); } }
 `}</style>
 </div>
 );
};

// ===== CARD COMPONENT =====
const Card = ({ card, onClick, size = 'md', floating = true, intensity = 1 }) => {
 const cardRef = useRef(null);
 const [rotation, setRotation] = useState({ x: 0, y: 0 });
 const [glare, setGlare] = useState({ x: 50, y: 50 });
 const [isHovered, setIsHovered] = useState(false);

 const handleMouseMove = (e) => {
 if (!cardRef.current) return;
 const rect = cardRef.current.getBoundingClientRect();
 const x = e.clientX - rect.left;
 const y = e.clientY - rect.top;
 const cx = rect.width / 2;
 const cy = rect.height / 2;
 setRotation({ x: -((y - cy) / cy) * 22 * intensity, y: ((x - cx) / cx) * 22 * intensity });
 setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
 };

 const handleLeave = () => {
 setRotation({ x: 0, y: 0 });
 setGlare({ x: 50, y: 50 });
 setIsHovered(false);
 };

 const sizes = { xs: 'w-32 h-48', sm: 'w-44 h-64', md: 'w-64 h-96', lg: 'w-80 h-[28rem]', xl: 'w-96 h-[36rem]'};

 const frameStyles = {
 blue: { outer: 'bg-gradient-to-br from-blue-700 via-blue-900 to-blue-950', inner: 'bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-700', gem: 'bg-blue-500', textBg: 'bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900', effectBg: 'bg-gradient-to-br from-blue-100 via-white to-blue-50'},
 gold: { outer: 'bg-gradient-to-br from-yellow-700 via-amber-600 to-yellow-800', inner: 'bg-gradient-to-br from-yellow-500 via-yellow-400 to-amber-500', gem: 'bg-black', textBg: 'bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900', effectBg: 'bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200'},
 purple: { outer: 'bg-gradient-to-br from-purple-700 via-purple-900 to-purple-950', inner: 'bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-700', gem: 'bg-purple-500', textBg: 'bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900', effectBg: 'bg-gradient-to-br from-purple-200 via-purple-100 to-purple-200'},
 silver: { outer: 'bg-gradient-to-br from-zinc-400 via-zinc-600 to-zinc-700', inner: 'bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500', gem: 'bg-black', textBg: 'bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900', effectBg: 'bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200'},
 green: { outer: 'bg-gradient-to-br from-green-700 via-green-900 to-green-950', inner: 'bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-700', gem: 'bg-green-500', textBg: 'bg-gradient-to-r from-green-900 via-green-800 to-green-900', effectBg: 'bg-gradient-to-br from-green-100 via-white to-green-50'},
 };
 const fs = frameStyles[card.frame];

 return (
 <div className={`relative ${sizes[size]} cursor-pointer flex-shrink-0`} style={{ perspective: '1500px', animation: floating && !isHovered ? 'float-card 6s ease-in-out infinite': 'none'}}>
 {isHovered && [...Array(6)].map((_, i) => (
 <div key={i} className="absolute w-1 h-1 rounded-full pointer-events-none" style={{ background: '#f97316', boxShadow: `0 0 8px #f97316`, left: `${20 + i * 12}%`, top: `${10 + (i % 3) * 30}%`, animation: `spark ${1 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
 ))}

 <div
 ref={cardRef}
 onMouseMove={handleMouseMove}
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={handleLeave}
 onClick={() => onClick && onClick(card)}
 className="relative w-full h-full rounded-xl overflow-hidden" style={{
 transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.08 : 1})`,
 transition: isHovered ? 'transform 0.08s ease-out': 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
 transformStyle: 'preserve-3d',
 boxShadow: isHovered ? `0 40px 80px -15px ${card.glowColor}, 0 0 60px ${card.glowColor}, 0 0 100px rgba(249, 115, 22, 0.4)` : '0 15px 40px rgba(0,0,0,0.8)',
 }}
 >
 <div className={`absolute inset-0 ${fs.outer} rounded-xl`}>
 <div className={`absolute inset-2 ${fs.inner} rounded-lg p-0.5`}>
 <div className="relative w-full h-full bg-black rounded-md overflow-hidden flex flex-col">
 <div className="relative w-full" style={{ height: '60%'}}>
 {card.image ? (
 // Live game art — img with onError fallback to the SVG placeholder
 // so the page still renders if the file is missing from disk.
 // `object-top` anchors the crop to the TOP of the source image so
 // character portraits keep their faces visible (the default
 // `object-cover` centers the crop, which decapitates everyone).
 <img
 src={card.image}
 alt={card.name}
 className="w-full h-full object-cover object-top" onError={(e) => {
 // Failed to load — hide the broken-image icon. The SVG below
 // is still rendered as a sibling so the slot stays filled.
 e.currentTarget.style.display = 'none';
 const sib = e.currentTarget.nextElementSibling;
 if (sib) sib.style.display = 'block';
 }}
 />
 ) : null}
 <div style={{ display: card.image ? 'none': 'block', width: '100%', height: '100%'}}>
 <CardArt type={card.art} />
 </div>
 <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 flex items-center justify-center shadow-lg border-2 border-yellow-200">
 <span className="text-black font-bold text-sm">{card.cost}</span>
 </div>
 <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur border border-orange-500/60">
 <span className="text-orange-300 text-[10px] font-semibold tracking-wider uppercase">{card.rarity}</span>
 </div>
 {card.kalon && (
 <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded border border-yellow-500/50">
 <span className="text-yellow-300 text-xs"></span>
 <span className="text-yellow-300 text-[9px] font-bold tracking-widest">KALON</span>
 </div>
 )}
 </div>

 <div className={`${fs.textBg} border-y-2 border-yellow-600/60 px-3 py-1.5 flex items-center justify-between`}>
 <h3 className="text-yellow-100 font-serif font-bold text-sm tracking-wide truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)'}}>{card.name}</h3>
 <span className="text-orange-300/80 text-[10px] italic uppercase tracking-wider">{card.faction}</span>
 </div>

 <div className={`flex-1 ${fs.effectBg} p-2 relative`}>
 <div className="text-stone-800 text-[10px] leading-tight font-medium">
 <p className="font-semibold text-[9px] text-stone-600 mb-1 uppercase tracking-wide">{card.type}</p>
 <p className="leading-snug">{card.effect}</p>
 {card.flavor && <p className="italic text-stone-600 text-[9px] mt-1 border-t border-stone-300 pt-1">{card.flavor}</p>}
 </div>
 {card.atk != null && (
 <div className="absolute bottom-1 right-1 flex gap-1">
 <div className="bg-red-900 border border-yellow-500 rounded px-1.5 py-0.5 text-yellow-100 text-xs font-bold" title="Attack"> {card.atk}</div>
 <div className="bg-blue-900 border border-yellow-500 rounded px-1.5 py-0.5 text-yellow-100 text-xs font-bold" title="Defense"> {card.def}</div>
 </div>
 )}
 <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
 <div className={`w-3 h-3 rounded-full ${fs.gem} border border-yellow-500 shadow-inner`} />
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Grunge overlay on card */}
 <div className="absolute inset-0 rounded-xl pointer-events-none opacity-40 mix-blend-multiply" style={{
 backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 100\'xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\'baseFrequency=\'0.8\'numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\'height=\'100%25\'filter=\'url(%23n)\'opacity=\'0.4\'/%3E%3C/svg%3E")',
 }} />

 <div className="absolute inset-0 rounded-xl pointer-events-none mix-blend-overlay" style={{ background: `linear-gradient(${135 + glare.x * 2}deg, transparent 15%, rgba(255,255,255,0.5) 45%, rgba(249,115,22,0.4) 50%, rgba(220,38,38,0.4) 55%, transparent 85%)`, opacity: isHovered ? 0.85 : 0, transition: 'opacity 0.3s'}} />
 <div className="absolute inset-0 rounded-xl pointer-events-none mix-blend-color-dodge" style={{ background: `conic-gradient(from ${glare.x * 3.6}deg at ${glare.x}% ${glare.y}%, rgba(249,115,22,0.2), rgba(220,38,38,0.2), rgba(251,191,36,0.2), rgba(132,204,22,0.2), rgba(249,115,22,0.2))`, opacity: isHovered ? 0.7 : 0, transition: 'opacity 0.3s'}} />
 <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.45), transparent 35%)`, opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s'}} />
 <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: `inset 0 0 40px ${card.glowColor}`, opacity: isHovered ? 0.8 : 0, transition: 'opacity 0.4s'}} />
 </div>
 </div>
 );
};

// ===== NAVBAR =====
const Navbar = ({ onNavigate, deckCount, survivors, loyalFaction, isSignedIn, displayName, onShowHub, onShowHome, onSignIn, currentPage }) => (
 <>
 <div className="fixed top-0 left-0 right-0 z-[60] bg-red-900/90 backdrop-blur border-b border-red-500 text-red-100 text-[10px] py-1 px-6 flex items-center justify-between tracking-widest uppercase">
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-red-400" style={{ animation: 'pulse-red 1s infinite'}} />
 <span style={{ animation: 'flicker 3s infinite'}}> EMERGENCY BROADCAST · DAY 2,847 SINCE THE COLLAPSE</span>
 </div>
 <div className="hidden md:flex items-center gap-4">
 {loyalFaction && (
 <span className="text-orange-300">
 FACTION: <span className="font-bold">{loyalFaction.toUpperCase()}</span>
 </span>
 )}
 <span>WIELDERS ONLINE: <span className="text-orange-300 font-bold">{survivors.toLocaleString()}</span></span>
 </div>
 </div>

 <nav className="fixed top-6 left-0 right-0 z-50 backdrop-blur-md bg-black/75 border-b border-orange-600/30">
 <div className="max-w-7xl mx-auto px-5 py-2.5 flex items-center gap-4 relative">
 <BulletHole className="top-2 right-32" size={16} />

 {/* ===== Logo (left) — distressed wordmark image ===== */}
 <button onClick={onShowHome} className="flex items-center cursor-pointer hover:opacity-85 transition shrink-0" title="Back to home" style={{ animation: 'flicker 6s infinite'}}>
 <img
 src="./assets/artwork/Mythic%20Spellbook.png" alt="Mythic Spellbook" className="block" style={{
 // Layout footprint stays at 48px tall so the navbar height never
 // grows — but transform:scale visually enlarges the wordmark by
 // 80% so it reads as a proper logo. The transform also doesn't
 // push neighbors around, so the nav links stay centered.
 height: '48px',
 width: 'auto',
 transform: 'scale(1.8)',
 transformOrigin: 'center left',
 marginRight: '38px', // reserve visual space the scale overflows into
 filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.45)) drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
 }}
 onError={(e) => {
 // Fallback to the old text logo if the image isn't on disk yet.
 const fallback = document.createElement('div');
 fallback.className = 'flex items-center gap-2.5';
 fallback.innerHTML = `
 <div style="width:36px;height:36px;border-radius:4px;background:linear-gradient(135deg,#f97316,#7f1d1d 60%,#1c1917);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(249,115,22,0.4);border:1px solid rgba(251,146,60,0.5)"><span style="color:#fef3c7;font-weight:700;font-size:16px;font-family:Cinzel,serif">M</span></div>
 <div style="text-align:left;line-height:1.1">
 <div style="color:#fef3c7;font-family:Cinzel,serif;font-weight:700;font-size:16px;letter-spacing:0.06em;white-space:nowrap;text-shadow:0 0 10px rgba(249,115,22,0.5),1px 1px 0 rgba(0,0,0,0.8)">MYTHIC SPELLBOOK</div>
 <div style="color:rgba(251,146,60,0.8);font-size:9px;letter-spacing:0.3em;margin-top:2px;white-space:nowrap">A SPATIAL TCG</div>
 </div>
 `;
 e.currentTarget.replaceWith(fallback);
 }}
 />
 </button>

 {/* ===== Nav links (center) — single row, never wrap ===== */}
 <div className="hidden lg:flex items-center gap-5 text-[13px] text-stone-300 mx-auto">
 <button onClick={() => onNavigate('home')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Home</button>
 <button onClick={() => onNavigate('about')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">About</button>
 <button onClick={() => onNavigate('factions')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Factions</button>
 <button onClick={() => onNavigate('different')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">What's New</button>
 <button onClick={() => onNavigate('champions')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Survivors</button>
 <button onClick={() => onNavigate('coliseum')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Coliseum</button>
 <button onClick={() => onNavigate('packs')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Packs</button>
 <button onClick={() => onNavigate('gallery')} className="whitespace-nowrap hover:text-orange-400 transition tracking-wide uppercase font-medium">Cards</button>
 </div>

 {/* ===== Right cluster (auth + play) ===== */}
 <div className="flex items-center gap-2 shrink-0 ml-auto">
 {isSignedIn ? (
 <button
 onClick={onShowHub}
 className={`flex items-center gap-2 px-3.5 py-2 font-bold text-[13px] rounded tracking-wide uppercase transition border whitespace-nowrap ${currentPage === 'hub'? 'bg-gradient-to-r from-amber-500 to-orange-600 text-yellow-50 border-amber-300 shadow-lg shadow-amber-500/50': 'bg-black/50 border-amber-400/50 text-amber-200 hover:bg-amber-500/20 hover:border-amber-300'}`}
 title="Open your Player Hub — stats, currency, Vendor Market" style={{ maxWidth: '180px'}}
 >
 <span className="text-sm"></span>
 <span className="overflow-hidden text-ellipsis hidden sm:inline" style={{ maxWidth: '140px'}}>{displayName ? displayName : 'Profile'}</span>
 <span className="sm:hidden">Profile</span>
 </button>
 ) : (
 <button
 onClick={onSignIn}
 className="px-3.5 py-2 border border-orange-400/50 text-orange-200 font-semibold text-[13px] rounded tracking-wide hover:bg-orange-500/10 transition uppercase whitespace-nowrap">
 Login
 </button>
 )}
 <a
 href={PLAY_URL}
 className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold text-[13px] rounded tracking-wide hover:shadow-lg hover:shadow-orange-500/50 transition border border-orange-400/50 uppercase whitespace-nowrap">
 Play Now
 </a>
 </div>
 </div>
 </nav>
 </>
);

// ===== HERO =====
const Hero = ({ featuredCard, onCardClick, onScrollTo }) => (
 <section className="relative min-h-screen flex items-center justify-center pt-32 px-6 overflow-hidden">
 {/* Cosmic MP4 loop as the hero background. We use <video> rather than
 a GIF/CSS background because the MP4 is ~16× smaller (7.9MB vs 125MB)
 AND animates more smoothly. Muted + autoplay + playsInline are required
 for modern browsers to auto-start the video without user interaction. */}
 <video
 autoPlay
 muted
 loop
 playsInline
 preload="auto" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 0 }}
 >
 <source src="./assets/background/Backgrounds/hero-cosmic.mp4" type="video/mp4"/>
 </video>

 {/* Readability overlay — strongest dim on the left (where text sits),
 lighter on the right (where the spotlight card floats). Vignette + a
 subtle vertical fade keep the splatter / hazard elements readable too. */}
 <div className="absolute inset-0 pointer-events-none" style={{
 zIndex: 1,
 background:
 'linear-gradient(90deg, rgba(5,3,12,0.85) 0%, rgba(5,3,12,0.7) 35%, rgba(5,3,12,0.3) 65%, rgba(5,3,12,0.55) 100%),'+
 'radial-gradient(ellipse at center, transparent 30%, rgba(5,3,12,0.6) 100%)',
 }} />
 {/* Bottom fade so the hazard stripe + next section transition cleanly. */}
 <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{
 zIndex: 1,
 background: 'linear-gradient(180deg, transparent 0%, #0a0a0a 100%)',
 }} />

 <BloodSplatter className="top-20 left-10" size={140} opacity={0.25} />
 <BloodSplatter className="bottom-32 right-20" size={180} opacity={0.2} />
 <BulletHole className="top-40 right-1/4" size={28} />
 <BulletHole className="bottom-1/3 left-1/4" size={20} />

 <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
 <div className="text-center md:text-left" style={{ animation: 'rise 1s ease-out'}}>
 <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-orange-500/40 rounded bg-black/40 relative">
 <DuctTape rotation={-3} className="-top-3 -left-2"/>
 <span className="w-2 h-2 rounded-full bg-orange-400" style={{ animation: 'pulse-red 1.5s infinite'}} />
 <span className="text-orange-300 text-xs tracking-[0.3em] uppercase">SPATIAL TCG · 39 FACTIONS · LIVE NOW</span>
 </div>
 <DistressedHeading level="h1" className="text-5xl md:text-7xl font-serif font-bold text-yellow-100 mb-6 leading-tight">
 OPEN THE
 <span className="block bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.9))'}}>
 MYTHIC SPELLBOOK.
 </span>
 <span className="block text-stone-500 italic font-normal text-3xl md:text-4xl my-2" style={{ textShadow: 'none', transform: 'skewX(-5deg)'}}>·· the cards move ··</span>
 </DistressedHeading>

 {/* Goddess lore hook — sets the apocalyptic tone before the
 mechanical pitch. Border-left bar in violet/orange tints it as
 in-universe text rather than marketing copy. */}
 <div className="relative bg-black/55 border-l-4 border-orange-500/70 rounded-r p-4 md:p-5 mb-6 max-w-xl" style={{ boxShadow: '0 0 30px rgba(255,140,40,0.12)'}}>
 <div className="text-orange-300 text-xs tracking-[0.35em] uppercase mb-2 font-bold">The Goddess Has Awakened</div>
 <p className="text-stone-200 text-sm leading-relaxed mb-2">
 <strong className="text-yellow-100">Abraxas</strong>, the ancient creator of the universe, has risen from her eternal slumber.
 </p>
 <p className="text-stone-300 text-sm leading-relaxed italic mb-2">
 For ages, she slept through the rise of gods, the wars of demon kings, and the collapse of countless civilizations. But something has finally broken the balance.
 </p>
 <p className="text-stone-200 text-sm leading-relaxed">
 Now, she has awakened <strong className="text-orange-300">not to save creation… but to erase it.</strong>
 </p>
 <div className="mt-3 pt-3 border-t border-orange-700/30 text-yellow-200 font-serif italic text-base">
 How long will you last?
 </div>
 </div>

 <p className="text-stone-400 text-lg mb-8 leading-relaxed max-w-xl">
 A grid-based tactical TCG where heroes <strong className="text-orange-300">level up, learn moves, and transform mid-match</strong>.
 Place units on the board. Cast spells. Drop weather, locations, and traps. Climb the Coliseum
 across 12 ranks, qualify for Regionals, Nationals, and Worlds. Built different.
 </p>
 <div className="flex gap-4 justify-center md:justify-start flex-wrap">
 <a href={PLAY_URL} className="group relative px-8 py-3 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-wide hover:shadow-xl hover:shadow-orange-500/50 transition transform hover:-translate-y-0.5 border border-orange-400/50">
 PLAY NOW — FREE
 </a>
 <a href={LOGIN_URL} className="px-8 py-3 border border-orange-500/40 text-orange-200 font-semibold rounded tracking-wide hover:bg-orange-500/10 transition">
 ALREADY PLAYING? LOG IN
 </a>
 </div>
 <div className="flex gap-8 mt-12 justify-center md:justify-start flex-wrap">
 <div><div className="text-3xl font-serif font-bold text-orange-300">39</div><div className="text-stone-500 text-xs tracking-widest uppercase">Factions</div></div>
 <div><div className="text-3xl font-serif font-bold text-orange-300">12</div><div className="text-stone-500 text-xs tracking-widest uppercase">Rank Tiers</div></div>
 <div><div className="text-3xl font-serif font-bold text-orange-300">200+</div><div className="text-stone-500 text-xs tracking-widest uppercase">Cards & Heroes</div></div>
 <div><div className="text-3xl font-serif font-bold text-orange-300">∞</div><div className="text-stone-500 text-xs tracking-widest uppercase">Deck Combos</div></div>
 </div>
 </div>
 <div className="flex justify-center relative">
 <div className="absolute -inset-10 bg-orange-500/10 rounded-full blur-3xl"/>
 <Card card={featuredCard} onClick={onCardClick} size="lg"/>
 </div>
 </div>
 <div className="absolute bottom-0 left-0 right-0"><HazardStripe /></div>
 </section>
);

// ===== FACTIONS OVERVIEW =====
const Factions = () => {
 return (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-10 right-5" size={120} opacity={0.15} />
 <div className="max-w-7xl mx-auto">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— The Five That Survived —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100">Choose Your Faction</DistressedHeading>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 {FACTIONS.map((f) => (
 <div key={f.name} className={`relative bg-gradient-to-br ${f.color} rounded p-6 text-center group hover:scale-105 transition cursor-pointer shadow-lg hover:shadow-2xl border border-stone-700/50 hover:border-orange-500/50 overflow-hidden`}>
 <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 100\'xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\'baseFrequency=\'0.9\'/%3E%3C/filter%3E%3Crect width=\'100%25\'height=\'100%25\'filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
 <BulletHole className="top-1 right-1" size={14} />
 <div className="relative">
 <div className="mb-3 flex items-center justify-center group-hover:scale-110 transition" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.7))'}}><img src={f.image} alt={f.name} style={{ width: '96px', height: '96px', objectFit: 'contain'}} /></div>
 <div className="text-white font-serif font-bold text-lg mb-1">{f.short}</div>
 <div className="text-orange-300 text-[10px] tracking-[0.3em] mb-3">{f.motto}</div>
 <div className="text-white/70 text-xs leading-snug">{f.desc}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
};

// ===== FACTION LOYALTY PAGE (NEW) =====
const FactionLoyalty = ({ loyalFaction, onPledge }) => {
 const [hoveredFaction, setHoveredFaction] = useState(null);

 return (
 <section className="relative py-24 px-6">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BloodSplatter className="top-20 left-1/2 -translate-x-1/2" size={200} opacity={0.15} />

 <div className="max-w-7xl mx-auto pt-8 relative">
 <div className="text-center mb-12">
 <div className="text-red-400/80 text-xs tracking-[0.4em] uppercase mb-3 flex items-center justify-center gap-2">
 <span className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'pulse-red 1s infinite'}} />
 — Allegiance Required —
 <span className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'pulse-red 1s infinite'}} />
 </div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-4">
 DECLARE LOYALTY
 </DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto uppercase text-xs tracking-widest">
 One faction. One oath. Your choice unlocks signature perks and identifies you in the field.
 </p>
 {loyalFaction && (
 <div className="inline-block mt-6 px-6 py-2 bg-orange-600/20 border border-orange-400/60 rounded">
 <div className="text-stone-400 text-[10px] tracking-widest uppercase">Current Oath</div>
 <div className="text-orange-300 font-serif font-bold text-xl">{loyalFaction}</div>
 </div>
 )}
 </div>

 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
 {FACTIONS.map((f, idx) => {
 const isPledged = loyalFaction === f.short;
 const isHovered = hoveredFaction === idx;
 return (
 <div
 key={f.name}
 onMouseEnter={() => setHoveredFaction(idx)}
 onMouseLeave={() => setHoveredFaction(null)}
 onClick={() => onPledge(f.short)}
 className={`relative bg-gradient-to-br ${f.color} rounded p-6 cursor-pointer transition-all duration-500 overflow-hidden border-2 ${
 isPledged ? 'border-orange-400 scale-105 shadow-2xl': 'border-stone-700/50 hover:border-orange-500/50'}`}
 style={{
 boxShadow: isPledged ? `0 0 60px ${f.glowColor}, 0 20px 40px rgba(0,0,0,0.6)` : isHovered ? '0 20px 40px rgba(0,0,0,0.6)': '0 10px 20px rgba(0,0,0,0.4)',
 transform: isPledged ? 'translateY(-8px)': isHovered ? 'translateY(-4px)': 'translateY(0)',
 }}
 >
 {/* Grunge overlay */}
 <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none" style={{
 backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 100\'xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\'baseFrequency=\'0.8\'/%3E%3C/filter%3E%3Crect width=\'100%25\'height=\'100%25\'filter=\'url(%23n)\'/%3E%3C/svg%3E")',
 }} />

 {isPledged && (
 <div className="absolute -top-2 -right-2 z-10">
 <div className="bg-gradient-to-r from-orange-500 to-red-600 text-yellow-100 text-[10px] font-bold px-3 py-1 rounded tracking-widest border border-orange-300 shadow-lg" style={{ transform: 'rotate(8deg)'}}>
 PLEDGED
 </div>
 </div>
 )}

 <BulletHole className="top-2 left-2" size={16} />
 <BloodSplatter className="bottom-0 right-0" size={80} opacity={0.2} color="#7f1d1d"/>

 <div className="relative">
 {/* Symbol */}
 <div className="flex items-center justify-between mb-4">
 <div style={{ filter: isPledged ? `drop-shadow(0 0 16px ${f.glowColor}) drop-shadow(0 0 32px ${f.glowColor})` : `drop-shadow(0 4px 10px rgba(0,0,0,0.7))`}}>
 <img src={f.image} alt={f.name} style={{ width: '128px', height: '128px', objectFit: 'contain'}} />
 </div>
 <div className="text-right">
 <div className="text-orange-300 text-2xl font-bold font-mono">{f.pledged.toLocaleString()}</div>
 <div className="text-stone-400 text-[9px] tracking-widest uppercase">Sworn</div>
 </div>
 </div>

 <DuctTape rotation={-4} className="-top-1 right-12"/>

 <h3 className="text-yellow-100 font-serif font-bold text-2xl mb-1" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.8)'}}>
 {f.name}
 </h3>
 <div className="text-orange-300 text-[10px] tracking-[0.4em] mb-4 font-bold">{f.motto}</div>

 <p className="text-white/80 text-sm mb-5 leading-relaxed italic">"{f.desc}"</p>

 <div className="space-y-2 mb-5 bg-black/40 rounded p-3 border border-stone-700/50">
 <div className="flex justify-between text-xs">
 <span className="text-stone-400 uppercase tracking-wider">Strength</span>
 <span className="text-orange-200 font-bold">{f.strength}</span>
 </div>
 <div className="flex justify-between text-xs">
 <span className="text-stone-400 uppercase tracking-wider">Playstyle</span>
 <span className="text-orange-200 font-bold">{f.playstyle}</span>
 </div>
 </div>

 <div className="bg-black/60 border border-orange-500/30 rounded p-3 mb-4">
 <div className="text-orange-400 text-[10px] tracking-widest uppercase mb-1">Loyalty Perk</div>
 <div className="text-stone-200 text-sm">{f.perk}</div>
 </div>

 <button
 className={`w-full py-2.5 font-bold rounded tracking-widest uppercase text-sm transition border ${
 isPledged
 ? 'bg-orange-600 text-yellow-100 border-orange-400 cursor-default': 'bg-black/50 hover:bg-orange-600/40 text-yellow-100 border-orange-500/40 hover:border-orange-400'}`}
 >
 {isPledged ? 'Loyalty Confirmed': 'Swear Allegiance'}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </section>
 );
};

// ===== STARTER CRATES =====
const StarterPacks = () => {
 const [hovered, setHovered] = useState(null);
 return (
 <section className="relative py-24 px-6">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BloodSplatter className="bottom-20 left-10" size={150} opacity={0.15} />
 <div className="max-w-7xl mx-auto pt-8">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Supply Drops —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Survival Caches</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto">Pre-collapse stockpiles, scavenged and sealed. Choose your initiation. Pay the toll.</p>
 </div>

 <div className="grid md:grid-cols-3 gap-8">
 {SUPPLY_CRATES.map((pack, i) => (
 <div
 key={pack.name}
 onMouseEnter={() => setHovered(i)}
 onMouseLeave={() => setHovered(null)}
 className={`relative bg-gradient-to-br ${pack.color} rounded p-8 cursor-pointer transition-all duration-500 border border-stone-700/50 hover:border-orange-500/60 ${pack.featured ? 'md:-translate-y-4 ring-2 ring-orange-500/50': ''} ${hovered === i ? 'scale-105 -translate-y-2': ''}`}
 style={{ boxShadow: hovered === i ? `0 30px 60px -15px rgba(249,115,22,0.4)` : '0 15px 30px rgba(0,0,0,0.6)'}}
 >
 <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" style={{
 backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 100\'xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\'baseFrequency=\'0.85\'/%3E%3C/filter%3E%3Crect width=\'100%25\'height=\'100%25\'filter=\'url(%23n)\'/%3E%3C/svg%3E")',
 }} />
 <BulletHole className="top-3 right-3" size={18} />
 <div className="absolute top-2 left-2 text-stone-500/40 text-[10px] font-mono tracking-widest">CACHE-{String(i + 1).padStart(3, '0')}</div>
 <div className="absolute top-2 right-12 px-2 py-0.5 bg-black/40 border border-red-500/50 text-red-300 text-[9px] tracking-widest uppercase rounded">THREAT: {pack.threat}</div>

 {pack.featured && (
 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-yellow-100 text-xs font-bold px-4 py-1 rounded tracking-widest border border-orange-300">
 RECOMMENDED
 </div>
 )}

 <div className="relative h-48 mb-6 mt-6 flex items-center justify-center">
 {/* Back ghost pack — sits behind for stacked depth */}
 <div className={`absolute w-32 h-44 rounded bg-gradient-to-br from-black/40 to-black/80 border-2 ${pack.accent} transition-transform duration-500`} style={{ transform: hovered === i ? 'rotate(5deg) translate(20px, 5px)': 'rotate(2deg) translateX(8px)', opacity: 0.7 }} />
 {/* Front pack — Mythic Spellbook "Birth of Universe 1"booster art */}
 <div className="relative w-32 h-44 rounded overflow-hidden transition-transform duration-500" style={{
 transform: hovered === i ? 'rotate(-5deg) translateY(-10px)': 'rotate(-2deg)',
 boxShadow: hovered === i ? '0 20px 40px rgba(0,0,0,0.8)': '0 10px 20px rgba(0,0,0,0.5)',
 }}>
 <img
 src="./assets/artwork/gameicons/birthofuniverse1.png" alt={pack.name}
 className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }}
 />
 {/* Subtle scratch overlay so the pack reads as physical packaging */}
 <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 12px)'}} />
 {/* Tier ribbon at the bottom corner */}
 <div className="absolute bottom-1 left-1 right-1 flex justify-between text-[7px] text-stone-300 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
 <span>BATCH 2847</span>
 <span>{pack.tier.toUpperCase()}</span>
 </div>
 </div>
 </div>

 <div className="text-center mb-6 relative">
 <h3 className="text-3xl font-serif font-bold text-yellow-100 mb-2">{pack.name}</h3>
 <div className="text-orange-300 text-4xl font-bold mb-2">{pack.price}</div>
 <p className="text-white/70 text-sm italic">{pack.description}</p>
 </div>

 <div className="space-y-2 mb-6 text-white/80 text-sm relative">
 <div className="flex justify-between border-b border-white/10 pb-1">
 <span className="uppercase text-xs tracking-wider text-stone-400">Contents</span>
 <span className="font-bold">{pack.cards} CARDS</span>
 </div>
 <div className="flex justify-between border-b border-white/10 pb-1">
 <span className="uppercase text-xs tracking-wider text-stone-400">Factions</span>
 <span className="font-bold text-xs">{pack.factions.join(', ')}</span>
 </div>
 <div className="flex flex-wrap gap-1 pt-2">
 {Object.entries(pack.rarity).map(([r, n]) => (
 <span key={r} className="text-[10px] bg-black/40 border border-stone-600/50 px-2 py-0.5 rounded uppercase tracking-wider">{n} {r}</span>
 ))}
 </div>
 </div>

 <button className="w-full py-3 bg-black/50 hover:bg-orange-600/30 border border-orange-500/40 hover:border-orange-400 text-yellow-100 font-bold rounded tracking-wider transition uppercase text-sm relative">
 Claim Cache
 </button>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
};

// ===== GALLERY =====
const Gallery = ({ onCardClick, onAddToDeck }) => {
 const [filter, setFilter] = useState('all');
 const factions = ['all', 'Watchers', 'Order', 'Forgotten', 'Hunters', 'Reclaimers'];
 const filtered = filter === 'all'? cards : cards.filter((c) => c.faction === filter);

 return (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-20 right-10" size={130} opacity={0.18} />
 <div className="max-w-7xl mx-auto">
 <div className="text-center mb-12">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Salvaged Archive —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Card Database</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto">Every card recovered from the field. Hover to inspect. Click to add to your loadout.</p>
 </div>

 <div className="flex flex-wrap gap-3 justify-center mb-16">
 {factions.map((s) => (
 <button key={s} onClick={() => setFilter(s)} className={`px-5 py-2 rounded text-sm font-semibold tracking-wider uppercase transition border ${filter === s ? 'bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 border-orange-400 shadow-lg shadow-orange-500/30': 'border-stone-700 text-stone-400 hover:border-orange-500/50 hover:text-orange-300 bg-black/30'}`}>
 {s}
 </button>
 ))}
 </div>

 <div className="flex flex-wrap gap-12 justify-center">
 {filtered.map((c) => (
 <div key={c.id} className="relative group">
 <Card card={c} onClick={onCardClick} size="md"/>
 <button onClick={(e) => { e.stopPropagation(); onAddToDeck(c); }} className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 text-xs font-bold rounded tracking-wider opacity-0 group-hover:opacity-100 transition shadow-lg whitespace-nowrap z-10 border border-orange-400/50">
 + LOAD CARD
 </button>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
};

// ===== DECK BUILDER =====
const DeckBuilder = ({ deck, onRemove, onClear }) => {
 const totalCost = deck.reduce((sum, c) => sum + c.cost, 0);
 const avgCost = deck.length ? (totalCost / deck.length).toFixed(1) : 0;
 const avgPower = deck.length ? Math.round(deck.reduce((s, c) => s + c.power, 0) / deck.length) : 0;
 const avgThreat = deck.length ? (deck.reduce((s, c) => s + c.threatLevel, 0) / deck.length).toFixed(1) : 0;
 const factionCounts = deck.reduce((acc, c) => { acc[c.faction] = (acc[c.faction] || 0) + 1; return acc; }, {});
 const manaCurve = Array.from({ length: 9 }, (_, i) => deck.filter((c) => c.cost === i + 1).length);
 const maxCurve = Math.max(...manaCurve, 1);

 return (
 <section className="relative py-24 px-6">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <div className="max-w-7xl mx-auto pt-8">
 <div className="text-center mb-12">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Field Kit Assembly —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Survival Loadout</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto">Build a 40-card spellbook. Monitor your threat profile. Don't get yourself killed.</p>
 </div>

 <div className="grid lg:grid-cols-3 gap-8">
 <div className="lg:col-span-1 space-y-6">
 <div className="bg-black/60 border border-orange-600/30 rounded p-6 relative overflow-hidden">
 <BulletHole className="top-12 right-4" size={14} />
 <div className="absolute top-0 right-0 px-2 py-0.5 bg-orange-600/30 border-l border-b border-orange-500/50 text-orange-300 text-[10px] tracking-widest font-mono">FIELD-OPS</div>
 <h3 className="text-orange-300 font-serif font-bold text-xl mb-4 flex items-center justify-between">
 <span className="tracking-wider">LOADOUT STATS</span>
 {deck.length > 0 && <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 normal-case font-normal uppercase tracking-wider">Dump All</button>}
 </h3>

 <div className="space-y-3 mb-6">
 <div className="flex justify-between items-baseline border-b border-orange-500/10 pb-2"><span className="text-stone-400 text-xs uppercase tracking-widest">Total Cards</span><span className="text-orange-300 text-2xl font-bold">{deck.length}<span className="text-stone-500 text-sm">/40</span></span></div>
 <div className="flex justify-between items-baseline border-b border-orange-500/10 pb-2"><span className="text-stone-400 text-xs uppercase tracking-widest">Avg Cost</span><span className="text-orange-300 text-2xl font-bold">{avgCost}</span></div>
 <div className="flex justify-between items-baseline border-b border-orange-500/10 pb-2"><span className="text-stone-400 text-xs uppercase tracking-widest">Avg Power</span><span className="text-orange-300 text-2xl font-bold">{avgPower}</span></div>
 <div className="flex justify-between items-baseline border-b border-orange-500/10 pb-2"><span className="text-stone-400 text-xs uppercase tracking-widest">Threat Profile</span><span className="text-red-400 text-2xl font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'pulse-red 1.5s infinite'}} />{avgThreat}</span></div>
 </div>

 <div className="mb-6">
 <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">Mana Curve</div>
 <div className="flex items-end gap-1 h-24">
 {manaCurve.map((count, i) => (
 <div key={i} className="flex-1 flex flex-col items-center">
 <div className="w-full bg-gradient-to-t from-red-700 via-orange-500 to-yellow-400 rounded-t transition-all" style={{ height: `${(count / maxCurve) * 100}%`, minHeight: count > 0 ? '4px': '0'}} />
 <div className="text-stone-500 text-[10px] mt-1 font-mono">{i + 1}</div>
 </div>
 ))}
 </div>
 </div>

 <div>
 <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">Faction Mix</div>
 {Object.keys(factionCounts).length === 0 ? <div className="text-stone-600 text-sm italic">No allegiance declared</div> : (
 <div className="space-y-2">
 {Object.entries(factionCounts).map(([faction, count]) => (
 <div key={faction} className="flex items-center gap-2">
 <span className="text-stone-300 text-xs w-20 uppercase tracking-wider">{faction}</span>
 <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden border border-stone-700"><div className="h-full bg-gradient-to-r from-orange-600 to-red-600 rounded-full transition-all" style={{ width: `${(count / deck.length) * 100}%` }} /></div>
 <span className="text-orange-300 text-sm font-bold w-6 text-right">{count}</span>
 </div>
 ))}
 </div>
 )}
 </div>

 <button disabled={deck.length === 0} className="w-full mt-6 py-3 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-wider hover:shadow-lg hover:shadow-orange-500/40 transition disabled:opacity-30 disabled:cursor-not-allowed uppercase border border-orange-400/50">Lock In Loadout</button>
 </div>
 </div>

 <div className="lg:col-span-2">
 <div className="bg-black/40 border border-orange-600/20 rounded p-6 min-h-[400px] relative">
 <div className="absolute top-2 right-2 text-stone-600 text-[10px] font-mono tracking-widest">DECK-VIEW.SCRN</div>
 {deck.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center text-center py-16">
 <div className="text-6xl mb-4 opacity-20"></div>
 <h4 className="text-orange-300 font-serif text-2xl mb-2 tracking-wider">NO LOADOUT REGISTERED</h4>
 <p className="text-stone-500 max-w-md uppercase text-xs tracking-widest">Return to the Card Database. Load cards into your kit.</p>
 </div>
 ) : (
 <div className="flex flex-wrap gap-4 justify-center">
 {deck.map((c, i) => (
 <div key={`${c.id}-${i}`} className="relative group">
 <Card card={c} size="sm" floating={false} intensity={0.5} />
 <button onClick={() => onRemove(i)} className="absolute -top-2 -right-2 w-7 h-7 rounded bg-red-700 hover:bg-red-600 text-yellow-100 text-sm font-bold opacity-0 group-hover:opacity-100 transition shadow-lg flex items-center justify-center z-20 border border-red-400"></button>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </section>
 );
};

// ===== JOIN THE RESISTANCE (NEW) =====
const JoinResistance = () => {
 const [email, setEmail] = useState('');
 const [signed, setSigned] = useState(false);

 const handleSubmit = () => {
 if (email.includes('@')) setSigned(true);
 };

 return (
 <section className="relative py-32 px-6 overflow-hidden">
 {/* Full-bleed dramatic background — The Flood: tornadoes, demons, hellgate */}
 <div className="absolute inset-0" style={{
 backgroundImage: 'url("./assets/artwork/The Flood.png")',
 backgroundSize: 'cover',
 backgroundPosition: 'center',
 backgroundRepeat: 'no-repeat',
 }} />

 {/* Darkening overlay so the wanted-poster panel + headline stay legible */}
 <div className="absolute inset-0" style={{
 background: 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 50%, rgba(127, 29, 29, 0.55) 100%)',
 }} />

 {/* Slight red vignette on the corners to keep the existing apocalypse mood */}
 <div className="absolute inset-0 pointer-events-none" style={{
 background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
 }} />

 <BloodSplatter className="top-10 left-1/4" size={200} opacity={0.3} />
 <BloodSplatter className="bottom-10 right-1/4" size={250} opacity={0.25} />
 <BulletHole className="top-1/4 right-10" size={32} />
 <BulletHole className="bottom-1/3 left-12" size={26} />
 <BulletHole className="top-1/2 right-1/3" size={20} />

 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <HazardStripe className="absolute bottom-0 left-0 right-0"/>

 <div className="max-w-5xl mx-auto relative">
 {/* Wanted poster style frame */}
 <div className="relative bg-stone-900/80 border-4 border-double border-orange-500/50 p-12 backdrop-blur" style={{
 boxShadow: '0 0 60px rgba(220, 38, 38, 0.4), inset 0 0 30px rgba(0,0,0,0.6)',
 }}>
 {/* Corner duct tape */}
 <DuctTape rotation={-25} className="-top-3 -left-3"/>
 <DuctTape rotation={20} className="-top-3 -right-3"/>
 <DuctTape rotation={15} className="-bottom-3 -left-3"/>
 <DuctTape rotation={-20} className="-bottom-3 -right-3"/>

 {/* Top stamp */}
 <div className="absolute top-2 right-6 text-red-500/60 font-bold text-xs tracking-widest border-2 border-red-500/60 px-2 py-1" style={{ transform: 'rotate(8deg)'}}>
 CLASSIFIED · LEVEL 5
 </div>

 <div className="text-center">
 <div className="inline-flex items-center gap-2 mb-4">
 <span className="text-orange-400 text-2xl"></span>
 <div className="text-orange-400 text-xs tracking-[0.5em] uppercase font-bold">PLAY FREE — NO DOWNLOAD</div>
 <span className="text-orange-400 text-2xl"></span>
 </div>

 <DistressedHeading level="h2" className="text-6xl md:text-8xl font-serif font-bold text-yellow-100 mb-4 leading-none">
 OPEN THE
 <span className="block bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.9))'}}>
 SPELLBOOK
 </span>
 </DistressedHeading>

 <p className="text-stone-300 text-lg md:text-xl max-w-2xl mx-auto mb-2 italic">
 Sign up. Pick a hero. Hit Find Match.
 </p>
 <p className="text-stone-400 text-sm max-w-xl mx-auto mb-10">
 Free to play. Cross-device cloud sync. Ranked multiplayer queues with AI fallback if no one's online.
 Earn Cinders and Arena Points to enter the Coliseum tournament ladder.
 </p>

 {/* Counter */}
 <div className="inline-flex items-center gap-6 mb-10 px-8 py-4 bg-black/60 border border-orange-500/40 rounded">
 <div className="text-left">
 <div className="text-stone-400 text-[10px] tracking-widest uppercase">Active Wielders</div>
 <div className="text-orange-300 text-3xl font-bold font-mono" style={{ animation: 'flicker 4s infinite'}}>
 20,841
 </div>
 </div>
 <div className="h-12 w-px bg-orange-500/40"/>
 <div className="text-left">
 <div className="text-stone-400 text-[10px] tracking-widest uppercase">Status</div>
 <div className="text-green-400 text-xl font-bold flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse-red 1s infinite'}} />
 ONLINE · SEASON 1
 </div>
 </div>
 </div>

 {/* CTA buttons */}
 <div className="max-w-lg mx-auto">
 <div className="flex flex-col sm:flex-row gap-3 justify-center">
 <a
 href={PLAY_URL}
 className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-widest uppercase text-sm hover:shadow-xl hover:shadow-orange-500/50 transition border border-orange-400/50 text-center">
 PLAY NOW — FREE
 </a>
 <a
 href={LOGIN_URL}
 className="flex-1 px-6 py-4 border border-orange-500/40 text-orange-200 font-semibold rounded tracking-widest uppercase text-sm hover:bg-orange-500/10 transition text-center">
 LOG IN
 </a>
 </div>
 <p className="text-stone-500 text-[10px] mt-3 tracking-widest uppercase">No download. Plays in your browser. Account syncs across devices.</p>
 </div>

 {/* Feature badges */}
 <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-stone-400">
 <span className="text-[10px] tracking-widest uppercase">Includes</span>
 <span className="px-3 py-1 bg-black/40 border border-stone-700/50 rounded text-xs uppercase">39 Factions</span>
 <span className="px-3 py-1 bg-black/40 border border-stone-700/50 rounded text-xs uppercase">200+ Cards</span>
 <span className="px-3 py-1 bg-black/40 border border-stone-700/50 rounded text-xs uppercase">Ranked Multiplayer</span>
 <span className="px-3 py-1 bg-black/40 border border-stone-700/50 rounded text-xs uppercase">Kalon Transformations</span>
 <span className="px-3 py-1 bg-black/40 border border-stone-700/50 rounded text-xs uppercase">Cross-Device Sync</span>
 </div>
 </div>
 </div>

 {/* Bottom signature */}
 <div className="text-center mt-6 text-stone-600 text-[10px] tracking-widest font-mono">
 // SEASON 1 — THE ASHEN SEASON · 90 DAYS REMAINING //
 </div>
 </div>
 </section>
 );
};

// ===== SPOTLIGHT =====
const Spotlight = ({ card, reverse, onCardClick }) => (
 <section className="relative py-24 px-6">
 <BloodSplatter className={reverse ? "top-10 left-10": "top-10 right-10"} size={100} opacity={0.15} />
 <div className={`max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center ${reverse ? 'md:[&>*:first-child]:order-2': ''}`}>
 <div className="flex justify-center relative">
 <div className="absolute -inset-10 bg-orange-500/5 rounded-full blur-3xl"/>
 <Card card={card} onClick={onCardClick} size="lg"/>
 </div>
 <div>
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">
 <span className="text-orange-400">●</span> SPOTLIGHT · {card.faction.toUpperCase()}
 </div>
 <DistressedHeading level="h3" className="text-4xl md:text-5xl font-serif font-bold text-yellow-100 mb-6 leading-tight">
 {card.name}
 </DistressedHeading>
 <p className="text-stone-300 text-lg italic mb-6 border-l-2 border-orange-500/50 pl-4">"{card.flavor}"</p>
 <p className="text-stone-400 leading-relaxed mb-8">
 {card.effect}
 </p>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.cost}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">Cost</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.hp ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">HP</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.atk ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">ATK</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.def ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">DEF</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.mag ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">MAG</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-xl font-bold">{card.spd ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-widest uppercase">SPD</div></div>
 </div>
 {card.kalon && (
 <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-600/30 to-amber-600/20 border border-yellow-500/50 rounded">
 <span className="text-2xl"></span>
 <div>
 <div className="text-yellow-300 text-[10px] tracking-widest uppercase font-bold">Kalon Mode</div>
 <div className="text-stone-300 text-xs">Transforms mid-match into a stronger form.</div>
 </div>
 </div>
 )}
 </div>
 </div>
 </section>
);

// ===== HOW TO PLAY =====
const HowToPlay = () => {
 const steps = [
 { num: '01', title: 'Build Your Deck', text: 'Forge a 40-card deck from 39 factions. Mix units, spells, traps, weather, walls, and locations. Each hero comes with a starter deck — or build your own.', icon: ''},
 { num: '02', title: 'Coin Flip → Place Hero', text: 'Win the toss, pick who goes first. Your hero spawns on the grid. Cards in hand cost energy (refilled every turn).', icon: ''},
 { num: '03', title: 'Move & Attack', text: 'Units move along tiles like chess pieces. Heroes learn up to 4 moves at a time. Range, accuracy, and elemental matchups all matter.', icon: ''},
 { num: '04', title: 'Transform & Win', text: 'Trigger Kalon transformations mid-match. Drop weather + locations to reshape the field. Drop the enemy hero to 0 HP to win.', icon: ''},
 ];

 return (
 <section className="relative py-24 px-6">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <div className="max-w-6xl mx-auto pt-8">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— How To Play —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Four Turns to Glory</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto uppercase text-xs tracking-widest">Like chess. Like Pokémon. Like nothing else.</p>
 </div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
 {steps.map((s, i) => (
 <div key={i} className="relative bg-black/60 border border-orange-600/30 rounded p-6 hover:border-orange-400/60 transition group overflow-hidden">
 <BulletHole className="top-2 right-2" size={14} />
 <div className="absolute top-2 right-8 text-stone-600 text-[9px] font-mono tracking-widest">STEP-{s.num}</div>
 <div className="text-7xl font-serif font-bold text-orange-500/10 mb-2 group-hover:text-orange-500/20 transition">{s.num}</div>
 <div className="text-3xl mb-2 opacity-60">{s.icon}</div>
 <h3 className="text-yellow-100 font-serif font-bold text-xl mb-3 tracking-wide">{s.title}</h3>
 <p className="text-stone-400 text-sm leading-relaxed">{s.text}</p>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
};

// ===== ABOUT / GAME OVERVIEW =====
// ===== STORY — universe-out-of-balance lore beat =====
// Pure narrative section that bridges the Hero hook into the mechanical About
// section below. No CTAs, no mechanics — just atmosphere.
const Story = () => (
 <section className="relative py-24 px-6 overflow-hidden">
 {/* Deep red/violet glow backdrop so the page reads "apocalyptic"without
 needing a custom illustration. */}
 <div className="absolute inset-0 pointer-events-none" style={{
 background:
 'radial-gradient(ellipse at 30% 30%, rgba(180,40,40,0.10) 0%, transparent 55%),'+
 'radial-gradient(ellipse at 80% 80%, rgba(120,40,180,0.10) 0%, transparent 55%)',
 }} />
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BloodSplatter className="top-16 left-1/5" size={160} opacity={0.15} />
 <BloodSplatter className="bottom-20 right-1/4" size={150} opacity={0.13} />

 <div className="max-w-4xl mx-auto relative">
 <div className="text-center mb-10">
 <div className="text-red-400/80 text-xs tracking-[0.4em] uppercase mb-3">— The Last Cycle —</div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-5">
 A Universe Out of Balance
 </DistressedHeading>
 <p className="text-stone-300 max-w-2xl mx-auto text-xl leading-relaxed italic">
 The realms are merging.
 </p>
 </div>

 <div className="bg-black/55 border-l-4 border-red-600/60 rounded-r p-7 md:p-8 mb-8" style={{ boxShadow: '0 0 32px rgba(180,40,40,0.18)'}}>
 <p className="text-stone-200 text-lg leading-relaxed mb-4">
 Heaven, wastelands, ruined cities, ancient kingdoms, demon worlds, and forgotten dimensions are <strong className="text-red-300">collapsing into one reality</strong>.
 </p>
 <div className="space-y-2 mb-5 text-stone-200">
 <div className="flex gap-3 items-center"><span className="text-red-400 text-xl">▸</span><span className="text-lg">Monsters walk through modern streets.</span></div>
 <div className="flex gap-3 items-center"><span className="text-red-400 text-xl">▸</span><span className="text-lg">Gods have vanished.</span></div>
 <div className="flex gap-3 items-center"><span className="text-red-400 text-xl">▸</span><span className="text-lg">Survivors fight over the scraps of existence.</span></div>
 </div>
 <p className="text-stone-300 leading-relaxed mb-3">
 Abraxas believes humanity has <strong className="text-red-300">corrupted creation beyond repair</strong>.
 </p>
 <p className="text-stone-300 leading-relaxed">Her answer is simple:</p>
 </div>

 {/* Three commandments — visual triplet, each line a different terrible promise */}
 <div className="grid md:grid-cols-3 gap-4 mb-6">
 <div className="bg-gradient-to-br from-red-950/50 to-black/60 border border-red-700/40 rounded-lg p-5 text-center" style={{ boxShadow: '0 6px 22px rgba(200,40,40,0.18)'}}>
 <div className="text-3xl mb-2"></div>
 <DistressedHeading level="h3" className="text-xl font-serif font-bold text-red-200">Destroy the universe.</DistressedHeading>
 </div>
 <div className="bg-gradient-to-br from-purple-950/50 to-black/60 border border-purple-700/40 rounded-lg p-5 text-center" style={{ boxShadow: '0 6px 22px rgba(140,60,200,0.18)'}}>
 <div className="text-3xl mb-2"></div>
 <DistressedHeading level="h3" className="text-xl font-serif font-bold text-purple-200">Merge every realm.</DistressedHeading>
 </div>
 <div className="bg-gradient-to-br from-orange-950/50 to-black/60 border border-orange-700/40 rounded-lg p-5 text-center" style={{ boxShadow: '0 6px 22px rgba(220,140,40,0.18)'}}>
 <div className="text-3xl mb-2"></div>
 <DistressedHeading level="h3" className="text-xl font-serif font-bold text-orange-200">Begin again.</DistressedHeading>
 </div>
 </div>
 </div>
 </section>
);

// ===== GAME HOOK — bridge from lore (Story) into mechanics (About) =====
// Sells the central gameplay loop in five sharp lines.
const GameHook = () => (
 <section className="relative py-20 px-6 overflow-hidden">
 <div className="absolute inset-0 pointer-events-none" style={{
 background:
 'radial-gradient(ellipse at center, rgba(255,140,40,0.10) 0%, transparent 55%),'+
 'linear-gradient(180deg, rgba(8,4,16,0.5) 0%, rgba(8,4,16,0.0) 100%)',
 }} />
 <BulletHole className="top-1/3 left-1/4" size={28} />
 <BulletHole className="bottom-1/4 right-1/5" size={22} />
 <BloodSplatter className="top-10 right-10" size={130} opacity={0.16} />

 <div className="max-w-4xl mx-auto text-center relative">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— The Last Weapon —</div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-5">
 Your Spellbook Is Your Last Weapon
 </DistressedHeading>
 <p className="text-stone-300 max-w-2xl mx-auto text-lg leading-relaxed mb-8">
 In Mythic Spellbook, every card represents <strong className="text-orange-300">power pulled from a dying realm</strong>.
 </p>

 {/* Five commandments in a vertical stack — feels like an in-game tutorial scroll */}
 <div className="max-w-xl mx-auto bg-black/55 border border-orange-500/40 rounded-lg p-6 md:p-8 space-y-3" style={{ boxShadow: '0 0 36px rgba(255,140,40,0.15)'}}>
 <div className="flex items-center gap-3 text-left"><span className="text-orange-400 text-xl">▸</span><span className="text-stone-200 text-lg"><strong className="text-yellow-100">Command</strong> heroes.</span></div>
 <div className="flex items-center gap-3 text-left"><span className="text-orange-400 text-xl">▸</span><span className="text-stone-200 text-lg"><strong className="text-yellow-100">Summon</strong> monsters.</span></div>
 <div className="flex items-center gap-3 text-left"><span className="text-orange-400 text-xl">▸</span><span className="text-stone-200 text-lg"><strong className="text-yellow-100">Equip</strong> powerful items.</span></div>
 <div className="flex items-center gap-3 text-left"><span className="text-orange-400 text-xl">▸</span><span className="text-stone-200 text-lg"><strong className="text-yellow-100">Cast</strong> forbidden spells.</span></div>
 <div className="flex items-center gap-3 text-left pt-3 mt-3 border-t border-orange-700/30"><span className="text-red-400 text-xl">▸</span><span className="text-orange-200 text-lg font-bold tracking-wide">Survive the apocalypse one battle at a time.</span></div>
 </div>
 </div>
 </section>
);

const About = () => (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-20 right-1/4" size={140} opacity={0.18} />
 <div className="max-w-6xl mx-auto">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— What Is Mythic Spellbook? —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-6">A TCG That Actually Moves</DistressedHeading>
 <p className="text-stone-300 max-w-3xl mx-auto text-lg leading-relaxed">
 Every other TCG is a stack of cards on a table. <strong className="text-orange-300">Mythic Spellbook is a battlefield.</strong>
 Units occupy tiles. Movement matters. Range matters. Cover matters.
 Heroes <strong className="text-orange-300">level up across matches</strong>, learn new moves,
 equip held items, and can <strong className="text-orange-300">transform into Kalon forms</strong> mid-battle.
 </p>
 </div>

 <div className="grid md:grid-cols-3 gap-6 text-stone-300">
 <div className="bg-black/60 border border-orange-600/30 rounded p-6">
 <DuctTape rotation={-4} className="-top-2 -left-2"/>
 <div className="text-orange-300 text-3xl mb-3"></div>
 <h3 className="text-yellow-100 font-serif font-bold text-xl mb-3">SPATIAL COMBAT</h3>
 <p className="text-sm leading-relaxed">Units move 1–4 tiles per turn. Attack range depends on the move. Status effects can shorten range. Flying units bypass walls and ground traps.</p>
 </div>
 <div className="bg-black/60 border border-orange-600/30 rounded p-6">
 <DuctTape rotation={3} className="-top-2 -right-2"/>
 <div className="text-orange-300 text-3xl mb-3"></div>
 <h3 className="text-yellow-100 font-serif font-bold text-xl mb-3">KALON TRANSFORMATIONS</h3>
 <p className="text-sm leading-relaxed">Three transformation charges per match. Trigger a unit's secret form mid-battle — bigger stats, new moves, sometimes a new faction tag. The signature swing mechanic.</p>
 </div>
 <div className="bg-black/60 border border-orange-600/30 rounded p-6">
 <DuctTape rotation={-2} className="-top-2 -left-2"/>
 <div className="text-orange-300 text-3xl mb-3"></div>
 <h3 className="text-yellow-100 font-serif font-bold text-xl mb-3">PERSISTENT HEROES</h3>
 <p className="text-sm leading-relaxed">Your hero levels 1→50 over time. Each level unlocks a new move slot or talent. Subclasses at Lv 3 split their kit three ways. Your Lyra is not your friend's Lyra.</p>
 </div>
 </div>
 </div>
 </section>
);

// ===== WHY WE'RE DIFFERENT =====
const WhyDifferent = () => {
 const features = [
 { icon: '', title: 'Weather That Matters', desc: 'Sun, rain, sandstorm, eclipse, blood moon, mist, mind realm, parallel world — 10+ weather cards each with global passives, immunities, and synergy procs. Drop weather to flip the meta in your favor.'},
 { icon: '', title: 'Change the Location Where You Survive At.', desc: 'Locations are FIELD-WIDE effects that reshape the entire battlefield — visually AND mechanically. Power Altar buffs your mages +5 ATK/MAG. Necropolis heals all undead. Mire halves enemy movement. Only one location can be active — playing a new one shatters the old and the field shifts beneath your feet.'},
 { icon: '', title: 'Hero Progression & Subclasses', desc: 'Heroes level 1→50. Pick a subclass at Lv 3 (e.g. Cedric → Champion / Bastion / Holy Knight) that adds unique moves. Build the same hero three radically different ways.'},
 { icon: '', title: '20 Trap Cards', desc: 'Spike Trap, Bear Trap, Plague Den, Aether Net (catches flyers!), Sleep Powder, Frost Glyph, Bone Crusher — placed face-down adjacent to your hero. Trigger when stepped on.'},
 { icon: '', title: 'Equipment & EV/Nature Training', desc: 'Held items grant stat bonuses, status immunities, on-hit triggers. Pokemon-style EV training and Natures shape long-term hero stats. The grind feels real.'},
 { icon: '', title: 'Live Multiplayer + Coliseum', desc: 'Real-time matchmaking with AI fallback. 12-tier rank ladder (Rookie → Mythic → Apex → Legendary). Open Cups → Regionals → Nationals → Worlds. Faction Wars span each 90-day season.'},
 { icon: '', title: 'Status Effects That Actually Change Combat', desc: '15+ statuses including Infected (halves all stats), Sleep (35% wake chance/turn), Confusion (33% self-hit), Rage (must attack nearest), Follow My Lead (must move toward source). Counterable, stackable, devastating.'},
 { icon: '', title: 'Custom Forge Library', desc: 'Every card is data — units, heroes, moves, items, locations, weather, traps. No collection, no deck, or play style will be the same as every aspect of the Mythic Spellbook truly create your name as an Survivor.'},
 ];
 return (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-10 left-10" size={160} opacity={0.15} />
 <BloodSplatter className="bottom-20 right-10" size={140} opacity={0.18} />
 <div className="max-w-7xl mx-auto">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— What Other TCGs Don't Have —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Eight Reasons We're Different</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto uppercase text-xs tracking-widest">Built for players bored of stack-and-attack.</p>
 </div>
 <div className="grid md:grid-cols-2 gap-6">
 {features.map((f, i) => (
 <div key={i} className="relative bg-black/60 border border-orange-600/30 rounded p-6 hover:border-orange-400/60 transition group overflow-hidden">
 <BulletHole className="top-2 right-2" size={14} />
 <div className="flex items-start gap-4">
 <div className="text-5xl shrink-0">{f.icon}</div>
 <div>
 <h3 className="text-yellow-100 font-serif font-bold text-xl mb-2 tracking-wide">{f.title}</h3>
 <p className="text-stone-400 text-sm leading-relaxed">{f.desc}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
};

// ===== COLISEUM / COMPETITIVE LADDER =====
// ===== BUILD A CAREER — full player-driven economy section =====
// Eight pillars: intro → Trade → Black Market → Betting → Cashout → Competitive
// Economy → Built for Players. Cinder + Aza Coin icons accent every price/value
// reference so the dual-currency model is visible at a glance.
const CinderIcon = ({ size = 22 }) => (
 <img
 src="./assets/artwork/gameicons/Cinder.png" alt="Cinder" style={{ width: size, height: size, verticalAlign: '-0.25em', display: 'inline-block', filter: 'drop-shadow(0 0 6px rgba(255,120,40,0.55))'}}
 />
);
const AzaIcon = ({ size = 22 }) => (
 <img
 src="./assets/artwork/gameicons/Azacoin.png" alt="Aza Coin" style={{ width: size, height: size, verticalAlign: '-0.25em', display: 'inline-block', filter: 'drop-shadow(0 0 6px rgba(140,180,255,0.55))'}}
 />
);

const BuildACareer = () => {
 return (
 <section className="relative py-28 px-6 overflow-hidden">
 {/* Atmospheric backdrop — orange-on-blue economy glow */}
 <div className="absolute inset-0 pointer-events-none" style={{
 background:
 'radial-gradient(ellipse at 20% 20%, rgba(255,140,60,0.10) 0%, transparent 55%),'+
 'radial-gradient(ellipse at 80% 80%, rgba(80,140,220,0.10) 0%, transparent 55%),'+
 'linear-gradient(180deg, rgba(8,4,16,0.4) 0%, rgba(8,4,16,0.0) 100%)',
 }} />
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BloodSplatter className="top-24 right-1/4" size={170} opacity={0.12} />
 <BloodSplatter className="bottom-32 left-1/5" size={150} opacity={0.12} />

 <div className="max-w-6xl mx-auto relative">
 {/* ===== Header ===== */}
 <div className="text-center mb-14">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— The Economy —</div>
 <DistressedHeading className="text-5xl md:text-7xl font-serif font-bold text-yellow-100 mb-5">
 Build a Career
 </DistressedHeading>
 <div className="flex items-center justify-center gap-4 mb-6">
 <CinderIcon size={32} />
 <div className="text-3xl md:text-4xl font-serif font-bold tracking-wider text-orange-300">
 Own. Trade. Profit.
 </div>
 <AzaIcon size={32} />
 </div>
 <p className="text-stone-300 max-w-3xl mx-auto text-lg leading-relaxed">
 Every card, hero, item, and cosmetic in Mythic Spellbook has value inside a fully <strong className="text-orange-300">player-driven economy</strong>. Open packs, build collections, trade rare finds, and turn your inventory into a growing arsenal of powerful assets.
 </p>
 <p className="text-stone-300 max-w-3xl mx-auto text-base leading-relaxed mt-4">
 The Market is alive. Prices shift based on <strong className="text-yellow-200">rarity, meta changes, tournament performance, player demand, and limited releases</strong> — creating a living marketplace inspired by real-world stock markets.
 </p>
 <div className="inline-block mt-6 px-6 py-2 border border-orange-500/40 rounded text-orange-200 tracking-[0.3em] uppercase text-sm font-bold">
 Buy Low. Sell High. Trade Smart.
 </div>
 </div>

 {/* ===== Pillar grid ===== */}
 <div className="grid md:grid-cols-2 gap-6 mb-12">
 {/* Trade Anything */}
 <div className="bg-black/50 border border-stone-700/50 rounded-lg p-7 hover:border-orange-500/50 transition" style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.45)'}}>
 <div className="flex items-center gap-3 mb-4">
 <div className="text-4xl"></div>
 <h3 className="text-2xl font-serif font-bold text-yellow-100">Trade Anything</h3>
 </div>
 <p className="text-stone-400 text-sm mb-4">Players can:</p>
 <ul className="space-y-2 text-stone-300 text-sm">
 <li className="flex gap-2"><span className="text-orange-400 mt-0.5">▸</span><span><strong className="text-yellow-200">Trade cards</strong> directly with other players</span></li>
 <li className="flex gap-2"><span className="text-orange-400 mt-0.5">▸</span><span><strong className="text-yellow-200">Sell Heroes, Items, and rare collectibles</strong> on the Black Market</span></li>
 <li className="flex gap-2"><span className="text-orange-400 mt-0.5">▸</span><span>Build collections and <strong className="text-yellow-200">flip valuable assets</strong> for profit</span></li>
 <li className="flex gap-2"><span className="text-orange-400 mt-0.5">▸</span><span>Negotiate <strong className="text-yellow-200">multi-card deals</strong> and player-to-player offers</span></li>
 <li className="flex gap-2"><span className="text-orange-400 mt-0.5">▸</span><span>Track <strong className="text-yellow-200">market trends</strong> and rising card values</span></li>
 </ul>
 <div className="mt-5 pt-4 border-t border-stone-700/50 text-stone-400 italic text-sm">
 Some players dominate the battlefield. Others dominate the market.
 </div>
 </div>

 {/* The Black Market */}
 <div className="bg-gradient-to-br from-purple-950/40 to-black/60 border border-purple-700/40 rounded-lg p-7 hover:border-purple-400/60 transition" style={{ boxShadow: '0 8px 28px rgba(120,40,160,0.25)'}}>
 <div className="flex items-center gap-3 mb-4">
 <div className="text-4xl">️</div>
 <h3 className="text-2xl font-serif font-bold text-purple-200">The Black Market</h3>
 </div>
 <p className="text-stone-300 text-sm mb-4 leading-relaxed">
 Mythic Spellbook's <strong className="text-purple-200">live player marketplace</strong> where players can:
 </p>
 <ul className="space-y-2 text-stone-300 text-sm mb-4">
 <li className="flex gap-2"><span className="text-purple-400 mt-0.5">▸</span><span>List cards, Heroes, and Items for <CinderIcon size={14} /> <strong className="text-orange-300">Cinders</strong></span></li>
 <li className="flex gap-2"><span className="text-purple-400 mt-0.5">▸</span><span>Search for <strong className="text-purple-200">rare or meta-defining</strong> collectibles</span></li>
 <li className="flex gap-2"><span className="text-purple-400 mt-0.5">▸</span><span>Discover <strong className="text-purple-200">rising-value cards</strong> before the community catches on</span></li>
 <li className="flex gap-2"><span className="text-purple-400 mt-0.5">▸</span><span>Build wealth through <strong className="text-purple-200">trading and speculation</strong></span></li>
 </ul>
 <div className="pt-4 border-t border-purple-700/30 text-stone-300 text-sm leading-relaxed">
 The economy evolves with the players. <span className="text-purple-200 font-bold">No fixed value.</span> <span className="text-purple-200 font-bold">No artificial control.</span> Supply and demand decide everything.
 </div>
 </div>

 {/* Spectate. Bet. Win. */}
 <div className="bg-gradient-to-br from-red-950/40 to-black/60 border border-red-700/40 rounded-lg p-7 hover:border-red-400/60 transition" style={{ boxShadow: '0 8px 28px rgba(200,60,60,0.25)'}}>
 <div className="flex items-center gap-3 mb-4">
 <div className="text-4xl"></div>
 <h3 className="text-2xl font-serif font-bold text-red-200">Spectate. Bet. Win.</h3>
 </div>
 <p className="text-stone-300 text-sm mb-4 leading-relaxed">
 A competitive betting system powered by <CinderIcon size={14} /> <strong className="text-orange-300">Cinders</strong>. Spectate live matches, tournaments, ranked battles, and championship events — wager on outcomes.
 </p>
 <p className="text-stone-400 text-xs uppercase tracking-widest mb-2">Bet On:</p>
 <ul className="space-y-1.5 text-stone-300 text-sm mb-4">
 <li className="flex gap-2"><span className="text-red-400 mt-0.5">▸</span><span>Ranked Matches</span></li>
 <li className="flex gap-2"><span className="text-red-400 mt-0.5">▸</span><span>Tournament Finals</span></li>
 <li className="flex gap-2"><span className="text-red-400 mt-0.5">▸</span><span>Rival Battles</span></li>
 <li className="flex gap-2"><span className="text-red-400 mt-0.5">▸</span><span>Community Events</span></li>
 <li className="flex gap-2"><span className="text-red-400 mt-0.5">▸</span><span>High-Stakes Arena Matches</span></li>
 </ul>
 <div className="pt-4 border-t border-red-700/30 text-stone-300 text-sm leading-relaxed">
 Predict winners correctly and earn <strong className="text-orange-300">more Cinders</strong>. <em className="text-red-200">The better your game knowledge, the bigger your advantage.</em>
 </div>
 </div>

 {/* Cashout System */}
 <div className="bg-gradient-to-br from-emerald-950/40 to-black/60 border border-emerald-700/40 rounded-lg p-7 hover:border-emerald-400/60 transition" style={{ boxShadow: '0 8px 28px rgba(60,160,100,0.25)'}}>
 <div className="flex items-center gap-3 mb-4">
 <div className="text-4xl"></div>
 <h3 className="text-2xl font-serif font-bold text-emerald-200">Cashout System</h3>
 </div>
 <p className="text-stone-300 text-sm mb-4 leading-relaxed">
 Players can cash out eligible earned <CinderIcon size={14} /> <strong className="text-orange-300">Cinders</strong> for <strong className="text-emerald-200">real-world USD</strong> through supported payout methods.
 </p>
 <p className="text-stone-300 text-sm mb-4 leading-relaxed">
 Cinders earned through gameplay, trading, tournaments, spectating, and marketplace activity can become real rewards for skilled players and active traders.
 </p>
 <div className="space-y-1.5 text-sm border-l-2 border-emerald-500/60 pl-3 py-2 mb-4 bg-black/40 rounded-r">
 <div className="text-emerald-200 font-bold">This is <em>not</em> hidden crypto.</div>
 <div className="text-emerald-200 font-bold">This is <em>not</em> NFTs.</div>
 <div className="text-stone-300">No blockchain wallets required to play.</div>
 </div>
 <div className="pt-3 text-stone-400 text-xs italic leading-relaxed">
 A direct USD payout system designed around competitive gaming, trading, and player-driven value — not speculative token gimmicks.
 </div>
 </div>
 </div>

 {/* ===== A Competitive Economy (wide banner) ===== */}
 <div className="relative bg-gradient-to-r from-orange-950/40 via-stone-900/60 to-orange-950/40 border-2 border-orange-500/30 rounded-lg p-8 md:p-10 mb-8" style={{ boxShadow: '0 0 40px rgba(255,120,40,0.18), inset 0 0 30px rgba(0,0,0,0.4)'}}>
 <BulletHole className="top-3 right-4" size={24} />
 <div className="flex items-center gap-4 mb-5">
 <div className="text-5xl">️</div>
 <div>
 <DistressedHeading level="h3" className="text-3xl md:text-4xl font-serif font-bold text-yellow-100">A Competitive Economy</DistressedHeading>
 <div className="text-orange-400/80 text-xs tracking-[0.3em] uppercase mt-1">Cards are competitive assets</div>
 </div>
 </div>
 <p className="text-stone-200 text-lg leading-relaxed mb-3">
 A single <strong className="text-orange-300">tournament victory</strong>, <strong className="text-orange-300">strategy shift</strong>, or <strong className="text-orange-300">balance update</strong> can change the value of an entire archetype overnight.
 </p>
 <p className="text-stone-300 leading-relaxed mb-4">
 Rare cards can rise in demand. Forgotten builds can suddenly explode back into the meta.
 </p>
 <div className="text-center pt-3 border-t border-orange-700/30 text-yellow-200 font-serif italic text-lg">
 The battlefield and the marketplace are <strong className="text-orange-300">connected</strong>.
 </div>
 </div>

 {/* ===== Built for Players ===== */}
 <div className="bg-black/55 border border-stone-700/50 rounded-lg p-7 md:p-9">
 <div className="flex items-center gap-3 mb-4">
 <div className="text-3xl"></div>
 <h3 className="text-2xl md:text-3xl font-serif font-bold text-yellow-100">Built for Players</h3>
 </div>
 <p className="text-stone-300 mb-5">Whether you want to:</p>
 <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 mb-6">
 <div className="flex gap-2 text-stone-200"><span className="text-orange-400">▸</span><span>Become a <strong className="text-yellow-200">top-ranked survivor</strong></span></div>
 <div className="flex gap-2 text-stone-200"><span className="text-orange-400">▸</span><span>Build the <strong className="text-yellow-200">rarest collection</strong></span></div>
 <div className="flex gap-2 text-stone-200"><span className="text-orange-400">▸</span><span>Trade like a <strong className="text-yellow-200">market expert</strong></span></div>
 <div className="flex gap-2 text-stone-200"><span className="text-orange-400">▸</span><span>Bet on <strong className="text-yellow-200">elite matches</strong></span></div>
 <div className="flex gap-2 text-stone-200 md:col-span-2"><span className="text-orange-400">▸</span><span>Or <strong className="text-yellow-200">dominate every part</strong> of the ecosystem</span></div>
 </div>
 <p className="text-stone-300 leading-relaxed border-t border-stone-700/50 pt-5">
 Mythic Spellbook gives players multiple ways to <strong className="text-orange-300">play, compete, collect, and profit</strong> inside one connected universe.
 </p>
 </div>

 {/* ===== Currency footer reminder ===== */}
 <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-sm">
 <div className="flex items-center gap-2 text-stone-300">
 <CinderIcon size={28} />
 <span><strong className="text-orange-300">Cinders</strong> — earned in-game · cashable to USD</span>
 </div>
 <div className="text-stone-600">|</div>
 <div className="flex items-center gap-2 text-stone-300">
 <AzaIcon size={28} />
 <span><strong className="text-sky-300">Aza Coin</strong> — premium currency · skip the grind</span>
 </div>
 </div>
 </div>
 </section>
 );
};

// ============================================================================
// PLAYER HUB — sign-in + stats + Vendor Market, all on the website
// ============================================================================
// Reads the same Supabase `user_profiles` row the in-game account writes, so:
// • The stats panel mirrors whatever the player has in-game (no email leaked).
// • Pack purchases on the website call the same RLS-gated row update — the
// gems balance and cardCollection appear in-game on next sync.
// Auth is via Supabase magic-link or password (whichever the project has).
// We default to email/password since the game uses signUp/signInWithPassword.

// ===== Shared catalog of buyable packs — mirrors the in-game PACK_DEFINITIONS.
// Each entry's id MUST match the in-game pack id so the receipt flows cleanly
// into the player's account. Prices follow the in-game cost (in Cinders).
const WEBSITE_PACK_CATALOG = [
 { id: 'starter', name: 'Apprentice Codex', icon: '', cost: 200, sovCost: 20, cards: 8, rarity: 'Common-weighted', desc: 'Eight-card primer pack. Common-tier units, spells, and traps.', accent: '#ff9e64'},
 { id: 'standard', name: "Wielder's Cache", icon: '', cost: 500, sovCost: 50, cards: 8, rarity: 'Balanced', desc: 'Hero drops enabled. Chance for a brand-new deck core.', accent: '#ffb070', featured: true },
 { id: 'premium', name: 'Mythic Spellbook', icon: '', cost: 2000, sovCost: 200, cards: 12, rarity: '1× Mythic guaranteed', desc: 'Twelve cards. One Mythic guaranteed. Held items + Kalon heroes.', accent: '#e87a7a'},
];

// ===== Aza Coin top-up packages — real money → Aza Coin =====
// Mirrors the in-game SOVEREIGN_PACKAGES. Mock checkout for now; replace the
// `handleBuyAza` flow with Stripe Checkout / Apple Pay / etc. before going live.
const AZA_COIN_PACKAGES = [
 { id: 'aza_small', name: 'Pocket Pouch', usd: 4.99, aza: 100, bonus: 0, accent: '#88c8e0'},
 { id: 'aza_medium', name: 'Wielder\'s Purse', usd: 19.99, aza: 525, bonus: 5, accent: '#a0a8ff', featured: true },
 { id: 'aza_large', name: 'Royal Cache', usd: 49.99, aza: 1650, bonus: 10, accent: '#b888ff'},
 { id: 'aza_huge', name: 'Sovereign Vault', usd: 149.99, aza: 5500, bonus: 20, accent: '#ffd166'},
];

const PlayerHub = ({ client, session, profile, refreshProfile, onSignedOut }) => {
 const [buyingId, setBuyingId] = useState(null);
 const [buyMsg, setBuyMsg] = useState('');
 const [storeTab, setStoreTab] = useState('packs'); // 'packs'| 'aza'// Local form state — only used when this page is reached signed-out.
 const [authMode, setAuthMode] = useState('signin');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [authError, setAuthError] = useState('');
 const [loading, setLoading] = useState(false);
 // ===== Live catalog + card-art lookups, pulled from the same Supabase row /
 // ===== Storage bucket the game reads. Lets us show the REAL card name +
 // ===== portrait art for the player's favorite hero + strongest unit instead
 // ===== of just the raw id ("cc_1778461339611") + a generic helmet icon.
 const [catalogById, setCatalogById] = useState(null);
 const [cardArtMap, setCardArtMap] = useState(null);
 const [spriteMap, setSpriteMap] = useState(null);
 useEffect(() => {
 if (!client) return;
 // Card catalog row (admin publishes here; all signed-in players can read).
 client.from('card_catalog').select('cards').eq('id', 'singleton').maybeSingle()
 .then(({ data }) => {
 if (!data || !Array.isArray(data.cards)) return;
 const byId = {};
 for (const c of data.cards) { if (c && c.id) byId[c.id] = c; }
 setCatalogById(byId);
 })
 .catch(() => {});
 // Public catalog art bucket. The single-file path works for small assets;
 // big assets (sprites can be 100MB+) get sharded into `<base>-N.json` with
 // an index file at `<base>.index.json` listing them. We try the index
 // first and fall back to the single-file path so both layouts are supported.
 const pullStorage = async (filename, setter) => {
 try {
 const base = filename.replace(/\.json$/, '');
 const idx = await client.storage.from('public-catalog').download(base + '.index.json');
 if (!idx.error && idx.data) {
 const idxObj = JSON.parse(await idx.data.text());
 const shardNames = Array.isArray(idxObj.shards) ? idxObj.shards : [];
 const merged = {};
 for (const sname of shardNames) {
 try {
 const { data, error } = await client.storage.from('public-catalog').download(sname);
 if (error || !data) continue;
 Object.assign(merged, JSON.parse(await data.text()) || {});
 } catch (e) { /* skip bad shard */ }
 }
 if (Object.keys(merged).length > 0) { setter(merged); return; }
 }
 // No index — fall back to the single-file layout.
 const { data, error } = await client.storage.from('public-catalog').download(filename);
 if (error || !data) return;
 const txt = await data.text();
 if (txt) setter(JSON.parse(txt));
 } catch (e) { /* silent — bucket may not be published yet */ }
 };
 pullStorage('cardArt.json', setCardArtMap);
 pullStorage('sprites.json', setSpriteMap);
 }, [client]);

 // Resolve an in-game card's display image. Order: cardArt portrait (the nice
 // illustration shown on the hand-card frame) → first sprite frame (battlefield
 // pixel art) → null (caller renders the emoji fallback). Hero sprites live
 // under either `h_<id>` or `u_<id>`, so we check both.
 const resolveCardImage = (id, isHero) => {
 if (!id) return null;
 // Helper: extract the first available frame from a sprite record. Sprite
 // records can be { idle: [dataURL] } OR { idle: [dataURL], walk: [...] }
 // OR even just an array — accept all shapes.
 const firstFrame = (s) => {
 if (!s) return null;
 if (typeof s === 'string') return s;
 if (Array.isArray(s)) return s[0] || null;
 if (Array.isArray(s.idle) && s.idle.length > 0) return s.idle[0];
 // Last-resort: look for any animation key with frames
 for (const k of Object.keys(s)) {
 if (Array.isArray(s[k]) && s[k].length > 0 && typeof s[k][0] === 'string') return s[k][0];
 }
 return null;
 };
 // Try every plausible cardArt / sprite key in both the public catalog and
 // the player's own forge data. Heroes can be saved under h_<id> OR u_<id>
 // (the game mirrors them), so we check every variant.
 const sources = [];
 const forge = (profile && profile.forge) || {};
 // cardArt portraits (preferred — they're the hand-card illustrations)
 if (forge.cardArt) sources.push(forge.cardArt);
 if (cardArtMap) sources.push(cardArtMap);
 for (const map of sources) {
 if (map[id]) return map[id];
 }
 // Sprites — try every spritesheet under h_<id> and u_<id> in both data sources
 const spriteSources = [];
 if (forge.sprites) spriteSources.push(forge.sprites);
 if (spriteMap) spriteSources.push(spriteMap);
 const keys = ['h_'+ id, 'u_'+ id, id];
 for (const map of spriteSources) {
 for (const k of keys) {
 const frame = firstFrame(map[k]);
 if (frame) return frame;
 }
 }
 return null;
 };

 const handleSignIn = async (e) => {
 e.preventDefault(); setAuthError('');
 if (!client) { setAuthError('Network not ready. Refresh and try again.'); return; }
 setLoading(true);
 try {
 const fn = authMode === 'signup'? 'signUp': 'signInWithPassword';
 const { error } = await client.auth[fn]({ email, password });
 if (error) setAuthError(error.message);
 else if (authMode === 'signup') setAuthError('Check your email for a verification link, then sign in.');
 } catch (err) { setAuthError((err && err.message) || 'Auth failed.'); }
 setLoading(false);
 };
 const handleSignOut = async () => {
 if (!client) return;
 await client.auth.signOut();
 setEmail(''); setPassword('');
 if (onSignedOut) onSignedOut();
 };

 // ----- Pack purchase (Cinders / Aza coin) -----
 const handleBuy = async (pack, currency) => {
 if (!client || !session || !profile) return;
 setBuyMsg(''); setBuyingId(pack.id);
 const cost = currency === 'sov'? (pack.sovCost || 0) : (pack.cost || 0);
 const field = currency === 'sov'? 'sovereigns': 'gems';
 const have = (profile[field] || 0);
 if (have < cost) {
 setBuyMsg(`Need ${cost - have} more ${currency === 'sov'? 'Aza Coin': 'Cinders'} — earn or top up first.`);
 setBuyingId(null); return;
 }
 const newBalance = have - cost;
 const receipt = {
 id: 'webp_'+ Date.now() + '_'+ Math.random().toString(36).slice(2, 8),
 packId: pack.id, packName: pack.name, currency, cost,
 at: new Date().toISOString(), applied: false,
 };
 const forge = profile.forge && typeof profile.forge === 'object'? profile.forge : {};
 const pending = Array.isArray(forge.webPurchases) ? forge.webPurchases.slice() : [];
 pending.push(receipt);
 const newForge = { ...forge, webPurchases: pending };
 const { error } = await client.from('user_profiles').update({
 [field]: newBalance, forge: newForge, updated_at: new Date().toISOString(),
 }).eq('user_id', session.user.id);
 if (error) {
 setBuyMsg('Purchase failed — '+ error.message);
 } else {
 if (refreshProfile) refreshProfile();
 setBuyMsg(` Purchased ${pack.name} for ${cost} ${currency === 'sov'? 'Aza Coin': 'Cinders'}. Open the game and your pack will be in your inventory.`);
 }
 setBuyingId(null);
 };

 // ----- Aza Coin TOP-UP (mock USD checkout → credits sovereigns column) -----
 // In production: replace the mock confirm with a real Stripe Checkout Session
 // and confirm the credit only after the webhook fires successful.
 const handleBuyAza = async (pkg) => {
 if (!client || !session || !profile) return;
 const totalAza = pkg.aza + (pkg.aza * (pkg.bonus || 0) / 100);
 const ok = window.confirm(
 ` MOCK PURCHASE\n\n` +
 `Package: ${pkg.name}\n` +
 `Price: $${pkg.usd.toFixed(2)} (USD)\n` +
 `You'll receive: ${Math.round(totalAza).toLocaleString()} Aza Coin` +
 (pkg.bonus ? ` (+${pkg.bonus}% bonus)` : '') + `\n\n` +
 `Confirm? (no real charge in this build)`
 );
 if (!ok) return;
 setBuyMsg(''); setBuyingId(pkg.id);
 const have = profile.sovereigns || 0;
 const newBalance = have + Math.round(totalAza);
 const { error } = await client.from('user_profiles').update({
 sovereigns: newBalance, updated_at: new Date().toISOString(),
 }).eq('user_id', session.user.id);
 if (error) {
 setBuyMsg('Top-up failed — '+ error.message);
 } else {
 if (refreshProfile) refreshProfile();
 setBuyMsg(` Credited ${Math.round(totalAza).toLocaleString()} Aza Coin to your account.`);
 }
 setBuyingId(null);
 };

 // ===== UI =====
 const gems = profile ? (profile.gems || 0) : 0;
 const sovereigns = profile ? (profile.sovereigns || 0) : 0;
 const records = (profile && profile.records) || {};
 const competitive = (profile && profile.competitive) || {};
 const wins = records.wins || 0;
 const battles = records.battles || 0;
 const winRate = battles > 0 ? Math.round((wins / battles) * 100) : 0;
 const heroes = (profile && profile.heroes) || {};
 const heroCount = Object.keys(heroes).length;
 const topHero = Object.entries(heroes).reduce((best, [id, h]) => (((h && h.level) || 0) > ((best.h && best.h.level) || 0) ? { id, h } : best), { id: null, h: null });
 const displayName = profile && profile.display_name ? profile.display_name : (session && session.user && session.user.email ? session.user.email.split('@')[0] : 'Wielder');

 // ===== Favorite Hero — most wins from profile.heroes =====
 // Matches the in-game logic. Falls back to highest-level if no one has wins yet.
 const heroEntries = Object.entries(heroes);
 const favoriteEntry = heroEntries.length === 0 ? null : heroEntries.reduce((best, [id, p]) => {
 const bestWins = (best && best.p && best.p.wins) || 0;
 const bestLvl = (best && best.p && best.p.level) || 0;
 const curWins = (p && p.wins) || 0;
 const curLvl = (p && p.level) || 0;
 // Wins first, level as tiebreaker.
 if (curWins > bestWins || (curWins === bestWins && curLvl > bestLvl)) return { id, p };
 return best;
 }, null);
 const favoriteId = favoriteEntry ? favoriteEntry.id : null;
 // Build a unified card-lookup that checks every available source.
 //
 // Lookup order:
 //   1. profile.forge.customCards         (the user's own Forge customs —
 //                                         always fresh, contains custom
 //                                         heroes AND custom units)
 //   2. profile.forge.customHeroes        (defensive — some older saves may
 //                                         have used this alternate key)
 //   3. published card_catalog row        (cross-player shared, admin-managed)
 //   4. marketing HEROES array            (built-in survivors)
 //   5. null → caller falls back to humanizeCardId() for a readable name
 //
 // For custom IDs (cc_<timestamp>) we also strip the prefix when no def is
 // found so the user sees "Custom Hero" instead of "cc_1778461339611".
 const _profileCardLookup = (id) => {
 if (!id) return null;
 const forge = (profile && profile.forge) || {};
 if (Array.isArray(forge.customCards)) {
 const hit = forge.customCards.find(c => c && c.id === id);
 if (hit) return hit;
 }
 if (Array.isArray(forge.customHeroes)) {
 const hit = forge.customHeroes.find(c => c && c.id === id);
 if (hit) return hit;
 }
 if (catalogById && catalogById[id]) return catalogById[id];
 if (typeof HEROES !== 'undefined' && HEROES.find) {
 const h = HEROES.find(x => x.id === id);
 if (h) return h;
 }
 return null;
 };
 // Humanize an unresolved card id into something at least readable. Custom
 // cards from the in-game Forge use ids like `cc_1778461339611` (timestamp
 // suffix). We don't want to surface that raw id to the player. This helper
 // strips the timestamp and falls back to a generic "Custom Hero/Unit" label.
 const humanizeCardId = (id, isHero) => {
 if (!id) return isHero ? 'Hero' : 'Unit';
 if (/^cc_\d+/.test(id)) return isHero ? 'Custom Hero' : 'Custom Unit';
 if (/^h_/.test(id))     return 'Hero';
 if (/^u_/.test(id))     return 'Unit';
 if (/^k_/.test(id))     return 'Kalon';
 // Generic id with underscores/hyphens — title-case it.
 return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
 };

 const favCatalogCard = _profileCardLookup(favoriteId);
 const favHero = favoriteId ? (typeof HEROES !== 'undefined'&& HEROES.find(h => h.id === favoriteId)) || null : null;
 const favDisplayName = favCatalogCard ? favCatalogCard.name
                       : (favHero ? favHero.name
                       : (favoriteId ? humanizeCardId(favoriteId, true) : null));
 // Portrait: prefer the catalog's uploaded cardArt → marketing image → emoji icon.
 const favImage = resolveCardImage(favoriteId, true) || (favHero && favHero.image) || null;
 const favEmoji = favCatalogCard ? (favCatalogCard.icon || '') : (favHero ? '': '');
 const favLevel = (favoriteEntry && favoriteEntry.p && favoriteEntry.p.level) || 1;
 const favWins = (favoriteEntry && favoriteEntry.p && favoriteEntry.p.wins) || 0;

 // ===== Strongest Unit — highest level from profile.units =====
 const unitMap = (profile && profile.units) || {};
 const unitEntries = Object.entries(unitMap);
 const strongestEntry = unitEntries.length === 0 ? null : unitEntries.reduce((best, [id, p]) => {
 const bestLvl = (best && best.p && best.p.level) || 0;
 const curLvl = (p && p.level) || 0;
 return curLvl > bestLvl ? { id, p } : best;
 }, null);
 const strongestId = strongestEntry ? strongestEntry.id : null;
 const strongCatalogCard = _profileCardLookup(strongestId);
 const strongUnitName = strongCatalogCard ? strongCatalogCard.name
                       : (strongestId ? humanizeCardId(strongestId, false) : null);
 const strongImage = resolveCardImage(strongestId, false);
 const strongEmoji = strongCatalogCard ? (strongCatalogCard.icon || '') : '';
 const strongLevel = (strongestEntry && strongestEntry.p && strongestEntry.p.level) || 1;
 const strongKills = (strongestEntry && strongestEntry.p && strongestEntry.p.kills) || 0;

 return (
 <section className="relative py-24 px-6 overflow-hidden">
 <div className="absolute inset-0 pointer-events-none" style={{
 background:
 'radial-gradient(ellipse at 25% 25%, rgba(120,80,255,0.10) 0%, transparent 55%),'+
 'radial-gradient(ellipse at 75% 75%, rgba(255,140,40,0.10) 0%, transparent 55%)',
 }} />
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BloodSplatter className="top-16 right-1/4" size={130} opacity={0.12} />

 <div className="max-w-6xl mx-auto relative">
 <div className="text-center mb-10">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Player Hub —</div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-3">
 Your Account, Your Inventory
 </DistressedHeading>
 <p className="text-stone-300 max-w-3xl mx-auto text-lg leading-relaxed">
 Sign in with your in-game account. Buy packs here, open them in-game. Same Cinders, same Aza coin, same collection — one account across the web and the app.
 </p>
 </div>

 {!session ? (
 /* ===== Sign-in / Sign-up card ===== */
 <div className="max-w-md mx-auto bg-black/65 border border-orange-500/40 rounded-lg p-7" style={{ boxShadow: '0 0 32px rgba(255,140,40,0.18)'}}>
 <div className="flex gap-2 mb-5 border-b border-stone-700/50 pb-3">
 <button onClick={() => { setAuthMode('signin'); setAuthError(''); }} className={`flex-1 py-2 rounded text-xs tracking-widest uppercase font-bold transition ${authMode === 'signin'? 'bg-orange-600 text-yellow-100': 'bg-black/40 text-stone-400 hover:text-orange-300'}`}>Sign In</button>
 <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className={`flex-1 py-2 rounded text-xs tracking-widest uppercase font-bold transition ${authMode === 'signup'? 'bg-orange-600 text-yellow-100': 'bg-black/40 text-stone-400 hover:text-orange-300'}`}>Create Account</button>
 </div>
 <form onSubmit={handleSignIn} className="space-y-3">
 <div>
 <label className="text-stone-400 text-xs tracking-widest uppercase mb-1 block">Email</label>
 <input type="email"required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-black/60 border border-stone-700 rounded text-yellow-100 focus:border-orange-500 focus:outline-none" placeholder="you@example.com"/>
 </div>
 <div>
 <label className="text-stone-400 text-xs tracking-widest uppercase mb-1 block">Password</label>
 <input type="password"required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-black/60 border border-stone-700 rounded text-yellow-100 focus:border-orange-500 focus:outline-none" placeholder="••••••••"/>
 </div>
 {authError && <div className="text-red-300 text-sm bg-red-950/40 border border-red-700/40 rounded px-3 py-2">{authError}</div>}
 <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-widest uppercase text-sm hover:shadow-xl hover:shadow-orange-500/40 transition border border-orange-400/50 disabled:opacity-50">
 {loading ? '…': (authMode === 'signup'? 'Create Account': 'Sign In')}
 </button>
 <p className="text-stone-500 text-xs text-center pt-2">{authMode === 'signup'? 'Already have an account?': 'New here?'} <button type="button" onClick={() => setAuthMode(authMode === 'signup'? 'signin': 'signup')} className="text-orange-300 underline">{authMode === 'signup'? 'Sign in instead': 'Create one'}</button></p>
 </form>
 </div>
 ) : (
 <>
 {/* ===== Logged-in profile card ===== */}
 <div className="grid md:grid-cols-3 gap-4 mb-8">
 {/* Identity + currency */}
 <div className="md:col-span-2 bg-gradient-to-br from-stone-900/85 to-black/80 border border-orange-500/40 rounded-lg p-6" style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.55)'}}>
 <div className="flex items-start justify-between mb-4">
 <div>
 <div className="text-stone-500 text-xs tracking-widest uppercase mb-1">Signed in as</div>
 <div className="text-2xl font-serif font-bold text-yellow-100">{displayName}</div>
 <div className="text-stone-400 text-xs mt-1">UID: <span className="font-mono">{session.user.id.slice(0, 8)}…</span></div>
 </div>
 <button onClick={handleSignOut} className="text-stone-400 hover:text-red-300 text-xs tracking-widest uppercase border border-stone-700 hover:border-red-500/50 rounded px-3 py-1.5 transition">Sign Out</button>
 </div>
 <div className="grid grid-cols-2 gap-3 mt-5">
 <div className="bg-black/50 border border-orange-500/35 rounded p-4 flex items-center gap-3">
 <CinderIcon size={36} />
 <div>
 <div className="text-3xl font-bold text-orange-300 font-mono">{gems.toLocaleString()}</div>
 <div className="text-stone-500 text-xs tracking-widest uppercase">Cinders</div>
 </div>
 </div>
 <div className="bg-black/50 border border-sky-500/35 rounded p-4 flex items-center gap-3">
 <AzaIcon size={36} />
 <div>
 <div className="text-3xl font-bold text-sky-300 font-mono">{sovereigns.toLocaleString()}</div>
 <div className="text-stone-500 text-xs tracking-widest uppercase">Aza Coin</div>
 </div>
 </div>
 </div>
 </div>

 {/* Stats column */}
 <div className="bg-gradient-to-br from-yellow-950/30 to-black/80 border border-yellow-500/35 rounded-lg p-6" style={{ boxShadow: '0 8px 28px rgba(255,209,102,0.12)'}}>
 <div className="text-xs tracking-widest uppercase text-yellow-300 mb-3 font-bold"> Combat Record</div>
 <div className="flex items-baseline gap-3 mb-4">
 <div className="text-5xl font-serif font-bold text-yellow-200" style={{ textShadow: '0 0 20px rgba(255,209,102,0.4)'}}>{wins.toLocaleString()}</div>
 <div className="text-stone-400 text-xs tracking-widest uppercase">Lifetime Wins</div>
 </div>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between border-b border-stone-700/40 pb-1.5"><span className="text-stone-500 uppercase text-xs tracking-wider">Win Rate</span><span className="text-yellow-100 font-bold font-mono">{winRate}%</span></div>
 <div className="flex justify-between border-b border-stone-700/40 pb-1.5"><span className="text-stone-500 uppercase text-xs tracking-wider">Battles</span><span className="text-yellow-100 font-bold font-mono">{battles.toLocaleString()}</span></div>
 <div className="flex justify-between border-b border-stone-700/40 pb-1.5"><span className="text-stone-500 uppercase text-xs tracking-wider">Heroes Trained</span><span className="text-yellow-100 font-bold font-mono">{heroCount}</span></div>
 {topHero.h && <div className="flex justify-between"><span className="text-stone-500 uppercase text-xs tracking-wider">Top Hero</span><span className="text-yellow-100 font-bold">Lv {topHero.h.level}</span></div>}
 {competitive.rr ? <div className="flex justify-between"><span className="text-stone-500 uppercase text-xs tracking-wider">RR</span><span className="text-yellow-100 font-bold font-mono">{competitive.rr}</span></div> : null}
 </div>
 </div>
 </div>

 {/* ===== Favorite Hero + Strongest Unit ===== */}
 {/* Two side-by-side cards mirroring the in-game profile page so
 players see the same highlights here as in the app. */}
 <div className="grid md:grid-cols-2 gap-4 mb-8">
 {/* Favorite Hero */}
 <div className="bg-gradient-to-br from-stone-900/85 to-black/80 border border-orange-500/35 rounded-lg overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.5)'}}>
 <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-700/50 bg-black/30">
 <span className="text-orange-400 text-base"></span>
 <span className="text-orange-300 text-xs tracking-[0.3em] uppercase font-bold">Favorite Hero</span>
 </div>
 <div className="p-5 flex items-center gap-4">
 <div
 className="w-14 h-14 rounded overflow-hidden flex-shrink-0 border relative" style={{
 borderColor: favHero ? (favHero.accent + '80') : 'rgba(120,113,108,0.6)',
 boxShadow: favHero ? `0 0 18px ${favHero.glow}` : '0 0 12px rgba(80,80,80,0.3)',
 background: favHero ? '': 'linear-gradient(135deg, #4b5563, #1f2937)',
 }}
 >
 {/* Placeholder emoji behind so a failed image load reveals it instead of leaving a blank tile */}
 <div className="absolute inset-0 flex items-center justify-center text-2xl">{favEmoji}</div>
 {favImage && (
 <img
 src={favImage}
 alt={favDisplayName}
 className="absolute inset-0 w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }}
 />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-lg font-serif font-bold text-yellow-100 truncate">
 {favoriteEntry ? favDisplayName : 'No favorite yet'}
 </div>
 {favoriteEntry ? (
 <div className="text-stone-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
 <span className="text-yellow-300"></span>
 <span>Level <strong className="text-yellow-100">{favLevel}</strong></span>
 <span className="text-stone-600">·</span>
 <span className="text-emerald-300"></span>
 <span><strong className="text-yellow-100">{favWins.toLocaleString()}</strong> wins</span>
 </div>
 ) : (
 <div className="text-stone-500 text-sm mt-1 italic">Play a match to set your favorite</div>
 )}
 </div>
 </div>
 </div>

 {/* Strongest Unit */}
 <div className="bg-gradient-to-br from-stone-900/85 to-black/80 border border-sky-500/35 rounded-lg overflow-hidden" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.5)'}}>
 <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-700/50 bg-black/30">
 <span className="text-sky-400 text-base">️</span>
 <span className="text-sky-300 text-xs tracking-[0.3em] uppercase font-bold">Strongest Unit</span>
 </div>
 <div className="p-5 flex items-center gap-4">
 <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0 border border-sky-700/50 relative bg-gradient-to-br from-sky-900/60 to-stone-900" style={{ boxShadow: '0 0 18px rgba(125, 211, 252, 0.25)'}}>
 <div className="absolute inset-0 flex items-center justify-center text-2xl">{strongEmoji}</div>
 {strongImage && (
 <img
 src={strongImage}
 alt={strongUnitName || 'unit'}
 className="absolute inset-0 w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }}
 />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-lg font-serif font-bold text-yellow-100 truncate">
 {strongUnitName || 'No unit trained yet'}
 </div>
 {strongestEntry ? (
 <div className="text-stone-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
 <span className="text-yellow-300"></span>
 <span>Level <strong className="text-yellow-100">{strongLevel}</strong></span>
 <span className="text-stone-600">·</span>
 <span className="text-red-300"></span>
 <span><strong className="text-yellow-100">{strongKills.toLocaleString()}</strong> kills</span>
 </div>
 ) : (
 <div className="text-stone-500 text-sm mt-1 italic">Train a unit in-game to see them here</div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* ===== Vendor Market section ===== */}
 <div className="bg-black/60 border-2 border-orange-500/35 rounded-lg p-6 md:p-8" style={{ boxShadow: '0 0 36px rgba(255,140,40,0.12)'}}>
 <div className="flex items-center gap-3 mb-2">
 <AzaIcon size={32} />
 <DistressedHeading level="h3" className="text-3xl md:text-4xl font-serif font-bold text-yellow-100">Vendor Market</DistressedHeading>
 </div>
 <p className="text-stone-400 text-sm mb-6 leading-relaxed">Buy packs with <CinderIcon size={14}/> Cinders or <AzaIcon size={14}/> Aza Coin. Run low? Switch to the <strong className="text-sky-300">Aza Coin Store</strong> tab to top up. Purchases sync to your in-game inventory on next sign-in.</p>

 {/* Tabs — Packs / Aza Coin Store */}
 <div className="flex gap-2 mb-6 border-b border-stone-700/50 pb-3">
 <button onClick={() => setStoreTab('packs')} className={`flex items-center gap-2 px-5 py-2.5 rounded text-sm tracking-widest uppercase font-bold transition ${storeTab === 'packs'? 'bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 shadow-lg shadow-orange-500/30': 'bg-black/40 text-stone-400 hover:text-orange-300 border border-stone-700/50'}`}>
 Card Packs
 </button>
 <button onClick={() => setStoreTab('aza')} className={`flex items-center gap-2 px-5 py-2.5 rounded text-sm tracking-widest uppercase font-bold transition ${storeTab === 'aza'? 'bg-gradient-to-r from-sky-600 to-indigo-700 text-sky-50 shadow-lg shadow-sky-500/30': 'bg-black/40 text-stone-400 hover:text-sky-300 border border-stone-700/50'}`}>
 <AzaIcon size={16} /> Aza Coin Store
 </button>
 </div>

 {buyMsg && (
 <div className={`mb-5 px-4 py-3 rounded text-sm ${buyMsg.startsWith('') ? 'bg-emerald-950/40 border border-emerald-700/50 text-emerald-200': 'bg-red-950/40 border border-red-700/50 text-red-200'}`}>{buyMsg}</div>
 )}

 {storeTab === 'packs'? (
 <div className="grid md:grid-cols-3 gap-5">
 {WEBSITE_PACK_CATALOG.map(pack => {
 const canCinder = gems >= (pack.cost || 0);
 const canSov = sovereigns >= (pack.sovCost || 0);
 const buying = buyingId === pack.id;
 return (
 <div key={pack.id} className={`relative bg-gradient-to-br from-stone-900/85 to-black/80 border-2 rounded-lg p-5 transition ${pack.featured ? 'md:-translate-y-2 ring-2': ''}`}
 style={{ borderColor: pack.accent + '60', boxShadow: pack.featured ? `0 16px 40px ${pack.accent}40` : '0 8px 22px rgba(0,0,0,0.45)'}}>
 {pack.featured && (
 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-yellow-100 text-[10px] font-bold px-3 py-1 rounded tracking-widest uppercase border border-orange-300">Recommended</div>
 )}
 <div className="text-center mb-4">
 <div className="text-5xl mb-2" style={{ filter: `drop-shadow(0 0 14px ${pack.accent}aa)` }}>{pack.icon}</div>
 <h4 className="text-xl font-serif font-bold text-yellow-100">{pack.name}</h4>
 <div className="text-stone-500 text-xs tracking-widest uppercase mt-1">{pack.cards} cards · {pack.rarity}</div>
 </div>
 <p className="text-stone-400 text-xs leading-relaxed mb-5 italic text-center">{pack.desc}</p>
 <div className="space-y-2">
 <button onClick={() => handleBuy(pack, 'cinder')} disabled={!canCinder || buying} className="w-full py-2.5 rounded font-bold text-sm tracking-wider transition border flex items-center justify-center gap-2" style={{
 background: canCinder ? `linear-gradient(180deg, ${pack.accent}55, ${pack.accent}33)` : 'rgba(0,0,0,0.4)',
 borderColor: canCinder ? pack.accent : 'rgba(120,113,108,0.4)',
 color: canCinder ? '#fef3c7': '#78716c',
 cursor: canCinder ? 'pointer': 'not-allowed',
 }}>
 <CinderIcon size={16}/> {pack.cost.toLocaleString()}
 </button>
 <button onClick={() => handleBuy(pack, 'sov')} disabled={!canSov || buying} className="w-full py-2.5 rounded font-bold text-sm tracking-wider transition border flex items-center justify-center gap-2" style={{
 background: canSov ? 'linear-gradient(180deg, rgba(110,150,220,0.3), rgba(110,150,220,0.15))': 'rgba(0,0,0,0.4)',
 borderColor: canSov ? 'rgba(140,170,230,0.7)': 'rgba(120,113,108,0.4)',
 color: canSov ? '#dbeafe': '#78716c',
 cursor: canSov ? 'pointer': 'not-allowed',
 }}>
 <AzaIcon size={16}/> {pack.sovCost.toLocaleString()}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 /* ===== Aza Coin top-up store ===== */
 <div>
 <div className="mb-5 p-4 bg-sky-950/30 border-l-4 border-sky-500/60 rounded-r text-sky-100 text-sm">
 <strong className="text-sky-200">Aza Coin</strong> is the premium currency — earned through bundles, not gameplay. Use it to grab packs at a discount or skip the grind for high-tier gear. <span className="text-sky-300 italic">Mock checkout — no real charges in this build.</span>
 </div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
 {AZA_COIN_PACKAGES.map(pkg => {
 const buying = buyingId === pkg.id;
 const totalAza = Math.round(pkg.aza + (pkg.aza * (pkg.bonus || 0) / 100));
 return (
 <div key={pkg.id} className={`relative bg-gradient-to-br from-stone-900/85 to-black/80 border-2 rounded-lg p-5 text-center transition ${pkg.featured ? 'md:-translate-y-2 ring-2': ''}`}
 style={{ borderColor: pkg.accent + '60', boxShadow: pkg.featured ? `0 16px 40px ${pkg.accent}40` : '0 8px 22px rgba(0,0,0,0.45)'}}>
 {pkg.featured && (
 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-500 to-indigo-600 text-sky-50 text-[10px] font-bold px-3 py-1 rounded tracking-widest uppercase border border-sky-300">Best Value</div>
 )}
 {pkg.bonus > 0 && (
 <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-gradient-to-br from-amber-400 to-orange-600 text-stone-900 rounded text-[10px] font-bold">+{pkg.bonus}%</div>
 )}
 <div className="flex justify-center mb-3" style={{ filter: `drop-shadow(0 0 14px ${pkg.accent}aa)` }}>
 <AzaIcon size={56} />
 </div>
 <h4 className="text-lg font-serif font-bold text-yellow-100 mb-1">{pkg.name}</h4>
 <div className="text-3xl font-mono font-bold mb-1" style={{ color: pkg.accent }}>{totalAza.toLocaleString()}</div>
 <div className="text-stone-500 text-xs tracking-widest uppercase mb-4">Aza Coin{pkg.bonus > 0 && <span className="text-amber-300"> · +{pkg.bonus}% bonus</span>}</div>
 <button onClick={() => handleBuyAza(pkg)} disabled={buying} className="w-full py-3 rounded font-bold text-base tracking-wider transition border flex items-center justify-center gap-2" style={{
 background: `linear-gradient(180deg, ${pkg.accent}66, ${pkg.accent}33)`,
 borderColor: pkg.accent,
 color: '#fef3c7',
 cursor: buying ? 'wait': 'pointer',
 opacity: buying ? 0.6 : 1,
 }}>
 ${pkg.usd.toFixed(2)}
 </button>
 </div>
 );
 })}
 </div>
 <p className="text-stone-500 text-xs text-center mt-5 italic">Aza Coin is non-refundable and cannot be cashed out for real money. Use it for packs, cosmetics, and player-market listings.</p>
 </div>
 )}
 </div>
 </>
 )}
 </div>
 </section>
 );
};

const Coliseum = () => {
 const tiers = [
 { name: 'Open Cup', desc: 'Daily-style 3-match AI gauntlet. Free to enter. AP rewards.', icon: '', accent: '#d4af37'},
 { name: 'Ranked Arena', desc: 'Best-of-5 brackets. Requires 500 AP. Exclusive cosmetics + rare cards.', icon: '', accent: '#b888ff'},
 { name: 'Regional Qualifier', desc: 'Monthly seeded bracket. Platinum+ rank required. Top finishers advance.', icon: '', accent: '#ff7755'},
 { name: 'Regional Championship', desc: 'Streamed prestige event. Diamond+ rank. Unique card variants on the line.', icon: '', accent: '#ffe066'},
 { name: 'National Championship', desc: 'Best from each region. Mythic+ rank. Winning permanently marks your profile.', icon: '', accent: '#88c8e0'},
 { name: 'Continental Championship', desc: 'Continent vs continent. The eve of Worlds.', icon: '', accent: '#7ad07a'},
 { name: 'World Championship', desc: 'Invite-only. The summit. Apex rank + championship trail required.', icon: '', accent: '#ffffff'},
 ];
 const ranks = ['Rookie', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Mythic', 'Titan', 'Apex', 'Legendary', 'Immortal'];
 return (
 <section className="relative py-24 px-6">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <div className="max-w-7xl mx-auto pt-8">
 <div className="text-center mb-16">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— The Coliseum —</div>
 <DistressedHeading className="text-5xl font-serif font-bold text-yellow-100 mb-4">Climb 12 Tiers. Earn Your Crown.</DistressedHeading>
 <p className="text-stone-400 max-w-2xl mx-auto leading-relaxed">
 Every ranked match adjusts your <strong className="text-orange-300">Rank Rating (RR)</strong>. Climb past 100 RR thresholds to promote.
 <strong className="text-orange-300"> Arena Points (AP)</strong> are a parallel currency that <em>never wipes</em> — earn them once,
 spend them on tournament entries forever. Seasons run 90 days. AP soft-resets ×0.9. Your prestige carries.
 </p>
 </div>

 {/* Rank Ladder */}
 <div className="mb-12">
 <div className="text-stone-500 text-xs tracking-widest uppercase mb-4 text-center">The 12 Divisions</div>
 <div className="flex flex-wrap justify-center gap-3">
 {ranks.map(r => (
 <div key={r} className="px-4 py-2 bg-black/60 border border-orange-600/30 rounded text-stone-200 text-sm font-serif tracking-wide hover:border-orange-400/60 hover:text-yellow-100 transition">
 {r}
 </div>
 ))}
 </div>
 <div className="text-center text-stone-500 text-xs mt-4 italic">Each tier except the elite three has IV → I sub-ranks. Total: 44 visible badges.</div>
 </div>

 {/* Tournament Tiers */}
 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
 {tiers.map((t, i) => (
 <div key={t.name} className="relative bg-black/60 border rounded p-5 transition hover:scale-[1.02]" style={{ borderColor: t.accent + '50'}}>
 <BulletHole className="top-2 right-2" size={12} />
 <div className="flex items-center gap-3 mb-2">
 <div className="text-3xl">{t.icon}</div>
 <div>
 <div className="text-stone-500 text-[10px] tracking-widest">TIER {i + 1}</div>
 <h3 className="text-yellow-100 font-serif font-bold text-lg">{t.name}</h3>
 </div>
 </div>
 <p className="text-stone-400 text-sm leading-relaxed">{t.desc}</p>
 </div>
 ))}
 </div>

 <div className="text-center mt-12">
 <a href={PLAY_URL} className="inline-block px-10 py-4 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-widest hover:shadow-xl hover:shadow-orange-500/50 transition border border-orange-400/50">
 START YOUR CLIMB
 </a>
 </div>
 </div>
 </section>
 );
};

// ===== CARD MODAL =====
const CardModal = ({ card, onClose, onAddToDeck }) => {
 if (!card) return null;
 return (
 <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={onClose} style={{ animation: 'rise 0.3s'}}>
 <button onClick={onClose} className="absolute top-6 right-6 w-12 h-12 rounded bg-red-900/40 hover:bg-red-700/50 border border-red-500/40 text-red-200 text-xl flex items-center justify-center transition z-10"></button>
 <div onClick={(e) => e.stopPropagation()} className="grid md:grid-cols-2 gap-12 items-center max-w-5xl">
 <div className="flex justify-center"><Card card={card} size="xl" floating={false} /></div>
 <div className="text-white max-w-md">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3"><span className="text-orange-400">●</span> CARD · {card.faction.toUpperCase()}</div>
 <DistressedHeading level="h2" className="text-5xl font-serif font-bold text-yellow-100 mb-4">{card.name}</DistressedHeading>
 <div className="flex gap-2 mb-6 flex-wrap">
 <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/40 rounded text-orange-200 text-xs uppercase tracking-wider">{card.rarity}</span>
 <span className="px-3 py-1 bg-stone-500/10 border border-stone-500/40 rounded text-stone-200 text-xs uppercase tracking-wider">{card.type}</span>
 {card.element && (
 <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/40 rounded text-blue-200 text-xs uppercase tracking-wider"> {card.element}</span>
 )}
 {card.kalon && (
 <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/40 rounded text-yellow-200 text-xs uppercase tracking-wider"> Kalon Mode</span>
 )}
 </div>
 <p className="text-stone-300 italic text-lg mb-6 leading-relaxed border-l-2 border-orange-500/50 pl-4">"{card.flavor}"</p>
 <div className="bg-black/60 border border-orange-500/20 rounded p-4 mb-6 relative">
 <div className="absolute top-1 right-2 text-stone-600 text-[9px] font-mono tracking-widest">EFFECT</div>
 <div className="text-orange-400/80 text-[10px] tracking-widest uppercase mb-2">Card Ability</div>
 <p className="text-stone-200 leading-relaxed">{card.effect}</p>
 </div>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.cost}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">Cost</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.hp ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">HP</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.atk ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">ATK</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.def ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">DEF</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.mag ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">MAG</div></div>
 <div className="bg-black/60 border border-orange-500/20 rounded p-2 text-center"><div className="text-orange-300 text-lg font-bold">{card.spd ?? '—'}</div><div className="text-stone-500 text-[9px] tracking-wider uppercase">SPD</div></div>
 </div>
 <a href={PLAY_URL} className="block w-full py-3 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-wider hover:shadow-lg hover:shadow-orange-500/40 transition uppercase border border-orange-400/50 text-center"> Play to Earn This Card</a>
 </div>
 </div>
 </div>
 );
};

// ===== FOOTER =====
const Footer = () => (
 <footer className="relative border-t border-orange-600/30 py-12 px-6 mt-12 bg-black/60">
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <BulletHole className="top-10 left-20" size={18} />
 <BulletHole className="top-20 right-32" size={14} />
 <div className="max-w-7xl mx-auto pt-4">
 <div className="flex flex-col md:flex-row items-center justify-between gap-6">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded bg-gradient-to-br from-orange-500 via-red-700 to-stone-900 flex items-center justify-center border border-orange-400/50">
 <span className="text-yellow-100 font-bold text-lg font-serif">M</span>
 </div>
 <div>
 <div className="text-yellow-100 font-serif font-bold tracking-wider">MYTHIC SPELLBOOK</div>
 <div className="text-stone-500 text-xs uppercase tracking-widest">© 2026 · A Spatial Tactical TCG</div>
 </div>
 </div>
 <div className="flex gap-6 text-stone-400 uppercase tracking-widest text-xs">
 <a href={PLAY_URL} className="hover:text-orange-400 transition">Play Now</a>
 <a href={LOGIN_URL} className="hover:text-orange-400 transition">Login</a>
 <a href="#" className="hover:text-orange-400 transition">Discord</a>
 <a href="#" className="hover:text-orange-400 transition">Privacy</a>
 <a href="#" className="hover:text-orange-400 transition">Terms</a>
 </div>
 </div>
 <div className="text-center text-stone-700 text-[10px] mt-8 font-mono tracking-widest">
 // SEASON 1 · THE ASHEN SEASON · BUILT FOR THE BOARD //
 </div>
 </div>
 </footer>
);

// ===== FLOATING DECK PREVIEW =====
const DeckPreview = ({ deck, onOpenBuilder }) => {
 if (deck.length === 0) return null;
 return (
 <button onClick={onOpenBuilder} className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-orange-600 to-red-800 text-yellow-100 px-5 py-3 rounded shadow-2xl shadow-orange-500/40 hover:scale-105 transition flex items-center gap-3 font-bold border border-orange-400/50">
 <span className="text-2xl"></span>
 <div className="text-left">
 <div className="text-[10px] uppercase tracking-widest opacity-80">Active Loadout</div>
 <div className="text-lg leading-none">{deck.length}/40</div>
 </div>
 </button>
 );
};

// ===== CHAMPIONS PAGE (heroes gallery, GA-TCG-inspired) =====
// ===== HELD ITEMS — showcase the gear that reshapes the battlefield =====
// Each item is a real game entry — the in-game Forge stores the mechanics, the
// landing page just mirrors a snapshot so visitors see what equipment can do.
const HELD_ITEMS_FEATURED = [
 {
 id: 'small_backpack',
 name: 'Small Backpack',
 title: 'Survivor\'s Kit',
 rarity: 'Common',
 type: 'Utility',
 accent: '#a87a4a',
 glow: 'rgba(196, 152, 90, 0.55)',
 image: './assets/items/Smallbackpaack.png',
 stats: { HP: '+5', SPD: '+1'},
 effect: 'Carries the essentials — extra HP, faster step. The pack everyone wishes they grabbed first.',
 flavor: 'Tactical pack. Camp knife strapped to the side, flashlight clipped where you can grab it.',
 },
 {
 id: 'handgun',
 name: 'Handgun',
 title: 'Last-Round Sidearm',
 rarity: 'Uncommon',
 type: 'Weapon',
 accent: '#7d8590',
 glow: 'rgba(140, 150, 170, 0.5)',
 image: './assets/items/Handgun.png',
 stats: { ATK: '+4', Range: '+1'},
 effect: 'Modern firearm. Adds +1 attack range to the wielder and bites for an extra +4 ATK on every strike.',
 flavor: 'Standard-issue. Reliable when nothing else is. The grip remembers everyone who ever needed it.',
 },
 {
 id: 'thoth_spellbook',
 name: 'Thoth Spellbook',
 title: 'Tome of the Knowing God',
 rarity: 'Mythic',
 type: 'Relic',
 accent: '#d4af37',
 glow: 'rgba(120, 220, 200, 0.75)',
 image: './assets/items/Magical%20book%20of%20thoth.png',
 stats: { MAG: '+8', RES: '+3', Immune: 'Sleep · Confusion'},
 effect: 'The lost tome of the Egyptian god of knowledge. Bearers cannot be confused or put to sleep — the mind sees what the gods see.',
 flavor: 'Eye of Horus, gilded ankh, hieroglyphs that move when no one is looking. It reads YOU back.',
 },
];

const HeldItems = () => {
 const [hoveredId, setHoveredId] = useState(null);
 return (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-16 left-1/4" size={140} opacity={0.16} />
 <BloodSplatter className="bottom-20 right-1/4" size={160} opacity={0.14} />
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <div className="max-w-7xl mx-auto pt-8">
 <div className="text-center mb-12">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Held Items —</div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-4">
 Reshape The Battlefield
 </DistressedHeading>
 <p className="text-stone-300 max-w-3xl mx-auto text-lg leading-relaxed mb-3">
 Equip powerful items to your <strong className="text-orange-300">Units and Heroes</strong> to completely reshape the battlefield. From <strong className="text-orange-300">cursed relics and ancient weapons</strong> to <strong className="text-orange-300">futuristic tech and magical artifacts</strong>, every item adds a new layer of strategy and unpredictability to every match.
 </p>
 <p className="text-stone-300 max-w-3xl mx-auto text-base leading-relaxed mb-3">
 Build your playstyle your way. Adapt mid-game. Counter enemy tactics. Create <strong className="text-orange-300">unstoppable combinations</strong>.
 </p>
 <p className="text-stone-400 max-w-3xl mx-auto text-sm leading-relaxed italic">
 Mythic Spellbook delivers a new level of customization and replayability to the TCG landscape, where no two battles ever feel the same.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {HELD_ITEMS_FEATURED.map(it => {
 const isHovered = hoveredId === it.id;
 return (
 <div
 key={it.id}
 onMouseEnter={() => setHoveredId(it.id)}
 onMouseLeave={() => setHoveredId(null)}
 className="relative bg-gradient-to-br from-stone-900/90 to-stone-950/95 rounded-lg overflow-hidden border-2 transition-all duration-300" style={{
 borderColor: isHovered ? it.accent : 'rgba(120,113,108,0.4)',
 boxShadow: isHovered ? `0 0 40px ${it.glow}, 0 12px 28px rgba(0,0,0,0.6)` : '0 4px 18px rgba(0,0,0,0.4)',
 transform: isHovered ? 'translateY(-6px)': 'translateY(0)',
 }}
 >
 {/* Rarity tag */}
 <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border bg-black/70" style={{ color: it.accent, borderColor: it.accent }}>
 {it.rarity}
 </div>
 {/* Type tag */}
 <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border border-stone-600/60 bg-black/70 text-stone-300">
 {it.type}
 </div>

 {/* Item image */}
 <div className="relative aspect-square overflow-hidden flex items-center justify-center" style={{
 background: `radial-gradient(circle at 50% 50%, ${it.accent}22 0%, transparent 60%), linear-gradient(180deg, #1a1428 0%, #0d0a1c 100%)`,
 }}>
 {/* Placeholder behind image so a failed load doesn't leave a black void */}
 <div className="absolute inset-0 flex items-center justify-center" style={{ color: it.accent, opacity: 0.18 }}>
 <div className="text-9xl font-serif font-bold" style={{ textShadow: `0 0 30px ${it.glow}` }}>{it.name.charAt(0)}</div>
 </div>
 <img
 src={it.image}
 alt={it.name}
 className="relative w-full h-full object-contain p-6 transition-transform duration-500" style={{
 transform: isHovered ? 'scale(1.08) rotate(-1.5deg)': 'scale(1) rotate(0deg)',
 filter: `drop-shadow(0 6px 22px ${it.glow})`,
 }}
 onError={(e) => { e.currentTarget.style.display = 'none'; }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"/>
 </div>

 {/* Info block */}
 <div className="p-5">
 <DistressedHeading className="text-2xl font-serif font-bold mb-1" style={{ color: it.accent }}>
 {it.name}
 </DistressedHeading>
 <div className="text-stone-400 text-sm italic mb-4">{it.title}</div>

 {/* Stat chips */}
 <div className="flex flex-wrap gap-2 mb-4">
 {Object.entries(it.stats).map(([k, v]) => (
 <div key={k} className="px-2.5 py-1 bg-black/50 border rounded text-xs font-mono" style={{ borderColor: `${it.accent}66`, color: '#efe4c4'}}>
 <span className="text-stone-500 mr-1">{k}</span>
 <span className="font-bold" style={{ color: it.accent }}>{v}</span>
 </div>
 ))}
 </div>

 {/* Effect */}
 <div className="bg-black/50 border-l-2 rounded p-3 mb-3" style={{ borderColor: it.accent }}>
 <div className="text-[10px] tracking-widest uppercase mb-1" style={{ color: it.accent }}>Effect</div>
 <div className="text-stone-200 text-sm leading-relaxed">{it.effect}</div>
 </div>

 <p className="text-stone-500 text-xs italic leading-relaxed">"{it.flavor}"</p>
 </div>
 </div>
 );
 })}
 </div>

 {/* Footer note */}
 <div className="text-center mt-10 text-stone-500 text-xs tracking-widest uppercase">
 <span className="text-orange-400/80">◆</span> Items drop from packs, events, and the Black Market <span className="text-orange-400/80">◆</span>
 </div>
 </div>
 </section>
 );
};

const Champions = ({ onPickHero }) => {
 const [filter, setFilter] = useState('all');
 const [hoveredId, setHoveredId] = useState(null);
 const factions = ['all', ...Array.from(new Set(HEROES.map(h => h.faction)))];
 const filtered = filter === 'all'? HEROES : HEROES.filter(h => h.faction === filter);
 return (
 <section className="relative py-24 px-6">
 <BloodSplatter className="top-20 right-1/3" size={140} opacity={0.18} />
 <BloodSplatter className="bottom-32 left-1/4" size={160} opacity={0.15} />
 <HazardStripe className="absolute top-0 left-0 right-0"/>
 <div className="max-w-7xl mx-auto pt-8">
 <div className="text-center mb-12">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-3">— Survivors —</div>
 <DistressedHeading className="text-5xl md:text-6xl font-serif font-bold text-yellow-100 mb-4">
 Choose Your Survivor
 </DistressedHeading>
 <p className="text-stone-300 max-w-3xl mx-auto text-lg leading-relaxed">
 Every survivor <strong className="text-orange-300">levels 1 → 50</strong>, learns moves from the rubble, equips scavenged held items, and unlocks <strong className="text-orange-300">3 subclasses</strong> at Lv 3 — paths that fork their kit forever. Pick the one whose story you want to write.
 </p>
 </div>
 <div className="flex flex-wrap justify-center gap-2 mb-10">
 {factions.map(f => {
 const active = filter === f;
 const count = f === 'all'? HEROES.length : HEROES.filter(h => h.faction === f).length;
 return (
 <button
 key={f}
 onClick={() => setFilter(f)}
 className={`px-4 py-2 rounded text-sm tracking-widest uppercase font-bold transition border ${active ? 'bg-orange-600 text-yellow-100 border-orange-400 shadow-lg shadow-orange-500/40': 'bg-black/40 text-stone-300 border-stone-700/50 hover:border-orange-500/50 hover:text-yellow-100'}`}
 >
 {f} <span className={`ml-1 text-[10px] ${active ? 'opacity-80': 'opacity-60'}`}>({count})</span>
 </button>
 );
 })}
 </div>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
 {filtered.map(h => {
 const isHovered = hoveredId === h.id;
 return (
 <button
 key={h.id}
 onMouseEnter={() => setHoveredId(h.id)}
 onMouseLeave={() => setHoveredId(null)}
 onClick={() => onPickHero(h)}
 className="group relative bg-black/60 border-2 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer text-left" style={{
 borderColor: isHovered ? h.accent : 'rgba(120,113,108,0.4)',
 boxShadow: isHovered ? `0 0 32px ${h.glow}, 0 12px 24px rgba(0,0,0,0.6)` : '0 4px 16px rgba(0,0,0,0.4)',
 transform: isHovered ? 'translateY(-4px) scale(1.02)': 'translateY(0) scale(1)',
 }}
 >
 <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-stone-800 to-stone-950">
 {/* Always render the initial-letter placeholder BEHIND the image so
 a failed load (cache/path/404) reveals it instead of leaving a
 black card. The <img> overlays it on success. */}
 <div className="absolute inset-0 flex items-center justify-center" style={{
 background: `radial-gradient(circle at 50% 30%, ${h.accent}55 0%, ${h.accent}11 40%, #1a1428 100%)`,
 }}>
 <div className="text-center">
 <div className="text-7xl font-serif font-bold opacity-80" style={{ color: h.accent, textShadow: `0 0 20px ${h.glow}` }}>
 {h.name.charAt(0)}
 </div>
 <div className="text-stone-500 text-[10px] tracking-widest uppercase mt-2 italic">art pending</div>
 </div>
 </div>
 {h.image && (
 <img
 src={h.image}
 alt={h.name}
 className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110" onError={(e) => { e.currentTarget.style.display = 'none'; }}
 />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"/>
 <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border" style={{ color: h.accent, borderColor: h.accent, background: 'rgba(0,0,0,0.7)'}}>
 {h.rarity}
 </div>
 <div className="absolute bottom-2 left-2 flex gap-1">
 {h.elements.map(el => (
 <span key={el} className="px-1.5 py-0.5 rounded text-[10px] bg-black/70 border border-stone-700/60 text-stone-300 uppercase tracking-wider">{el}</span>
 ))}
 </div>
 </div>
 <div className="p-3 relative">
 <DuctTape rotation={-2} className="-top-2 left-4"/>
 <div className="text-yellow-100 font-serif font-bold text-lg leading-tight">{h.name}</div>
 <div className="text-stone-400 text-xs italic mb-2">{h.title}</div>
 <div className="flex items-center justify-between">
 <span className="text-orange-300 text-[10px] tracking-widest uppercase font-bold">{h.faction}</span>
 <span className="text-stone-500 text-[10px] tracking-wider">View →</span>
 </div>
 </div>
 </button>
 );
 })}
 </div>
 {filtered.length === 0 && (
 <div className="text-center text-stone-500 py-12">No survivors in this faction yet.</div>
 )}
 </div>
 </section>
 );
};

const HeroModal = ({ hero, onClose }) => {
 if (!hero) return null;
 return (
 <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto" onClick={onClose} style={{ animation: 'rise 0.3s'}}>
 <button onClick={onClose} className="absolute top-6 right-6 w-12 h-12 rounded bg-red-900/40 hover:bg-red-700/50 border border-red-500/40 text-red-200 text-xl flex items-center justify-center transition z-10"></button>
 <div onClick={(e) => e.stopPropagation()} className="grid md:grid-cols-5 gap-8 max-w-6xl w-full my-12">
 <div className="md:col-span-2 flex flex-col items-center">
 <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border-2" style={{ borderColor: hero.accent, boxShadow: `0 0 60px ${hero.glow}` }}>
 {/* Initial-letter placeholder ALWAYS rendered behind — a failed image
 load (cache/path/404) reveals it instead of leaving a black panel. */}
 <div className="absolute inset-0 flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 30%, ${hero.accent}55 0%, ${hero.accent}11 40%, #1a1428 100%)` }}>
 <div className="text-9xl font-serif font-bold opacity-80" style={{ color: hero.accent, textShadow: `0 0 30px ${hero.glow}` }}>{hero.name.charAt(0)}</div>
 </div>
 {hero.image && (
 <img src={hero.image} alt={hero.name} className="absolute inset-0 w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
 </div>
 {hero.kalonImage && (
 <div className="mt-3 px-3 py-1.5 bg-yellow-500/15 border border-yellow-500/50 rounded text-yellow-300 text-xs tracking-widest uppercase font-bold"> Kalon Form Available</div>
 )}
 </div>
 <div className="md:col-span-3 text-white">
 <div className="text-orange-400/80 text-xs tracking-[0.4em] uppercase mb-2">
 <span style={{ color: hero.accent }}>●</span> {hero.faction.toUpperCase()} SURVIVOR · {hero.rarity.toUpperCase()}
 </div>
 <DistressedHeading level="h2" className="text-5xl font-serif font-bold mb-1" style={{ color: hero.accent }}>{hero.name}</DistressedHeading>
 <div className="text-stone-400 text-lg italic mb-5">{hero.title}</div>
 <p className="text-stone-300 italic mb-6 border-l-2 pl-4" style={{ borderColor: hero.accent }}>"{hero.flavor}"</p>
 <div className="bg-black/60 border rounded p-4 mb-5" style={{ borderColor: `${hero.accent}55` }}>
 <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: hero.accent }}>Signature Passive</div>
 <div className="text-yellow-100 font-serif font-bold text-xl mb-1">{hero.passive.name}</div>
 <div className="text-stone-300 text-sm">{hero.passive.desc}</div>
 </div>
 <div className="mb-5">
 <div className="text-stone-500 text-[10px] tracking-widest uppercase mb-2">Starting Stats (Lv 1)</div>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
 {['hp','atk','def','mag','res','spd'].map(k => (
 <div key={k} className="bg-black/60 border border-stone-700/50 rounded p-2 text-center">
 <div className="text-orange-300 text-xl font-bold">{hero.stats[k]}</div>
 <div className="text-stone-500 text-[9px] tracking-widest uppercase">{k}</div>
 </div>
 ))}
 </div>
 </div>
 <div className="mb-5">
 <div className="text-stone-500 text-[10px] tracking-widest uppercase mb-2">Subclasses (Pick at Lv 3)</div>
 <div className="grid sm:grid-cols-3 gap-2">
 {hero.subclasses.map(s => (
 <div key={s.name} className="bg-black/60 border border-stone-700/50 hover:border-orange-500/50 rounded p-3 transition">
 <div className="text-2xl mb-1">{s.icon}</div>
 <div className="text-yellow-100 font-serif font-bold text-base">{s.name}</div>
 <div className="text-stone-400 text-xs mt-1 leading-snug">{s.desc}</div>
 </div>
 ))}
 </div>
 </div>
 <div className="mb-6 bg-orange-500/10 border border-orange-500/40 rounded p-3">
 <div className="text-orange-400/80 text-[10px] tracking-widest uppercase mb-1">Signature Move</div>
 <div className="text-stone-200 text-sm">{hero.signature}</div>
 </div>
 <a href={PLAY_URL} className="block w-full py-4 bg-gradient-to-r from-orange-600 to-red-700 text-yellow-100 font-bold rounded tracking-widest hover:shadow-xl hover:shadow-orange-500/50 transition border border-orange-400/50 text-center uppercase"> Play as {hero.name}</a>
 </div>
 </div>
 </div>
 );
};

// ===== MAIN APP =====
export default function App() {
 const [selectedCard, setSelectedCard] = useState(null);
 const [selectedHero, setSelectedHero] = useState(null);
 const [survivors, setSurvivors] = useState(14892);

 // ===== Page router — 'home'shows the marketing landing page; 'hub'shows
 // ===== the Player Hub (stats + Vendor Market). Toggled by the navbar button.
 const [currentPage, setCurrentPage] = useState('home');

 // ===== Supabase session — lifted up so the navbar can show "Player Profile"// ===== when the player is signed in. Refresh triggers a re-pull of the row.
 const [client, setClient] = useState(null);
 const [session, setSession] = useState(null);
 const [profile, setProfile] = useState(null);
 const [profileRefresh, setProfileRefresh] = useState(0);

 useEffect(() => {
 if (typeof window === 'undefined') return;
 const c = window.msSupabase ? window.msSupabase() : null;
 setClient(c);
 if (c) {
 c.auth.getSession().then(({ data }) => setSession(data.session || null));
 const { data: sub } = c.auth.onAuthStateChange((_evt, s) => setSession(s || null));
 return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
 }
 }, []);

 useEffect(() => {
 if (!client || !session) { setProfile(null); return; }
 let cancel = false;
 client.from('user_profiles').select('*').eq('user_id', session.user.id).maybeSingle()
 .then(({ data, error }) => {
 if (cancel) return;
 if (error) { console.warn('profile fetch failed', error); setProfile(null); }
 else setProfile(data || null);
 });
 return () => { cancel = true; };
 }, [client, session, profileRefresh]);

 const refreshProfile = () => setProfileRefresh((n) => n + 1);

 // Auto-refresh the player profile when the user switches back to the website
 // tab (e.g. after playing a battle in the game in another tab). This is
 // what keeps the "Favorite Hero · 16 wins" and "Strongest Unit · 7 kills"
 // panels in sync with the latest in-game stats without manual reloads.
 useEffect(() => {
 if (!session) return;
 const onFocus = () => refreshProfile();
 window.addEventListener('focus', onFocus);
 document.addEventListener('visibilitychange', () => {
 if (document.visibilityState === 'visible') refreshProfile();
 });
 return () => { window.removeEventListener('focus', onFocus); };
 }, [session]);

 useEffect(() => {
 const interval = setInterval(() => setSurvivors((s) => s + Math.floor(Math.random() * 5) - 2), 3000);
 return () => clearInterval(interval);
 }, []);

 // Card-modal handlers — the marketing site doesn't have its own deck builder
 // (that lives in the game). The "+ Play to Earn This Card"button just links
 // the user to the game.
 const handleAddToDeck = () => { /* no-op — sends to game via the modal's PLAY NOW link */ };
 // Nav button click — scroll on the home page, switch back to home then scroll
 // if we're currently on the hub page.
 const handleNavigate = (section) => {
 if (currentPage !== 'home') {
 setCurrentPage('home');
 // Wait one render for the home page to mount before scrolling.
 requestAnimationFrame(() => {
 const el = document.getElementById(section); if (el) el.scrollIntoView({ behavior: 'smooth'});
 });
 } else {
 const el = document.getElementById(section); if (el) el.scrollIntoView({ behavior: 'smooth'});
 }
 };
 const showHub = () => { setCurrentPage('hub'); window.scrollTo({ top: 0, behavior: 'smooth'}); };
 const showHome = () => { setCurrentPage('home'); window.scrollTo({ top: 0, behavior: 'smooth'}); };

 const isSignedIn = !!session;
 const displayName = profile && profile.display_name
 ? profile.display_name
 : (session && session.user && session.user.email ? session.user.email.split('@')[0] : null);

 return (
 <div className="relative min-h-screen text-white overflow-x-hidden" style={{ fontFamily: 'system-ui, sans-serif'}}>
 <Wasteland />
 <Navbar
 onNavigate={handleNavigate}
 deckCount={0}
 survivors={survivors}
 loyalFaction={null}
 isSignedIn={isSignedIn}
 displayName={displayName}
 currentPage={currentPage}
 onShowHub={showHub}
 onShowHome={showHome}
 onSignIn={showHub} // Login button routes to the hub page where the sign-in form lives
 />

 {currentPage === 'hub'? (
 /* ===== PLAYER HUB PAGE ===== */
 <div className="pt-32">
 <PlayerHub
 client={client}
 session={session}
 profile={profile}
 refreshProfile={refreshProfile}
 onSignedOut={() => { /* stay on hub; the page rerenders to the sign-in form */ }}
 />
 <Footer />
 </div>
 ) : (
 /* ===== HOME / MARKETING PAGE ===== */
 <>
 <div id="home"><Hero featuredCard={cards[0]} onCardClick={setSelectedCard} onScrollTo={handleNavigate} /></div>
 <div id="story"><Story /></div>
 <div id="hook"><GameHook /></div>
 <div id="about"><About /></div>
 <div id="play"><HowToPlay /></div>
 <Spotlight card={cards[1]} reverse={false} onCardClick={setSelectedCard} />
 <div id="different"><WhyDifferent /></div>
 <div id="factions"><Factions /></div>
 <Spotlight card={cards[2]} reverse={true} onCardClick={setSelectedCard} />
 <div id="champions"><Champions onPickHero={setSelectedHero} /></div>
 <div id="items"><HeldItems /></div>
 <div id="coliseum"><Coliseum /></div>
 <div id="career"><BuildACareer /></div>
 <div id="packs"><StarterPacks /></div>
 <div id="gallery"><Gallery onCardClick={setSelectedCard} onAddToDeck={handleAddToDeck} /></div>
 <JoinResistance />
 <Footer />
 </>
 )}

 <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} onAddToDeck={handleAddToDeck} />
 <HeroModal hero={selectedHero} onClose={() => setSelectedHero(null)} />
 </div>
 );
}
