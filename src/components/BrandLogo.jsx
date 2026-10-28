import React from 'react';
import google from 'simple-icons/icons/google.svg?raw';
import telegram from 'simple-icons/icons/telegram.svg?raw';
import pubg from 'simple-icons/icons/pubg.svg?raw';
import valorant from 'simple-icons/icons/valorant.svg?raw';
import roblox from 'simple-icons/icons/roblox.svg?raw';
import leagueoflegends from 'simple-icons/icons/leagueoflegends.svg?raw';
import smart from 'simple-icons/icons/smart.svg?raw';
import steam from 'simple-icons/icons/steam.svg?raw';
import playstation from 'simple-icons/icons/playstation.svg?raw';
import googleplay from 'simple-icons/icons/googleplay.svg?raw';
import apple from 'simple-icons/icons/apple.svg?raw';
import netflix from 'simple-icons/icons/netflix.svg?raw';
import spotify from 'simple-icons/icons/spotify.svg?raw';
import youtube from 'simple-icons/icons/youtube.svg?raw';
import tiktok from 'simple-icons/icons/tiktok.svg?raw';
import discord from 'simple-icons/icons/discord.svg?raw';

const LOGOS = { google, telegram, pubg, valorant, roblox, leagueoflegends, smart, steam, playstation, googleplay, apple, netflix, spotify, youtube, tiktok, discord };

/**
 * Only use official brand-mark SVGs from Simple Icons (CC0 data package).
 * Unknown logos intentionally render no image; do not invent a fake brand mark.
 */
export function hasOfficialBrandLogo(slug) { return Boolean(LOGOS[String(slug || '').toLowerCase()]); }

export default function BrandLogo({ brand, label, className = '', compact = false }) {
  const svg = LOGOS[String(brand || '').toLowerCase()];
  if (!svg) return <span className={`brand-wordmark ${className}`} aria-label={label}>{label}</span>;
  return (
    <span className={`brand-logo ${compact ? 'compact' : ''} ${className}`} role="img" aria-label={`${label} official logo`}>
      <span className="brand-logo-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}
