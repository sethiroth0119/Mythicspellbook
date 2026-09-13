/* 🔧 Adapted for the game's cinematic sandbox (v121v142): the vendored
   three.min.js in this folder is a UMD build exposing a GLOBAL THREE, and these
   pages load it with a plain <script src>. The original module's
   `import * as THREE from 'three'` cannot resolve a bare specifier here. */
const THREE = window.THREE;

// Local ground is y=0. Call update(deltaSeconds) from your render loop.
class CosmicPunch extends THREE.Group {
  constructor({ particleCount = 650, onImpact = () => {}, fistUrl = 'cosmic-fist.webp' } = {}) {
    super(); this.onImpact = onImpact; this.time = 10; this.duration = 3.8;
    this.uniforms = { time: { value: 0 }, fade: { value: 1 } };
    this.fist = new THREE.Group(); this.add(this.fist);
    const artwork = new THREE.TextureLoader().load(fistUrl);
    /* ⚠ THE VENDORED BUILD PREDATES SRGBColorSpace (r152). Assigning the missing
    constant would store undefined, the texture would be read as LINEAR, and the
    fist would render washed out — a bug nobody reports because it merely looks
    slightly wrong. Set whichever the loaded build actually understands. */
    if (THREE.SRGBColorSpace !== undefined) artwork.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) artwork.encoding = THREE.sRGBEncoding;
    this.art = new THREE.Sprite(new THREE.SpriteMaterial({map:artwork,transparent:true,depthWrite:false,rotation:-.42,toneMapped:false}));
    this.art.scale.set(4.8,4.68,1); this.art.position.y=2.5; this.fist.add(this.art);
    // Camera-facing energy field around the supplied transparent artwork.
    // Orbiting light pulses travel along rippling ribbons and a soft nebula halo.
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(7.4,7.4),new THREE.ShaderMaterial({
      uniforms:this.uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv; uniform float time; uniform float fade;
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p*vec2(1.24,1.));float a=atan(p.y,p.x);float haze=exp(-pow((r-.59)*6.,2.))*.13;
      float light=0.;float violet=0.;for(int i=0;i<3;i++){float f=float(i);float wave=.59+.055*sin(a*3.+time*3.+f*2.)+.035*sin(a*7.-time*4.+f);float d=abs(r-wave-f*.045);float head=pow(.5+.5*cos(a-time*(2.+f*.35)+f*2.1),5.);float ribbon=(.16+head)*(.007/(d+.007));light+=ribbon;violet+=ribbon*f*.28;}
      float sparks=pow(max(0.,sin(a*31.+r*17.-time*7.)),35.)*exp(-pow((r-.72)*19.,2.));vec3 col=vec3(.025,.32,1.)*(light+haze)+vec3(.22,.035,.65)*violet+vec3(.32,.8,1.)*sparks*.65;
      float edge=1.-smoothstep(.83,.98,r);gl_FragColor=vec4(col*1.7*edge,fade*edge);}`
    }));this.aura.position.y=2.5;this.fist.add(this.aura);
    const parentRotation=new THREE.Quaternion();
    this.aura.onBeforeRender=(_renderer,_scene,camera)=>{this.fist.getWorldQuaternion(parentRotation);this.aura.quaternion.copy(parentRotation.invert()).multiply(camera.quaternion);this.aura.updateMatrixWorld();};
    this.rings=[];
    for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({color:i===0?0x9bfaff:0x127aff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}); const ring=new THREE.Mesh(new THREE.RingGeometry(.96,1,192),m);ring.rotation.x=-Math.PI/2;ring.position.y=.035+i*.009;this.add(ring);this.rings.push(ring);}
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff');gradient.addColorStop(.18,'#acffff');gradient.addColorStop(.4,'#258cff');gradient.addColorStop(1,'#0000');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);
    this.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0x73caff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.flash.position.y=.35;this.add(this.flash);
    this.count=particleCount;this.positions=new Float32Array(particleCount*3);this.velocities=[];const colors=new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){const a=Math.random()*Math.PI*2,s=2+Math.random()*7;this.velocities.push([Math.cos(a)*s,1.5+Math.random()*7,Math.sin(a)*s]);new THREE.Color().setHSL(.53+Math.random()*.1,.95,.55+Math.random()*.4).toArray(colors,i*3);}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(this.positions,3));pg.setAttribute('color',new THREE.BufferAttribute(colors,3));this.particles=new THREE.Points(pg,new THREE.PointsMaterial({size:.13,map:texture,transparent:true,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.particles.frustumCulled=false;this.add(this.particles);
    this.rocks=[];const rockGeo=new THREE.IcosahedronGeometry(1,0);const rockMat=new THREE.MeshStandardMaterial({color:0x14283d,roughness:.8,metalness:.35});for(let i=0;i<42;i++){const rock=new THREE.Mesh(rockGeo,rockMat);const a=Math.random()*Math.PI*2;rock.userData={a,r:.6+Math.random()*1.3,v:1+Math.random()*3,h:2+Math.random()*5,s:.05+Math.random()*.18};rock.scale.setScalar(rock.userData.s);this.add(rock);this.rocks.push(rock);}
    this.cracks=new THREE.Group();this.add(this.cracks);const crackMat=new THREE.LineBasicMaterial({color:0x4adfff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});for(let j=0;j<18;j++){const points=[];const a=j/18*Math.PI*2;for(let k=0;k<8;k++){const r=.45+k*.43;const angle=a+(Math.random()-.5)*.2;points.push(new THREE.Vector3(Math.cos(angle)*r,.025,Math.sin(angle)*r));}this.cracks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),crackMat));}
    this.light=new THREE.PointLight(0x239aff,0,18,2);this.light.position.y=1.4;this.add(this.light);this.visible=false;
  }
  trigger(position) { if(position)this.position.copy(position);this.time=0;this.visible=true;this.hit=false; }
  update(dt) {
    this.time+=Math.max(0,dt);const t=this.time; if(t>this.duration){this.visible=false;return;} this.uniforms.time.value=t;
    const impact=.9, a=t-impact;this.fist.visible=a<.8;
    const charge=Math.min(t/.65,1);this.fist.position.y=t<.65?4.8+Math.sin(charge*Math.PI)*.25:t<impact?4.8*(1-Math.pow((t-.65)/.25,3)):.02;
    this.fist.position.x=t<impact?-.5*(1-charge):0;this.fist.rotation.z=t<impact?-.13*(1-charge):0;
    this.uniforms.fade.value=a<.22?Math.min(t*4,1):Math.max(0,1-(a-.22)/.55);
    this.art.material.opacity=this.uniforms.fade.value;
    this.art.material.rotation=-.42+Math.sin(t*3.)*.025;
    this.aura.scale.setScalar(1+Math.sin(t*7.)*.025+Math.max(0,a)*.25);
    if(a>=0&&!this.hit){this.hit=true;this.onImpact();}
    this.flash.visible=a>=0;this.flash.scale.setScalar(2+Math.max(0,a)*13);this.flash.material.opacity=a<0?0:Math.exp(-a*12);
    this.light.intensity=a<0?charge*12:180*Math.exp(-a*5);
    this.rings.forEach((r,i)=>{const age=a-i*.09;r.visible=age>=0;r.scale.setScalar(.5+Math.max(0,age)*(9-i*1.5));r.material.opacity=age<0?0:Math.max(0,1-age/(.85+i*.15));});
    this.cracks.visible=a>=0;this.cracks.children[0].material.opacity=a<0?0:Math.min(a*15,1)*Math.max(0,1-a/2.8);
    this.particles.visible=a>=0;this.particles.material.opacity=Math.max(0,1-a/2.5);
    for(let i=0;i<this.count;i++){const v=this.velocities[i];const age=Math.max(0,a);this.positions[i*3]=v[0]*age/(1+age*.9);this.positions[i*3+1]=Math.max(.04,.15+v[1]*age-4.9*age*age);this.positions[i*3+2]=v[2]*age/(1+age*.9);}this.particles.geometry.attributes.position.needsUpdate=true;
    for(const rock of this.rocks){const d=rock.userData;rock.visible=a>=0;const age=Math.max(a,0),r=d.r+d.v*age;rock.position.set(Math.cos(d.a)*r,Math.max(d.s*.45,d.h*age-4.9*age*age),Math.sin(d.a)*r);rock.rotation.set(age*3+d.a,age*2,age);rock.scale.setScalar(d.s*Math.min(1,Math.max(0,(this.duration-t)*2)));}
  }
  dispose(){const gs=new Set(),ms=new Set(),ts=new Set();this.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const m of ms){if(m.map)ts.add(m.map);m.dispose();}for(const g of gs)g.dispose();for(const t of ts)t.dispose();this.removeFromParent();}
}



try { window.CosmicPunch = CosmicPunch; } catch (e) {}
