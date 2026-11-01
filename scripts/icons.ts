import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{const svg=await readFile('public/icon.svg','utf8');await mkdir('public',{recursive:true});for(const size of [180,192,512]){const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{width:100%;height:100%;display:block}</style>${svg}`);await page.screenshot({path:`public/${size===180?'apple-touch-icon':`icon-${size}`}.png`});await page.close()}}finally{await browser.close()}
