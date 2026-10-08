import {documentDate,imageURI} from './common';
import {formCanvas,linesFor,margin as X,contentWidth as W} from './form-layout';

// Wording follows the supplied two-page form. Answers retain their original indexes.
const drivingDeclarations=[
  "The driver's work diary has been completed in accordance with regulations.",
  'If this task takes the driver past the next 24 hours, they will take into account what work time is available according to the scheme that the driver is accredited.',
  "The driver's duties will be completed in accordance with regulations. The driver has taken their required rest breaks and is fit to perform this trip.",
  'Any additional risks associated with driving at night have been taken into account. The driver is familiar with the task and is aware of suitable rest areas.',
  'The driver is appropriately licensed for the load they are about to transport.',
  'The driver is free from drugs and alcohol and their blood alcohol level is zero.',
  'Are there any vehicle faults or concerns with the vehicle? This includes any large cracks on the windscreen that may obscure the driver\'s vision.',
  'Has the vehicle made any strange noises or reached excessive levels of noise, or are there any obvious faults with vehicle lights?',
  'Is there sufficient tread on the tyres?',
  'The above stated vehicle has not and will not be modified in any way as to permit a breach of speed limits, and the driver will not drive in breach of any speed limits.',
  "I am satisfied with the vehicle's condition.",
  'The load will be adequately restrained in all directions in accordance with the NHVAS load restraint guide.',
];
const inspectionQuestions=[
  'Check engine oil level, coolant, windscreen fluid level, and for any fluid or air leaks.',
  'Windscreen wipers / washers operate effectively, ensuring clear forward vision.',
  'Headlights, driving, park and clearance lights.',
  'Indicators, hazards, tail, plate and brake lights.',
  'Wheels / tyres for pressure (visual check), tread integrity and wheel security.',
  'Coupling security, including air hoses and electrical cables.',
  'Check tow couplings and drawbars visually for security and integrity.',
  'All lights, including clearance lights (where applicable), are fitted and operating. All reflectors and lenses are clean and have no cracks or fractures.',
  'Body damage: all panels and readily visible structural members are secure and free from cracks, fluid or air leaks.',
  'Mud flaps and guards (front and rear).',
  'Check windows and mirrors for security, damage and grime.',
  'Check that number plates, rear reflectors and the NHVAS label are secure and unobscured, and the interception book is available in the vehicle.',
  'Fuel tanks.',
  'Brake failure indicators and pressure gauges working; drain air tanks.',
  'All brake system components secure and operational.',
];
const checklistDeclarations=[
  'By signing this declaration, I declare that I hold a valid licence to operate this vehicle, have a current work diary and have completed this daily pre-start inspection to the limits of my ability, and declare the vehicle/s safe to the limits of the inspection.',
  'I also declare I have had sufficient rest to satisfy my needs and can complete the task as allocated without breaching relevant regulations.',
  'I understand the effects and causes of fatigue and declare myself fit for work.',
  'I have conducted a fit-for-duty self-assessment and am not under the influence of drugs or alcohol.',
  'I have complied with the load security requirements as per the Load Restraint Guide.',
  "Is all personal protective equipment (PPE) for today's task on hand, in good condition and fully operational? Report any missing, damaged or out-of-date equipment.",
  "Is all load restraint equipment for today's task on hand, in good condition and fully operational? Report frayed straps or damaged equipment.",
  'I have checked the dimensions and load security and they comply with the legislation.',
];
export function formPages(record){
  const v=record.values,pages=[],extra=[],logo=record.showLogo?imageURI(record.logo):'',company=record.showCompany?record.company.trim():'',operator=company||'the operator';
  const signed=record.status==='Signed'&&record.reviewed&&!!imageURI(record.signature),signature=signed?imageURI(record.signature):'';
  const vehicles=['pm','t1','t2','t3'],vehicleLabels=['Prime mover','Trailer 1','Trailer 2 / Dolly','Trailer 3'];
  const make=(title)=>{const c=formCanvas();if(logo)c.image(logo,X,20,64,46);const start=logo?X+78:X,width=W-(start-X);
    if(company)c.paragraph(start,34,company,width,12,true,14);
    c.text(start,65,title,15,true);c.line(X,74,X+W,74);if(!signed)c.text(X+W,18,'UNSIGNED DRAFT',7.5,true,'end');return c;};
  const field=(c,x,y,w,h,label,value)=>{
    if(linesFor(value,w-10,10).length>Math.floor((h-14)/11)){extra.push(label+': '+String(value));c.field(x,y,w,h,label,'See continuation');}
    else c.field(x,y,w,h,label,value||'');
  };
  const weekday=(d)=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?new Date(d+'T12:00:00Z').toLocaleDateString('en-AU',{timeZone:'UTC',weekday:'long'}):'';
  const finish=(c,label)=>{pages.push({c,label});};
  const sign=(c,y)=>{
    c.paragraph(X,y,'I declare that, to the best of my knowledge, the information provided above is complete and correct.',W,8.4,true,10.1);
    y+=17;field(c,X,y,180,42,'Driver name',signed?record.signedName:'');c.rect(X+180,y,245,42);c.text(X+185,y+10,'Signature',7.7,true);c.image(signature,X+190,y+13,225,26,true);field(c,X+425,y,W-425,42,'Date',signed?documentDate(v.date):'');return y+42;
  };
  let c=make('Safe Driving Plan - Driving Declaration');
  const half=W/2;
  [['Trip start location',v.from,'Trip destination',v.to],['Driver name',v.driver,'Driver contact',v.contact],['Licence number',v.licence,'Expiry date',documentDate(v.expiry)]].forEach(([a,b,d,e],i)=>{field(c,X,82+i*32,half,32,a,b);field(c,X+half,82+i*32,half,32,d,e);});
  const vehiclesY=184,vehicleW=W/4;
  vehicles.forEach((key,i)=>field(c,X+i*vehicleW,vehiclesY,vehicleW,28,vehicleLabels[i],v[key]));
  c.rect(X,218,W,14,'#eeeeee');c.text(X+5,228,'Weighbridge declaration - recorded vehicle / trailer weights',8.3,true);
  ['steer','drive','1','2','3'].forEach((k,i)=>field(c,X+i*W/5,232,W/5,27,i<2?(i===0?'Steer':'Drive'):'Group '+k,v['weight-'+k]));
  field(c,X,265,half,27,'Driving hours scheme',v.scheme);field(c,X+half,265,half,27,'Accreditation number',v.accreditation);
  field(c,X,298,half,27,'Vehicle type',v['vehicle-type']);field(c,X+half,298,half,27,'LH manifest number',v.manifest);
  c.rect(X,331,W,27);c.paragraph(X+5,342,'Driver-declared work hours available in the next 24 hours under the applicable fatigue accreditation scheme:',W-116,8.5,false,10);c.line(X+W-108,331,X+W-108,358);c.text(X+W-101,349,v.hours||'',10);
  [['Departure',v.date,v.depart],['Estimated arrival',(v.arrive||'').slice(0,10),(v.arrive||'').slice(11,16)]].forEach(([label,date,time],i)=>{
    const y=364+i*20;c.rect(X,y,W,20);c.line(X+100,y,X+100,y+20);c.line(X+200,y,X+200,y+20);c.line(X+350,y,X+350,y+20);c.text(X+5,y+13,label,8.5,true);c.text(X+106,y+13,'Time: '+(time||''),9);c.text(X+206,y+13,weekday(date),9);c.text(X+356,y+13,'Date: '+documentDate(date),9);
  });
  let y=412;y+=c.paragraph(X,y,'The arrival time is an estimate and is not binding on the driver. Any delays affecting the ETA will be notified to '+operator+'.',W,8.3,false,10)+6;
  const questions=[...drivingDeclarations,'I will report unscheduled rest, mechanical failures, hazards and incidents affecting this journey to '+operator+'.'];
  const head=()=>{c.rect(X,y,W,17,'#eeeeee');c.text(X+5,y+12,'Driver declaration',9,true);c.text(X+W-23,y+12,'Yes / No',8,true,'middle');c.line(X+W-46,y,X+W-46,y+17);y+=17;};head();
  questions.forEach((question,i)=>{
    const lines=linesFor(question,W-56,9),h=Math.max(17,lines.length*10.8+4);
    if(y+h>742){finish(c,'Safe driving plan');c=make('Driving Declaration - continued');y=84;head();}
    c.rect(X,y,W,h);c.line(X+W-46,y,X+W-46,y+h);lines.forEach((line,j)=>c.text(X+5,y+10.2+j*10.8,line,9));c.text(X+W-23,y+h/2+3,record.declarations[i]||'',9.5,false,'middle');y+=h;
  });
  y+=12;const returnLines=linesFor('Please return this completed document to '+operator+' as soon as practical after this journey.',W,8.3);
  if(y+returnLines.length*10+67>816){finish(c,'Safe driving plan');c=make('Driving Declaration - signature');y=86;}
  y+=c.paragraph(X,y,'Please return this completed document to '+operator+' as soon as practical after this journey.',W,8.3,false,10)+7;sign(c,y);finish(c,'Safe driving plan');

  c=make('Vehicle Daily Checklist');
  field(c,X,82,W*.55,30,"Driver's name",v.driver);field(c,X+W*.55,82,W*.45,30,'Date / time',documentDate(v.date)+' '+(v.depart||''));
  field(c,X,112,W*.55,30,'Location',v.from);c.rect(X+W*.55,112,W*.45,30);c.text(X+W*.55+5,122,'Driver signature',7.7,true);c.image(signature,X+W*.55+70,115,W*.45-80,23,true);
  vehicles.forEach((key,i)=>field(c,X+i*vehicleW,148,vehicleW,28,vehicleLabels[i],v[key]));
  y=185;const questionW=W-4*36,colW=36;
  const tableHead=(title)=>{c.rect(X,y,W,28,'#eeeeee');c.text(X+5,y+12,title,9,true);c.text(X+5,y+23,'✓ OK     X Not OK     N/A Not applicable',7.8);
    vehicles.forEach((_,i)=>{const cx=X+questionW+i*colW;c.line(cx,y,cx,y+28);c.text(cx+colW/2,y+11,i===0?'Prime':'Trailer',7.5,true,'middle');c.text(cx+colW/2,y+22,i===0?'mover':i===2?'2 / Dolly':String(i),7.5,true,'middle');});y+=28;};tableHead('Pre-trip inspection');
  const row=(question,answers)=>{const lines=linesFor(question,questionW-10,9),h=Math.max(17,lines.length*10.8+4);
    if(y+h>712){finish(c,'Vehicle daily checklist');c=make('Vehicle Daily Checklist - continued');y=84;tableHead('Continued');}
    c.rect(X,y,W,h);lines.forEach((line,j)=>c.text(X+5,y+10.2+j*10.8,line,9));vehicles.forEach((key,i)=>{const cx=X+questionW+i*colW;c.line(cx,y,cx,y+h);if(v[key]?.trim())c.text(cx+colW/2,y+h/2+3,answers[key]||'',10,false,'middle');});y+=h;
  };
  inspectionQuestions.forEach((question,i)=>row(question,Object.fromEntries(vehicles.map(k=>[k,{ok:'✓',issue:'X',na:'N/A'}[record.checks[k]?.[i]]||'']))));
  c.rect(X,y,W,20);c.text(X+5,y+13,'Odometer',9,true);c.line(X+questionW,y,X+questionW,y+20);c.text(X+questionW+5,y+13,v.odo||'',10);y+=20;
  checklistDeclarations.forEach((question,i)=>row(question,Object.fromEntries(vehicles.map(k=>[k,record.declarations[i+13]==='Yes'?'✓':record.declarations[i+13]==='No'?'X':'']))));
  const commentLines=linesFor(v.comments||'',W-10,9);
  if(y+29>736){finish(c,'Vehicle daily checklist');c=make('Vehicle Daily Checklist - comments');y=84;}
  const room=Math.max(0,Math.floor((736-y-19)/11));
  const used=commentLines.slice(0,Math.max(1,room)),more=commentLines.slice(Math.max(1,room));
  const commentsH=Math.max(29,Math.min(736-y,17+used.length*11));c.rect(X,y,W,commentsH);c.text(X+5,y+11,'Comments / faults and action taken',8.5,true);used.forEach((line,i)=>c.text(X+5,y+23+i*11,line,9));y+=commentsH;
  if(more.length){extra.push('Comments continued:',...more);c.text(X+W,y+10,'Comments continue on the attached page.',7.5,false,'end');}
  sign(c,Math.max(y+18,752));finish(c,'Vehicle daily checklist');
  const continuation=extra.flatMap(line=>linesFor(line,W,10));
  for(let i=0;i<continuation.length;i+=48){const a=make('Form details - continuation');a.text(X,89,(v.driver||'')+' - '+documentDate(v.date),9,true);continuation.slice(i,i+48).forEach((line,j)=>a.text(X,112+j*14,line,10));finish(a,'Form details continued');}
  return pages.map(({c,label},i)=>{c.text(X,830,documentDate(v.date)+(v.base?' - '+v.base+' base time':''),7);c.text(X+W,830,`${i+1} / ${pages.length}`,7,false,'end');return c.finish(label+(signed?' - signed':' - unsigned draft'));});
}
