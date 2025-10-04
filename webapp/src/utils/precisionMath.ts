/**
 * Precision Math Utilities
 * Handles high-precision calculations for financial operations
 */

/**
 * Calculate percentage with maximum precision using BigInt arithmetic
 * @param numerator The numerator value
 * @param denominator The denominator value
 * @param precisionDigits Number of decimal places for precision (default: 6)
 * @returns The percentage as a number
 */
export function calculatePrecisePercentage(
  numerator: bigint,
  denominator: bigint,
  precisionDigits: number = 6
): number {
  if (denominator === BigInt(0)) {
    return 0;
  }

  // Calculate precision multiplier: 10^precisionDigits
  const precisionMultiplier = BigInt(10 ** precisionDigits);
  
  // Perform high-precision calculation: (numerator * 10^precisionDigits) / denominator
  const resultBigInt = (numerator * precisionMultiplier) / denominator;
  
  // Convert back to decimal
  return Number(resultBigInt) / (10 ** precisionDigits);
}

/**
 * Format percentage with appropriate precision based on the value
 * @param percentage The percentage value
 * @returns Formatted percentage string
 */
export function formatPercentage(percentage: number): string {
  if (percentage >= 1) {
    return `${percentage.toFixed(2)}%`;
  } else if (percentage >= 0.01) {
    return `${percentage.toFixed(4)}%`;
  } else if (percentage >= 0.0001) {
    return `${percentage.toFixed(6)}%`;
  } else {
    return `${percentage.toFixed(8)}%`;
  }
}

/**
 * Safely convert Wei to ETH with high precision
 * @param weiAmount Amount in Wei
 * @param precisionDigits Number of decimal places (default: 18)
 * @returns Amount in ETH as a number
 */
export function weiToEth(weiAmount: bigint, precisionDigits: number = 18): number {
  const divisor = BigInt(10 ** precisionDigits);
  const ethBigInt = weiAmount / divisor;
  const remainder = weiAmount % divisor;
  
  // Calculate decimal part with high precision
  const decimalPart = Number(remainder) / (10 ** precisionDigits);
  
  return Number(ethBigInt) + decimalPart;
}

/**
 * Safely convert ETH to Wei with high precision
 * @param ethAmount Amount in ETH
 * @returns Amount in Wei as BigInt
 */
export function ethToWei(ethAmount: number): bigint {
  // Convert to string to preserve precision
  const ethString = ethAmount.toFixed(18);
  const [integerPart, decimalPart = ''] = ethString.split('.');
  
  // Pad decimal part to 18 digits
  const paddedDecimal = decimalPart.padEnd(18, '0');
  
  // Combine and convert to BigInt
  const weiString = integerPart + paddedDecimal;
  return BigInt(weiString);
}

/**
 * Check if a BigInt value is within safe uint64 range
 * @param value The value to check
 * @returns True if within safe range
 */
export function isWithinUint64Range(value: bigint): boolean {
  const MAX_UINT64 = BigInt('18446744073709551615'); // 2^64 - 1
  return value >= BigInt(0) && value <= MAX_UINT64;
}

/**
 * Safely subtract two BigInt values with underflow protection
 * @param a First value
 * @param b Second value
 * @returns Result of a - b, or 0 if underflow would occur
 */
export function safeSubtract(a: bigint, b: bigint): bigint {
  if (a >= b) {
    return a - b;
  } else {
    console.warn(`Underflow prevented: ${a.toString()} - ${b.toString()}`);
    return BigInt(0);
  }
}

/**
 * Safely add two BigInt values with overflow protection
 * @param a First value
 * @param b Second value
 * @returns Result of a + b, or MAX_UINT64 if overflow would occur
 */
export function safeAdd(a: bigint, b: bigint): bigint {
  const MAX_UINT64 = BigInt('18446744073709551615');
  const result = a + b;
  
  if (result > MAX_UINT64 || result < a) { // Overflow check
    console.warn(`Overflow prevented: ${a.toString()} + ${b.toString()}`);
    return MAX_UINT64;
  }
  
  return result;
}

