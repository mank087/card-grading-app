import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { reportStyles } from './ReportStyles';

/**
 * Card Grading Report PDF Component
 * Generates a professional PDF report for card grading results
 */

export interface ReportCardData {
  // Unified Label Data (matches card detail page exactly)
  primaryName: string;        // Line 1: Card/Player name (cleaned, no "Unknown...")
  contextLine: string;        // Line 2: Set • #Number • Year (pre-formatted, unknowns filtered)
  featuresLine: string | null; // Line 3: RC • Auto • /99 (null if none)
  serial: string;             // Line 4: DCM serial number
  grade: number;              // Numeric grade
  gradeFormatted: string;     // Display format (7 or 7.5)
  condition: string;          // Condition label (Near Mint, Excellent, etc.)

  // Legacy fields (kept for backward compatibility with other report sections)
  cardName: string;
  playerName: string;
  setName: string;
  year: string;
  manufacturer: string;
  cardNumber: string;
  sport: string;
  frontImageUrl: string;
  backImageUrl: string;
  conditionLabel: string;
  labelCondition: string;
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
    isFoil?: boolean;
    foilType?: string;
    isDoubleFaced?: boolean;
    rarity?: string;
  };
  aiConfidence: string;
  imageQuality: string;
  generatedDate: string;
  reportId: string;
  cardDetails: string;          // DEPRECATED - use contextLine
  specialFeaturesString: string; // DEPRECATED - use featuresLine
  cardUrl: string;
  qrCodeDataUrl?: string;
  overallSummary?: string;
}

interface CardGradingReportProps {
  cardData: ReportCardData;
}

interface BatchCardGradingReportProps {
  cardDataArray: ReportCardData[];
}

/**
 * Format grade score - v6.0: Always whole numbers, no decimals
 */
