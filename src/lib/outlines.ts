export const OUTLINE_LIMIT = 20 * 1024 * 1024;
export function outlineContentType(file: {name:string;type:string;size:number}) {
 if(file.size>OUTLINE_LIMIT)throw new Error('File exceeds the 20 MB limit.');
 if(/\.pdf$/i.test(file.name))return 'application/pdf';
 if(/\.html?$/i.test(file.name))return 'text/html';
 if(file.type==='application/pdf'||file.type==='text/html')return file.type;
 throw new Error('Choose a PDF or HTML (.html/.htm) outline.');
}
