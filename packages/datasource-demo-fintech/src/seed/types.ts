// Shared shapes passed between seed builders so that foreign keys and business
// rules stay coherent across tables (e.g. alerts are weighted by customer risk).

export type Row = Record<string, unknown>;

export interface Customer extends Row {
  id: number;
  risk_rating: string;
  is_pep: boolean;
  is_sanctioned: boolean;
  onboarding_status: string;
}

export interface Card extends Row {
  id: number;
  customer_id: number;
}

export interface Refund extends Row {
  id: number;
  customer_id: number;
}
