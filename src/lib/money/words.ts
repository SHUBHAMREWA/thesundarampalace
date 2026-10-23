import { roundMoney, type MoneyInput } from "./money";

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Whole number in words using Indian grouping (thousand, lakh, crore). */
export function integerToIndianWords(value: bigint): string {
  if (value === BigInt(0)) return "Zero";
  const parts: string[] = [];
  let n = value;
  const crore = n / BigInt(10_000_000);
  n %= BigInt(10_000_000);
  if (crore > BigInt(0)) parts.push(`${integerToIndianWords(crore)} Crore`);
  const lakh = Number(n / BigInt(100_000));
  n %= BigInt(100_000);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  const thousand = Number(n / BigInt(1000));
  n %= BigInt(1000);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  const rest = Number(n);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/**
 * "Rupees One Lakh Twenty-Five Thousand Only"
 * "Rupees Ten and Fifty Paise Only"
 */
export function amountInWordsINR(value: MoneyInput): string {
  const amount = roundMoney(value);
  if (amount.isNegative()) {
    throw new RangeError("Amount in words is only defined for non-negative amounts");
  }
  const [rupeesPart, paisePart] = amount.toFixed(2).split(".");
  const rupees = BigInt(rupeesPart);
  const paise = Number(paisePart);
  const rupeeWords = integerToIndianWords(rupees);
  if (paise === 0) return `Rupees ${rupeeWords} Only`;
  if (rupees === BigInt(0)) return `${twoDigits(paise)} Paise Only`;
  return `Rupees ${rupeeWords} and ${twoDigits(paise)} Paise Only`;
}
