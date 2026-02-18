'use client';

import { useState, useEffect } from 'react';
import { getStoredSession } from '@/lib/directAuth';

interface CardData {
  id: string;
  card_name?: string;
  featured?: string;
  card_set?: string;
  card_number?: string;
  release_date?: string;
  manufacturer_name?: string;
  serial_numbering?: string;
  autographed?: boolean;
  autograph_type?: string;
  rookie_card?: boolean;
  first_print_rookie?: boolean;
  memorabilia_type?: string;
  holofoil?: string;
  is_foil?: boolean;
  foil_type?: string;
  mtg_rarity?: string;
  is_double_faced?: boolean;
  mtg_set_code?: string;
  rarity_tier?: string;
  rarity_description?: string;
  category?: string;
  conversational_card_info?: {
    card_name?: string;
    player_or_character?: string;
    set_name?: string;
    card_number_raw?: string;
    year?: string;
    manufacturer?: string;
    serial_number?: string;
    autographed?: boolean;
    rookie_or_first?: boolean;
    memorabilia?: string;
    facsimile_autograph?: boolean;
    official_reprint?: boolean;
    holofoil?: string;
    pokemon_type?: string;
    pokemon_stage?: string;
    hp?: string;
    card_type?: string;
    is_foil?: boolean;
    foil_type?: string;
    mtg_rarity?: string;
    is_double_faced?: boolean;
    expansion_code?: string;
    ink_color?: string;
    lorcana_card_type?: string;
    character_version?: string;
    inkwell?: boolean;
    ink_cost?: number;
    is_enchanted?: boolean;
    rarity_tier?: string;
    rarity_description?: string;
  };
}

interface EditCardDetailsModalProps {
  card: CardData;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: CardData) => void;
}

