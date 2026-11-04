// Pure local-time parser; safe to import without opening the desk database/profile.
export function untilTime(value: string, now = new Date()): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use --until HH:MM');
  const [h,m]=value.split(':').map(Number);
  const end=new Date(now);end.setHours(h,m,0,0);
  if(end.getTime()<now.getTime())end.setDate(end.getDate()+1);
  return end.getTime();
}
