/**
 * A simple helper for splitting an array into several sub-arrays of the given size.
 *
 * @param array array to split
 * @param size size of each chink
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}
