import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { reportStyles } from './ReportStyles';

/**
 * Card Grading Report PDF Component
 * Generates a professional PDF report for card grading results
 */

export interface ReportCardData {
  cardName: string;
  playerName: string;
  setName: string;
  year: string;
  manufacturer: string;
  cardNumber: string;
  sport: string;
  frontImageUrl: string;
  backImageUrl: string;
  grade: number;
  conditionLabel: string;
  labelCondition: string; // Condition category for card labels (e.g., "Mint", "Near Mint")
  gradeRange: string;
  professionalGrades: {
    psa: string | number;
    bgs: string | number;
    sgc: string | number;
    cgc: string | number;
  };
  subgrades: {
    centering: {
      score: number;
      summary: string;
      frontScore?: number;
      backScore?: number;
      frontSummary?: string;
      backSummary?: string;
    };
    corners: {
      score: number;
      summary: string;
      frontScore?: number;
      backScore?: number;
      frontSummary?: string;
      backSummary?: string;
    };
    edges: {
      score: number;
      summary: string;
      frontScore?: number;
      backScore?: number;
      frontSummary?: string;
      backSummary?: string;
    };
    surface: {
      score: number;
      summary: string;
      frontScore?: number;
      backScore?: number;
      frontSummary?: string;
      backSummary?: string;
    };
  };
  specialFeatures?: {
    rookie?: boolean;
    autographed?: boolean;
    serialNumbered?: string;
    subset?: string;
    // MTG-specific
    isFoil?: boolean;
    foilType?: string;
    isDoubleFaced?: boolean;
    rarity?: string;
  };
  aiConfidence: string;
  imageQuality: string;
  generatedDate: string;
  reportId: string;
  serial: string;
  cardDetails: string; // Full card details string (subset - set - features - number - year) - DEPRECATED, use separate fields
  specialFeaturesString: string; // Special features (RC • Auto • Serial #)
  cardUrl: string; // URL to the graded card page
  qrCodeDataUrl?: string; // Base64 QR code image for back label
  overallSummary?: string; // 3-4 sentence overall card condition summary
}

interface CardGradingReportProps {
  cardData: ReportCardData;
}

/**
 * Format grade score - only show decimal if it's .5
 */
const formatScore = (score: number): string => {
  if (score % 1 === 0.5) {
    return score.toFixed(1); // Show .5 scores
  }
  return Math.round(score).toString(); // Show whole numbers
};

/**
 * Truncate text to ensure it fits within PDF constraints
 * This prevents content from overflowing to a second page
 */
