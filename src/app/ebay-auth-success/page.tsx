'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * eBay Auth Success Content
 *
 * Separated component that uses useSearchParams, wrapped by Suspense in the parent.
 */
function EbayAuthSuccessContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get('ebay_connected') === 'true';
  const username = searchParams.get('ebay_username');
  const error = searchParams.get('ebay_error');
  const message = searchParams.get('message');

  useEffect(() => {
    // Signal the parent window that auth is complete
    if (window.opener) {
      try {
        // Post message to parent window
        window.opener.postMessage(
          {
            type: 'EBAY_AUTH_COMPLETE',
            success: connected && !error,
            username: username,
            error: error,
            message: message,
          },
          window.location.origin
        );
      } catch (e) {
        console.error('Failed to post message to parent:', e);
      }

      // Close the popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      // If not in a popup, redirect to the card listing page
      setTimeout(() => {
        window.location.href = '/collection';
      }, 2000);
    }
  }, [connected, username, error, message]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
      {connected && !error ? (
        <>
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">eBay Connected!</h1>
          <p className="text-gray-600 mb-4">
            {username ? `Connected as ${username}` : 'Your eBay account has been connected.'}
          </p>
          <p className="text-sm text-gray-500">This window will close automatically...</p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h1>
          <p className="text-gray-600 mb-4">{message || 'Failed to connect your eBay account.'}</p>
          <p className="text-sm text-gray-500">This window will close automatically...</p>
        </>
      )}
    </div>
  );
}

/**
 * Loading fallback for Suspense
 */
function LoadingFallback() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Processing...</h1>
      <p className="text-gray-600 mb-4">Completing eBay authorization...</p>
    </div>
  );
}

/**
 * eBay Auth Success Page
 *
 * This page is shown in the popup after successful eBay OAuth.
 * It signals the parent window and closes itself.
 */
export default function EbayAuthSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<LoadingFallback />}>
        <EbayAuthSuccessContent />
      </Suspense>
    </div>
  );
}
