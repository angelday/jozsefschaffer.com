// Enigma part 9 rebuilt: a press-play screen on part 1's starfield, the body's intertitle, then the part's original
// logo, scroller and timing around an interactive, GPU ray-traced sphere scene, all running to the demo's soundtrack.
(async function () {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { degToRad, lerp } = THREE.MathUtils;
  const D = window.PART9, S = D.scene, T = D.timeline, IT = window.INTERTITLE;
  const [AX, AY, AW, AH] = D.screen.anim;

  // ---------- layout ----------
  const stage = document.getElementById('stage');
  const staticCanvas = document.getElementById('screen');
  const animWindow = document.getElementById('anim');
  const glCanvas = document.getElementById('scene');
  const origCanvas = document.getElementById('original');
  const screen = window.Part9Screen(D, staticCanvas);
  const inter = window.Intertitle(IT), PRE = inter.length;
  const press = window.PressPlay(window.PART1, IT.flash);

  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(320, 150, false);                        // Amiga pixels like the logo and scroller; zoom scales it up
  const tracer = window.Part9Raytrace(THREE, S);

  const origCtx = origCanvas.getContext('2d');
  origCanvas.width = 320; origCanvas.height = 150;
  const frames = await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise((ok) => {
    const im = new Image(); im.onload = () => ok(im); im.src = `assets/frames/frame${i}.png`;
  })));

  let zoom = 1;
  function setZoom(z) {
    zoom = z;
    stage.style.width = `${D.screen.width * z}px`;
    stage.style.height = `${D.screen.height * z}px`;
    Object.assign(animWindow.style, { left: `${AX * z}px`, top: `${AY * z}px`, width: `${AW * z}px` });
    for (const c of [glCanvas, origCanvas]) { c.style.width = `${320 * z}px`; c.style.height = `${150 * z}px`; }
  }
  // the largest whole zoom (1x..4x) that fits the window
  const fitZoom = () => Math.max(1, Math.min(4, Math.floor(Math.min(innerWidth / D.screen.width, innerHeight / D.screen.height))));
  setZoom(fitZoom());

  // ---------- camera ----------
  const cam = S.camera;
  const camera = new THREE.PerspectiveCamera(cam.fovY, cam.aspect, 0.01, 1000);
  camera.rotation.order = 'YXZ';
  const controls = new OrbitControls(camera, glCanvas);
  controls.enableDamping = true;
  controls.minDistance = 0.3;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI - 0.05;                   // the flight looks up under the arches; the floor is enforced below

  // a pose is where the camera is, what it looks at and its vertical FOV
  function homePose() {
    const pitch = degToRad(cam.pitch), yaw = degToRad(cam.yaw), d = 6;
    const position = new THREE.Vector3(0, cam.height, 0);
    const forward = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    return { position, target: position.clone().addScaledVector(forward, d), fov: cam.fovY };
  }
  function applyPose(pose) {
    camera.position.copy(pose.position); controls.target.copy(pose.target);
    if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    camera.lookAt(controls.target);
  }
  const atPose = (pose) => camera.position.distanceTo(pose.position) < 1e-3 && controls.target.distanceTo(pose.target) < 1e-3
    && Math.abs(camera.fov - pose.fov) < 1e-3;
  const isHome = () => atPose(homePose());

  // animated transfer to a pose: the target glides, the camera swings around it on a sphere
  let flight = null;
  function flyTo(pose, duration = 1.4, done = null) {
    const sph = (p, t) => new THREE.Spherical().setFromVector3(p.clone().sub(t));
    const from = { target: controls.target.clone(), off: sph(camera.position, controls.target), fov: camera.fov };
    const to = { target: pose.target.clone(), off: sph(pose.position, pose.target), fov: pose.fov };
    const dTheta = Math.atan2(Math.sin(to.off.theta - from.off.theta), Math.cos(to.off.theta - from.off.theta));
    controls.enableDamping = false; controls.update();
    flight = { t: 0, duration, from, to, dTheta, done };
  }
  function stepFlight(dt) {
    flight.t += dt;
    const x = Math.min(1, flight.t / flight.duration), k = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
    const { from, to } = flight;
    controls.target.lerpVectors(from.target, to.target, k);
    camera.position.setFromSpherical(new THREE.Spherical(lerp(from.off.radius, to.off.radius, k), lerp(from.off.phi, to.off.phi, k),
      from.off.theta + flight.dTheta * k)).add(controls.target);
    camera.fov = lerp(from.fov, to.fov, k); camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    if (x >= 1) {
      const done = flight.done;
      flight = null; controls.enableDamping = true;
      if (done) done();
    }
  }

  // ---------- scripted flight (js/flyover.js), 3 s after the animation window has fully opened ----------
  // Dragging or zooming takes the camera over and holds the flight; after release it flies back to the held
  // point and carries on from there.
  const home = homePose();
  const fly = window.Part9Flyover({ position: home.position.toArray(), target: home.target.toArray(), fov: home.fov });
  const pa = [0, 0, 0], qa = [0, 0, 0];
  const tour = { active: false, t: 0, onPath: false, ease: 1 };
  function tourPose(t) {
    const fov = fly.sample(t, pa, qa);
    return { position: new THREE.Vector3(...pa), target: new THREE.Vector3(...qa), fov };
  }
  function startTour() {
    Object.assign(tour, { active: true, t: 0, onPath: false, ease: 1 });
    if (!flight && !dragging && !showOriginal && isHome()) tour.onPath = true;    // the path starts at the home view
  }
  function stopTour() { Object.assign(tour, { active: false, t: 0, onPath: false }); }
  function followTour(dt) {
    if (running && !paused) {
      tour.ease = Math.min(1, tour.ease + dt / 0.8);                              // pick the speed up again after a hand-back
      tour.t += dt * tour.ease * tour.ease * (3 - 2 * tour.ease);
    }
    applyPose(tourPose(Math.min(tour.t, fly.duration)));
    if (tour.t >= fly.duration) stopTour();                                       // it ends exactly on the home view
  }

  // after IDLE seconds without a drag or zoom the camera returns: to the flight if one is under way, else home
  const IDLE = 0.5;
  let dragging = false, lastInput = 0;
  controls.addEventListener('start', () => {
    dragging = true;
    tour.onPath = false;
    if (flight) flight = null;
    controls.enableDamping = true;
  });
  controls.addEventListener('end', () => { dragging = false; lastInput = performance.now(); });
  function idleReturn(now) {
    if (flight || dragging || now - lastInput < IDLE * 1000) return;
    if (tour.active && !showOriginal) {
      const pose = tourPose(tour.t);
      if (atPose(pose)) tour.onPath = true;
      else flyTo(pose, 1.2, () => { if (tour.active && !showOriginal) Object.assign(tour, { onPath: true, ease: 0 }); });
    } else if (!isHome()) flyTo(homePose());
  }
  function stepCamera(dt, now) {
    if (flight) stepFlight(dt);
    else if (tour.onPath) followTour(dt);
    else {
      controls.update();
      if (camera.position.y < 0.05) { camera.position.y = 0.05; camera.lookAt(controls.target); }   // stay above the mirror floor
      idleReturn(now);
    }
  }
  function resetView() { stopTour(); flyTo(homePose()); }
  applyPose(homePose()); controls.update();

  // ---------- original frames / live toggle ----------
  let showOriginal = false;
  function toggleOriginal() {
    showOriginal = !showOriginal;
    glCanvas.style.visibility = showOriginal ? 'hidden' : 'visible';
    origCanvas.style.visibility = showOriginal ? 'visible' : 'hidden';
    if (showOriginal) { tour.onPath = false; flyTo(homePose(), 0.6); }   // the original only exists from the home view
  }

  // ---------- music: the recording's soundtrack, looping at its end ----------
  // Browsers reliably allow sound that starts inside a click, so the music starts with the play click itself: the
  // file begins LEAD seconds before the intertitle and plays under the start screen's outro. Every play() call
  // below runs inside a click or key press.
  const HZ = 3546895 / (227 * 313);                        // PAL field rate, 49.92 Hz: the demo's clock, and the music's
  const LEAD = press.fullOutro / HZ;                        // where the intertitle falls in the file
  const music = new Audio(IT.music.src);
  music.loop = true; music.preload = 'auto';
  let musicOn = false, looped = false, lastMusicT = 0;
  function playMusicAt(t) {
    music.currentTime = t;
    looped = false; lastMusicT = t;
    music.play().then(() => { musicOn = true; }).catch(() => { musicOn = false; });
  }
  const playMusic = () => playMusicAt((LEAD + tl.total / HZ) % (music.duration || Infinity));   // join at the timeline
  function toggleSound() {
    if (!musicOn && running) { music.muted = false; playMusic(); } else music.muted = !music.muted;
  }

  // ---------- field timeline: intertitle, then the part's main loop ----------
  // part: fade-in 16 frames -> scroller alone 350 frames -> animation drops in with a damped bounce -> runs forever
  // tl.total counts fields from the intertitle, which is where the music file starts
  const PART_START = { tick: 0, anim: 0, amp: T.bounceAmplitude, phase: 0, offset: 999 };
  const tl = { pre: 0, total: 0, ...PART_START };
  const FADE_END = T.fadeFrames, HOLD_END = FADE_END + T.holdFrames;
  const TOUR_TICK = HOLD_END + T.bounceAmplitude + Math.round(3 * HZ);       // bounce settled + 3 s
  let acc = 0, gateAcc = 0, running = false, paused = false;
  function tick() {
    tl.total++;
    if (tl.pre < PRE) { tl.pre++; return; }                   // the intertitle plays out, then the part starts at its tick 0
    const t = tl.tick++;
    if (t === TOUR_TICK) startTour();
    if (t === 0) screen.stepScroller();
    if (t < FADE_END) { screen.setFade(t + 1); return; }
    screen.stepScroller();
    if (t < HOLD_END) { tl.offset = 999; return; }
    tl.anim++;                                                // one ray-traced frame per field
    const d1 = Math.floor((D.bounceTable[tl.phase] * tl.amp * 2) / 65536);
    tl.offset = d1;
    tl.phase = (tl.phase + T.phaseStep) % T.phaseWrap;
    tl.amp = Math.max(0, tl.amp - 1);
  }
  function resetTimeline() {
    paused = false;
    resetView();
    Object.assign(tl, { pre: 0, total: 0, ...PART_START });
    screen.reset();
    acc = 0;
  }
  function restart() {                                      // replay from the intertitle, music in step
    resetTimeline();
    if (musicOn) playMusic();
  }
  // the start screen is one big play button; the music starts with the click, then the start-screen outro
  // (prompt wipe, a second's pause, stars fading out) runs before the demo begins on the music's cue
  const gate = document.getElementById('gate');
  function pressPlay() {
    if (gate.hidden) return;
    gate.hidden = true;
    const outro = press.press();
    playMusicAt((press.fullOutro - outro) / HZ);            // a short outro starts further in, so the cue still lands
  }
  function begin() {
    running = true;
    resetTimeline();
  }
  gate.addEventListener('click', pressPlay);
  if (new URLSearchParams(location.search).has('skip')) {    // ?skip: start silently with the intro already played
    screen.setFade(16);
    for (let i = 0; i < 400; i++) screen.stepScroller();
    Object.assign(tl, { pre: PRE, tick: HOLD_END + T.bounceAmplitude, amp: 0, offset: 0 });
    tl.total = PRE + tl.tick;
    gate.hidden = true; running = true;
  }

  function applyBounce() {
    const d1 = tl.offset, visible = Math.max(0, AH - d1);   // image rows d1.. shown, window bottom raised by d1
    animWindow.style.height = `${visible * zoom}px`;
    const shift = `translateY(${-d1 * zoom}px)`;
    glCanvas.style.transform = shift; origCanvas.style.transform = shift;
  }

  // ---------- loop ----------
  // ticks follow the frame clock, pulled back onto the music's clock while its first pass is playing
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (running && !paused) {
      acc += dt * HZ;
      if (musicOn && !music.paused && !looped) {
        const mt = music.currentTime;
        if (mt < lastMusicT - 1) looped = true;               // the file wrapped: from here the picture free-runs
        else { const drift = (mt - LEAD) * HZ - (tl.total + acc); if (Math.abs(drift) > 3) acc += drift; }
        lastMusicT = mt;
      }
      while (acc >= 1) { tick(); acc -= 1; }
    } else if (!running) {                                    // the start screen runs on its own clock
      gateAcc += dt * HZ;
      while (gateAcc >= 1 && !running) { press.tick(); gateAcc -= 1; if (press.finished) begin(); }
    }
    stepCamera(dt, now);
    applyBounce();
    screen.draw(!running ? (px, w) => press.draw(px, w)
      : tl.pre < PRE ? (px, w) => inter.draw(px, w, IT.origin[0], IT.origin[1], tl.pre) : undefined);
    if (tl.offset < AH) {                                     // the animation window is open
      if (showOriginal) origCtx.drawImage(frames[tl.anim % 8], 0, 0);
      else tracer.render(renderer, camera, tl.anim);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function togglePause() {                                  // freezes the demo and its music together; orbiting still works
    paused = !paused;
    if (musicOn) (paused ? music.pause() : music.play().catch(() => {}));
  }
  // no on-screen controls: Space pause, R reset view (ends the flight), M mute, O original frames, I replay from the intertitle
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') resetView();
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyO') toggleOriginal();
    if (e.code === 'KeyI') (running ? restart() : pressPlay());
    if (e.code === 'Space' && running) { e.preventDefault(); togglePause(); }
    if ((e.code === 'Space' || e.code === 'Enter') && !running) { e.preventDefault(); pressPlay(); }
  });
  window.addEventListener('resize', () => setZoom(fitZoom()));
})();
