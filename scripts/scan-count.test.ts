import {test,expect} from 'vitest';
import {proposalCounter,observingCli} from './scan-count';
test('proposal count excludes existing IDs, duplicate saves and already-assigned results',()=>{
 const counter=proposalCounter(['existing']);
 for(const text of ['Already assigned','Proposal saved: existing','Proposal saved: new','Proposal saved: new','Proposal saved: other'])counter.observe(text);
 expect(counter.count).toBe(2);
});

test('local outline CLI observes successful proposals and excludes failed and unrelated calls',async()=>{
 const counter=proposalCounter(['existing']);
 const cli=observingCli(counter,async args=>{if(args[1]==='failure')throw Error('fake failure');return 'Proposal saved: '+args[1];});
 await cli(['courses','unrelated']);await cli(['propose','existing']);await cli(['propose','new']);await cli(['propose','new']);
 await expect(cli(['propose','failure'])).rejects.toThrow('fake failure');expect(counter.count).toBe(1);
});
