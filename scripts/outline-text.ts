// Text extraction only: uploaded markup is never executed and cannot fetch resources.
export async function htmlOutlineText(html:string):Promise<string>{
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',bull:'•',copy:'©'};
 return html.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'').replace(/<[^>]*>/g,'\n').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(match,key:string)=>{
 if(key[0]!=='#')return entities[key.toLowerCase()]??match;
 const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return code>0&&code<=0x10ffff?String.fromCodePoint(code):'�';
 }).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
}
