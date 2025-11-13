/**
 * Social sharing utility functions for DCM Card Grading App
 */

export interface CardSharingData {
  id?: string;
  cardName?: string;
  playerName?: string;
  setName?: string;
  year?: string;
  manufacturer?: string;
  grade?: number;
  gradeUncertainty?: string;
  url?: string;
  // Legacy fields for backward compatibility
  card_name?: string;
  featured?: string;
  card_set?: string;
  release_date?: string;
  dcm_grade_whole?: number;
  ai_confidence_score?: string;
  front_url?: string;
  serial?: string;
}

/**
 * Detect if user is on mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generate Facebook share URL
 * Note: Facebook requires Open Graph meta tags on the page for pre-filled content
 * The 'quote' parameter is deprecated and may not work
 */
export function generateFacebookShareUrl(cardData: CardSharingData): string {
  const cardUrl = cardData.url || `https://dcmgrading.com/sports/${cardData.id}`;

  // Facebook Share Dialog - simpler and more reliable
  const params = new URLSearchParams({
    u: cardUrl
  });

  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * Generate Twitter share URL
 */
export function generateTwitterShareUrl(cardData: CardSharingData): string {
  const cardUrl = cardData.url || `https://dcmgrading.com/sports/${cardData.id}`;
  const text = generateShareText(cardData);

  const params = new URLSearchParams({
    url: cardUrl,
    text: text,
    hashtags: 'DCMGrading,SportsCards,CardGrading'
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate Instagram sharing content (mobile app or copy text)
 */
export function handleInstagramShare(cardData: CardSharingData): void {
  const text = generateInstagramCaption(cardData);

  if (isMobile()) {
    // Try to open Instagram app
    const instagramUrl = 'instagram://story-camera';
    window.open(instagramUrl, '_blank');

    // Fallback: copy text to clipboard
    setTimeout(() => {
      copyToClipboard(text);
      alert('Instagram content copied to clipboard! Paste it when you create your story.');
    }, 1000);
  } else {
    // Desktop: copy caption and show instructions
    copyToClipboard(text);
    alert('Instagram caption copied to clipboard! Open Instagram on your phone and paste when creating a post.');
  }
}

/**
 * Copy card URL to clipboard
 */
export function copyCardUrl(cardData: CardSharingData, baseUrl: string = 'https://dcmgrading.com'): void {
  const cardUrl = `${baseUrl}/sports/${cardData.id}`;
  copyToClipboard(cardUrl);
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  } else {
    // Fallback for older browsers
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
      textArea.remove();
      return Promise.resolve(true);
    } catch (err) {
      textArea.remove();
      return Promise.resolve(false);
    }
  }
}

/**
 * Generate sharing text for Facebook/Twitter
 */
function generateShareText(cardData: CardSharingData): string {
  // Use new fields with fallback to legacy fields
  const playerName = cardData.playerName || cardData.featured || cardData.cardName || cardData.card_name || 'Card';
  const cardName = cardData.cardName || cardData.card_name || '';
  const grade = cardData.grade || cardData.dcm_grade_whole;
  const imageQuality = cardData.gradeUncertainty || cardData.ai_confidence_score || 'B';
  const year = cardData.year || cardData.release_date || '';
  const set = cardData.setName || cardData.card_set || '';
  const manufacturer = cardData.manufacturer || '';

  // Build card details line: Player - Card Name - Year Manufacturer Set
  const cardDetails: string[] = [];
  if (playerName && playerName !== 'Card') cardDetails.push(playerName);
  if (cardName && cardName !== playerName) cardDetails.push(cardName);

  const setInfo: string[] = [];
  if (year) setInfo.push(year);
  if (manufacturer) setInfo.push(manufacturer);
  if (set) setInfo.push(set);
  if (setInfo.length > 0) cardDetails.push(setInfo.join(' '));

  let text = cardDetails.join(' - ');

  // Add grade in format: 9.2/A or 9/A
  if (grade) {
    text += `\nDCM Grade: ${grade}/${imageQuality}`;
  }

  return text;
}

/**
 * Generate Instagram caption
 */
function generateInstagramCaption(cardData: CardSharingData): string {
  // Use new fields with fallback to legacy fields
  const playerName = cardData.playerName || cardData.featured || cardData.cardName || cardData.card_name || 'Card';
  const cardName = cardData.cardName || cardData.card_name || '';
  const grade = cardData.grade || cardData.dcm_grade_whole;
  const imageQuality = cardData.gradeUncertainty || cardData.ai_confidence_score || 'B';
  const year = cardData.year || cardData.release_date || '';
  const set = cardData.setName || cardData.card_set || '';
  const manufacturer = cardData.manufacturer || '';

  // Build card details line: Player - Card Name - Year Manufacturer Set
  const cardDetails: string[] = [];
  if (playerName && playerName !== 'Card') cardDetails.push(playerName);
  if (cardName && cardName !== playerName) cardDetails.push(cardName);

  const setInfo: string[] = [];
  if (year) setInfo.push(year);
  if (manufacturer) setInfo.push(manufacturer);
  if (set) setInfo.push(set);
  if (setInfo.length > 0) cardDetails.push(setInfo.join(' '));

  let caption = cardDetails.join(' - ') + '\n\n';

  // Add grade in format: 9.2/A or 9/A
  if (grade) {
    caption += `DCM Grade: ${grade}/${imageQuality}\n\n`;
  }

  caption += `Professional card grading and authentication.\n\n`;

  // Generate hashtags - clean up player name for hashtag
  const hashtags: string[] = ['#DCMGrading', '#SportsCards', '#CardGrading'];
  if (playerName && playerName !== 'Card') {
    hashtags.push(`#${playerName.replace(/\s+/g, '')}`);
  }
  if (set && !set.toLowerCase().includes('unknown')) {
    hashtags.push(`#${set.replace(/\s+/g, '')}`);
  }
  hashtags.push('#CardCollector', '#TradingCards');

  caption += hashtags.join(' ');

  return caption;
}

/**
 * Open social sharing in new window
 */
export function openSocialShare(url: string): void {
  const width = 600;
  const height = 400;
  const left = (window.innerWidth / 2) - (width / 2);
  const top = (window.innerHeight / 2) - (height / 2);

  window.open(
    url,
    'social-share',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

/**
 * Show success message for social sharing
 */
export function showShareSuccess(platform: string): void {
  // You can customize this to show a toast notification or modal
  console.log(`Successfully shared to ${platform}!`);
}