// A scripted camera flight through the part 9 scene: under the main arch, across the fractal and under the far arch,
// a full turn that rises to a high overview, a close pass over the arch top, then a dolly zoom back into the original view.
// Each channel (camera position, look-at point, vertical FOV) is a chain of cubic Bézier segments through timed keys.
// The inner handles follow the neighbouring keys divided by their time span, so the speed is continuous across keys;
// the first and last keys are at rest.
window.Part9Flyover = function (home) {                 // home: { position, target, fov } of the original view
  const HOME = [home.position, home.target, home.fov];
  // [seconds, camera position, look-at point, vertical FOV in degrees]
  const KEYS = [
    [0, ...HOME],                                                  // the original view
    [3.5, [1.31, 0.5, -3.95], [-3.06, 0.95, -8.49], 56],           // glide down towards the main arch
    [6, [-0.98, 0.5, -6.33], [-3.75, 2, -9.21], 74],               // under it, looking up through the ring
    [8.5, [-3.47, 0.75, -8.92], [3, 0.8, -12], 60],
    [10.2, [0.6, 0.85, -11.3], [9, 1, -12], 54],                   // round behind its right foot...
    [12, [6.8, 1, -9.3], [8.45, 1.2, -16.03], 52],                 // ...and across the front of the far arch
    [13.8, [12.6, 0.8, -11.2], [8.45, 0.9, -16.03], 50],
    [15.5, [10.68, 0.55, -14.02], [6.97, 1.6, -17.38], 60],        // under the far arch, front to back
    [17, [8.45, 0.42, -16.03], [5.49, 1.3, -18.72], 72],
    [19, [5.26, 1.5, -18.92], [3.74, 0.6, -11.18], 56],
    [21.5, [14.13, 3.2, -17.18], [3.74, 0.6, -11.18], 52],         // a full turn around both arches...
    [24, [15.03, 4.5, -8.99], [3.74, 0.6, -11.18], 52],
    [26.5, [10.73, 6.5, -0.82], [3.74, 0.6, -11.18], 56],
    [29, [1.26, 8, 1.58], [3.74, 0.6, -11.18], 62],                // ...highest over the front
    [31.5, [-6.62, 7, -4.19], [3.74, 0.6, -11.18], 56],
    [34, [-8.04, 5.5, -13.47], [3.74, 0.6, -11.18], 52],
    [36.5, [-2.41, 4.5, -20.3], [3.74, 0.6, -11.18], 50],
    [39, [5.53, 4, -20], [3.74, 0.6, -11.18], 48],
    [41.5, [-2.78, 5.9, -8.2], [-0.71, 2.06, -6.05], 34],          // telephoto on the arch top from above
    [44, [-0.43, 3.6, -5.77], [1.24, 0.3, -4.02], 70],             // close pass over it
    [47, [2.6, 1.5, -1.2], [-0.05, 0.52, -5.98], 70],              // round to the front
    [49.5, [-0.03, 0.74, -3.19], [-0.05, 0.52, -5.98], 80.42],     // dolly zoom: the arch keeps its size...
    [51, [-0.01, 0.87, -1.59], [-0.05, 0.52, -5.98], 58.81],
    [52.5, ...HOME],                                               // ...until the original framing is back
  ];
  const times = KEYS.map((k) => k[0]), last = KEYS.length - 1;

  // Bézier control points for one channel (an array of numbers per key)
  function channel(values) {
    const vel = values.map((v, i) => (i === 0 || i === last ? v.map(() => 0)
      : v.map((_, c) => (values[i + 1][c] - values[i - 1][c]) / (times[i + 1] - times[i - 1]))));
    return values.slice(0, last).map((v, i) => {
      const h = times[i + 1] - times[i], w = values[i + 1];
      return [v, v.map((x, c) => x + (vel[i][c] * h) / 3), w.map((x, c) => x - (vel[i + 1][c] * h) / 3), w];
    });
  }
  const pos = channel(KEYS.map((k) => k[1])), look = channel(KEYS.map((k) => k[2])), fov = channel(KEYS.map((k) => [k[3]]));
  const bezier = ([a, b, c, d], u, out) => {
    const v = 1 - u;
    for (let i = 0; i < a.length; i++) out[i] = v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i];
    return out;
  };

  const f = [0];
  return {
    duration: times[last],
    // pose at time t (seconds): fills position and target ([x, y, z] arrays), returns the vertical FOV
    sample(t, position, target) {
      t = Math.max(0, Math.min(times[last], t));
      let i = 0;
      while (i < last - 1 && t >= times[i + 1]) i++;
      const u = (t - times[i]) / (times[i + 1] - times[i]);
      bezier(pos[i], u, position);
      bezier(look[i], u, target);
      return bezier(fov[i], u, f)[0];
    },
  };
};
