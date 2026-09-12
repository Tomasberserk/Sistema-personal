<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>El Mundo de Melanie 3D</title>
<style>
  body { margin: 0; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; touch-action: none; background: #000; }
  #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
  .screen { position: absolute; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); pointer-events: auto; }
  .glass-panel { background: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.6); border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(15px); max-width: 80%; }
  h1 { font-size: 2.5em; color: #d81b60; margin-top: 0; text-shadow: 2px 2px 4px rgba(255,255,255,0.8); }
  p { font-size: 1.2em; color: #333; font-weight: bold; }
  button { background: #ff69b4; color: white; border: none; padding: 12px 25px; font-size: 16px; border-radius: 30px; cursor: pointer; margin: 8px; transition: 0.3s; box-shadow: 0 4px 15px rgba(255,105,180,0.4); font-weight: bold; }
  button:hover { transform: scale(1.05); background: #ff1493; }
  #hud { position: absolute; top: 15px; left: 15px; pointer-events: none; }
  .hud-box { background: rgba(255,255,255,0.6); padding: 8px 15px; border-radius: 15px; margin-bottom: 8px; font-weight: bold; color: #333; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.8); font-size: 14px; }
  #dialog { position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.85); padding: 15px 30px; border-radius: 20px; pointer-events: none; opacity: 0; transition: 0.5s; text-align: center; max-width: 80%; font-weight: bold; color: #d81b60; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
  #mobile-controls { position: absolute; bottom: 20px; width: 100%; display: none; pointer-events: none; }
  #joystick { position: absolute; left: 20px; bottom: 20px; width: 100px; height: 100px; background: rgba(255,255,255,0.3); border-radius: 50%; pointer-events: auto; border: 2px solid rgba(255,255,255,0.5); }
  #joystick-knob { position: absolute; width: 40px; height: 40px; background: rgba(255,105,180,0.8); border-radius: 50%; top: 30px; left: 30px; }
  .btn-action { position: absolute; width: 60px; height: 60px; background: rgba(255,105,180,0.6); border-radius: 50%; pointer-events: auto; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; user-select: none; border: 2px solid rgba(255,255,255,0.5); }
  #btn-shoot { bottom: 90px; right: 30px; }
  #btn-jump { bottom: 20px; right: 100px; }
  #hearts-container { position: absolute; width: 100%; height: 100%; pointer-events: none; overflow: hidden; top:0; left:0; }
  @keyframes fall { to { transform: translateY(110vh); } }
</style>
</head>
<body>

<div id="ui-layer">
  <div id="start-screen" class="screen">
    <div class="glass-panel">
      <h1>El Mundo de Melanie 3D</h1>
      <p>Un detalle de amor en código por Tomás</p>
      <button id="start-btn">Comenzar Aventura</button>
    </div>
  </div>

  <div id="apodo-screen" class="screen" style="display:none;">
    <div class="glass-panel">
      <h2 style="color:#d81b60;">¿Cómo te gusta que te llame, mi amor?</h2>
      <div>
        <button onclick="selectApodo('Melanie')">Melanie</button>
        <button onclick="selectApodo('Mi Hadita 🧚‍♀️')">Mi Hadita 🧚‍♀️</button>
        <button onclick="selectApodo('Mi Negra 🖤')">Mi Negra 🖤</button>
      </div>
      <div>
        <button onclick="selectApodo('Mi Niña 👧')">Mi Niña 👧</button>
        <button onclick="selectApodo('Beba Hermosa 🥰')">Beba Hermosa 🥰</button>
        <button onclick="selectApodo('Mi Amol 💖')">Mi Amol 💖</button>
      </div>
    </div>
  </div>

  <div id="hud" style="display:none;">
    <div class="hud-box" id="hp-hearts">❤️❤️❤️❤️❤️</div>
    <div class="hud-box" id="hud-name">Jugadora: Melanie</div>
    <div class="hud-box" id="hud-zone">Zona 1: El Preicfes</div>
    <div class="hud-box" id="hud-collect">Libros: 0/3</div>
    <div class="hud-box" id="boss-hud" style="display:none; color:#d81b60;">La Duda: <progress id="boss-bar" value="10" max="10" style="width:120px; height:15px;"></progress></div>
  </div>

  <div id="dialog"></div>

  <div id="victory-screen" class="screen" style="display:none;">
    <div id="hearts-container"></div>
    <div class="glass-panel" style="background:rgba(255,255,255,0.85);">
      <div style="border:10px solid white; padding:30px; background:#fdf5e6; border-radius:10px;">
        <h2 style="color:#d81b60; margin-top:0;">Tomás & Melanie - Para Siempre 💖</h2>
        <p style="color:#333; font-size:1.1em; line-height:1.6;">Completaste el mundo, venciste todos los obstáculos... tal como lo hacemos en la vida real. Tu paciencia, tu disciplina y ese amor tan bonito que tienes derrotan a cualquier duda. Gracias por ser mi compañera de aventuras. Te amo con todo mi corazón. - Tomás</p>
        <button onclick="resetGame()" style="margin-top:20px;">Pasear Libremente / Reiniciar</button>
      </div>
    </div>
  </div>

  <div id="mobile-controls">
    <div id="joystick"><div id="joystick-knob"></div></div>
    <div id="btn-shoot" class="btn-action">💋</div>
    <div id="btn-jump" class="btn-action">⤴️</div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const AudioSys = {
  ctx: null,
  init() {
    if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(this.ctx.state === 'suspended') this.ctx.resume();
  },
  playTone(freq, type, duration, vol=0.1) {
    if(!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  jump() { this.playTone(400, 'sine', 0.3, 0.1); },
  collect() { this.playTone(800, 'sine', 0.1, 0.1); setTimeout(()=>this.playTone(1200, 'sine', 0.2, 0.1), 100); },
  shoot() { this.playTone(600, 'triangle', 0.15, 0.1); },
  hit() { this.playTone(200, 'sawtooth', 0.2, 0.15); },
  victory() {
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.5, 0.1), i * 250);
    });
  }
};

let scene, camera, renderer, clock;
let melanie, wings;
let keys = {};
let touchVector = new THREE.Vector2(0,0);
let projectiles = [];
let bossProjectiles = [];
let collectibles = [];
let portal = null;
let boss = null;
let currentZoneIdx = 0;
let collectedCount = 0;
let hp = 5;
let bossHp = 10;
let playerApodo = "Melanie";
let gameState = 'start';

let zoneData = [
  { name: "Zona 1: El Preicfes", sub: "Donde nuestra historia empezó a estudiar.", color: 0xe0f7fa, fog: 0xe0f7fa, type: 'books' },
  { name: "Zona 2: Prahba Burgers", sub: "Recuerdos de risas y papitas.", color: 0xfff3e0, fog: 0xfff3e0, type: 'burgers' },
  { name: "Zona 3: El Cine", sub: "Nuestra primera película juntos.", color: 0xfce4ec, fog: 0xfce4ec, type: 'popcorn' },
  { name: "Zona 4: Cafetería & WhatsApp", sub: "Charlas infinitas y cafecito.", color: 0xffebce, fog: 0xffebce, type: 'coffee' },
  { name: "Zona 5: La Arena de la Duda", sub: "Vence al monstruo de las inseguridades.", color: 0x2a004f, fog: 0x2a004f, type: 'boss' }
];

let dynamicObjects = new THREE.Group();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene.add(dynamicObjects);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  melanie = createMelanie();
  melanie.velocity = new THREE.Vector3();
  scene.add(melanie);
  wings = melanie.wings;

  clock = new THREE.Clock();
  setupEvents();
  animate();
}

function createMelanie() {
  const group = new THREE.Group();
  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), new THREE.MeshPhongMaterial({color: 0xffb6c1}));
  dress.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshPhongMaterial({color: 0xffe0bd}));
  head.position.y = 1.4;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI*2, 0, Math.PI/1.5), new THREE.MeshPhongMaterial({color: 0x8b4513}));
  hair.position.y = 1.45;
  
  const wingMat = new THREE.MeshPhongMaterial({color: 0xaaffff, transparent:true, opacity:0.6, side:THREE.DoubleSide, emissive: 0x44ffff, emissiveIntensity: 0.2});
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), wingMat);
  wingL.position.set(-0.3, 1.0, 0.2);
  wingL.rotation.y = Math.PI / 4;
  const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), wingMat);
  wingR.position.set(0.3, 1.0, 0.2);
  wingR.rotation.y = -Math.PI / 4;
  
  group.add(dress, head, hair, wingL, wingR);
  group.traverse(c => { if(c.isMesh) c.castShadow = true; });
  group.wings = [wingL, wingR];
  return group;
}

