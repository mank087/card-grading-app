/**
 * eBay Policy Creation API
 *
 * Creates fulfillment, payment, and return policies for eBay sellers.
 *
 * POST /api/ebay/policies/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { EBAY_API_URLS, MARKETPLACES } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface CreatePoliciesRequest {
  // Shipping options
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  flatRateAmount?: number;
  handlingDays: number;

  // Return options
  returnsAccepted: boolean;
  returnPeriodDays?: number; // 14, 30, 60
  returnShippingPaidBy?: 'BUYER' | 'SELLER';
}

interface PolicyResult {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

/**
 * Parse eBay API error responses to extract meaningful error messages
 */
function parseEbayError(errorText: string, status: number): string {
  try {
    const errorJson = JSON.parse(errorText);

    // Handle array of errors
    if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
      const firstError = errorJson.errors[0];
      // Try longMessage first, then message, then errorId
      const message = firstError.longMessage ||
                      firstError.message ||
                      `Error ${firstError.errorId || status}`;

      // If there are additional parameter details, include them
      if (firstError.parameters && firstError.parameters.length > 0) {
        const params = firstError.parameters
          .map((p: any) => `${p.name}: ${p.value}`)
          .join(', ');
        return `${message} (${params})`;
      }

      return message;
    }

    // Handle single error object
    if (errorJson.error) {
      return errorJson.error.message || errorJson.error.description || `Error ${status}`;
    }

    // Handle error_description (OAuth style)
    if (errorJson.error_description) {
      return errorJson.error_description;
    }

    return `Status ${status}: ${errorText.substring(0, 150)}`;
  } catch {
    // If not JSON, return the raw text (truncated)
    if (errorText && errorText.length > 0) {
      return `Status ${status}: ${errorText.substring(0, 150)}`;
    }
    return `HTTP ${status} error`;
  }
}

async function ebayRequest(
  endpoint: string,
  method: string,
  accessToken: string,
  body: object,
  sandbox: boolean = true
): Promise<Response> {
  const baseUrl = sandbox
    ? EBAY_API_URLS.sandbox.api
    : EBAY_API_URLS.production.api;

  const url = `${baseUrl}${endpoint}`;

  return fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify(body),
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get eBay connection
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected' },
        { status: 400 }
      );
    }

    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization' },
        { status: 401 }
      );
    }

    const body: CreatePoliciesRequest = await request.json();
    const {
      shippingType = 'FREE',
      flatRateAmount = 5.00,
      handlingDays = 1,
      returnsAccepted = true,
      returnPeriodDays = 30,
      returnShippingPaidBy = 'BUYER',
    } = body;

    const results: Partial<PolicyResult> = {};
    const errors: string[] = [];

    // 1. Create Fulfillment (Shipping) Policy
    // Structure based on eBay API documentation
    const shippingCost = shippingType === 'FREE' ? '0.00' :
                         shippingType === 'FLAT_RATE' ? flatRateAmount.toFixed(2) : '5.00';

    const fulfillmentPolicy: any = {
      name: `DCM Shipping ${Date.now()}`,
      marketplaceId: MARKETPLACES.US,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      handlingTime: {
        value: handlingDays,
        unit: 'DAY',
      },
      shippingOptions: [
        {
          optionType: 'DOMESTIC',
          costType: 'FLAT_RATE',
          shippingServices: [
            {
              sortOrder: 1,
              shippingCarrierCode: 'USPS',
              shippingServiceCode: 'USPSPriority',
              shippingCost: {
                currency: 'USD',
                value: shippingCost,
              },
              freeShipping: shippingType === 'FREE',
            },
          ],
        },
      ],
    };

    console.log('[eBay Policies] Creating fulfillment policy:', JSON.stringify(fulfillmentPolicy, null, 2));
    const fulfillmentResponse = await ebayRequest(
      '/sell/account/v1/fulfillment_policy',
      'POST',
      connection.access_token,
      fulfillmentPolicy,
      connection.is_sandbox
    );

    if (fulfillmentResponse.ok) {
      const data = await fulfillmentResponse.json();
      results.fulfillmentPolicyId = data.fulfillmentPolicyId;
      console.log('[eBay Policies] Fulfillment policy created:', data.fulfillmentPolicyId);
    } else {
      const errorText = await fulfillmentResponse.text();
      console.error('[eBay Policies] Fulfillment policy error (status ' + fulfillmentResponse.status + '):', errorText);
      errors.push(`Shipping: ${parseEbayError(errorText, fulfillmentResponse.status)}`);
    }

    // 2. Create Payment Policy (simplified for eBay Managed Payments)
    // For eBay Managed Payments, paymentMethods is optional
    const paymentPolicy = {
      name: `DCM Payment ${Date.now()}`,
      marketplaceId: MARKETPLACES.US,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      immediatePay: false,
    };

    console.log('[eBay Policies] Creating payment policy:', JSON.stringify(paymentPolicy, null, 2));
    const paymentResponse = await ebayRequest(
      '/sell/account/v1/payment_policy',
      'POST',
      connection.access_token,
      paymentPolicy,
      connection.is_sandbox
    );

    if (paymentResponse.ok) {
      const data = await paymentResponse.json();
      results.paymentPolicyId = data.paymentPolicyId;
      console.log('[eBay Policies] Payment policy created:', data.paymentPolicyId);
    } else {
      const errorText = await paymentResponse.text();
      console.error('[eBay Policies] Payment policy error (status ' + paymentResponse.status + '):', errorText);
      errors.push(`Payment: ${parseEbayError(errorText, paymentResponse.status)}`);
    }

    // 3. Create Return Policy
    const returnPolicy: any = {
      name: `DCM Returns ${Date.now()}`,
      marketplaceId: MARKETPLACES.US,
      categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }],
      returnsAccepted: returnsAccepted,
    };

    // Only add return details if returns are accepted
    if (returnsAccepted) {
      returnPolicy.returnPeriod = {
        value: returnPeriodDays,
        unit: 'DAY',
      };
      returnPolicy.returnShippingCostPayer = returnShippingPaidBy;
      returnPolicy.refundMethod = 'MONEY_BACK';
    } else {
      // For no returns, we still need to set a description
      returnPolicy.description = 'This item is not eligible for return.';
    }

    console.log('[eBay Policies] Creating return policy:', JSON.stringify(returnPolicy, null, 2));
    const returnResponse = await ebayRequest(
      '/sell/account/v1/return_policy',
      'POST',
      connection.access_token,
      returnPolicy,
      connection.is_sandbox
    );

    if (returnResponse.ok) {
      const data = await returnResponse.json();
      results.returnPolicyId = data.returnPolicyId;
      console.log('[eBay Policies] Return policy created:', data.returnPolicyId);
    } else {
      const errorText = await returnResponse.text();
      console.error('[eBay Policies] Return policy error (status ' + returnResponse.status + '):', errorText);
      errors.push(`Returns: ${parseEbayError(errorText, returnResponse.status)}`);
    }

    // Check if we created all policies
    if (results.fulfillmentPolicyId && results.paymentPolicyId && results.returnPolicyId) {
      return NextResponse.json({
        success: true,
        ...results,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to create some policies',
        details: errors,
        partial: results,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('[eBay Policies] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
