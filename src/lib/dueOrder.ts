export interface DueItem {
  dueDates: readonly {datetime: string}[];
  status?: string;
  done?: boolean;
}

/** Next upcoming instant, or the latest past deadline. Undated items sort last. */
export function nextDueDate(item: DueItem, now: number): number {
  const dates = item.dueDates.map(d => Date.parse(d.datetime)).filter(Number.isFinite);
  const upcoming = dates.filter(date => date >= now);
  return upcoming.length ? Math.min(...upcoming) : dates.length ? Math.max(...dates) : Infinity;
}

/** Pure comparator: callers supply the clock, including for task/assignment projections. */
export function compareDueDate(a: DueItem, b: DueItem, now: number): number {
  const completed = (item: DueItem) => !!item.done || item.status === 'done' || item.status === 'completed';
  const completionOrder = Number(completed(a)) - Number(completed(b));
  if (completionOrder) return completionOrder;
  const left = nextDueDate(a, now), right = nextDueDate(b, now);
  return left === right ? 0 : left < right ? -1 : 1;
}
