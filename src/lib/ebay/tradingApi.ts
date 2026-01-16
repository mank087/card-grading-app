/**
 * eBay Trading API Helper
 *
 * Uses the Trading API (XML-based) for creating listings.
 * This allows inline shipping/payment/return details without
 * creating permanent business policies on the seller's account.
 */

import { EBAY_API_URLS } from './constants';

// Trading API endpoints
const TRADING_API_ENDPOINTS = {
  production: 'https://api.ebay.com/ws/api.dll',
  sandbox: 'https://api.sandbox.ebay.com/ws/api.dll',
};

// eBay site IDs
const EBAY_SITE_ID = {
  US: '0',
  UK: '3',
  DE: '77',
  AU: '15',
  CA: '2',
};

// Common domestic shipping services
export const DOMESTIC_SHIPPING_SERVICES = [
  { value: 'USPSPriority', label: 'USPS Priority Mail' },
  { value: 'USPSFirstClass', label: 'USPS First Class' },
  { value: 'USPSPriorityMailExpress', label: 'USPS Priority Mail Express' },
  { value: 'UPSGround', label: 'UPS Ground' },
  { value: 'UPS3rdDay', label: 'UPS 3 Day Select' },
  { value: 'UPS2ndDay', label: 'UPS 2nd Day Air' },
  { value: 'UPSNextDay', label: 'UPS Next Day Air' },
  { value: 'FedExHomeDelivery', label: 'FedEx Home Delivery' },
  { value: 'FedExGround', label: 'FedEx Ground' },
  { value: 'FedEx2Day', label: 'FedEx 2Day' },
];

// Common international shipping services
export const INTERNATIONAL_SHIPPING_SERVICES = [
  { value: 'USPSPriorityMailInternational', label: 'USPS Priority Mail International' },
  { value: 'USPSFirstClassMailInternational', label: 'USPS First Class Mail International' },
  { value: 'USPSPriorityMailExpressInternational', label: 'USPS Priority Mail Express International' },
  { value: 'UPSWorldWideExpedited', label: 'UPS Worldwide Expedited' },
  { value: 'UPSWorldWideExpress', label: 'UPS Worldwide Express' },
  { value: 'FedExInternationalEconomy', label: 'FedEx International Economy' },
  { value: 'FedExInternationalPriority', label: 'FedEx International Priority' },
];

// eBay Global Shipping Program location
export const GSP_SHIP_TO_LOCATIONS = ['Worldwide'];

export interface TradingApiConfig {
  accessToken: string;
  sandbox: boolean;
  siteId?: string;
}

export interface PackageDimensions {
  weightOz: number; // Weight in ounces
  lengthIn: number; // Length in inches
  widthIn: number;  // Width in inches
  depthIn: number;  // Depth in inches
}

export interface InternationalShippingOption {
  shippingService: string;
  shippingCost?: number; // For flat rate international
  shipToLocations: string[]; // e.g., ['Worldwide', 'CA', 'GB']
}

export interface ShippingDetails {
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  domesticShippingService: string;
  flatRateCost?: number;
  handlingDays: number;
  postalCode: string;
  packageDimensions: PackageDimensions;
  // International shipping
  offerInternational: boolean;
  internationalShippingType?: 'FLAT_RATE' | 'CALCULATED';
  internationalShippingService?: string;
  internationalFlatRateCost?: number;
  internationalShipToLocations?: string[];
}

export interface ReturnDetails {
  // Domestic returns
  domesticReturnsAccepted: boolean;
  domesticReturnPeriodDays?: number;
  domesticReturnShippingPaidBy?: 'BUYER' | 'SELLER';
  // International returns
  internationalReturnsAccepted: boolean;
  internationalReturnPeriodDays?: number;
  internationalReturnShippingPaidBy?: 'BUYER' | 'SELLER';
}