function loadZone(idx) {
  while(dynamicObjects.children.length > 0){ 
    dynamicObjects.remove(dynamicObjects.children[0]); 
  }
  collectibles = [];
  projectiles = [];
  bossProjectiles = [];
  collectedCount = 0;
  portal = null;
  boss = null;
  hp = 5;
  
  let data = zoneData[idx];
  scene.fog = new THREE.Fog(data.fog, 10, 60);
  scene.background = new THREE.Color(data.color);
  
  const floorMat = new THREE.MeshPhongMaterial({color: data.color});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  dynamicObjects.add(floor);

  let pLight = new THREE.PointLight(0xffaa55, 1, 40);
  pLight.position.set(0, 10, 0);
  dynamicObjects.add(pLight);

  melanie.position.set(0, 0, 0);
  melanie.velocity.set(0,0,0);

  if(idx < 4) {
    for(let i=0; i<3; i++) {
      let c = createCollectible(data.type, i);
      collectibles.push(c);
      dynamicObjects.add(c);
    }
    portal = createPortal();
    portal.visible = false;
    dynamicObjects.add(portal);
    createDecor(idx);
  } else {
    boss = createBoss();
    bossHp = 10;
    dynamicObjects.add(boss);
  }
  updateHUD();
}

function createCollectible(type, index) {
  let geo, mat, mesh;
  if(type === 'books') {
     geo = new THREE.BoxGeometry(0.5, 0.7, 0.2);
     mat = new THREE.MeshPhongMaterial({color: [0xff5252, 0x448aff, 0x69f0ae][index]});
     mesh = new THREE.Mesh(geo, mat);
  } else if(type === 'burgers') {
     geo = new THREE.SphereGeometry(0.4, 16, 16);
     mat = new THREE.MeshPhongMaterial({color: 0xffb300});
     mesh = new THREE.Mesh(geo, mat);
  } else if(type === 'popcorn') {
     geo = new THREE.IcosahedronGeometry(0.4, 0);
     mat = new THREE.MeshPhongMaterial({color: 0xffff00});
     mesh = new THREE.Mesh(geo, mat);
  } else if(type === 'coffee') {
     geo = new THREE.CylinderGeometry(0.3, 0.2, 0.5, 16);
     mat = new THREE.MeshPhongMaterial({color: 0x795548});
     mesh = new THREE.Mesh(geo, mat);
  }
  let angle = (index / 3) * Math.PI * 2;
  mesh.position.set(Math.cos(angle)*5, 1, Math.sin(angle)*5);
  mesh.castShadow = true;
  return mesh;
}

