/**
 * Safely format a value as a fixed-point number string.
 * Handles strings, null, undefined, and non-numeric values.
 * 
 * @param value - The value to format
 * @param digits - Number of decimal places (default: 2)
 * @returns Formatted string with fixed decimal places
 */
export function safeFixed(value: unknown, digits: number = 2): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return (isNaN(num) ? 0 : num).toFixed(digits);
}

/**
 * Safely format a currency value with $ prefix.
 * 
 * @param value - The value to format
 * @param digits - Number of decimal places (default: 2)
 * @returns Formatted currency string (e.g., "$12.34")
 */
export function formatCurrency(value: unknown, digits: number = 2): string {
  return `$${safeFixed(value, digits)}`;
}
