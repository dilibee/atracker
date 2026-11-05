// Trusted runtime projection; never imported by fixture tests.
import {serverDB,owner} from './server-db';
const db=serverDB(),user_id=owner();
const result:Record<string,unknown[]>={assignments:[],proposals:[]};
for(const collection of Object.keys(result))for(let from=0;;from+=1000){
 const {data,error}=await db.from('atracker_docs').select('id,data').match({user_id,collection}).order('id').range(from,from+999);if(error)throw new Error('Brief inputs unavailable');
 for(const {data:d} of data)if(collection==='assignments'&&d.status==='active')result.assignments.push({course:d.course,title:d.title,dueDates:d.dueDates});else if(collection==='proposals'&&d.status==='pending')result.proposals.push({course:d.assignment?.course,title:d.assignment?.title});
 if(data.length<1000)break;
}
console.log(JSON.stringify(result));
