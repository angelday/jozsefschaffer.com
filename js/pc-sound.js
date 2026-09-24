const buffers = new Map();
let ctx = null;

function getContext() {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

async function loadSound(url) {
  if (buffers.has(url)) return buffers.get(url);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await getContext().decodeAudioData(arrayBuffer);
  buffers.set(url, buffer);
  return buffer;
}

export async function playSound(url, options = {}) {
  const audioCtx = getContext();
  const buf = await loadSound(url);
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.5;
  source.buffer = buf;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  options.onStart?.();
  source.start();
  return new Promise((resolve) => {
    source.onended = resolve;
  });
}