function createPortal() {
  let geo = new THREE.TorusGeometry(1.5, 0.2, 16, 32);
  let mat = new THREE.MeshPhongMaterial({color: 0xff00ff, emissive: 0xff00ff, transparent: true, opacity: 0.8});
  let mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 2, -15);
  mesh.rotation.y = Math.PI;
  return mesh;
}

function createDecor(idx) {
  let decorGroup = new THREE.Group();
  if(idx === 0) {
    for(let i=0; i<4; i++) {
      let desk = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color:0x8d6e63}));
      desk.position.set(-5 + i*3, 0.5, 3); desk.castShadow=true; decorGroup.add(desk);
    }
    let board = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.2), new THREE.MeshPhongMaterial({color:0x004d40}));
    board.position.set(0, 3, -10); decorGroup.add(board);
  } else if(idx === 1) {
    for(let i=0; i<3; i++) {
      let table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.MeshPhongMaterial({color:0xffcc80}));
      table.position.set(-4 + i*4, 0.5, 4); table.castShadow=true; decorGroup.add(table);
    }
  } else if(idx === 2) {
    for(let i=0; i<10; i++) {
      let seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshPhongMaterial({color:0xd32f2f}));
      seat.position.set(-4 + (i%5)*2, 0.4, 2 + Math.floor(i/5)*2); seat.castShadow=true; decorGroup.add(seat);
    }
    let canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,256,128);
    ctx.fillStyle = '#000'; ctx.font = '40px Arial'; ctx.fillText('CINE', 70, 75);
    let tex = new THREE.CanvasTexture(canvas);
    let screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({map: tex}));
    screen.position.set(0, 4, -10); decorGroup.add(screen);
  } else if(idx === 3) {
    for(let i=0; i<4; i++) {
      let cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.5, 16), new THREE.MeshPhongMaterial({color:0xffffff}));
      cup.position.set(-4 + i*2.5, 0.25, 4); cup.castShadow=true; decorGroup.add(cup);
      let bubble = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({color:0xffffff, transparent:true, opacity:0.5}));
      bubble.position.set(-4 + i*2.5, 2, 4); decorGroup.add(bubble);
    }
  }
  dynamicObjects.add(decorGroup);
}

