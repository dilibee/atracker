// Local browser verification; uses a fresh context and never the LEARN profile.
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
await mkdir('data/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [name,width,height]of [['desktop',1440,1000],['phone',390,844]] as const){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173/atracker/');
  await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
  await page.getByRole('button',{name:'＋ Add assignment',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Programming assignment');
  const due=new Date(Date.now()+4*86400000).toISOString().slice(0,10)+'T23:59';await page.getByLabel('Due datetime').fill(due);
  await page.getByRole('button',{name:'Save assignment',exact:true}).click();await page.getByRole('heading',{name:'Programming assignment',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Dashboard',exact:true}).click();
  await page.getByRole('heading',{name:'Programming assignment',exact:true}).first().waitFor();
  await page.getByRole('checkbox').first().check();await page.reload();await page.getByRole('checkbox').first().waitFor();if(!await page.getByRole('checkbox').first().isChecked())throw new Error('Task completion did not survive reload');
  await page.screenshot({path:`data/screenshots/dashboard-${name}.png`,fullPage:true});
  for(const view of ['Calendar','Admin']){await page.getByRole('button',{name:view,exact:true}).click();await page.getByRole('heading',{name:view,exact:true}).waitFor();await page.screenshot({path:`data/screenshots/${view.toLowerCase()}-${name}.png`,fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error(`${view} overflows at ${width}px`)}
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('atracker.local.v1')!);const sample=structuredClone(Object.values(s.assignments)[0]) as Record<string,unknown>;sample.title='Imported lab';sample.source='learn';s.proposals.sample={assignment:sample,status:'pending',createdAt:new Date().toISOString()};localStorage.setItem('atracker.local.v1',JSON.stringify(s))});
  await page.reload();await page.getByRole('button',{name:'Admin',exact:true}).click();await page.getByRole('button',{name:'Approve',exact:true}).click();await page.getByRole('button',{name:'Assignments',exact:true}).click();await page.getByRole('heading',{name:'Imported lab',exact:true}).waitFor();
  if(errors.length)throw new Error(errors.join('\n'));await context.close();console.log(`${name}: assignment/task persistence, proposal approval, views, no overflow or page errors`);
 }
 const page=await browser.newPage();await page.setContent('<h1>ECE 150</h1><p>Assignment 1 due November 15, 2026</p>');const bytes=await page.pdf();await page.close();
 const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});try{const document=await loading.promise,content=await(await document.getPage(1)).getTextContent();if(!content.items.some(item=>'str' in item&&item.str.includes('Assignment 1')))throw new Error('PDF extraction failed');console.log('PDF text extraction passed')}finally{await loading.destroy()}
}finally{await browser.close()}
