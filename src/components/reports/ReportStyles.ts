import { StyleSheet, Font } from '@react-pdf/renderer';

/**
 * PDF Report Styles for Card Grading Report
 * Using react-pdf/renderer StyleSheet API
 */

export const reportStyles = StyleSheet.create({
  // Page layout - compact for single page fit
  page: {
    padding: 14,  // Reduced from 16 to compensate for larger fonts
    fontSize: 9,  // Increased from 8
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // Header section with logo on right - Reduced for single page fit
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,  // Reduced from 6 to compensate
    paddingBottom: 3,  // Reduced from 4 to compensate
    borderBottomWidth: 2,
    borderBottomColor: '#6b46c1',
    borderBottomStyle: 'solid',
  },

  headerLeft: {
    flex: 1,
  },

  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },

  logo: {
    width: 60,
    height: 'auto',
  },

  companyName: {
    fontSize: 18,  // Increased from 16
    fontWeight: 'bold',
    color: '#6b46c1',
    marginBottom: 2,
  },

  reportTitle: {
    fontSize: 15,  // Increased from 14
    fontWeight: 'bold',
    color: '#2d3748',
  },

  // Professional label (PSA-style) above card images
  cardLabelContainer: {
    marginBottom: 4,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderStyle: 'solid',
    padding: 4,
    height: 45, // Fixed height for consistency
  },

  cardLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardLabelLeft: {
    width: 25,
  },

  cardLabelLogo: {
    width: 20,
    height: 'auto',
  },

  cardLabelCenter: {
    flex: 1,
    paddingHorizontal: 6,
  },

  cardLabelPlayerName: {
    fontSize: 10,  // Increased from 9
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 1,
  },

  cardLabelDetails: {
    fontSize: 8,  // Increased from 7
    color: '#4b5563',
    marginBottom: 1,
  },

  cardLabelFeatures: {
    fontSize: 7,
    color: '#2563eb', // Blue-600
    fontWeight: 'bold',
    marginBottom: 1,
  },

  cardLabelSerial: {
    fontSize: 7,  // Increased from 6
    color: '#6b7280',
    fontFamily: 'Courier',
  },

  cardLabelRight: {
    width: 25,
    alignItems: 'center',
  },

  cardLabelGrade: {
    fontSize: 15,  // Increased from 14
    fontWeight: 'bold',
    color: '#7c3aed',
  },

  cardLabelDivider: {
    width: 15,
    height: 1,
    backgroundColor: '#7c3aed',
    marginVertical: 1,
  },

  cardLabelConfidence: {
    fontSize: 11,  // Increased from 10
    fontWeight: 'bold',
    color: '#7c3aed',
  },

  // QR Code for back label
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },

  qrCodeImage: {
    width: 35,
    height: 35,
  },

  // Card images section
  imagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },

  imageBox: {
    width: '48%',
  },

  cardImage: {
    width: '100%',
    height: 190,  // Reduced from 200 to compensate for larger fonts
    objectFit: 'contain',
  },

  // Grade box (purple gradient box matching detail page) - Reduced height for single page fit
  gradeBox: {
    backgroundColor: '#6366f1', // Indigo base (simulating gradient)
    padding: 5,  // Reduced from 6 to compensate
    marginBottom: 5,  // Reduced from 6 to compensate
    textAlign: 'center',
  },

  gradeNumber: {
    fontSize: 26,  // Increased from 24
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },

  conditionLabel: {
    fontSize: 9,  // Increased from 8
    fontWeight: 'normal',
    color: '#ffffff',
    marginBottom: 2,  // Reduced from 3 to compensate
  },

  gradeBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 0,
  },

  gradeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7,  // Increased from 6
    color: '#ffffff',
  },

  professionalGradesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderTopStyle: 'solid',
  },

  professionalGradeItem: {
    alignItems: 'center',
  },

  professionalGradeLabel: {
    fontSize: 6,  // Increased from 5
    color: '#e9d5ff',
    marginBottom: 1,
  },

  professionalGradeValue: {
    fontSize: 10,  // Increased from 9
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Two-column layout for front/back
  twoColumnContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,  // Reduced from 8 to compensate
  },

  columnHalf: {
    width: '48%',
  },

  columnHeader: {
    fontSize: 11,  // Increased from 10
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#6366f1',
    padding: 4,
    textAlign: 'center',
    marginBottom: 3,  // Reduced from 4 to compensate
  },

  // Subgrades section - compact, reduced for single page fit
  subgradesSection: {
    marginBottom: 4,  // Reduced from 5 to compensate
  },

  sectionTitle: {
    fontSize: 9,  // Increased from 8
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
  },

  subgradeItem: {
    marginBottom: 2,  // Reduced from 3 to compensate
    padding: 3,
    backgroundColor: '#f7fafc',
    borderLeftWidth: 2,
    borderLeftColor: '#6b46c1',
    borderLeftStyle: 'solid',
    minHeight: 24,
  },

  subgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },

  subgradeTitle: {
    fontSize: 9,  // Increased from 8
    fontWeight: 'bold',
    color: '#2d3748',
  },

  subgradeScore: {
    fontSize: 10,  // Increased from 9
    fontWeight: 'bold',
    color: '#6b46c1',
  },

  subgradeSummary: {
    fontSize: 7,  // Increased from 6
    color: '#4a5568',
    lineHeight: 1.4,
  },

  // AI Confidence section - compact, reduced for single page fit
  confidenceSection: {
    marginBottom: 3,  // Reduced from 4 to compensate
    padding: 4,
    backgroundColor: '#edf2f7',
  },

  confidenceTitle: {
    fontSize: 8,  // Increased from 7
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
  },

  confidenceText: {
    fontSize: 6,  // Increased from 5
    color: '#4a5568',
    marginBottom: 0,
  },

  // Overall Card Condition Summary section - Reduced for single page fit
  overallSummarySection: {
    marginBottom: 4,  // Reduced from 5 to compensate
    padding: 4,  // Reduced from 5 to compensate
    backgroundColor: '#eef2ff', // Light indigo/purple background
    borderWidth: 1,
    borderColor: '#c7d2fe', // Indigo border
    borderStyle: 'solid',
    borderRadius: 4,
  },

  overallSummaryTitle: {
    fontSize: 9,  // Increased from 8
    fontWeight: 'bold',
    color: '#3730a3', // Indigo-800
    marginBottom: 2,
  },

  overallSummaryText: {
    fontSize: 7,  // Increased from 6
    color: '#1e293b', // Slate-800
    lineHeight: 1.4,
  },

  // Professional Grades Comparison section - Reduced for single page fit
  professionalGradesSection: {
    marginBottom: 3,  // Reduced from 4 to compensate
    padding: 4,
    backgroundColor: '#edf2f7',
  },

  professionalGradesSectionTitle: {
    fontSize: 8,  // Increased from 7
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
  },

  professionalGradesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  professionalGradeBox: {
    alignItems: 'center',
  },

  professionalGradeBoxLabel: {
    fontSize: 7,  // Increased from 6
    color: '#4a5568',
    marginBottom: 2,
  },

  professionalGradeBoxValue: {
    fontSize: 11,  // Increased from 10
    fontWeight: 'bold',
    color: '#2d3748',
  },

  // Footer - compact, reduced for single page fit
  footer: {
    marginTop: 3,  // Reduced from 4 to compensate
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e0',
    borderTopStyle: 'solid',
    textAlign: 'center',
  },

  reportMeta: {
    fontSize: 6,  // Increased from 5
    color: '#4a5568',  // Darker gray (was #718096)
    marginTop: 1,
  },

  disclaimer: {
    fontSize: 5,  // Increased from 4
    color: '#6b7280',  // Darker gray (was #a0aec0)
    fontStyle: 'italic',
    marginTop: 2,
  },

  callToAction: {
    fontSize: 7,  // Increased from 6
    fontWeight: 'bold',
    color: '#6b46c1',  // Purple to match brand
    textAlign: 'center',
    marginTop: 3,  // Reduced from 4 to compensate
  },

  // Side-by-side layout helper
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },

  column: {
    width: '48%',
  },
});