function createBoss() {
  let group = new THREE.Group();
  group.position.set(0, 3, -15);
  let core = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshPhongMaterial({color: 0x220044, emissive: 0x110022}));
  group.add(core);
  let eyeMat = new THREE.MeshBasicMaterial({color: 0xff0000});
  let eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), eyeMat);
  eyeL.position.set(-0.8, 0.5, 1.8);
  let eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), eyeMat);
  eyeR.position.set(0.8, 0.5, 1.8);
  group.add(eyeL, eyeR);
  
  let pGeo = new THREE.BufferGeometry();
  let pCount = 200;
  let pos = new Float32Array(pCount * 3);
  for(let i=0; i<pCount; i++) {
    pos[i*3] = (Math.random()-0.5)*10;
    pos[i*3+1] = -Math.random()*10;
    pos[i*3+2] = (Math.random()-0.5)*10;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let pMat = new THREE.PointsMaterial({color: 0xaa00ff, size: 0.2});
  let particles = new THREE.Points(pGeo, pMat);
  group.add(particles);
  group.particles = particles;
  return group;
}

function shoot() {
  if(gameState !== 'play') return;
  AudioSys.shoot();
  let heart = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({color: 0xff0055}));
  heart.position.copy(melanie.position);
  heart.position.y += 1.5;
  let dir = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), melanie.rotation.y);
  if(boss) dir = boss.position.clone().sub(heart.position).normalize();
  heart.velocity = dir.multiplyScalar(25);
  dynamicObjects.add(heart);
  projectiles.push(heart);
}

function updatePlayer(dt) {
  let speed = 10;
  let dir = new THREE.Vector3(0,0,0);
  if(keys['w'] || keys['arrowup']) dir.z -= 1;
  if(keys['s'] || keys['arrowdown']) dir.z += 1;
  if(keys['a'] || keys['arrowleft']) dir.x -= 1;
  if(keys['d'] || keys['arrowright']) dir.x += 1;

  if(touchVector.length() > 0.1) {
    dir.x = touchVector.x;
    dir.z = -touchVector.y;
  }

  dir.normalize();
  melanie.position.x += dir.x * speed * dt;
  melanie.position.z += dir.z * speed * dt;

  if(dir.lengthSq() > 0) {
    let targetAngle = Math.atan2(dir.x, dir.z) + Math.PI;
    melanie.rotation.y = THREE.MathUtils.lerp(melanie.rotation.y, targetAngle, 0.1);
  }

  if(keys[' '] && melanie.position.y <= 0.01) {
    melanie.velocity.y = 15;
    AudioSys.jump();
    keys[' '] = false;
  }
  melanie.velocity.y -= 30 * dt; 
  melanie.position.y += melanie.velocity.y * dt;
  if(melanie.position.y < 0) {
    melanie.position.y = 0;
    melanie.velocity.y = 0;
  }

  if(melanie.position.y <= 0.01 && dir.lengthSq() > 0) {
    melanie.position.y = Math.abs(Math.sin(clock.getElapsedTime() * 15)) * 0.2;
  } else if (melanie.position.y <= 0.01) {
    melanie.position.y = 0;
  }

  if(wings) {
    let flap = Math.sin(clock.getElapsedTime() * 15) * 0.3;
    wings[0].rotation.z = flap;
    wings[1].rotation.z = -flap;
  }
}

