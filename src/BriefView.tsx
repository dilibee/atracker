import type {Brief} from './lib/types';
// Plain text only: no HTML or markdown from automation is executed.
export function BriefView({briefs}:{briefs:Record<string,Brief>}){
 const rows=Object.entries(briefs).sort(([a,x],[b,y])=>y.date.localeCompare(x.date)||b.localeCompare(a));
 return <section className="brief-list">{!rows.length&&<p>No briefs yet.</p>}{rows.map(([id,b])=><article className="panel" key={id}><h2>{b.title} · {b.date}</h2><p>{b.summary}</p><div className="brief-body">{b.body.split(/(https?:\/\/[^\s|]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>:part)}</div></article>)}</section>;
}
