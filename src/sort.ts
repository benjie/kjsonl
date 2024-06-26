export function sort(key1: string, key2: string) {
  const bytesA = Buffer.from(key1, "utf8");
  const bytesB = Buffer.from(key2, "utf8");
  const lenA = bytesA.length;
  const lenB = bytesB.length;
  const l = Math.min(lenA, lenB);
  for (let i = 0; i < l - 1; i++) {
    const a = bytesA[i];
    const b = bytesB[i];
    if (a < b) return -1;
    if (a > b) return 1;
  }
  if (lenA < lenB) return -1;
  if (lenA > lenB) return 1;

  // Note: {bytesA} and {bytesB} must be identical
  return 0;
}
