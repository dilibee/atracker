import {chromium} from 'playwright';
// Parse in an inert, detached document: uploaded scripts and resources never run.
export async function htmlOutlineText(html:string):Promise<string>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  return await page.evaluate(source=>{
   const doc=new DOMParser().parseFromString(source,'text/html');
   doc.querySelectorAll('script,style,noscript,template').forEach(n=>n.remove());
   doc.querySelectorAll('br,p,div,li,tr,td,th,h1,h2,h3,h4,section,article').forEach(n=>{n.prepend('\n');n.append('\n')});
   return (doc.body.textContent||'').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
  },html);
 }finally{await browser.close()}
}
