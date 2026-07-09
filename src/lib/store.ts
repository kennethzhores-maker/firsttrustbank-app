export interface BankData {
  userName: string;
  accountNumber: string;
  balance: number;
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  adminPin: string;
}

const DEFAULT_DATA: BankData = {
  userName: "Alexander Mitchell",
  accountNumber: "4820 1937 5582 0041",
  balance: 24853.67,
  cardholderName: "ALEXANDER MITCHELL",
  cardNumber: "4532 8901 2345 6789",
  expiryDate: "09/28",
  adminPin: "12345",
};

const STORAGE_KEY = "fintech-demo-data";

export function getBankData(): BankData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_DATA, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_DATA };
}

export function setBankData(data: BankData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("bankdata-update"));
}
