// Count newly saved proposal IDs only; duplicate and unrelated CLI output is ignored.
export function proposalCounter(existing:Iterable<string>){
 const known=new Set(existing);let count=0;
 return {get count(){return count;},observe(output:string){
  const id=output.trim().match(/^Proposal saved: ([^\r\n]+)$/)?.[1];
  if(id&&!known.has(id)){known.add(id);count++;}
 }};
}

export function observingCli(counter:ReturnType<typeof proposalCounter>,run:(args:string[])=>Promise<string>){
 return async(args:string[])=>{const stdout=await run(args);if(args[0]==='propose')counter.observe(stdout);return stdout;};
}
