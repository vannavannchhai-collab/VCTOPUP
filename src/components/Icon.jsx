import React from 'react';
import {
  Gamepad2, Smartphone, Gift, Clapperboard, MessageCircle, Swords, Flame,
  Crosshair, Sparkles, Crown, Target, Shield, Boxes, Zap, Trophy, Signal,
  Radio, Wifi, Play, Apple, Music, Video, Send, Landmark, Building2, Wallet,
  CreditCard, Gem, Star, Globe, Package, CircleHelp,
} from 'lucide-react';

export const ICONS = {
  Gamepad2, Smartphone, Gift, Clapperboard, MessageCircle, Swords, Flame,
  Crosshair, Sparkles, Crown, Target, Shield, Boxes, Zap, Trophy, Signal,
  Radio, Wifi, Play, Apple, Music, Video, Send, Landmark, Building2, Wallet,
  CreditCard, Gem, Star, Globe, Package, CircleHelp,
};

export default function Icon({ name, fallback = 'Package', ...props }) {
  const Cmp = ICONS[name] || ICONS[fallback] || Package;
  return <Cmp {...props} />;
}
