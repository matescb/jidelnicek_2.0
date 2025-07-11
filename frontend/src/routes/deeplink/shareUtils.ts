/**
 * Share and link generation utilities
 */

import { pathBuilders } from '../paths';
import {
  DEEP_LINK_SCHEMES,
  SOCIAL_SHARE_CONFIG,
  DEFAULT_GENERATION_CONFIG,
  type DeepLinkGenerationConfig,
} from './deepLinkConfig';

/**
 * Share link options
 */
export interface ShareLinkOptions extends DeepLinkGenerationConfig {
  title?: string;
  description?: string;
  hashtags?: string[];
  source?: 'app' | 'web' | 'qr';
}

/**
 * Generate a shareable deep link for a recipe
 */
export function generateRecipeShareLink(
  recipeId: string | number,
  options: ShareLinkOptions = {}
): string {
  const config = { ...DEFAULT_GENERATION_CONFIG, ...options };
  const scheme = DEEP_LINK_SCHEMES[config.preferredScheme || 'APP'];
  
  let link = `${scheme}recipe/${recipeId}/share`;
  
  // Add source tracking
  if (config.includeSource && options.source) {
    link += `?source=${options.source}`;
  }
  
  return link;
}

/**
 * Generate a trip invitation link
 */
export function generateTripInviteLink(
  tripId: string | number,
  inviteToken: string,
  options: ShareLinkOptions = {}
): string {
  const config = { ...DEFAULT_GENERATION_CONFIG, ...options };
  const scheme = DEEP_LINK_SCHEMES[config.preferredScheme || 'APP'];
  
  let link = `${scheme}trip/${tripId}/join?token=${inviteToken}`;
  
  // Add source tracking
  if (config.includeSource && options.source) {
    link += `&source=${options.source}`;
  }
  
  return link;
}

/**
 * Generate a shopping list share link
 */
export function generateShoppingListShareLink(
  listId: string | number,
  shareToken?: string,
  options: ShareLinkOptions = {}
): string {
  const config = { ...DEFAULT_GENERATION_CONFIG, ...options };
  const scheme = DEEP_LINK_SCHEMES[config.preferredScheme || 'APP'];
  
  let link = `${scheme}shopping-list/${listId}/share`;
  
  const params: string[] = [];
  
  if (shareToken) {
    params.push(`token=${shareToken}`);
  }
  
  if (config.includeSource && options.source) {
    params.push(`source=${options.source}`);
  }
  
  if (params.length > 0) {
    link += `?${params.join('&')}`;
  }
  
  return link;
}

/**
 * Generate a navigation deep link
 */
export function generateNavigationLink(
  path: string,
  options: ShareLinkOptions = {}
): string {
  const config = { ...DEFAULT_GENERATION_CONFIG, ...options };
  const scheme = DEEP_LINK_SCHEMES[config.preferredScheme || 'APP'];
  
  // Remove leading slash from path
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  return `${scheme}${cleanPath}`;
}

/**
 * Generate social media share URL
 */
export function generateSocialShareUrl(
  platform: keyof typeof SOCIAL_SHARE_CONFIG,
  deepLink: string,
  options: ShareLinkOptions = {}
): string {
  const config = SOCIAL_SHARE_CONFIG[platform];
  const params = new URLSearchParams();
  
  switch (platform) {
    case 'facebook':
      params.append('u', deepLink);
      break;
      
    case 'twitter':
      params.append('url', deepLink);
      if (options.title) {
        params.append('text', options.title);
      }
      if (options.hashtags && options.hashtags.length > 0) {
        params.append('hashtags', options.hashtags.join(','));
      }
      break;
      
    case 'whatsapp':
      const whatsappText = options.title
        ? `${options.title}\n${deepLink}`
        : deepLink;
      return `${config.baseUrl}?text=${encodeURIComponent(whatsappText)}`;
      
    case 'telegram':
      params.append('url', deepLink);
      if (options.title) {
        params.append('text', options.title);
      }
      break;
      
    case 'email':
      const subject = options.title || 'Check this out on Jidelnicek';
      const body = options.description
        ? `${options.description}\n\n${deepLink}`
        : `Check this out on Jidelnicek: ${deepLink}`;
      return `${config.baseUrl}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  
  return `${config.baseUrl}?${params.toString()}`;
}

/**
 * Generate QR code data URL
 */
export async function generateQRCode(
  deepLink: string,
  options: {
    size?: number;
    margin?: number;
    darkColor?: string;
    lightColor?: string;
  } = {}
): Promise<string> {
  const {
    size = 256,
    margin = 4,
    darkColor = '#000000',
    lightColor = '#FFFFFF',
  } = options;
  
  // Using a simple QR code generation approach
  // In production, use a library like qrcode.js
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&color=${darkColor.replace('#', '')}&bgcolor=${lightColor.replace('#', '')}&data=${encodeURIComponent(deepLink)}`;
  
  try {
    const response = await fetch(qrApiUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to older method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      return true;
    } finally {
      textArea.remove();
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Share using native share API
 */
export async function shareNative(
  deepLink: string,
  options: ShareLinkOptions = {}
): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }
  
  try {
    await navigator.share({
      title: options.title,
      text: options.description,
      url: deepLink,
    });
    return true;
  } catch (error) {
    // User cancelled or error occurred
    console.error('Native share failed:', error);
    return false;
  }
}

/**
 * Check if native share is available
 */
export function canShareNative(): boolean {
  return typeof navigator.share === 'function';
}

/**
 * Get share message template
 */
export function getShareMessage(
  type: 'recipe' | 'trip' | 'shopping-list',
  title: string,
  deepLink: string
): string {
  const templates = {
    recipe: `Check out this recipe: "${title}"\n${deepLink}`,
    trip: `Join me on this trip: "${title}"\n${deepLink}`,
    'shopping-list': `Here's my shopping list: "${title}"\n${deepLink}`,
  };
  
  return templates[type] || `Check this out on Jidelnicek: ${deepLink}`;
}

/**
 * Track share event
 */
export function trackShareEvent(
  type: string,
  method: string,
  itemId?: string | number
): void {
  // Analytics tracking
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'share', {
      content_type: type,
      method: method,
      item_id: itemId,
    });
  }
}

/**
 * Generate short URL (requires backend service)
 */
export async function generateShortUrl(
  longUrl: string
): Promise<string | null> {
  try {
    // This would call your backend URL shortening service
    const response = await fetch('/api/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: longUrl }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to shorten URL');
    }
    
    const data = await response.json();
    return data.shortUrl;
  } catch (error) {
    console.error('Failed to generate short URL:', error);
    return null;
  }
}