/**
 * eBay Media API Helper
 *
 * Handles document uploads for regulatory compliance documents
 * such as Certificate of Analysis (grading reports).
 */

import { EBAY_API_URLS } from './constants';

// Media API endpoints
// Note: Uses api.ebay.com, not apim.ebay.com
const MEDIA_API_ENDPOINTS = {
  production: 'https://api.ebay.com/commerce/media/v1',
  sandbox: 'https://api.sandbox.ebay.com/commerce/media/v1',
};

export type DocumentType =
  | 'CERTIFICATE_OF_ANALYSIS'
  | 'CERTIFICATE_OF_CONFORMITY'
  | 'DECLARATION_OF_CONFORMITY'
  | 'INSTRUCTIONS_FOR_USE'
  | 'OTHER_SAFETY_DOCUMENTS'
  | 'SAFETY_DATA_SHEET'
  | 'TROUBLE_SHOOTING_GUIDE'
  | 'USER_GUIDE_OR_MANUAL'
  | 'INSTALLATION_INSTRUCTIONS'
  | 'ACCESSIBILITY_INFORMATION';

export interface CreateDocumentRequest {
  documentType: DocumentType;
  languages: string[]; // e.g., ['en']
}

export interface DocumentResponse {
  documentId: string;
  documentType: string;
  documentStatus: 'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'ACCEPTED' | 'FAILED';
  languages: string[];
}

export interface UploadDocumentResult {
  success: boolean;
  documentId?: string;
  documentStatus?: string;
  error?: string;
}

/**
 * Create a document resource in eBay's Media API
 */
export async function createDocument(
  accessToken: string,
  documentType: DocumentType,
  languages: string[] = ['en'],
  sandbox: boolean = false
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const endpoint = sandbox
    ? MEDIA_API_ENDPOINTS.sandbox
    : MEDIA_API_ENDPOINTS.production;

  try {
    const response = await fetch(`${endpoint}/document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        documentType,
        languages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Media API] createDocument failed:', response.status, errorText);
      // Parse error for better messaging
      let errorDetail = '';
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.errors?.[0]?.message || errorJson.message || '';
      } catch {
        errorDetail = errorText.substring(0, 200);
      }
      return {
        success: false,
        error: `Failed to create document: ${response.status}${errorDetail ? ' - ' + errorDetail : ''}`,
      };
    }

    const data: DocumentResponse = await response.json();
    console.log('[Media API] Document created:', data.documentId, 'Status:', data.documentStatus);

    return {
      success: true,
      documentId: data.documentId,
    };
  } catch (error) {
    console.error('[Media API] createDocument error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload a document file to eBay's Media API
 */
export async function uploadDocument(
  accessToken: string,
  documentId: string,
  fileBlob: Blob,
  fileName: string,
  sandbox: boolean = false
): Promise<UploadDocumentResult> {
  const endpoint = sandbox
    ? MEDIA_API_ENDPOINTS.sandbox
    : MEDIA_API_ENDPOINTS.production;

  try {
    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('file', fileBlob, fileName);

    const response = await fetch(`${endpoint}/document/${documentId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // Don't set Content-Type - let the browser set it with boundary for multipart
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Media API] uploadDocument failed:', response.status, errorText);
      return {
        success: false,
        error: `Failed to upload document: ${response.status}`,
      };
    }

    const data: DocumentResponse = await response.json();
    console.log('[Media API] Document uploaded:', data.documentId, 'Status:', data.documentStatus);

    return {
      success: true,
      documentId: data.documentId,
      documentStatus: data.documentStatus,
    };
  } catch (error) {
    console.error('[Media API] uploadDocument error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get document status from eBay's Media API
 */
export async function getDocument(
  accessToken: string,
  documentId: string,
  sandbox: boolean = false
): Promise<{ success: boolean; document?: DocumentResponse; error?: string }> {
  const endpoint = sandbox
    ? MEDIA_API_ENDPOINTS.sandbox
    : MEDIA_API_ENDPOINTS.production;

  try {
    const response = await fetch(`${endpoint}/document/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Media API] getDocument failed:', response.status, errorText);
      return {
        success: false,
        error: `Failed to get document: ${response.status}`,
      };
    }

    const data: DocumentResponse = await response.json();
    return {
      success: true,
      document: data,
    };
  } catch (error) {
    console.error('[Media API] getDocument error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wait for a document to be processed and accepted
 * Polls the document status until it's ACCEPTED or fails
 */
export async function waitForDocumentAccepted(
  accessToken: string,
  documentId: string,
  sandbox: boolean = false,
  maxAttempts: number = 10,
  delayMs: number = 1000
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getDocument(accessToken, documentId, sandbox);

    if (!result.success || !result.document) {
      return { success: false, error: result.error || 'Failed to get document status' };
    }

    const status = result.document.documentStatus;

    if (status === 'ACCEPTED') {
      console.log('[Media API] Document accepted:', documentId);
      return { success: true };
    }

    if (status === 'FAILED') {
      console.error('[Media API] Document processing failed:', documentId);
      return { success: false, error: 'Document processing failed' };
    }

    // Still processing, wait and retry
    console.log('[Media API] Document status:', status, '- waiting...');
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return { success: false, error: 'Timeout waiting for document to be accepted' };
}

/**
 * Upload a grading report as a Certificate of Analysis
 * This is a convenience function that handles the full flow:
 * 1. Create document resource
 * 2. Upload the PDF file
 * 3. Wait for acceptance
 */
export async function uploadGradingReport(
  accessToken: string,
  reportBlob: Blob,
  fileName: string,
  sandbox: boolean = false
): Promise<UploadDocumentResult> {
  // Step 1: Create document resource
  const createResult = await createDocument(
    accessToken,
    'CERTIFICATE_OF_ANALYSIS',
    ['en'],
    sandbox
  );

  if (!createResult.success || !createResult.documentId) {
    return {
      success: false,
      error: createResult.error || 'Failed to create document resource',
    };
  }

  const documentId = createResult.documentId;

  // Step 2: Upload the PDF file
  const uploadResult = await uploadDocument(
    accessToken,
    documentId,
    reportBlob,
    fileName,
    sandbox
  );

  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error || 'Failed to upload document',
    };
  }

  // Step 3: Wait for the document to be accepted
  const acceptResult = await waitForDocumentAccepted(
    accessToken,
    documentId,
    sandbox,
    15, // More attempts for PDF processing
    2000 // 2 second delay between checks
  );

  if (!acceptResult.success) {
    // Document uploaded but not yet accepted - still return the ID
    // The listing can still be created, eBay may accept it later
    console.warn('[Media API] Document not yet accepted, but continuing:', documentId);
    return {
      success: true,
      documentId,
      documentStatus: 'PROCESSING',
    };
  }

  return {
    success: true,
    documentId,
    documentStatus: 'ACCEPTED',
  };
}
