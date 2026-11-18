// A reversible timeline: dwell/zoom at each chapter, then travel to the next.
export const HOLD=.20, BLOCK=1.20, LAST=4, END=LAST*BLOCK+HOLD;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
// Shift the deceleration upstream, spreading the final approach over more scroll.
export const sectionTravel=x=>smooth(1-Math.pow(1-clamp(x,0,1),1.3));
export function timelineState(position){
 const q=clamp(position,0,END),section=Math.min(LAST,Math.floor((q+1e-9)/BLOCK)),local=Math.max(0,q-section*BLOCK);
 const zoom=smooth(local/HOLD),travel=clamp(local-HOLD,0,1);
 // Zero slope at arrival/departure creates resistance without snapping.
 return {section,progress:Math.min(LAST,section+sectionTravel(travel)),zoom:local<=HOLD?zoom:1-sectionTravel(travel),anchored:local<=HOLD||section===LAST};
}
export function timelineForProgress(progress){
 const p=clamp(progress,0,LAST),i=Math.floor(p),fraction=p-i;
 let lo=0,hi=1;for(let n=0;n<28;n++){const mid=(lo+hi)/2;if(sectionTravel(mid)<fraction)lo=mid;else hi=mid;}
 return i*BLOCK+(fraction>1e-5?HOLD+(lo+hi)/2:0);
}
// Euler XYZ orientation puts a region's outward direction on the camera axis.
export function facingAngles(x,y,z){
 const horizontal=Math.hypot(x,z);
 return [clamp(Math.atan2(y,horizontal),-.105,.105),-Math.atan2(x,z),0];
}
export function rotationStep(yaw,velocity,heading,scrollSpeed,dt){
 const error=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw));
 const activity=smooth(Math.abs(scrollSpeed)/.18);
 // Always turn forward. Catch regions that are behind us too, instead of
 // discarding negative angular errors and leaving them invisible.
 const forward=error>=0?error:Math.PI*2+error;
 const remaining=Math.abs(error)<.35?Math.max(0,error):forward;
 const catchup=Math.min(4.2,remaining*(2.8+Math.min(2,Math.abs(scrollSpeed))));
 const desired=.045+activity*catchup;
 const response=desired>velocity?7:12;
 const speed=Math.max(.035,velocity+(desired-velocity)*(1-Math.exp(-dt*response)));
 return {yaw:yaw+speed*dt,velocity:speed};
}