const formatScore = (score: number): string => {
  // v6.0: Always return whole number (no .5 scores)
  return Math.round(score).toString();
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

/**
 * Default subgrade structure to prevent null access errors
 */
const defaultSubgrade = {
  score: 0,
  summary: 'No data available',
  frontScore: 0,
  backScore: 0,
  frontSummary: 'No data available',
  backSummary: 'No data available',
};

const defaultSubgrades = {
  centering: defaultSubgrade,
  corners: defaultSubgrade,
  edges: defaultSubgrade,
  surface: defaultSubgrade,
};

/**
 * Safely get subgrades with defaults to prevent null access errors
 */
const getSafeSubgrades = (cardData: ReportCardData) => {
  if (!cardData.subgrades) {
    return defaultSubgrades;
  }
  return {
    centering: { ...defaultSubgrade, ...cardData.subgrades.centering },
    corners: { ...defaultSubgrade, ...cardData.subgrades.corners },
    edges: { ...defaultSubgrade, ...cardData.subgrades.edges },
    surface: { ...defaultSubgrade, ...cardData.subgrades.surface },
  };
};

export const CardGradingReport: React.FC<CardGradingReportProps> = ({ cardData }) => {
  // Get safe subgrades with defaults
  const subgrades = getSafeSubgrades(cardData);

  return (
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

          {/* Slab Container - Purple border wrapping label + separator + card image */}
          <View style={reportStyles.slabOuterContainer}>
            <View style={reportStyles.slabInnerContainer}>
              {/* Front Label - Unified 4-Line Structure (matches card detail page) */}
              <View style={reportStyles.cardLabelContainer}>
                <View style={reportStyles.cardLabelRow}>
                  <View style={reportStyles.cardLabelLeft}>
                    <Image src="/DCM-logo.png" style={reportStyles.cardLabelLogo} />
                  </View>
                  <View style={reportStyles.cardLabelCenter}>
                    {/* Line 1: Primary Name (cleaned, no "Unknown...") */}
                    <Text style={reportStyles.cardLabelPlayerName}>
                      {truncateText(cardData.primaryName, PDF_LIMITS.PLAYER_NAME)}
                    </Text>
                    {/* Line 2: Context Line (Set • #Number • Year - pre-filtered) */}
                    {cardData.contextLine && (
                      <Text style={reportStyles.cardLabelDetails}>
                        {truncateText(cardData.contextLine, PDF_LIMITS.CARD_DETAILS)}
                      </Text>
                    )}
                    {/* Line 3: Features Line (RC • Auto • /99) - Only if present */}
                    {cardData.featuresLine && (
                      <Text style={reportStyles.cardLabelFeatures}>
                        {truncateText(cardData.featuresLine, PDF_LIMITS.SPECIAL_FEATURES)}
                      </Text>
                    )}
                    {/* Line 4: DCM Serial Number */}
                    <Text style={reportStyles.cardLabelSerial}>
                      {cardData.serial}
                    </Text>
                  </View>
                  <View style={reportStyles.cardLabelRight}>
                    <Text style={reportStyles.cardLabelGrade}>
                      {cardData.gradeFormatted}
                    </Text>
                    <View style={reportStyles.cardLabelDivider} />
                    <Text style={reportStyles.cardLabelConfidence}>
                      {cardData.condition}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Purple Separator - matches slab divider on web */}
              <View style={reportStyles.slabSeparator} />

              {/* Front Image */}
              <Image src={cardData.frontImageUrl} style={reportStyles.cardImage} />
            </View>
          </View>

          {/* Front Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Front Subgrades</Text>

            {/* Front Centering */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.centering.frontScore || subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.centering.frontSummary || subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Corners */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.corners.frontScore || subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.corners.frontSummary || subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Edges */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.edges.frontScore || subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.edges.frontSummary || subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Front Surface */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.surface.frontScore || subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.surface.frontSummary || subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Column: BACK */}
        <View style={reportStyles.columnHalf}>
          <Text style={reportStyles.columnHeader}>BACK</Text>

          {/* Slab Container - Purple border wrapping label + separator + card image */}
          <View style={reportStyles.slabOuterContainer}>
            <View style={reportStyles.slabInnerContainer}>
              {/* Back Label - QR Code Centered OR Unified Label */}
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
                      {/* Line 1: Primary Name (cleaned, no "Unknown...") */}
                      <Text style={reportStyles.cardLabelPlayerName}>
                        {truncateText(cardData.primaryName, PDF_LIMITS.PLAYER_NAME)}
                      </Text>
                      {/* Line 2: Context Line (Set • #Number • Year - pre-filtered) */}
                      {cardData.contextLine && (
                        <Text style={reportStyles.cardLabelDetails}>
                          {truncateText(cardData.contextLine, PDF_LIMITS.CARD_DETAILS)}
                        </Text>
                      )}
                      {/* Line 3: Features Line (RC • Auto • /99) - Only if present */}
                      {cardData.featuresLine && (
                        <Text style={reportStyles.cardLabelFeatures}>
                          {truncateText(cardData.featuresLine, PDF_LIMITS.SPECIAL_FEATURES)}
                        </Text>
                      )}
                      {/* Line 4: DCM Serial Number */}
                      <Text style={reportStyles.cardLabelSerial}>
                        {cardData.serial}
                      </Text>
                    </View>
                    <View style={reportStyles.cardLabelRight}>
                      <Text style={reportStyles.cardLabelGrade}>
                        {cardData.gradeFormatted}
                      </Text>
                      <View style={reportStyles.cardLabelDivider} />
                      <Text style={reportStyles.cardLabelConfidence}>
                        {cardData.condition}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Purple Separator - matches slab divider on web */}
              <View style={reportStyles.slabSeparator} />

              {/* Back Image */}
              <Image src={cardData.backImageUrl} style={reportStyles.cardImage} />
            </View>
          </View>

          {/* Back Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Back Subgrades</Text>

            {/* Back Centering */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.centering.backScore || subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.centering.backSummary || subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Corners */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.corners.backScore || subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.corners.backSummary || subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Edges */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.edges.backScore || subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.edges.backSummary || subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>

            {/* Back Surface */}
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.surface.backScore || subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.surface.backSummary || subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
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
          {cardData.gradeFormatted}
        </Text>

        {/* Condition Label */}
        <Text style={reportStyles.conditionLabel}>
          {cardData.condition}
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
};

/**
 * Helper component that renders just the page content (without Document wrapper)
 * Used for batch report generation
 */
const CardGradingReportPage: React.FC<{ cardData: ReportCardData }> = ({ cardData }) => {
  // Get safe subgrades with defaults
  const subgrades = getSafeSubgrades(cardData);

  return (
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

          {/* Slab Container - Purple border wrapping label + separator + card image */}
          <View style={reportStyles.slabOuterContainer}>
            <View style={reportStyles.slabInnerContainer}>
              {/* Front Label - Unified 4-Line Structure */}
              <View style={reportStyles.cardLabelContainer}>
                <View style={reportStyles.cardLabelRow}>
                  <View style={reportStyles.cardLabelLeft}>
                    <Image src="/DCM-logo.png" style={reportStyles.cardLabelLogo} />
                  </View>
                  <View style={reportStyles.cardLabelCenter}>
                    <Text style={reportStyles.cardLabelPlayerName}>
                      {truncateText(cardData.primaryName, PDF_LIMITS.PLAYER_NAME)}
                    </Text>
                    {cardData.contextLine && (
                      <Text style={reportStyles.cardLabelDetails}>
                        {truncateText(cardData.contextLine, PDF_LIMITS.CARD_DETAILS)}
                      </Text>
                    )}
                    {cardData.featuresLine && (
                      <Text style={reportStyles.cardLabelFeatures}>
                        {truncateText(cardData.featuresLine, PDF_LIMITS.SPECIAL_FEATURES)}
                      </Text>
                    )}
                    <Text style={reportStyles.cardLabelSerial}>
                      {cardData.serial}
                    </Text>
                  </View>
                  <View style={reportStyles.cardLabelRight}>
                    <Text style={reportStyles.cardLabelGrade}>
                      {cardData.gradeFormatted}
                    </Text>
                    <View style={reportStyles.cardLabelDivider} />
                    <Text style={reportStyles.cardLabelConfidence}>
                      {cardData.condition}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={reportStyles.slabSeparator} />
              <Image src={cardData.frontImageUrl} style={reportStyles.cardImage} />
            </View>
          </View>

          {/* Front Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Front Subgrades</Text>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.centering.frontScore || subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.centering.frontSummary || subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.corners.frontScore || subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.corners.frontSummary || subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.edges.frontScore || subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.edges.frontSummary || subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.surface.frontScore || subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.surface.frontSummary || subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Column: BACK */}
        <View style={reportStyles.columnHalf}>
          <Text style={reportStyles.columnHeader}>BACK</Text>

          <View style={reportStyles.slabOuterContainer}>
            <View style={reportStyles.slabInnerContainer}>
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
                      <Text style={reportStyles.cardLabelPlayerName}>
                        {truncateText(cardData.primaryName, PDF_LIMITS.PLAYER_NAME)}
                      </Text>
                      {cardData.contextLine && (
                        <Text style={reportStyles.cardLabelDetails}>
                          {truncateText(cardData.contextLine, PDF_LIMITS.CARD_DETAILS)}
                        </Text>
                      )}
                      {cardData.featuresLine && (
                        <Text style={reportStyles.cardLabelFeatures}>
                          {truncateText(cardData.featuresLine, PDF_LIMITS.SPECIAL_FEATURES)}
                        </Text>
                      )}
                      <Text style={reportStyles.cardLabelSerial}>
                        {cardData.serial}
                      </Text>
                    </View>
                    <View style={reportStyles.cardLabelRight}>
                      <Text style={reportStyles.cardLabelGrade}>
                        {cardData.gradeFormatted}
                      </Text>
                      <View style={reportStyles.cardLabelDivider} />
                      <Text style={reportStyles.cardLabelConfidence}>
                        {cardData.condition}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={reportStyles.slabSeparator} />
              <Image src={cardData.backImageUrl} style={reportStyles.cardImage} />
            </View>
          </View>

          {/* Back Subgrades */}
          <View style={reportStyles.subgradesSection}>
            <Text style={reportStyles.sectionTitle}>Back Subgrades</Text>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Centering</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.centering.backScore || subgrades.centering.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.centering.backSummary || subgrades.centering.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Corners</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.corners.backScore || subgrades.corners.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.corners.backSummary || subgrades.corners.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Edges</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.edges.backScore || subgrades.edges.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.edges.backSummary || subgrades.edges.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
              </Text>
            </View>
            <View style={reportStyles.subgradeItem}>
              <View style={reportStyles.subgradeHeader}>
                <Text style={reportStyles.subgradeTitle}>Surface</Text>
                <Text style={reportStyles.subgradeScore}>
                  {formatScore(subgrades.surface.backScore || subgrades.surface.score)}/10
                </Text>
              </View>
              <Text style={reportStyles.subgradeSummary}>
                {truncateText(subgrades.surface.backSummary || subgrades.surface.summary, PDF_LIMITS.SUBGRADE_SUMMARY)}
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

      {/* Grade Box */}
      <View style={reportStyles.gradeBox}>
        <Text style={reportStyles.gradeNumber}>
          {cardData.gradeFormatted}
        </Text>
        <Text style={reportStyles.conditionLabel}>
          {cardData.condition}
        </Text>
        <View style={reportStyles.gradeBadgesRow}>
          <Text style={reportStyles.gradeBadge}>
            Uncertainty: {(() => {
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
  );
};

/**
 * Batch Card Grading Report - renders multiple cards in a single PDF
 * Each card gets its own page
 */
export const BatchCardGradingReport: React.FC<BatchCardGradingReportProps> = ({ cardDataArray }) => {
  return (
    <Document>
      {cardDataArray.map((cardData, index) => (
        <CardGradingReportPage key={index} cardData={cardData} />
      ))}
    </Document>
  );
};
