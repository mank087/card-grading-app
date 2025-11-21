"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { QRCodeCanvas } from 'qrcode.react';
import GradeBadge from "../../ui/GradeBadge";

interface AIGrading {
  "Final Score"?: { "Overall Grade"?: string };
  "Final DCM Grade"?: {
    "Raw Decimal Grade"?: number;
    "DCM Grade (Whole Number)"?: number;
    "Confidence Level"?: string;
  };
  "Card Information"?: Record<string, string>;
  "Card Identification"?: Record<string, string>;
  "Card Details"?: Record<string, string>;
  "Grading (DCM Master Scale)"?: {
    "Raw Decimal Grade (Before Rounding)"?: string | number;
    "DCM Grade (Final Whole Number)"?: string | number;
    "Subgrade Evaluation"?: Record<
      string,
      { score?: number; ratio?: string; commentary?: string }
    >;
  };
  "Estimated Scoring by Major Grading Companies"?: Record<
    string,
    { grade?: string; reasoning?: string }
  >;
  "DCM Score System"?: Record<string, string | number>;
  "DCM Estimated Value"?: Record<string, string | number>;
  "AI Confidence Assessment"?: {
    "Confidence Level"?: string;
    "Image Quality Factors"?: string;
    "Resolution Assessment"?: string;
    "Visibility Issues"?: string;
    "Grading Reliability"?: string;
    "Confidence Justification"?: string;
  };
}

interface Card {
  id: string;
  front_url: string;
  back_url: string;
  card_name: string;
  category: string;
  card_number: string;
  serial_numbering: string;
  card_set: string;
  manufacturer_name: string;
  release_date: string;
  authentic: string;
  rookie_or_first_print: string;
  rarity_description: string;
  featured: string;
  raw_decimal_grade: number | null;
  dcm_grade_whole: number | null;
  ai_grading: AIGrading | null;
  final_dcm_score: string;
  condition_grade_base: number | null;
  ai_confidence_score: string;
  estimated_market_value: string;
  estimated_range: string;
  estimate_confidence: string;
  obstruction_summary: string;
  explanation: any;
  summary: string;
  processing_time?: number;
  conversational_card_info?: {
    card_name?: string;
    player_or_character?: string;
    card_front_text?: string;
    card_back_text?: string;
    [key: string]: any;
  };
}

const renderValue = (value: any) => {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "-";
  }
  return value;
};

const formatGrade = (grade: number | null) => {
  if (grade === null || grade === undefined) {
    return "-";
  }
  // If the grade is a whole number (e.g., 10.0, 9.0), display without decimal
  // Otherwise keep the decimal (e.g., 9.5, 8.5)
  return grade % 1 === 0 ? Math.floor(grade).toString() : grade.toString();
};


export default function CardDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params?.id;
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');

  // Simple fetch function - single request
  const fetchCardDetails = useCallback(async () => {
    if (!cardId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/card/${cardId}`);

      if (!res.ok) {
        if (res.status === 429) {
          console.log('Card is being processed, waiting 3 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          // Retry once after waiting
          const retryRes = await fetch(`/api/card/${cardId}`);
          if (!retryRes.ok) {
            throw new Error(`Failed to load card after retry: ${retryRes.status}`);
          }
          const retryData = await retryRes.json();
          setCard(retryData);
          return;
        }
        throw new Error(`Failed to load card: ${res.status}`);
      }

      const data = await res.json();
      setCard(data);

    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  // Single fetch on mount
  useEffect(() => {
    if (cardId) {
      console.log('Fetching card details for:', cardId);
      fetchCardDetails();
    }
  }, [cardId, fetchCardDetails]);

  // Redirect to category-specific pages
  useEffect(() => {
    if (card && cardId) {
      if (card.category === 'Pokemon') {
        console.log('Redirecting Pokemon card to /pokemon/' + cardId);
        router.push(`/pokemon/${cardId}`);
      } else if (card.category === 'Sports') {
        console.log('Redirecting Sports card to /sports/' + cardId);
        router.push(`/sports/${cardId}`);
      }
    }
  }, [card, cardId, router]);

  // Set origin for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading card details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p>{error}</p>
        <div className="mt-4 space-x-4">
          <button
            onClick={fetchCardDetails}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
          <Link href="/" className="text-blue-500 inline-block">
            Go back to list
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Card Not Found</h1>
        <Link href="/" className="text-blue-500">
          Go back to list
        </Link>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← Back to Cards
        </Link>
        <div className="text-sm text-gray-500">
          {card.processing_time && (
            <span>Evaluated in {(card.processing_time / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* Main Card Display */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Card Images */}
        <div className="lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Front</h3>
              <Image
                src={card.front_url}
                alt="Card front"
                width={400}
                height={560}
                className="rounded-lg shadow-lg w-full"
              />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Back</h3>
              <Image
                src={card.back_url}
                alt="Card back"
                width={400}
                height={560}
                className="rounded-lg shadow-lg w-full"
              />
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div className="space-y-6">
          {/* Grade Display */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">DCM Grade</h2>
            <div className="text-center mb-4">
              <GradeBadge
                conditionGrade={card.dcm_grade_whole || 0}
                aiConfidence={card.ai_confidence_score || "Medium"}
              />
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {formatGrade(card.raw_decimal_grade)}
                </div>
                <div className="text-sm text-gray-600">
                  Raw Score
                </div>
              </div>
            </div>

          </div>

          {/* Card Information */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4">Card Information</h3>
            <div className="space-y-3">
              <div>
                <span className="font-semibold">Name:</span>
                <span className="ml-2">{renderValue(card.card_name)}</span>
              </div>
              <div>
                <span className="font-semibold">Set:</span>
                <span className="ml-2">{renderValue(card.card_set)}</span>
              </div>
              <div>
                <span className="font-semibold">Number:</span>
                <span className="ml-2">{renderValue(card.card_number)}</span>
              </div>
              <div>
                <span className="font-semibold">Category:</span>
                <span className="ml-2">{renderValue(card.category)}</span>
              </div>
              <div>
                <span className="font-semibold">Manufacturer:</span>
                <span className="ml-2">{renderValue(card.manufacturer_name)}</span>
              </div>
              <div>
                <span className="font-semibold">Release Date:</span>
                <span className="ml-2">{renderValue(card.release_date)}</span>
              </div>
              <div>
                <span className="font-semibold">Rarity:</span>
                <span className="ml-2">{renderValue(card.rarity_description)}</span>
              </div>
              {card.estimated_market_value && (
                <div>
                  <span className="font-semibold">Est. Market Value:</span>
                  <span className="ml-2">${renderValue(card.estimated_market_value)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card Text (for MTG and other TCG cards) */}
          {card.category === 'MTG' && card.conversational_card_info?.card_front_text && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Card Text</h3>
              <div className="space-y-3">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {card.conversational_card_info.card_front_text}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h3 className="text-xl font-bold mb-4">Share Card</h3>
            <QRCodeCanvas
              value={`${origin}/card/${card.id}`}
              size={150}
              className="mx-auto"
            />
            <p className="text-sm text-gray-600 mt-2">
              Scan to view this card
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}