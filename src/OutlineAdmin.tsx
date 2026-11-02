import {useCallback,useEffect,useState} from 'react';
import {outlineContentType} from './lib/outlines';
import {supabase} from './lib/db';
import type {ScanRun} from './lib/types';
export function OutlineAdmin({userId,runs}:{userId?:string;runs:Record<string,ScanRun>}){
 const [files,setFiles]=useState<{name:string;created_at:string|null}[]>([]),[error,setError]=useState(''),[uploading,setUploading]=useState(false),[results,setResults]=useState<{name:string;status:string}[]>([]);
 const load=useCallback(async()=>{
  setFiles([]);if(!supabase||!userId)return;
  try{const all:typeof files=[];for(let offset=0;;offset+=100){const {data,error}=await supabase.storage.from('outlines').list(userId,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;all.push(...data.filter(f=>f.id));if(data.length<100)break}setFiles(all);setError('')}catch(e){setError(e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?String(e.message):String(e))}
 },[userId]);
 useEffect(()=>{void load()},[load]);
 return <div><label>Upload course outlines (PDF or HTML, 20 MB each)<input type="file" multiple disabled={uploading||!userId} accept="application/pdf,text/html,.pdf,.html,.htm" onChange={e=>{
  const selected=Array.from(e.target.files||[]);e.target.value='';if(!selected.length)return;
  setUploading(true);setResults(selected.map(f=>({name:f.name,status:'Waiting'})));
  void (async()=>{for(let i=0;i<selected.length;i++){const file=selected[i];let status='Uploaded';try{
   if(!supabase||!userId)throw new Error('Sign in to upload outlines.');
   const contentType=outlineContentType(file);
   setResults(rs=>rs.map((r,n)=>n===i?{...r,status:'Uploading'}:r));
   const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   const extension=/\.(pdf|html?)$/i.test(name)?'':contentType==='text/html'?'.html':'.pdf';
   const path=`${userId}/${Date.now()}-${crypto.randomUUID()}-${name}${extension}`;
   const {error}=await supabase.storage.from('outlines').upload(path,file,{contentType});if(error)throw error;
  }catch(e){status='Failed: '+(e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?String(e.message):String(e))}setResults(rs=>rs.map((r,n)=>n===i?{...r,status}:r))}await load()})().finally(()=>setUploading(false));
 }}/></label>{!userId&&<p>Sign in to upload and view outlines.</p>}
 {results.length>0&&<div role="status"><p>{uploading?'Uploading…':`${results.filter(r=>r.status==='Uploaded').length} uploaded, ${results.filter(r=>r.status.startsWith('Failed')).length} failed.`}</p><ul>{results.map((r,i)=><li key={i}>{r.name}: {r.status}</li>)}</ul></div>}
 <h3>Uploaded outlines</h3><button className="quiet" onClick={()=>void load()}>Refresh outlines</button>{error&&<p role="alert">{error}</p>}{!files.length&&!error&&<p>No uploaded outlines.</p>}<ul>{files.map(f=><li key={f.name} style={{overflowWrap:'anywhere'}}>{f.name}<br/><small>{f.created_at?new Date(f.created_at).toLocaleString():'Date unavailable'} · {Object.values(runs).some(r=>r.path===`${userId}/${f.name}`&&r.status==='imported')?'Processed':'Not processed'}</small></li>)}</ul>
 </div>;
}