function updateGameObjects(dt) {
  for(let i=collectibles.length-1; i>=0; i--) {
    let c = collectibles[i];
    c.rotation.y += dt;
    c.position.y = 1 + Math.sin(clock.getElapsedTime()*3 + i)*0.2;
    if(c.position.distanceTo(melanie.position) < 1.5) {
      AudioSys.collect();
      dynamicObjects.remove(c);
      collectibles.splice(i, 1);
      collectedCount++;
      updateHUD();
      if(collectedCount === 3 && portal) {
        portal.visible = true;
        showDialog("¡Bien hecho " + playerApodo + "! El portal se ha abierto. Ve hacia él.");
      }
    }
  }

  if(portal && portal.visible) {
    portal.rotation.z += dt;
    if(portal.position.distanceTo(melanie.position) < 2.5) {
      currentZoneIdx++;
      loadZone(currentZoneIdx);
      showDialog(zoneData[currentZoneIdx].sub);
    }
  }

  for(let i=projectiles.length-1; i>=0; i--) {
    let p = projectiles[i];
    p.position.addScaledVector(p.velocity, dt);
    if(boss && p.position.distanceTo(boss.position) < 3) {
      AudioSys.hit();
      bossHp--;
      updateHUD();
      p.life = 0;
      if(bossHp <= 0) triggerVictory();
    }
    p.life = (p.life || 0) + dt;
    if(p.life > 3) p.life = 0;
    if(p.life === 0) {
      dynamicObjects.remove(p);
      projectiles.splice(i, 1);
    }
  }

  if(boss) {
    boss.rotation.y += dt * 0.5;
    boss.position.y = 3 + Math.sin(clock.getElapsedTime()*2)*1;
    if(boss.particles) {
      let pos = boss.particles.geometry.attributes.position.array;
      for(let i=1; i<pos.length; i+=3) {
        pos[i] += dt * 2;
        if(pos[i] > 0) pos[i] = -10;
      }
      boss.particles.geometry.attributes.position.needsUpdate = true;
    }
    if(Math.random() < 0.02) {
      let proj = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({color: 0x8800ff}));
      proj.position.copy(boss.position);
      let d = melanie.position.clone().sub(boss.position).normalize();
      proj.velocity = d.multiplyScalar(10);
      dynamicObjects.add(proj);
      bossProjectiles.push(proj);
    }
  }

  for(let i=bossProjectiles.length-1; i>=0; i--) {
    let p = bossProjectiles[i];
    p.position.addScaledVector(p.velocity, dt);
    if(p.position.distanceTo(melanie.position) < 1.2) {
      hp--;
      AudioSys.hit();
      updateHUD();
      p.life = 0;
      if(hp <= 0) {
        hp = 5;
        updateHUD();
        melanie.position.set(0,0,0);
        showDialog("¡Cuidado " + playerApodo + "! Recuperaste algo de vida.");
      }
    }
    p.life = (p.life || 0) + dt;
    if(p.life > 4) p.life = 0;
    if(p.life === 0) {
      dynamicObjects.remove(p);
      bossProjectiles.splice(i, 1);
    }
  }
}

function updateCamera() {
  let offset = new THREE.Vector3(0, 4, 8);
  offset.applyAxisAngle(new THREE.Vector3(0,1,0), melanie.rotation.y + Math.PI);
  let targetPos = melanie.position.clone().add(offset);
  camera.position.lerp(targetPos, 0.1);
  camera.lookAt(melanie.position.clone().add(new THREE.Vector3(0, 1, 0)));
}

function updateHUD() {
  document.getElementById('hp-hearts').innerText = '❤️'.repeat(hp);
  document.getElementById('hud-name').innerText = "Jugadora: " + playerApodo;
  document.getElementById('hud-zone').innerText = zoneData[currentZoneIdx].name;
  if(currentZoneIdx < 4) {
    let typeStr = ['Libros', 'Hamburguesas', 'Palomitas', 'Tazas de Café'][currentZoneIdx];
    document.getElementById('hud-collect').style.display = 'block';
    document.getElementById('hud-collect').innerText = `${typeStr}: ${collectedCount}/3`;
    document.getElementById('boss-hud').style.display = 'none';
  } else {
    document.getElementById('hud-collect').style.display = 'none';
    document.getElementById('boss-hud').style.display = 'block';
    document.getElementById('boss-bar').value = bossHp;
  }
}

