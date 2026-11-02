import {describe,expect,it} from 'vitest';
import {compareDueDate,nextDueDate,type DueItem} from './dueOrder';

const now = Date.parse('2026-11-01T12:00:00Z');
const item = (dates: string[], extra: Partial<DueItem> = {}): DueItem => ({
  dueDates: dates.map(datetime => ({datetime})), ...extra,
});

describe('due date ordering', () => {
  it('uses the next upcoming instant, including now, and ignores past milestones', () => {
    const a = item(['2026-10-01T12:00:00Z','2026-11-05T12:00:00Z','2026-11-03T12:00:00Z']);
    expect(nextDueDate(a,now)).toBe(Date.parse('2026-11-03T12:00:00Z'));
    expect(nextDueDate(item(['2026-11-01T12:00:00Z']),now)).toBe(now);
    expect(compareDueDate(a,item(['2026-11-02T12:00:00Z']),now)).toBeGreaterThan(0);
  });

  it('falls back to the latest past deadline and compares timestamps across offsets', () => {
    expect(nextDueDate(item(['2026-10-31T12:00:00Z','2026-10-01T12:00:00Z']),now))
      .toBe(Date.parse('2026-10-31T12:00:00Z'));
    expect(compareDueDate(item(['2026-11-02T08:00:00-05:00']),item(['2026-11-02T12:00:00Z']),now)).toBeGreaterThan(0);
  });

  it('sorts active items first, then completed items by due date without mutating input', () => {
    const done = item(['2026-10-01'],{status:'done'});
    const checked = item(['2026-10-02'],{done:true});
    const completed = item(['2026-10-03'],{status:'completed'});
    const later = item(['2026-11-05']);
    const earlier = item(['2026-11-02']);
    const source = [done,later,checked,completed,earlier];
    expect([...source].sort((a,b)=>compareDueDate(a,b,now))).toEqual([earlier,later,done,checked,completed]);
    expect(source).toEqual([done,later,checked,completed,earlier]);
  });

  it('puts missing or invalid dates last and preserves ties', () => {
    const missing = item([]), invalid = item(['invalid']);
    expect(compareDueDate(missing,invalid,now)).toBe(0);
    expect(compareDueDate(missing,item(['2026-11-05']),now)).toBeGreaterThan(0);
    expect(compareDueDate(item(['2026-11-05']),item(['2026-11-05']),now)).toBe(0);
  });
});