const truncateText = (text: string | undefined, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Maximum character limits for PDF content to guarantee single-page fit
 * These limits are calibrated for A4 page with current font sizes
 *
 * Subgrade summaries: Increased to 350 chars for more detailed analysis
 * Overall summary: Increased to 500 chars for comprehensive condition description
 */
const PDF_LIMITS = {
  SUBGRADE_SUMMARY: 350,      // Increased from 140 - allows more detailed subgrade analysis
  OVERALL_SUMMARY: 500,       // Increased from 280 - allows comprehensive overall summary
  PLAYER_NAME: 35,            // Max chars for player/card name on label
  CARD_DETAILS: 45,           // Max chars for card details line
  SPECIAL_FEATURES: 30,       // Max chars for special features line
};

export const CardGradingReport: React.FC<CardGradingReportProps> = ({ cardData }) => (
  <Document>
    <Page size="A4" style={reportStyles.page}>
      {/* Header with Logo on Right */}
      <View style={reportStyles.headerContainer}>
        <View style={reportStyles.headerLeft}>
          <Text style={reportStyles.companyName}>Dynamic Collectibles Management</Text>
          <Text style={reportStyles.reportTitle}>Grading Report</Text>
        </View>
        <View style={reportStyles.headerRight}>
          <Image src="/DCM-logo.png" style={reportStyles.logo} />
        </View>
      </View>

      {/* Two-Column Layout: Front and Back */}
      <View style={reportStyles.twoColumnContainer}>
        {/* Left Column: FRONT */}
        <View style={reportStyles.columnHalf}>
          <Text style={reportStyles.columnHeader}>FRONT</Text>

          {/* Front Label - New 4-Line Structure */}
          <View style={reportStyles.cardLabelContainer}>
            <View style={reportStyles.cardLabelRow}>
              <View style={reportStyles.cardLabelLeft}>
                <Image src="/DCM-logo.png" style={reportStyles.cardLabelLogo} />
              </View>
              <View style={reportStyles.cardLabelCenter}>
                {/* Line 1: Player/Card Name */}
                <Text style={reportStyles.cardLabelPlayerName}>
                  {truncateText(cardData.playerName || cardData.cardName, PDF_LIMITS.PLAYER_NAME)}
                </Text>
                {/* Line 2: Set Name • Card # • Year */}
                <Text style={reportStyles.cardLabelDetails}>
                  {truncateText([cardData.setName, cardData.cardNumber, cardData.year].filter(p => p && p !== 'N/A').join(' • '), PDF_LIMITS.CARD_DETAILS)}
                </Text>
                {/* Line 3: Special Features (RC, Auto, Serial #) - Only if present */}
                {cardData.specialFeaturesString && (
                  <Text style={reportStyles.cardLabelFeatures}>
                    {truncateText(cardData.specialFeaturesString, PDF_LIMITS.SPECIAL_FEATURES)}
                  </Text>
                )}
                {/* Line 4: DCM Serial Number */}
                <Text style={reportStyles.cardLabelSerial}>
                  {cardData.serial}
                </Text>
              </View>
              <View style={reportStyles.cardLabelRight}>
                <Text style={reportStyles.cardLabelGrade}>
                  {cardData.grade}
                </Text>
                <View style={reportStyles.cardLabelDivider} />
                <Text style={reportStyles.cardLabelConfidence}>
                  {cardData.labelCondition}
                </Text>
              </View>
            </View>
          </View>

          {/* Front Image */}
          <Image src={cardData.frontImageUrl} style={reportStyles.cardImage} />

          {/* Front Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Front Subgrades</Text>

            {/* Front Centering */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.centering.frontScore || cardData.subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.centering.frontSummary || cardData.subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Corners */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.corners.frontScore || cardData.subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.corners.frontSummary || cardData.subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Edges */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.edges.frontScore || cardData.subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.edges.frontSummary || cardData.subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Surface */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.surface.frontScore || cardData.subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.surface.frontSummary || cardData.subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Column: BACK */}
        <View style={reportStyles.columnHalf}>
          <Text style={reportStyles.columnHeader}>BACK</Text>

          {/* Back Label - QR Code Centered */}
          <View style={reportStyles.cardLabelContainer}>
            {cardData.qrCodeDataUrl ? (
              <View style={reportStyles.qrCodeContainer}>
                <Image src={cardData.qrCodeDataUrl} style={reportStyles.qrCodeImage} />
              </View>
            ) : (
              <View style={reportStyles.cardLabelRow}>
                <View style={reportStyles.cardLabelLeft}>
                  <Image src="/DCM-logo.png" style={reportStyles.cardLabelLogo} />
                </View>
                <View style={reportStyles.cardLabelCenter}>
                  {/* Line 1: Player/Card Name */}
                  <Text style={reportStyles.cardLabelPlayerName}>
                    {truncateText(cardData.playerName || cardData.cardName, PDF_LIMITS.PLAYER_NAME)}
                  </Text>
                  {/* Line 2: Set Name • Card # • Year */}
                  <Text style={reportStyles.cardLabelDetails}>
                    {truncateText([cardData.setName, cardData.cardNumber, cardData.year].filter(p => p && p !== 'N/A').join(' • '), PDF_LIMITS.CARD_DETAILS)}
                  </Text>
                  {/* Line 3: Special Features (RC, Auto, Serial #) - Only if present */}
                  {cardData.specialFeaturesString && (
                    <Text style={reportStyles.cardLabelFeatures}>
                      {truncateText(cardData.specialFeaturesString, PDF_LIMITS.SPECIAL_FEATURES)}
                    </Text>
                  )}
                  {/* Line 4: DCM Serial Number */}
                  <Text style={reportStyles.cardLabelSerial}>
                    {cardData.serial}
                  </Text>
                </View>
                <View style={reportStyles.cardLabelRight}>
                  <Text style={reportStyles.cardLabelGrade}>
                    {cardData.grade}
                  </Text>
                  <View style={reportStyles.cardLabelDivider} />
                  <Text style={reportStyles.cardLabelConfidence}>
                    {cardData.labelCondition}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Back Image */}
          <Image src={cardData.backImageUrl} style={reportStyles.cardImage} />

          {/* Back Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Back Subgrades</Text>

            {/* Back Centering */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.centering.backScore || cardData.subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.centering.backSummary || cardData.subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Corners */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.corners.backScore || cardData.subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.corners.backSummary || cardData.subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Edges */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.edges.backScore || cardData.subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.edges.backSummary || cardData.subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Surface */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(cardData.subgrades.surface.backScore || cardData.subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(cardData.subgrades.surface.backSummary || cardData.subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Overall Card Condition Summary */}
      {cardData.overallSummary && (
        <View style={reportStyles.overallSummarySection}>
          <Text style={reportStyles.overallSummaryTitle}>Overall Card Condition Summary</Text>
          <Text style={reportStyles.overallSummaryText}>
            {truncateText(cardData.overallSummary, PDF_LIMITS.OVERALL_SUMMARY)}
          </Text>
        </View>
      )}

      {/* Grade Box (Purple Gradient Box - Matching Detail Page Style) */}
      <View style={reportStyles.gradeBox}>
        {/* Large Grade Number */}
        <Text style={reportStyles.gradeNumber}>
          {cardData.grade}
        </Text>

        {/* Condition Label */}
        <Text style={reportStyles.conditionLabel}>
          {cardData.conditionLabel}
        </Text>

        {/* Badges Row (Uncertainty & Image Quality) */}
        <View style={reportStyles.gradeBadgesRow}>
          <Text style={reportStyles.gradeBadge}>
            Uncertainty: {(() => {
              // Extract only ± value from format "10.0 ± 0.25" → "± 0.25"
              const parts = cardData.gradeRange.split('±');
              const uncertaintyValue = parts.length > 1 ? parts[1].trim() : '0.5';
              return `± ${uncertaintyValue}`;
            })()}
          </Text>
          <Text style={reportStyles.gradeBadge}>
            Confidence Score: {cardData.aiConfidence}
          </Text>
        </View>
      </View>


      {/* AI Confidence Section */}
      <View style={reportStyles.confidenceSection}>
        <Text style={reportStyles.confidenceTitle}>DCM Optic™ Analysis Confidence Score</Text>
        <Text style={reportStyles.confidenceText}>
          Confidence Level: {cardData.aiConfidence} | Image Quality: {cardData.imageQuality}
        </Text>
      </View>

      {/* Professional Grades Comparison Section */}
      <View style={reportStyles.professionalGradesSection}>
        <Text style={reportStyles.professionalGradesSectionTitle}>Estimated Professional Grading Equivalency</Text>
        <View style={reportStyles.professionalGradesGrid}>
          <View style={reportStyles.professionalGradeBox}>
            <Text style={reportStyles.professionalGradeBoxLabel}>PSA</Text>
            <Text style={reportStyles.professionalGradeBoxValue}>{cardData.professionalGrades.psa}</Text>
          </View>
          <View style={reportStyles.professionalGradeBox}>
            <Text style={reportStyles.professionalGradeBoxLabel}>BGS</Text>
            <Text style={reportStyles.professionalGradeBoxValue}>{cardData.professionalGrades.bgs}</Text>
          </View>
          <View style={reportStyles.professionalGradeBox}>
            <Text style={reportStyles.professionalGradeBoxLabel}>SGC</Text>
            <Text style={reportStyles.professionalGradeBoxValue}>{cardData.professionalGrades.sgc}</Text>
          </View>
          <View style={reportStyles.professionalGradeBox}>
            <Text style={reportStyles.professionalGradeBoxLabel}>CGC</Text>
            <Text style={reportStyles.professionalGradeBoxValue}>{cardData.professionalGrades.cgc}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={reportStyles.footer}>
        <Text style={reportStyles.reportMeta}>
          Generated: {cardData.generatedDate} | Report ID: {cardData.reportId}
        </Text>
        <Text style={reportStyles.disclaimer}>
          DCM Optic™ Report{'\n'}
          Grades provided in this report are estimates based on visual analysis and do not represent an official score from any grading company. Estimated equivalency to PSA, BGS, SGC, or CGC standards is for reference only. Official grading can only be guaranteed through direct submission to those respective companies.
        </Text>
        <Text style={reportStyles.callToAction}>
          Grade your card collection at DCMGrading.com
        </Text>
      </View>
    </Page>
  </Document>
);
