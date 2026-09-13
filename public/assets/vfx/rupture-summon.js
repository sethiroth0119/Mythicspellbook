/* Hologram Summon — dependency-free transparent Canvas renderer. */
(function(global){'use strict';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},TAU=Math.PI*2;
const random=n=>{let x=Math.sin(n*127.1+78.2)*43758.5453;return x-Math.floor(x)};
class RuptureSummon {
 constructor(canvas,options={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.color=options.color||'#ff304b';this.duration=4;this.time=0;this.speed=1;this.running=false;this.onComplete=options.onComplete||(()=>{});this.unit=document.createElement('canvas');this.unit.width=360;this.unit.height=480;this.tint=document.createElement('canvas');this.tint.width=360;this.tint.height=480;this.makeDemo();this.rebuildTint();this.makeDust();}
 makeDust(){
 this.dust=document.createElement('canvas');this.dust.width=128;this.dust.height=128;const d=this.dust.getContext('2d');
 for(let i=0;i<65;i++){const a=random(i+1200)*TAU,r=Math.sqrt(random(i+1300))*37,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r,sz=12+random(i+1400)*21;const f=d.createRadialGradient(x-3,y-5,0,x,y,sz);f.addColorStop(0,'rgba(166,151,139,.16)');f.addColorStop(.45,'rgba(112,103,96,.12)');f.addColorStop(1,'rgba(58,53,52,0)');d.fillStyle=f;d.fillRect(x-sz,y-sz,sz*2,sz*2)}
 }
 makeDemo(){let g=this.unit.getContext('2d');g.clearRect(0,0,360,480);const poly=(p,c)=>{g.fillStyle=c;g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.strokeStyle='#718aa4';g.lineWidth=2;g.stroke()};
 poly([[122,180],[74,207],[47,398],[126,365],[180,427],[239,365],[301,399],[274,207],[236,179]],'#152137');
 for(let side of [-1,1]){g.save();if(side===1){g.translate(360,0);g.scale(-1,1)}poly([[129,287],[175,294],[165,372],[143,451],[103,451],[117,365]],'#43546b');poly([[121,365],[153,374],[139,449],[104,449]],'#8796a8');poly([[103,441],[141,441],[147,470],[85,470],[87,457]],'#243148');poly([[114,169],[83,176],[65,218],[105,233],[134,206]],'#9aaabd');poly([[78,222],[110,230],[99,289],[72,311],[56,290]],'#44586f');poly([[61,291],[89,298],[84,331],[62,337],[50,316]],'#a7b4c1');g.restore()}
 poly([[130,169],[180,151],[230,169],[240,225],[217,289],[180,307],[139,289],[121,225]],'#64798e');poly([[130,177],[177,192],[177,266],[143,248]],'#b1c1ce');poly([[184,192],[229,177],[218,248],[184,266]],'#7d93a8');poly([[145,269],[180,281],[215,269],[211,299],[151,299]],'#23354b');poly([[149,104],[180,87],[211,104],[217,142],[200,167],[160,167],[143,142]],'#afc0cd');poly([[144,119],[180,132],[216,119],[210,144],[180,155],[150,144]],'#142b3f');g.fillStyle='#7dfaff';g.fillRect(155,133,50,4);poly([[180,202],[193,219],[180,237],[167,219]],'#a6ffff');g.fillStyle='#54ddeb';g.fillRect(124,383,5,35);g.fillRect(232,383,5,35);
 }
 rebuildTint(){let g=this.tint.getContext('2d');g.clearRect(0,0,360,480);g.globalCompositeOperation='source-over';g.drawImage(this.unit,0,0);g.globalCompositeOperation='source-in';g.fillStyle=this.color;g.fillRect(0,0,360,480);g.globalCompositeOperation='source-over';}
 async setUnit(source){let img;if(typeof source==='string'){img=new Image();if(!source.startsWith('data:')&&!source.startsWith('blob:'))img.crossOrigin='anonymous';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Unit image could not load. Use a local image or a CORS-enabled URL.'));img.src=source})}else{img=source;if(img instanceof HTMLImageElement&&!img.complete)await img.decode()}
 const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(!w||!h)throw new Error('Unit image has no dimensions');const s=Math.min(340/w,465/h),g=this.unit.getContext('2d');g.clearRect(0,0,360,480);g.drawImage(img,(360-w*s)/2,475-h*s,w*s,h*s);this.rebuildTint();this.draw(this.time);return this;}
 setColor(color){if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Use a six-digit hex color');this.color=color;this.rebuildTint();this.draw(this.time);}
 play(){this.pause();this.time=0;this.running=true;let previous=performance.now();const tick=now=>{if(!this.running)return;this.time=Math.min(this.duration,this.time+(now-previous)/1000*this.speed);previous=now;this.draw(this.time);if(this.time>=this.duration){this.running=false;this.onComplete();return}this.raf=requestAnimationFrame(tick)};this.raf=requestAnimationFrame(tick);return this;}
 pause(){this.running=false;cancelAnimationFrame(this.raf);}
 seek(seconds){this.pause();this.time=Math.max(0,Math.min(this.duration,seconds));this.draw(this.time);}
 stop(){this.pause();this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
 destroy(){this.stop();this.onComplete=()=>{};}
 draw(t){t=t*5.6/this.duration;const g=this.ctx,W=this.canvas.width,H=this.canvas.height;g.clearRect(0,0,W,H);g.save();const scale=Math.min(W/1200,H/760);g.translate(W/2,H*.82);g.scale(scale,scale);const shake=(Math.exp(-Math.max(0,t-.95)*5)*(t>.95?1:0)+Math.exp(-Math.max(0,t-3.2)*4)*(t>3.2?1:0))*9;g.translate(Math.sin(t*93)*shake,Math.cos(t*77)*shake*.5);const c=this.color;
 const line=(pts,color,width=1,a=1)=>{g.globalAlpha=clamp(a);g.strokeStyle=color;g.lineWidth=width;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.stroke();g.globalAlpha=1};
 const glow=(x,y,rx,ry,a)=>{if(a<=0)return;g.save();g.translate(x,y);g.scale(1,ry/rx);let f=g.createRadialGradient(0,0,0,0,0,rx);f.addColorStop(0,c);f.addColorStop(1,'transparent');g.globalAlpha=clamp(a);g.fillStyle=f;g.fillRect(-rx,-rx,rx*2,rx*2);g.restore()};
 const ellipse=(r,y,a,width=1,start=0,end=TAU)=>{g.globalAlpha=clamp(a);g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.ellipse(0,y,r,r*.23,0,start,end);g.stroke();g.globalAlpha=1};
 const charge=smooth(t/.65),energy=charge*(1-smooth((t-3.8)/1.05)),beam=smooth((t-.45)/.3)*(1-smooth((t-3.35)/.9)),build=smooth((t-1.05)/2.4),solid=smooth((t-3.35)/.9);
 // A procedural fracture decal stays behind after the arrival.
 const rupture=Math.max(0,t-.92),spread=smooth(rupture/.5);
 if(rupture>0){g.save();g.globalCompositeOperation='source-over';g.fillStyle='#070609';g.globalAlpha=.8*spread;g.beginPath();g.ellipse(0,5,180*spread,43*spread,0,0,TAU);g.fill();
 for(let i=0;i<19;i++){let a=i*TAU/19,pts=[[Math.cos(a)*60,Math.sin(a)*15]],r=60;for(let k=1;k<6;k++){r+=(24+random(i*9+k)*28)*spread;let angle=a+(random(i*19+k)-.5)*.27;pts.push([Math.cos(angle)*r,Math.sin(angle)*r*.27])}line(pts,'#080609',7,spread);line(pts,c,1.4,spread*(.2+.6*Math.exp(-rupture*.7)));let p=pts[3];line([p,[p[0]+Math.cos(a+.7)*47*spread,p[1]+Math.sin(a+.7)*15*spread]],c,.8,spread*.5)}g.restore();}
 g.globalCompositeOperation='lighter';glow(0,0,330,90,energy*.24);glow(0,-250,200,360,beam*.13);
 for(let j=0;j<3;j++){let r=(134+j*27)*(.7+.3*charge);ellipse(r,0,energy*(.7-j*.14),j===0?2:1);for(let i=0;i<8;i++){let a=i*TAU/8+t*(j%2?-.3:.2);ellipse(r+5,0,energy*.8,3,a,a+.22)}}
 for(let i=0;i<64;i++){let a=i/64*TAU,r=204;line([[Math.cos(a)*r,Math.sin(a)*r*.23],[Math.cos(a)*(r+(i%4?4:12)),Math.sin(a)*(r+(i%4?4:12))*.23]],c,1,energy*.7)}
 if(beam>0){let end=-650+smooth((t-.45)/.48)*650;g.save();g.beginPath();g.rect(-230,-760,460,end+760);g.clip();let f=g.createLinearGradient(-165,0,165,0);f.addColorStop(0,'transparent');f.addColorStop(.12,c+'08');f.addColorStop(.47,c+'26');f.addColorStop(.5,'#ffe0d080');f.addColorStop(.53,c+'26');f.addColorStop(.88,c+'08');f.addColorStop(1,'transparent');g.globalAlpha=beam;g.fillStyle=f;g.fillRect(-165,-760,330,760);for(let i=0;i<28;i++){let x=(random(i)-.5)*290;line([[x,-760],[x,end]],c,i%7===0?1.8:.6,beam*(.06+random(i+4)*.23))}g.restore();glow(0,end,160,14,beam*.9);}
 // Ground-level compression front with turbulent dust trailing behind it.
 const shock=(age,front)=>{if(age<=0||age>2.5)return;const life=(1-smooth(age/2.5))*smooth(age/.055),r=45+460*(1-Math.exp(-age*1.45)),width=8+age*30;
 g.save();g.globalCompositeOperation='source-over';
 // Uneven refractive-looking pressure ridge: bright leading edge and dark wake.
 for(let layer=0;layer<3;layer++){let pts=[];for(let k=0;k<=100;k++){let a=(front?0:Math.PI)+k/100*Math.PI,rr=r+Math.sin(a*13+age*5)*2+Math.sin(a*29)*1.2-layer*4;pts.push([Math.cos(a)*rr,Math.sin(a)*rr*.235])}line(pts,layer===0?'#d2b7ae':layer===1?'#17131a':'#8a5756',layer===0?1.2:layer===1?7:3,life*(layer===0?.24:.2))}
 for(let i=0;i<110;i++){let a=i/110*TAU;if((Math.sin(a)>=0)!==front)continue;let irregular=1+(random(i+1540)-.5)*.12,rr=(r-width*(.2+random(i+1640)*1.4))*irregular,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.235;let lift=(8+random(i+1740)*25)*Math.sin(Math.min(1,age/1.4)*Math.PI*.8),size=(22+random(i+1840)*36)*(1+age*.45);g.globalAlpha=life*(.34+random(i+1940)*.35);g.drawImage(this.dust,x-size*.7,y-lift-size*.42,size*1.4,size*.85);
 // Fine grit travels just ahead of the dust collar.
 for(let j=0;j<2;j++){let q=i*2+j,rr2=r+random(q+2010)*32,xx=Math.cos(a)*rr2,yy=Math.sin(a)*rr2*.235-random(q+2110)*14*life;g.globalAlpha=life*.45;g.fillStyle=q%3?'#89776c':'#c2a194';g.fillRect(xx,yy,1+random(q+2210)*1.6,1)}
 }
 // Only a faint red bounce light reaches the underside of the dust.
 g.globalCompositeOperation='lighter';let pts=[];for(let k=0;k<80;k++){let a=(front?0:Math.PI)+k/79*Math.PI;pts.push([Math.cos(a)*(r-width*.5),Math.sin(a)*(r-width*.5)*.235+2])}line(pts,c,5,life*.045);g.restore();};
 for(const start of [.95,3.2])shock(t-start,false);
 // Unit-alpha mask makes holography follow any supplied character artwork.
 if(build>0){g.save();g.globalCompositeOperation='source-over';g.globalAlpha=.13*build*(1-solid);g.drawImage(this.tint,-180,-480);g.restore();g.save();g.beginPath();g.rect(-185,-480,370,480*build);g.clip();g.globalAlpha=.65*(1-solid);g.drawImage(this.tint,-180,-480);g.globalAlpha=solid;g.globalCompositeOperation='source-over';g.drawImage(this.unit,-180,-480);g.globalCompositeOperation='lighter';g.globalAlpha=(1-solid)*.8;for(let y=0;y<480;y+=5){let offset=Math.sin(y*.15+t*13)*1.8;g.drawImage(this.tint,0,y,360,1,-180+offset,y-480,360,1)}g.restore();
 let scan=-480+480*build;if(build<1){glow(0,scan,160,9,(1-solid)*.65);line([[-145,scan],[145,scan]],'#ffe0d4',1.5,.85)}
 }
 g.globalCompositeOperation='lighter';
 for(let i=0;i<230;i++){let seed=random(i+81),u=(t*(.22+random(i+7)*.2)+seed)%1,x=(random(i+18)-.5)*370,y=-650+u*680,a=beam*Math.sin(u*Math.PI)*(.25+random(i+6)*.6);g.globalAlpha=a;g.fillStyle=i%6===0?'#fff0e2':c;let sz=1+random(i+34)*3;g.fillRect(x,y,sz,sz*(i%3?1:3));if(i%13===0)line([[x,y-20],[x,y]],c,.7,a*.4)}
 // Blocks converge toward the descending reconstruction front.
 if(t>1&&t<3.6)for(let i=0;i<72;i++){let u=(t*.7+random(i+410))%1,side=i%2?1:-1,target=-460+random(i+510)*450,x=side*(45+(1-u)*190),y=target-(1-u)*90,a=Math.sin(u*Math.PI)*(1-solid)*.6;g.globalAlpha=a;g.strokeStyle=c;g.lineWidth=.8;let s=2+random(i+610)*6;g.strokeRect(x,y,s,s);}
 // Two kinetic detonations: beam impact, then the powerful unit's arrival.
 for(const start of [.95,3.2]){const age=t-start;if(age<0)continue;const fade=1-smooth(age/1.4);shock(age,true);g.globalCompositeOperation='lighter';glow(0,-15,270,80,Math.exp(-age*13)*.7);
 for(let i=0;i<90;i++){let angle=random(i+921)*TAU,v=110+random(i+401)*330,x=Math.cos(angle)*v*age,y=Math.sin(angle)*v*age*.25-(90+random(i+89)*220)*age+160*age*age;line([[x-Math.cos(angle)*12,y+8],[x,y]],i%3?c:'#fff0cb',1.2,fade);}
 g.globalCompositeOperation='source-over';for(let i=0;i<42;i++){let angle=i*2.399,v=75+random(i+811)*210,x=Math.cos(angle)*v*age,base=Math.sin(angle)*v*age*.25,y=base-(100+random(i+723)*190)*age+220*age*age;y=Math.min(y,base+8);let size=4+random(i+600)*12;g.save();g.translate(x,y);g.rotate(i+Math.min(age,1.2)*(random(i)*5-2.5));g.globalAlpha=clamp(1-Math.max(0,age-1.4)*.6);g.fillStyle='#262129';g.strokeStyle='#72515b';g.lineWidth=1;g.beginPath();g.moveTo(-size,-size*.5);g.lineTo(size*.3,-size);g.lineTo(size,size*.4);g.lineTo(-size*.5,size*.7);g.closePath();g.fill();g.stroke();g.fillStyle='#ad394a';g.fillRect(-size*.4,-size*.5,size*.8,1.3);g.restore()}
  }
 g.globalCompositeOperation='lighter';
 const impact=t-3.45;if(impact>0){let fade=1-smooth(impact/.95);glow(0,-210,240,320,Math.exp(-impact*14)*.28);glow(0,0,300,25,fade*.35)}
 g.restore();
 }
}
global.RuptureSummon=RuptureSummon;
})(window);
