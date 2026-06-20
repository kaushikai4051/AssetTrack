export const ASSET_TYPES = {
  FIXED_DEPOSIT: 'fixed_deposit',
  RECURRING_DEPOSIT: 'recurring_deposit',
  SAVINGS_ACCOUNT: 'savings_account',
  MUTUAL_FUND: 'mutual_fund',
  STOCK: 'stock',
  GOLD: 'gold',
  CORPORATE_BOND: 'corporate_bond',
  GSEC_BOND: 'gsec_bond',
  TAX_FREE_BOND: 'tax_free_bond',
  PPF: 'ppf',
  NPS: 'nps',
  EPF: 'epf',
  SSY: 'ssy',
  NSC: 'nsc',
  SCSS: 'scss',
  KVP: 'kvp',
  POST_OFFICE: 'post_office',
  LIFE_INSURANCE: 'life_insurance',
  HEALTH_INSURANCE: 'health_insurance',
  VEHICLE_INSURANCE: 'vehicle_insurance',
  PROPERTY: 'property',
  REIT: 'reit',
  HOME_LOAN: 'home_loan',
  CAR_LOAN: 'car_loan',
  PERSONAL_LOAN: 'personal_loan',
  EDUCATION_LOAN: 'education_loan',
  CRYPTO: 'crypto',
  CHIT_FUND: 'chit_fund',
  P2P_LENDING: 'p2p_lending',
  ANGEL_INVESTMENT: 'angel_investment',
}

export const ASSET_CATEGORY_LABELS = {
  bank_accounts: 'Bank Accounts',
  mutual_funds: 'Mutual Funds',
  stocks: 'Stocks',
  gold: 'Gold',
  bonds: 'Bonds',
  govt_schemes: 'Govt Schemes',
  insurance: 'Insurance',
  real_estate: 'Real Estate',
  loans: 'Loans',
  alternatives: 'Alternatives',
}

export const FINANCIAL_YEARS = [
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
  '2020-21',
]

export const RISK_CATEGORIES = [
  { value: 'low', label: 'Low' },
  { value: 'moderate_low', label: 'Moderately Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'moderately_high', label: 'Moderately High' },
  { value: 'high', label: 'High' },
  { value: 'very_high', label: 'Very High' },
]

export const EXCHANGES = ['NSE', 'BSE', 'NYSE', 'NASDAQ']

export const INSURANCE_TYPES = [
  { value: 'term', label: 'Term Plan' },
  { value: 'endowment', label: 'Endowment' },
  { value: 'money_back', label: 'Money Back' },
  { value: 'ulip', label: 'ULIP' },
  { value: 'lic_other', label: 'LIC Other' },
  { value: 'health_individual', label: 'Health — Individual' },
  { value: 'health_floater', label: 'Health — Floater' },
  { value: 'health_super_topup', label: 'Health — Super Top-up' },
  { value: 'vehicle_third_party', label: 'Vehicle — Third Party' },
  { value: 'vehicle_comprehensive', label: 'Vehicle — Comprehensive' },
  { value: 'critical_illness', label: 'Critical Illness' },
  { value: 'accident', label: 'Accident' },
]
