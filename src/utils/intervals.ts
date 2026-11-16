/** Elapsed coverage; overlapping task durations remain separate in logged totals. */
export function coveredDuration(
  intervals: Array<{ start: number; end: number }>,
): number {
  let total = 0;
  let end = -Infinity;
  for (const item of [...intervals].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  )) {
    if (
      !Number.isFinite(item.start) ||
      !Number.isFinite(item.end) ||
      item.end <= item.start
    )
      continue;
    total += Math.max(0, item.end - Math.max(item.start, end));
    end = Math.max(end, item.end);
  }
  return total;
}