export interface ListingDetails {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  quantity: number;
  conditionId: string;
  conditionDescription?: string;
  imageUrls: string[];
  itemSpecifics: Array<{ name: string; value: string | string[] }>;
  sku: string;
  listingDuration: string;
  bestOfferEnabled?: boolean;
  // Graded card specific
  professionalGrader?: string;
  grade?: string;
  certificationNumber?: string;
  // Regulatory documents (e.g., Certificate of Analysis)
  regulatoryDocumentIds?: string[];
}

export interface AddItemResponse {
  success: boolean;
  itemId?: string;
  listingUrl?: string;
  fees?: Array<{ name: string; amount: number }>;
  errors?: Array<{ code: string; message: string; severity: string }>;
  warnings?: Array<{ code: string; message: string }>;
}

/**
 * Build XML for AddFixedPriceItem call
 */
function buildAddFixedPriceItemXml(
  listing: ListingDetails,
  shipping: ShippingDetails,
  returns: ReturnDetails
): string {
  // Build item specifics XML
  const itemSpecificsXml = listing.itemSpecifics
    .filter(spec => spec.value && (Array.isArray(spec.value) ? spec.value.length > 0 : spec.value.trim()))
    .map(spec => {
      const values = Array.isArray(spec.value) ? spec.value : [spec.value];
      return values.map(v => `
        <NameValueList>
          <Name>${escapeXml(spec.name)}</Name>
          <Value>${escapeXml(v)}</Value>
        </NameValueList>
      `).join('');
    })
    .join('');

  // Build picture URLs XML
  const pictureUrlsXml = listing.imageUrls
    .map(url => `<PictureURL>${escapeXml(url)}</PictureURL>`)
    .join('\n          ');

  // Convert weight from oz to lbs + oz
  const weightLbs = Math.floor(shipping.packageDimensions.weightOz / 16);
  const weightOz = shipping.packageDimensions.weightOz % 16;

  // Build shipping details XML based on type
  let shippingXml = '';
  let shippingPackageXml = '';

  if (shipping.shippingType === 'FREE') {
    shippingXml = `
      <ShippingDetails>
        <ShippingType>Flat</ShippingType>
        <ShippingServiceOptions>
          <ShippingService>${shipping.domesticShippingService}</ShippingService>
          <ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost>
          <FreeShipping>true</FreeShipping>
          <ShippingServicePriority>1</ShippingServicePriority>
        </ShippingServiceOptions>
        ${buildInternationalShippingXml(shipping)}
      </ShippingDetails>`;
  } else if (shipping.shippingType === 'FLAT_RATE') {
    shippingXml = `
      <ShippingDetails>
        <ShippingType>Flat</ShippingType>
        <ShippingServiceOptions>
          <ShippingService>${shipping.domesticShippingService}</ShippingService>
          <ShippingServiceCost currencyID="USD">${(shipping.flatRateCost || 0).toFixed(2)}</ShippingServiceCost>
          <ShippingServicePriority>1</ShippingServicePriority>
        </ShippingServiceOptions>
        ${buildInternationalShippingXml(shipping)}
      </ShippingDetails>`;
  } else {
    // Calculated shipping
    shippingXml = `
      <ShippingDetails>
        <ShippingType>Calculated</ShippingType>
        <ShippingServiceOptions>
          <ShippingService>${shipping.domesticShippingService}</ShippingService>
          <ShippingServicePriority>1</ShippingServicePriority>
        </ShippingServiceOptions>
        ${buildInternationalShippingXml(shipping)}
        <CalculatedShippingRate>
          <OriginatingPostalCode>${escapeXml(shipping.postalCode)}</OriginatingPostalCode>
          <PackagingHandlingCosts currencyID="USD">0.00</PackagingHandlingCosts>
        </CalculatedShippingRate>
      </ShippingDetails>`;

    // Package details needed for calculated shipping
    shippingPackageXml = `
      <ShippingPackageDetails>
        <WeightMajor unit="lbs">${weightLbs}</WeightMajor>
        <WeightMinor unit="oz">${weightOz}</WeightMinor>
        <PackageLength unit="in">${shipping.packageDimensions.lengthIn}</PackageLength>
        <PackageWidth unit="in">${shipping.packageDimensions.widthIn}</PackageWidth>
        <PackageDepth unit="in">${shipping.packageDimensions.depthIn}</PackageDepth>
      </ShippingPackageDetails>`;
  }

  // Build return policy XML with domestic and international options
  const returnPolicyXml = buildReturnPolicyXml(returns);

  // Build best offer XML if enabled
  const bestOfferXml = listing.bestOfferEnabled
    ? `<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>`
    : '';

  // Build condition descriptors for graded cards
  let conditionDescriptorsXml = '';
  if (listing.conditionId === '2750' && listing.professionalGrader && listing.grade) {
    // Log the certification number for debugging
    console.log('[Trading API] Building condition descriptors:', {
      professionalGrader: listing.professionalGrader,
      grade: listing.grade,
      certificationNumber: listing.certificationNumber,
      certNumberType: typeof listing.certificationNumber,
      certNumberTrimmed: listing.certificationNumber?.trim(),
      willIncludeCertNumber: !!listing.certificationNumber?.trim(),
    });

    conditionDescriptorsXml = `
      <ConditionDescriptors>
        <ConditionDescriptor>
          <Name>27501</Name>
          <Value>${escapeXml(listing.professionalGrader)}</Value>
        </ConditionDescriptor>
        <ConditionDescriptor>
          <Name>27502</Name>
          <Value>${escapeXml(listing.grade)}</Value>
        </ConditionDescriptor>
        ${listing.certificationNumber?.trim() ? `
        <ConditionDescriptor>
          <Name>27503</Name>
          <Value>${escapeXml(listing.certificationNumber.trim())}</Value>
        </ConditionDescriptor>` : ''}
      </ConditionDescriptors>`;
  }

  // Build ship to locations for international shipping
  let shipToLocationsXml = '';
  if (shipping.offerInternational && shipping.internationalShipToLocations?.length) {
    shipToLocationsXml = shipping.internationalShipToLocations
      .map(loc => `<ShipToLocation>${escapeXml(loc)}</ShipToLocation>`)
      .join('\n    ');
  }

  // Build regulatory documents XML (Certificate of Analysis, etc.)
  let regulatoryXml = '';
  if (listing.regulatoryDocumentIds?.length) {
    const documentsXml = listing.regulatoryDocumentIds
      .map(docId => `
          <Document>
            <DocumentID>${escapeXml(docId)}</DocumentID>
          </Document>`)
      .join('');
    regulatoryXml = `
      <Regulatory>
        <Documents>${documentsXml}
        </Documents>
      </Regulatory>`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>TOKEN_PLACEHOLDER</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${escapeXml(listing.title)}</Title>
    <Description><![CDATA[${listing.description}]]></Description>
    <PrimaryCategory>
      <CategoryID>${listing.categoryId}</CategoryID>
    </PrimaryCategory>
    <StartPrice currencyID="USD">${listing.price.toFixed(2)}</StartPrice>
    <Quantity>${listing.quantity}</Quantity>
    <ConditionID>${listing.conditionId}</ConditionID>
    ${listing.conditionDescription ? `<ConditionDescription>${escapeXml(listing.conditionDescription)}</ConditionDescription>` : ''}
    ${conditionDescriptorsXml}
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>${shipping.handlingDays}</DispatchTimeMax>
    <ListingDuration>${listing.listingDuration}</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PaymentMethods>PayPal</PaymentMethods>
    <PictureDetails>
      ${pictureUrlsXml}
    </PictureDetails>
    <PostalCode>${escapeXml(shipping.postalCode)}</PostalCode>
    <ItemSpecifics>
      ${itemSpecificsXml}
    </ItemSpecifics>
    <SKU>${escapeXml(listing.sku)}</SKU>
    ${shippingXml}
    ${shippingPackageXml}
    ${returnPolicyXml}
    ${bestOfferXml}
    ${regulatoryXml}
    ${shipToLocationsXml ? `<ShipToLocations>${shipToLocationsXml}</ShipToLocations>` : ''}
  </Item>
</AddFixedPriceItemRequest>`;
}

/**
 * Build international shipping XML section
 */
function buildInternationalShippingXml(shipping: ShippingDetails): string {
  if (!shipping.offerInternational || !shipping.internationalShippingService) {
    return '';
  }

  const intlService = shipping.internationalShippingService;
  const intlLocations = shipping.internationalShipToLocations || ['Worldwide'];

  if (shipping.internationalShippingType === 'FLAT_RATE') {
    return `
        <InternationalShippingServiceOption>
          <ShippingService>${intlService}</ShippingService>
          <ShippingServiceCost currencyID="USD">${(shipping.internationalFlatRateCost || 0).toFixed(2)}</ShippingServiceCost>
          <ShippingServicePriority>1</ShippingServicePriority>
          ${intlLocations.map(loc => `<ShipToLocation>${escapeXml(loc)}</ShipToLocation>`).join('\n          ')}
        </InternationalShippingServiceOption>`;
  } else {
    // Calculated international shipping
    return `
        <InternationalShippingServiceOption>
          <ShippingService>${intlService}</ShippingService>
          <ShippingServicePriority>1</ShippingServicePriority>
          ${intlLocations.map(loc => `<ShipToLocation>${escapeXml(loc)}</ShipToLocation>`).join('\n          ')}
        </InternationalShippingServiceOption>`;
  }
}

/**
 * Build return policy XML with domestic and international options
 */
function buildReturnPolicyXml(returns: ReturnDetails): string {
  // Domestic returns
  let domesticXml = '';
  if (returns.domesticReturnsAccepted) {
    domesticXml = `
        <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
        <ReturnsWithinOption>Days_${returns.domesticReturnPeriodDays || 30}</ReturnsWithinOption>
        <ShippingCostPaidByOption>${returns.domesticReturnShippingPaidBy === 'SELLER' ? 'Seller' : 'Buyer'}</ShippingCostPaidByOption>
        <RefundOption>MoneyBack</RefundOption>`;
  } else {
    domesticXml = `
        <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>`;
  }

  // International returns
  let internationalXml = '';
  if (returns.internationalReturnsAccepted) {
    internationalXml = `
        <InternationalReturnsAcceptedOption>ReturnsAccepted</InternationalReturnsAcceptedOption>
        <InternationalReturnsWithinOption>Days_${returns.internationalReturnPeriodDays || 30}</InternationalReturnsWithinOption>
        <InternationalShippingCostPaidByOption>${returns.internationalReturnShippingPaidBy === 'SELLER' ? 'Seller' : 'Buyer'}</InternationalShippingCostPaidByOption>`;
  } else {
    internationalXml = `
        <InternationalReturnsAcceptedOption>ReturnsNotAccepted</InternationalReturnsAcceptedOption>`;
  }

  return `
      <ReturnPolicy>
        ${domesticXml}
        ${internationalXml}
      </ReturnPolicy>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse XML response from Trading API
 */
function parseAddItemResponse(xmlResponse: string): AddItemResponse {
  // Simple XML parsing using regex (for production, consider using a proper XML parser)
  const getTagValue = (xml: string, tag: string): string | null => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
    return match ? match[1] : null;
  };

  const ack = getTagValue(xmlResponse, 'Ack');
  const success = ack === 'Success' || ack === 'Warning';
  const itemId = getTagValue(xmlResponse, 'ItemID');

  // Parse errors
  const errors: Array<{ code: string; message: string; severity: string }> = [];
  const errorMatches = xmlResponse.matchAll(/<Errors>([\s\S]*?)<\/Errors>/gi);
  for (const match of errorMatches) {
    const errorBlock = match[1];
    const code = getTagValue(errorBlock, 'ErrorCode') || '';
    const message = getTagValue(errorBlock, 'LongMessage') || getTagValue(errorBlock, 'ShortMessage') || '';
    const severity = getTagValue(errorBlock, 'SeverityCode') || 'Error';
    if (severity === 'Error') {
      errors.push({ code, message, severity });
    }
  }

  // Parse warnings
  const warnings: Array<{ code: string; message: string }> = [];
  const warningMatches = xmlResponse.matchAll(/<Errors>([\s\S]*?)<\/Errors>/gi);
  for (const match of warningMatches) {
    const errorBlock = match[1];
    const severity = getTagValue(errorBlock, 'SeverityCode') || '';
    if (severity === 'Warning') {
      const code = getTagValue(errorBlock, 'ErrorCode') || '';
      const message = getTagValue(errorBlock, 'LongMessage') || getTagValue(errorBlock, 'ShortMessage') || '';
      warnings.push({ code, message });
    }
  }

  // Parse fees
  const fees: Array<{ name: string; amount: number }> = [];
  const feeMatches = xmlResponse.matchAll(/<Fee>([\s\S]*?)<\/Fee>/gi);
  for (const match of feeMatches) {
    const feeBlock = match[1];
    const name = getTagValue(feeBlock, 'Name') || '';
    const amountStr = getTagValue(feeBlock, 'Fee') || '0';
    const amount = parseFloat(amountStr);
    if (name && amount > 0) {
      fees.push({ name, amount });
    }
  }

  return {
    success,
    itemId: itemId || undefined,
    listingUrl: itemId ? `https://www.ebay.com/itm/${itemId}` : undefined,
    fees: fees.length > 0 ? fees : undefined,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Make a Trading API call
 */
export async function callTradingApi(
  config: TradingApiConfig,
  callName: string,
  xmlBody: string
): Promise<string> {
  const endpoint = config.sandbox
    ? TRADING_API_ENDPOINTS.sandbox
    : TRADING_API_ENDPOINTS.production;

  const siteId = config.siteId || EBAY_SITE_ID.US;

  // Replace the token placeholder with actual token
  const xmlWithToken = xmlBody.replace('TOKEN_PLACEHOLDER', config.accessToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': siteId,
      'X-EBAY-API-IAF-TOKEN': config.accessToken,
    },
    body: xmlWithToken,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Trading API] HTTP error:', response.status, errorText);
    throw new Error(`Trading API HTTP error: ${response.status}`);
  }

  return response.text();
}

/**
 * Create a fixed price listing using Trading API
 */
export async function addFixedPriceItem(
  config: TradingApiConfig,
  listing: ListingDetails,
  shipping: ShippingDetails,
  returns: ReturnDetails
): Promise<AddItemResponse> {
  const xmlRequest = buildAddFixedPriceItemXml(listing, shipping, returns);

  console.log('[Trading API] AddFixedPriceItem request:', xmlRequest.substring(0, 500) + '...');

  const xmlResponse = await callTradingApi(config, 'AddFixedPriceItem', xmlRequest);

  console.log('[Trading API] AddFixedPriceItem response:', xmlResponse.substring(0, 1000) + '...');

  return parseAddItemResponse(xmlResponse);
}

/**
 * Verify the AddFixedPriceItem call without actually creating the listing
 */
export async function verifyAddItem(
  config: TradingApiConfig,
  listing: ListingDetails,
  shipping: ShippingDetails,
  returns: ReturnDetails
): Promise<AddItemResponse> {
  const xmlRequest = buildAddFixedPriceItemXml(listing, shipping, returns)
    .replace('AddFixedPriceItemRequest', 'VerifyAddFixedPriceItemRequest')
    .replace('</AddFixedPriceItemRequest>', '</VerifyAddFixedPriceItemRequest>');

  const xmlResponse = await callTradingApi(config, 'VerifyAddFixedPriceItem', xmlRequest);

  return parseAddItemResponse(xmlResponse);
}
