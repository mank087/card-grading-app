'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  const [status, setStatus] = useState<'loading' | 'confirm' | 'success' | 'error' | 'already'>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (error === 'invalid') {
      setStatus('error');
      setErrorMessage('Invalid unsubscribe link.');
    } else if (token) {
      setStatus('confirm');
    } else {
      setStatus('error');
      setErrorMessage('No unsubscribe token provided.');
    }
  }, [token, error]);

  const handleUnsubscribe = async () => {
    if (!token) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/unsubscribe/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unsubscribe');
      }

      if (data.alreadyUnsubscribed) {
        setStatus('already');
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Loading State */}
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          )}

          {/* Confirm State */}
          {status === 'confirm' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
              <p className="text-gray-600 mb-6">
                Are you sure you want to unsubscribe from DCM marketing emails?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                You will still receive important account-related emails (password resets, purchase confirmations, etc.)
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleUnsubscribe}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Yes, Unsubscribe Me'}
                </button>
                <Link
                  href="/"
                  className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 text-center transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
              <p className="text-gray-600 mb-6">
                You have been successfully unsubscribed from marketing emails.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Changed your mind? You can re-enable marketing emails in your account settings.
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Return to DCM Grading
              </Link>
            </div>
          )}

          {/* Already Unsubscribed State */}
          {status === 'already' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Unsubscribed</h1>
              <p className="text-gray-600 mb-6">
                You are already unsubscribed from marketing emails.
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Return to DCM Grading
              </Link>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
              <p className="text-gray-600 mb-6">
                {errorMessage || 'Something went wrong. Please try again.'}
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Return to DCM Grading
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Questions? Contact us at{' '}
          <a href="mailto:admin@dcmgrading.com" className="text-purple-600 hover:underline">
            admin@dcmgrading.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