function showDialog(msg) {
  const d = document.getElementById('dialog');
  d.innerText = msg;
  d.style.opacity = 1;
  clearTimeout(d.timeout);
  d.timeout = setTimeout(() => { d.style.opacity = 0; }, 4000);
}

function triggerVictory() {
  gameState = 'victory';
  AudioSys.victory();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('victory-screen').style.display = 'flex';
  document.getElementById('mobile-controls').style.display = 'none';
  createHeartRain();
}

function createHeartRain() {
  let container = document.getElementById('hearts-container');
  container.innerHTML = '';
  for(let i=0; i<40; i++) {
    let h = document.createElement('div');
    h.innerHTML = ['❤️','💖','💕','💘'][Math.floor(Math.random()*4)];
    h.style.position = 'absolute';
    h.style.left = Math.random()*100 + 'vw';
    h.style.top = '-10vh';
    h.style.fontSize = (20 + Math.random()*30) + 'px';
    h.style.animation = `fall ${3 + Math.random()*4}s linear ${Math.random()*3}s infinite`;
    container.appendChild(h);
  }
}

function setupEvents() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  window.addEventListener('keydown', (e) => {
    let k = e.key.toLowerCase();
    keys[k] = true;
    if(e.key === ' ' || e.key === 'Spacebar') keys[' '] = true;
    if(k === 'f' || k === 'e') shoot();
  });
  window.addEventListener('keyup', (e) => {
    let k = e.key.toLowerCase();
    keys[k] = false;
    if(e.key === ' ' || e.key === 'Spacebar') keys[' '] = false;
  });
  renderer.domElement.addEventListener('mousedown', (e) => {
    if(gameState === 'play') shoot();
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    AudioSys.init();
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('apodo-screen').style.display = 'flex';
  });

  let joyActive = false;
  let joyCenter = {x:0, y:0};
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  joystick.addEventListener('touchstart', (e) => { 
    e.preventDefault(); joyActive = true; 
    let rect = joystick.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width/2; joyCenter.y = rect.top + rect.height/2;
    updateJoy(e.touches[0]); 
  }, {passive: false});
  joystick.addEventListener('touchmove', (e) => { if(joyActive) { e.preventDefault(); updateJoy(e.touches[0]); } }, {passive: false});
  joystick.addEventListener('touchend', (e) => { 
    joyActive = false; touchVector.set(0,0);
    knob.style.left = '30px'; knob.style.top = '30px'; 
  });
  function updateJoy(touch) {
    let dx = touch.clientX - joyCenter.x;
    let dy = touch.clientY - joyCenter.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let max = 40;
    if(dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; }
    knob.style.left = (30 + dx) + 'px';
    knob.style.top = (30 + dy) + 'px';
    touchVector.set(dx/max, dy/max);
  }
  
  document.getElementById('btn-shoot').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); });
  document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); keys[' '] = true; });
}

window.selectApodo = function(apodo) {
  playerApodo = apodo;
  document.getElementById('apodo-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('mobile-controls').style.display = 'block';
  gameState = 'play';
  loadZone(0);
  showDialog("Bienvenida " + playerApodo + "! Explora y recoge los ítems.");
};

window.resetGame = function() {
  hp = 5; currentZoneIdx = 0; bossHp = 10;
  document.getElementById('victory-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('mobile-controls').style.display = 'block';
  gameState = 'play';
  loadZone(0);
  showDialog("Un nuevo comienzo, " + playerApodo + ".");
};

function animate() {
  requestAnimationFrame(animate);
  let dt = clock.getDelta();
  if(dt > 0.1) dt = 0.1;
  if(gameState === 'play') {
    updatePlayer(dt);
    updateGameObjects(dt);
    updateCamera();
  }
  renderer.render(scene, camera);
}

init();
</script>
</body>
</html>