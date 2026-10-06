export type PriceType =
  | 'REGULAR'
  | 'PROMOTION'
  | 'LIQUIDATION_FIRST'
  | 'LIQUIDATION_SECOND'
  | 'LIQUIDATION_FINAL'
  | 'UNKNOWN';

export interface Store {
  id: string;
  name: string;
  branch: string;
  city?: string;
  state?: string;
}

export interface PriceEntry {
  id: string;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  priceType: PriceType;
  store: string;
  storeBranch?: string;
  city?: string;
  notes?: string;
  photoProofUrl?: string;
  createdAt: string;
  userId?: string;
  user: string;
  votesCount?: number;
}

export interface ProductDetails {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  createdById?: string;
  createdBy?: {
    id: string;
    username: string;
    name?: string;
  } | null;
  workingVotesCount?: number;
  brokenReportsCount?: number;
  isReportedBroken?: boolean;
}

export interface ProductPriceHistoryResponse {
  product: ProductDetails;
  stats: {
    totalSightings: number;
    currentPrice: number | null;
    lowestPrice: number | null;
    highestPrice: number | null;
    isAtAllTimeLow: boolean;
    workingVotesCount?: number;
    brokenReportsCount?: number;
    isReportedBroken?: boolean;
  };
  history: PriceEntry[];
}

export interface BarcodeLookupResponse {
  exists: boolean;
  barcode: string;
  workingVotesCount?: number;
  brokenReportsCount?: number;
  isReportedBroken?: boolean;
  data?: {
    product: ProductDetails;
    workingVotesCount?: number;
    brokenReportsCount?: number;
    isReportedBroken?: boolean;
    latestPriceEntry: {
      price: number;
      originalPrice?: number | null;
      discountPercent?: number | null;
      store: string;
      createdAt: string;
      daysSinceLastReport: number;
      registeredBy: string;
      notes?: string;
    } | null;
    recentSightingsCount: number;
  };
}

export interface AddPriceEntryPayload {
  barcode: string;
  productName?: string;
  brand?: string;
  category?: string;
  reportedPrice: number;
  originalPrice?: number;
  storeName: string;
  storeBranch: string;
  priceType: PriceType;
  notes?: string;
  stockEstimate?: number;
  photoProofUrl?: string;
  userId: string;
}

export interface PersonalBarcodeItem {
  id: string;
  barcode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  storeName?: string | null;
  storeBranch?: string | null;
  notes?: string | null;
  isPublished: boolean;
  productId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavePersonalBarcodePayload {
  userId: string;
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  originalPrice?: number;
  storeName?: string;
  storeBranch?: string;
  notes?: string;
}

export interface UpdatePersonalBarcodePayload {
  userId: string;
  name?: string;
  brand?: string;
  category?: string;
  price?: number | null;
  originalPrice?: number | null;
  storeName?: string | null;
  storeBranch?: string | null;
  notes?: string | null;
}