export default function EditCardDetailsModal({
  card,
  isOpen,
  onClose,
  onSave
}: EditCardDetailsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state - initialized from card data
  const [formData, setFormData] = useState({
    // Core fields
    card_name: '',
    featured: '',
    card_set: '',
    card_number_num: '',      // Numerator part (e.g., "018")
    card_number_total: '',    // Denominator part (e.g., "091")
    release_date: '',
    manufacturer_name: '',
    serial_numbering: '',
    // Special features
    autographed: false,
    rookie_card: false,
    memorabilia_type: '',
    memorabilia_other: '',
    rarity_tier: '',
    rarity_description: '',
    // Sports-specific
    sport: '',
    team: '',
    parallel_type: '',
    first_print_rookie: false,
    is_refractor: false,
    is_numbered: false,
    is_patch: false,
    is_jersey: false,
    is_game_used: false,
    is_on_card_auto: false,
    is_sticker_auto: false,
    is_variation: false,
    is_short_print: false,
    is_case_hit: false,
    // Pokemon-specific
    holofoil: '',
    pokemon_type: '',
    pokemon_stage: '',
    hp: '',
    subset_variant: '',
    // Pokemon special features
    is_first_edition: false,
    is_shadowless: false,
    is_reverse_holo: false,
    is_full_art: false,
    is_secret_rare: false,
    is_promo: false,
    is_error_card: false,
    is_illustration_rare: false,
    is_special_art_rare: false,
    is_hyper_rare: false,
    is_gold_rare: false,
    // MTG-specific
    is_foil: false,
    foil_type: '',
    mtg_rarity: '',
    is_double_faced: false,
    mtg_set_code: '',
    // MTG extended fields
    mana_cost: '',
    mtg_card_type: '',
    creature_type: '',
    power_toughness: '',
    color_identity: '',
    artist_name: '',
    border_color: '',
    frame_version: '',
    language: '',
    is_extended_art: false,
    is_showcase: false,
    is_borderless: false,
    is_retro_frame: false,
    is_full_art_mtg: false,
  });

  // Helper to convert value to boolean (handles string "false", "true", etc.)
  const toBoolean = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return Boolean(val);
  };

  // Helper to parse card number into numerator and total parts
  const parseCardNumber = (cardNum: string | null | undefined, cardNumRaw: string | null | undefined, setTotal: string | null | undefined) => {
    // Try card_number_raw first (e.g., "018/091")
    const raw = cardNumRaw || cardNum || '';

    if (raw.includes('/')) {
      const parts = raw.split('/');
      return {
        num: parts[0]?.trim() || '',
        total: parts[1]?.trim() || setTotal || ''
      };
    }

    // If no slash, use card_number as num and set_total as total
    return {
      num: cardNum || raw || '',
      total: setTotal || ''
    };
  };

  // Initialize form data when card changes
  useEffect(() => {
    if (card) {
      const info = card.conversational_card_info || {};
      const rarityDesc = card.rarity_description || info.rarity_description || info.rarity_or_variant || '';

      // Parse card number into parts
      const cardNumParts = parseCardNumber(
        info.card_number || card.card_number,
        info.card_number_raw,
        info.set_total
      );

      // Get holofoil value, checking multiple sources
      const holofoilValue = card.holofoil || info.holofoil || '';

      // Detect reverse holo from holofoil field (legitimate stored data)
      const isReverseHolo =
        holofoilValue.toLowerCase() === 'reverse' ||
        holofoilValue.toLowerCase() === 'reverse holo';

      setFormData({
        // Card name: prefer AI-detected card_name, then column value
        card_name: info.card_name || card.card_name || '',
        // Featured/Player: from AI card_info or column
        featured: info.player_or_character || card.featured || '',
        // Set name: prefer AI-detected, then column
        card_set: info.set_name || card.card_set || '',
        // Card number split into parts
        card_number_num: cardNumParts.num,
        card_number_total: cardNumParts.total,
        // Year: prefer AI-detected year
        release_date: info.year || card.release_date || '',
        manufacturer_name: info.manufacturer || card.manufacturer_name || '',
        serial_numbering: info.serial_number || card.serial_numbering || '',
        autographed: toBoolean(info.autographed) || toBoolean(card.autographed),
        rookie_card: toBoolean(info.rookie_or_first) || toBoolean(card.rookie_card),
        memorabilia_type: info.memorabilia || card.memorabilia_type || '',
        memorabilia_other: info.memorabilia_other || '',
        // Rarity: try AI rarity_tier first, then derive from rarity description
        rarity_tier: info.rarity_tier || card.rarity_tier || deriveRarityTier(rarityDesc),
        rarity_description: rarityDesc,
        // Sports-specific fields
        sport: info.sport || (card as any).sport || '',
        team: info.team || (card as any).team || '',
        parallel_type: info.parallel_type || info.rarity_or_variant || '',
        first_print_rookie: toBoolean(info.first_print_rookie) || toBoolean(card.first_print_rookie),
        is_refractor: toBoolean(info.is_refractor) || toBoolean((card as any).is_refractor),
        is_numbered: toBoolean(info.is_numbered) || toBoolean((card as any).is_numbered),
        is_patch: toBoolean(info.is_patch) || toBoolean((card as any).is_patch),
        is_jersey: toBoolean(info.is_jersey) || toBoolean((card as any).is_jersey),
        is_game_used: toBoolean(info.is_game_used) || toBoolean((card as any).is_game_used),
        is_on_card_auto: toBoolean(info.is_on_card_auto) || toBoolean((card as any).is_on_card_auto),
        is_sticker_auto: toBoolean(info.is_sticker_auto) || toBoolean((card as any).is_sticker_auto),
        is_variation: toBoolean(info.is_variation) || toBoolean((card as any).is_variation),
        is_short_print: toBoolean(info.is_short_print) || toBoolean((card as any).is_short_print),
        is_case_hit: toBoolean(info.is_case_hit) || toBoolean((card as any).is_case_hit),
        // Pokemon-specific fields
        holofoil: holofoilValue,
        pokemon_type: info.pokemon_type || (card as any).pokemon_type || '',
        pokemon_stage: info.pokemon_stage || (card as any).pokemon_stage || '',
        hp: String(info.hp || (card as any).hp || ''),
        subset_variant: info.subset || info.rarity_or_variant || info.subset_insert_name || '',
        // Pokemon special features (detected or stored)
        is_first_edition: toBoolean(info.is_first_edition) || toBoolean((card as any).is_first_edition),
        is_shadowless: toBoolean(info.is_shadowless) || toBoolean((card as any).is_shadowless),
        is_reverse_holo: toBoolean(info.is_reverse_holo) || toBoolean((card as any).is_reverse_holo) || isReverseHolo,
        is_full_art: toBoolean(info.is_full_art) || toBoolean((card as any).is_full_art),
        is_secret_rare: toBoolean(info.is_secret_rare) || toBoolean((card as any).is_secret_rare),
        is_promo: toBoolean(info.is_promo) || toBoolean((card as any).is_promo),
        is_error_card: toBoolean(info.is_error_card) || toBoolean((card as any).is_error_card),
        is_illustration_rare: toBoolean(info.is_illustration_rare) || toBoolean((card as any).is_illustration_rare),
        is_special_art_rare: toBoolean(info.is_special_art_rare) || toBoolean((card as any).is_special_art_rare),
        is_hyper_rare: toBoolean(info.is_hyper_rare) || toBoolean((card as any).is_hyper_rare),
        is_gold_rare: toBoolean(info.is_gold_rare) || toBoolean((card as any).is_gold_rare),
        // MTG-specific
        is_foil: toBoolean(info.is_foil) || toBoolean(card.is_foil),
        foil_type: info.foil_type || card.foil_type || '',
        mtg_rarity: info.mtg_rarity || card.mtg_rarity || '',
        is_double_faced: toBoolean(info.is_double_faced) || toBoolean(card.is_double_faced),
        mtg_set_code: info.expansion_code || card.mtg_set_code || '',
        // MTG extended fields
        mana_cost: info.mana_cost || (card as any).mana_cost || '',
        mtg_card_type: info.mtg_card_type || (card as any).mtg_card_type || '',
        creature_type: info.creature_type || (card as any).creature_type || '',
        power_toughness: info.power_toughness || (card as any).power_toughness || '',
        color_identity: info.color_identity || (card as any).color_identity || '',
        artist_name: info.artist_name || (card as any).artist_name || '',
        border_color: info.border_color || (card as any).border_color || '',
        frame_version: info.frame_version || (card as any).frame_version || '',
        language: info.language || (card as any).card_language || 'English',
        is_extended_art: toBoolean(info.is_extended_art) || toBoolean((card as any).is_extended_art),
        is_showcase: toBoolean(info.is_showcase) || toBoolean((card as any).is_showcase),
        is_borderless: toBoolean(info.is_borderless) || toBoolean((card as any).is_borderless),
        is_retro_frame: toBoolean(info.is_retro_frame) || toBoolean((card as any).is_retro_frame),
        is_full_art_mtg: toBoolean(info.is_full_art_mtg) || toBoolean((card as any).is_full_art_mtg),
      });
      setHasChanges(false);
      setError(null);
    }
  }, [card, isOpen]);

  // Helper to derive rarity tier from description
  const deriveRarityTier = (desc: string): string => {
    const lower = (desc || '').toLowerCase();
    if (lower.includes('hyper rare') || lower.includes('rainbow')) return 'hyper_rare';
    if (lower.includes('special art rare') || lower.includes('sar')) return 'special_art_rare';
    if (lower.includes('illustration rare')) return 'illustration_rare';
    if (lower.includes('secret rare')) return 'secret_rare';
    if (lower.includes('ultra rare')) return 'ultra_rare';
    if (lower.includes('holo rare')) return 'holo_rare';
    if (lower.includes('rare')) return 'rare';
    if (lower.includes('uncommon')) return 'uncommon';
    if (lower.includes('common')) return 'common';
    if (lower.includes('promo')) return 'promo';
    return '';
  };

  // Card category flags
  const isPokemon = card.category === 'Pokemon';
  const isMTG = card.category === 'MTG';
  const isLorcana = card.category === 'Lorcana';
  const isSports = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'].includes(card.category || '');

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to edit card details');
      }

      // Handle card number based on category
      const cardNumber = isSports
        ? formData.card_number_num || ''
        : (formData.card_number_num && formData.card_number_total
          ? `${formData.card_number_num}/${formData.card_number_total}`
          : formData.card_number_num || '');

      // Build category-specific payload (only send relevant fields)
      const commonFields = {
        card_name: formData.card_name,
        featured: formData.featured,
        card_set: formData.card_set,
        card_number: cardNumber,
        release_date: formData.release_date,
        manufacturer_name: formData.manufacturer_name,
        serial_numbering: formData.serial_numbering,
        autographed: formData.autographed,
        rookie_card: formData.rookie_card,
        rarity_tier: formData.rarity_tier,
        rarity_description: formData.rarity_description,
      };

      let payload: Record<string, any>;

      if (isPokemon) {
        payload = {
          ...commonFields,
          holofoil: formData.holofoil,
          pokemon_type: formData.pokemon_type,
          pokemon_stage: formData.pokemon_stage,
          hp: formData.hp,
          subset_variant: formData.subset_variant,
          is_first_edition: formData.is_first_edition,
          is_shadowless: formData.is_shadowless,
          is_reverse_holo: formData.is_reverse_holo,
          is_full_art: formData.is_full_art,
          is_secret_rare: formData.is_secret_rare,
          is_promo: formData.is_promo,
          is_error_card: formData.is_error_card,
          is_illustration_rare: formData.is_illustration_rare,
          is_special_art_rare: formData.is_special_art_rare,
          is_hyper_rare: formData.is_hyper_rare,
          is_gold_rare: formData.is_gold_rare,
        };
      } else if (isSports) {
        payload = {
          ...commonFields,
          sport: formData.sport,
          team: formData.team,
          parallel_type: formData.parallel_type,
          memorabilia_type: formData.memorabilia_type,
          memorabilia_other: formData.memorabilia_other,
          first_print_rookie: formData.first_print_rookie,
          is_refractor: formData.is_refractor,
          is_numbered: formData.is_numbered,
          is_patch: formData.is_patch,
          is_jersey: formData.is_jersey,
          is_game_used: formData.is_game_used,
          is_on_card_auto: formData.is_on_card_auto,
          is_sticker_auto: formData.is_sticker_auto,
          is_variation: formData.is_variation,
          is_short_print: formData.is_short_print,
          is_case_hit: formData.is_case_hit,
        };
      } else if (isMTG) {
        payload = {
          ...commonFields,
          is_foil: formData.is_foil,
          foil_type: formData.foil_type,
          mtg_rarity: formData.mtg_rarity,
          is_double_faced: formData.is_double_faced,
          mtg_set_code: formData.mtg_set_code,
          mana_cost: formData.mana_cost,
          mtg_card_type: formData.mtg_card_type,
          creature_type: formData.creature_type,
          power_toughness: formData.power_toughness,
          color_identity: formData.color_identity,
          artist_name: formData.artist_name,
          border_color: formData.border_color,
          frame_version: formData.frame_version,
          language: formData.language,
          is_extended_art: formData.is_extended_art,
          is_showcase: formData.is_showcase,
          is_borderless: formData.is_borderless,
          is_retro_frame: formData.is_retro_frame,
          is_full_art_mtg: formData.is_full_art_mtg,
          is_promo: formData.is_promo,
        };
      } else {
        payload = { ...commonFields };
      }

      const response = await fetch(`/api/cards/${card.id}/details`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to update card details';
        throw new Error(errorMsg);
      }

      onSave(data.card);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
            <h2 className="text-xl font-bold text-gray-900">Edit Card Details</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Basic Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                {/* Pokemon: Card Name is the Pokemon name */}
                {isPokemon ? (
                  <>
                    {/* Pokemon Name / Card Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.card_name}
                        onChange={(e) => handleInputChange('card_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Pikachu VMAX, Charizard ex"
                        required
                        maxLength={200}
                      />
                    </div>

                    {/* Pokemon Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pokemon Name
                      </label>
                      <input
                        type="text"
                        value={formData.featured}
                        onChange={(e) => handleInputChange('featured', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Pikachu, Charizard"
                        maxLength={200}
                      />
                      <p className="mt-1 text-xs text-gray-500">The Pokemon name shown on the card label</p>
                    </div>

                    {/* Set Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Set Name
                      </label>
                      <input
                        type="text"
                        value={formData.card_set}
                        onChange={(e) => handleInputChange('card_set', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Scarlet & Violet, Crown Zenith"
                        maxLength={200}
                      />
                    </div>

                    {/* Card Number (split into two fields) & Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Card Number
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formData.card_number_num}
                            onChange={(e) => handleInputChange('card_number_num', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
                            placeholder="018"
                            maxLength={10}
                          />
                          <span className="text-gray-500 font-medium">/</span>
                          <input
                            type="text"
                            value={formData.card_number_total}
                            onChange={(e) => handleInputChange('card_number_total', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
                            placeholder="091"
                            maxLength={10}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Year
                        </label>
                        <input
                          type="text"
                          value={formData.release_date}
                          onChange={(e) => handleInputChange('release_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., 2023"
                          maxLength={4}
                          pattern="\d{4}"
                        />
                      </div>
                    </div>

                    {/* Serial Numbering (for numbered cards like /25) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Serial Numbering <span className="text-gray-400 text-xs">(if numbered)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.serial_numbering}
                        onChange={(e) => handleInputChange('serial_numbering', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., /25, 10/99"
                        maxLength={20}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Non-Pokemon: Standard card layout */}
                    {/* Card Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.card_name}
                        onChange={(e) => handleInputChange('card_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        maxLength={200}
                      />
                    </div>

                    {/* Player/Character & Set Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isSports ? 'Player Name' : 'Character/Player'}
                        </label>
                        <input
                          type="text"
                          value={formData.featured}
                          onChange={(e) => handleInputChange('featured', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={200}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Set Name
                        </label>
                        <input
                          type="text"
                          value={formData.card_set}
                          onChange={(e) => handleInputChange('card_set', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={200}
                        />
                      </div>
                    </div>

                    {/* Card Number & Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Card Number
                        </label>
                        {isSports ? (
                          <input
                            type="text"
                            value={formData.card_number_num}
                            onChange={(e) => handleInputChange('card_number_num', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g., 94, RC-12"
                            maxLength={20}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={formData.card_number_num}
                              onChange={(e) => handleInputChange('card_number_num', e.target.value)}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
                              placeholder="94"
                              maxLength={10}
                            />
                            <span className="text-gray-500 font-medium">/</span>
                            <input
                              type="text"
                              value={formData.card_number_total}
                              onChange={(e) => handleInputChange('card_number_total', e.target.value)}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
                              placeholder="102"
                              maxLength={10}
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Year
                        </label>
                        <input
                          type="text"
                          value={formData.release_date}
                          onChange={(e) => handleInputChange('release_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="e.g., 2023"
                          maxLength={4}
                          pattern="\d{4}"
                        />
                      </div>
                    </div>

                    {/* Manufacturer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Manufacturer
                      </label>
                      <input
                        type="text"
                        value={formData.manufacturer_name}
                        onChange={(e) => handleInputChange('manufacturer_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Topps, Panini, The Pokemon Company"
                        maxLength={200}
                      />
                    </div>

                    {/* Serial Numbering */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Serial Numbering
                      </label>
                      <input
                        type="text"
                        value={formData.serial_numbering}
                        onChange={(e) => handleInputChange('serial_numbering', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., /99, /50, 25/100"
                        maxLength={20}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sports Card Details Section */}
            {isSports && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sports Card Details</h3>
                <div className="space-y-4">
                  {/* Sport & Team */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sport
                      </label>
                      <select
                        value={formData.sport}
                        onChange={(e) => handleInputChange('sport', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select sport...</option>
                        <option value="Football">Football</option>
                        <option value="Baseball">Baseball</option>
                        <option value="Basketball">Basketball</option>
                        <option value="Hockey">Hockey</option>
                        <option value="Soccer">Soccer</option>
                        <option value="Wrestling">Wrestling</option>
                        <option value="Golf">Golf</option>
                        <option value="Racing">Racing</option>
                        <option value="MMA">MMA/UFC</option>
                        <option value="Boxing">Boxing</option>
                        <option value="Tennis">Tennis</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team
                      </label>
                      <input
                        type="text"
                        value={formData.team}
                        onChange={(e) => handleInputChange('team', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Lakers, Yankees, Cowboys"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {/* Parallel Type & Rarity Description */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parallel/Insert Type
                      </label>
                      <input
                        type="text"
                        value={formData.parallel_type}
                        onChange={(e) => handleInputChange('parallel_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Prizm Silver, Refractor, Chrome"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Memorabilia Type
                      </label>
                      <select
                        value={formData.memorabilia_type}
                        onChange={(e) => handleInputChange('memorabilia_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">None</option>
                        <option value="patch">Patch</option>
                        <option value="jersey">Jersey</option>
                        <option value="bat">Bat Piece</option>
                        <option value="ball">Ball</option>
                        <option value="glove">Glove</option>
                        <option value="helmet">Helmet</option>
                        <option value="shoe">Shoe/Cleat</option>
                        <option value="ticket">Ticket Stub</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Other Memorabilia Details - shows when "other" is selected */}
                  {formData.memorabilia_type === 'other' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Memorabilia Details
                      </label>
                      <input
                        type="text"
                        value={formData.memorabilia_other}
                        onChange={(e) => handleInputChange('memorabilia_other', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Describe the memorabilia type..."
                        maxLength={100}
                      />
                    </div>
                  )}

                  {/* Special Features Checkboxes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Features
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.rookie_card}
                          onChange={(e) => handleInputChange('rookie_card', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Rookie Card</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.first_print_rookie}
                          onChange={(e) => handleInputChange('first_print_rookie', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">1st Bowman</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autographed}
                          onChange={(e) => handleInputChange('autographed', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Autographed</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_on_card_auto}
                          onChange={(e) => handleInputChange('is_on_card_auto', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">On-Card Auto</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_sticker_auto}
                          onChange={(e) => handleInputChange('is_sticker_auto', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Sticker Auto</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_numbered}
                          onChange={(e) => handleInputChange('is_numbered', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Numbered</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_refractor}
                          onChange={(e) => handleInputChange('is_refractor', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Refractor/Prizm</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_patch}
                          onChange={(e) => handleInputChange('is_patch', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Patch Card</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_jersey}
                          onChange={(e) => handleInputChange('is_jersey', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Jersey Card</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_game_used}
                          onChange={(e) => handleInputChange('is_game_used', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Game Used</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_short_print}
                          onChange={(e) => handleInputChange('is_short_print', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Short Print (SP)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_variation}
                          onChange={(e) => handleInputChange('is_variation', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Variation</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_case_hit}
                          onChange={(e) => handleInputChange('is_case_hit', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Case Hit/1 of 1</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Special Features Section - shown for non-Pokemon, non-Sports cards (MTG, Lorcana, Other) */}
            {!isPokemon && !isSports && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Features</h3>
                <div className="space-y-4">
                  {/* Checkboxes */}
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autographed}
                        onChange={(e) => handleInputChange('autographed', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Autographed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.rookie_card}
                        onChange={(e) => handleInputChange('rookie_card', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Rookie Card</span>
                    </label>
                  </div>

                  {/* Rarity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rarity Tier
                      </label>
                      <select
                        value={formData.rarity_tier}
                        onChange={(e) => handleInputChange('rarity_tier', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select rarity...</option>
                        <option value="common">Common</option>
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="ultra_rare">Ultra Rare</option>
                        <option value="secret_rare">Secret Rare</option>
                        <option value="special">Special</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rarity Description
                      </label>
                      <input
                        type="text"
                        value={formData.rarity_description}
                        onChange={(e) => handleInputChange('rarity_description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Illustration Rare, Full Art"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pokemon Rarity Section */}
            {isPokemon && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Rarity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rarity Tier
                    </label>
                    <select
                      value={formData.rarity_tier}
                      onChange={(e) => handleInputChange('rarity_tier', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select rarity...</option>
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="holo_rare">Holo Rare</option>
                      <option value="ultra_rare">Ultra Rare</option>
                      <option value="secret_rare">Secret Rare</option>
                      <option value="illustration_rare">Illustration Rare</option>
                      <option value="special_art_rare">Special Art Rare</option>
                      <option value="hyper_rare">Hyper Rare</option>
                      <option value="promo">Promo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rarity Description
                    </label>
                    <input
                      type="text"
                      value={formData.rarity_description}
                      onChange={(e) => handleInputChange('rarity_description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Ultra Rare, Full Art"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pokemon-Specific Section */}
            {isPokemon && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pokemon Card Details</h3>
                <div className="space-y-4">
                  {/* Type, Stage, HP row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pokemon Type
                      </label>
                      <select
                        value={formData.pokemon_type}
                        onChange={(e) => handleInputChange('pokemon_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select type...</option>
                        <option value="Colorless">Colorless</option>
                        <option value="Darkness">Darkness</option>
                        <option value="Dragon">Dragon</option>
                        <option value="Fairy">Fairy</option>
                        <option value="Fighting">Fighting</option>
                        <option value="Fire">Fire</option>
                        <option value="Grass">Grass</option>
                        <option value="Lightning">Lightning</option>
                        <option value="Metal">Metal</option>
                        <option value="Psychic">Psychic</option>
                        <option value="Water">Water</option>
                        <option value="Trainer">Trainer</option>
                        <option value="Energy">Energy</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage
                      </label>
                      <select
                        value={formData.pokemon_stage}
                        onChange={(e) => handleInputChange('pokemon_stage', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select stage...</option>
                        <option value="Basic">Basic</option>
                        <option value="Stage 1">Stage 1</option>
                        <option value="Stage 2">Stage 2</option>
                        <option value="VMAX">VMAX</option>
                        <option value="VSTAR">VSTAR</option>
                        <option value="V">V</option>
                        <option value="GX">GX</option>
                        <option value="EX">EX</option>
                        <option value="ex">ex (lowercase)</option>
                        <option value="MEGA">MEGA</option>
                        <option value="BREAK">BREAK</option>
                        <option value="LV.X">LV.X</option>
                        <option value="Prime">Prime</option>
                        <option value="Legend">LEGEND</option>
                        <option value="Trainer">Trainer</option>
                        <option value="Supporter">Supporter</option>
                        <option value="Item">Item</option>
                        <option value="Stadium">Stadium</option>
                        <option value="Energy">Energy</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        HP
                      </label>
                      <input
                        type="text"
                        value={formData.hp}
                        onChange={(e) => handleInputChange('hp', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 190, 320"
                        maxLength={5}
                      />
                    </div>
                  </div>

                  {/* Subset/Variant & Rarity Description row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subset/Variant
                      </label>
                      <input
                        type="text"
                        value={formData.subset_variant}
                        onChange={(e) => handleInputChange('subset_variant', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Full Art GX, Trainer Gallery"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Holofoil
                      </label>
                      <select
                        value={formData.holofoil}
                        onChange={(e) => handleInputChange('holofoil', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select...</option>
                        <option value="Yes">Yes (Holo)</option>
                        <option value="No">No (Non-Holo)</option>
                        <option value="Reverse">Reverse Holo</option>
                      </select>
                    </div>
                  </div>

                  {/* Special Features Checkboxes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Features
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_first_edition}
                          onChange={(e) => handleInputChange('is_first_edition', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">1st Edition</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_shadowless}
                          onChange={(e) => handleInputChange('is_shadowless', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Shadowless</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_full_art}
                          onChange={(e) => handleInputChange('is_full_art', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Full Art</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_secret_rare}
                          onChange={(e) => handleInputChange('is_secret_rare', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Secret Rare</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_illustration_rare}
                          onChange={(e) => handleInputChange('is_illustration_rare', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Illustration Rare</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_special_art_rare}
                          onChange={(e) => handleInputChange('is_special_art_rare', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Special Art Rare</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_hyper_rare}
                          onChange={(e) => handleInputChange('is_hyper_rare', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Hyper/Rainbow Rare</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_gold_rare}
                          onChange={(e) => handleInputChange('is_gold_rare', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Gold Rare</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_promo}
                          onChange={(e) => handleInputChange('is_promo', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Promo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_reverse_holo}
                          onChange={(e) => handleInputChange('is_reverse_holo', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Reverse Holo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_error_card}
                          onChange={(e) => handleInputChange('is_error_card', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Error Card</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autographed}
                          onChange={(e) => handleInputChange('autographed', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Autographed</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MTG-Specific Section */}
            {isMTG && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">MTG Card Details</h3>
                <div className="space-y-4">
                  {/* Card Type & Creature Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Type
                      </label>
                      <input
                        type="text"
                        value={formData.mtg_card_type}
                        onChange={(e) => handleInputChange('mtg_card_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Creature, Instant, Sorcery"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Creature Type
                      </label>
                      <input
                        type="text"
                        value={formData.creature_type}
                        onChange={(e) => handleInputChange('creature_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Human Wizard, Elf Druid"
                      />
                    </div>
                  </div>

                  {/* Mana Cost & Color Identity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mana Cost
                      </label>
                      <input
                        type="text"
                        value={formData.mana_cost}
                        onChange={(e) => handleInputChange('mana_cost', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                        placeholder="e.g., {2}{U}{U}, {3}{B}{B}"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Identity
                      </label>
                      <input
                        type="text"
                        value={formData.color_identity}
                        onChange={(e) => handleInputChange('color_identity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Blue, Red/Green, Colorless"
                      />
                    </div>
                  </div>

                  {/* Power/Toughness & Set Code */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Power/Toughness
                      </label>
                      <input
                        type="text"
                        value={formData.power_toughness}
                        onChange={(e) => handleInputChange('power_toughness', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., 3/4, 2/2, */1+*"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Set Code
                      </label>
                      <input
                        type="text"
                        value={formData.mtg_set_code}
                        onChange={(e) => handleInputChange('mtg_set_code', e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., MKM, ONE, BRO"
                        maxLength={5}
                      />
                    </div>
                  </div>

                  {/* Rarity & Language */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rarity
                      </label>
                      <select
                        value={formData.mtg_rarity}
                        onChange={(e) => handleInputChange('mtg_rarity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select rarity...</option>
                        <option value="common">Common</option>
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="mythic">Mythic Rare</option>
                        <option value="special">Special / Bonus</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Language
                      </label>
                      <select
                        value={formData.language}
                        onChange={(e) => handleInputChange('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="English">English</option>
                        <option value="Japanese">Japanese</option>
                        <option value="German">German</option>
                        <option value="French">French</option>
                        <option value="Italian">Italian</option>
                        <option value="Spanish">Spanish</option>
                        <option value="Portuguese">Portuguese</option>
                        <option value="Russian">Russian</option>
                        <option value="Korean">Korean</option>
                        <option value="Chinese (Simplified)">Chinese (Simplified)</option>
                        <option value="Chinese (Traditional)">Chinese (Traditional)</option>
                        <option value="Phyrexian">Phyrexian</option>
                      </select>
                    </div>
                  </div>

                  {/* Artist & Border Color */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Artist
                      </label>
                      <input
                        type="text"
                        value={formData.artist_name}
                        onChange={(e) => handleInputChange('artist_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="e.g., Mark Poole, Rebecca Guay"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Border Color
                      </label>
                      <select
                        value={formData.border_color}
                        onChange={(e) => handleInputChange('border_color', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select border...</option>
                        <option value="black">Black</option>
                        <option value="white">White</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                        <option value="borderless">Borderless</option>
                      </select>
                    </div>
                  </div>

                  {/* Foil Type (if foil) */}
                  {formData.is_foil && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Foil Type
                      </label>
                      <select
                        value={formData.foil_type}
                        onChange={(e) => handleInputChange('foil_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Standard Foil</option>
                        <option value="etched">Etched Foil</option>
                        <option value="surge">Surge Foil</option>
                        <option value="gilded">Gilded Foil</option>
                        <option value="textured">Textured Foil</option>
                        <option value="galaxy">Galaxy Foil</option>
                        <option value="confetti">Confetti Foil</option>
                        <option value="halo">Halo Foil</option>
                      </select>
                    </div>
                  )}

                  {/* Special Features Checkboxes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Features
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_foil}
                          onChange={(e) => handleInputChange('is_foil', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Foil</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_double_faced}
                          onChange={(e) => handleInputChange('is_double_faced', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Double-Faced</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_full_art_mtg}
                          onChange={(e) => handleInputChange('is_full_art_mtg', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Full Art</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_extended_art}
                          onChange={(e) => handleInputChange('is_extended_art', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Extended Art</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_showcase}
                          onChange={(e) => handleInputChange('is_showcase', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Showcase</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_borderless}
                          onChange={(e) => handleInputChange('is_borderless', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Borderless</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_retro_frame}
                          onChange={(e) => handleInputChange('is_retro_frame', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Retro Frame</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_promo}
                          onChange={(e) => handleInputChange('is_promo', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Promo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autographed}
                          onChange={(e) => handleInputChange('autographed', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Autographed</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 -mb-6 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isLoading || !hasChanges}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
