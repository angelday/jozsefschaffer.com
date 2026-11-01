// GPU re-implementation of the Perfect View ray-traced scene from Enigma part 9.
// Spheres, a mirror floor with a Mandelbrot texture, fog, Phong shading, a point light with shadows; sky is never reflected.
window.Part9Raytrace = function (THREE, scene) {
  const MAX_SPHERES = 48;
  const { degToRad } = THREE.MathUtils;

  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const sky = scene.sky; // [elevationDeg, [r,g,b]] from the top row down to the horizon

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCamWorld: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uSpheres: { value: Array.from({ length: MAX_SPHERES }, () => new THREE.Vector4()) }, uCount: { value: 0 },
      uLightPos: { value: v3(scene.light.pos) }, uLightI: { value: scene.light.i },
      uColor: { value: v3(scene.sphere.color) }, uKa: { value: scene.sphere.ka }, uKd: { value: scene.sphere.kd },
      uDiffPow: { value: scene.sphere.dp }, uKs: { value: scene.sphere.ks }, uShin: { value: scene.sphere.n },
      uFloorRot: { value: scene.floor.rot }, uFloorScale: { value: new THREE.Vector2(scene.floor.s, scene.floor.s * scene.floor.k) },
      uFloorC: { value: new THREE.Vector2(scene.floor.cx, scene.floor.cy) },
      uPalette: { value: scene.floor.palette.map(v3) }, uFog: { value: v3(scene.floor.fog) }, uFogLength: { value: scene.floor.fogLength },
      uMaxDist: { value: scene.floor.maxDistance }, uReflect: { value: scene.floor.reflect }, uShadow: { value: scene.floor.shadow },
      uSkyE: { value: sky.map((s) => s[0]) }, uSkyC: { value: sky.map((s) => v3(s[1])) },
      uResolution: { value: new THREE.Vector2(320, 150) },
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      precision highp float;
      #define MAXS ${MAX_SPHERES}
      #define NSKY ${sky.length}
      uniform mat4 uCamWorld, uProjInv; uniform vec3 uCamPos; uniform vec2 uResolution;
      uniform vec4 uSpheres[MAXS]; uniform int uCount;
      uniform vec3 uLightPos, uColor; uniform float uLightI, uKa, uKd, uDiffPow, uKs, uShin;
      uniform float uFloorRot; uniform vec2 uFloorScale, uFloorC; uniform vec3 uPalette[16], uFog;
      uniform float uFogLength, uMaxDist, uReflect, uShadow;
      uniform float uSkyE[NSKY]; uniform vec3 uSkyC[NSKY];

      float traceSpheres(vec3 ro, vec3 rd, out int hit) {
        float best = 1e9; hit = -1;
        for (int i = 0; i < MAXS; i++) {
          if (i >= uCount) break;
          vec4 s = uSpheres[i];
          vec3 oc = ro - s.xyz;
          float b = dot(oc, rd), c = dot(oc, oc) - s.w * s.w, h = b * b - c;
          if (h < 0.0) continue;
          float t = -b - sqrt(h);
          if (t > 1e-3 && t < best) { best = t; hit = i; }
        }
        return best;
      }
      // point light: only spheres between p and the lamp block it
      bool inShadow(vec3 p, int count) {
        vec3 tl = uLightPos - p;
        float dl = length(tl);
        vec3 l = tl / dl;
        for (int i = 0; i < MAXS; i++) {
          if (i >= count) break;
          vec4 s = uSpheres[i];
          vec3 oc = p - s.xyz;
          float b = dot(oc, l), c = dot(oc, oc) - s.w * s.w, h = b * b - c;
          if (h > 0.0) { float t = -b - sqrt(h); if (t > 1e-3 && t < dl) return true; }
        }
        return false;
      }
      // colours are in Amiga 4-bit gun units (0..15) throughout, like the original tracer's output
      vec3 shadeSphere(vec3 p, int i, vec3 v) {
        vec3 n = normalize(p - uSpheres[i].xyz);
        vec3 col = uKa * uColor, l = normalize(uLightPos - p);
        float ndl = dot(n, l);
        if (ndl > 0.0 && !inShadow(p + n * 1e-3, uCount)) {
          float spec = uKs * pow(max(dot(reflect(-l, n), v), 0.0), uShin);
          col += (uKd * uColor * pow(ndl, uDiffPow) + spec) * uLightI;
        }
        return min(col, vec3(15.0));
      }
      vec3 floorColour(vec3 p, float dist) {
        vec2 q = p.xz * uFloorScale;
        float cs = cos(uFloorRot), sn = sin(uFloorRot);
        vec2 c = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y) + uFloorC;
        vec2 z = vec2(0.0);
        int n = 0;
        for (int k = 0; k < 15; k++) {
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
          if (dot(z, z) > 4.0) break;
          n++;
        }
        vec3 base = uPalette[0];
        for (int k = 0; k < 16; k++) if (k == n) base = uPalette[k];
        float f = 1.0 - exp(-dist / uFogLength);
        return min(base * (1.0 - f) + uFog * f, vec3(15.0));
      }
      vec3 skyColour(vec3 rd) {
        float e = degrees(asin(clamp(rd.y, -1.0, 1.0)));
        if (e >= uSkyE[0]) return uSkyC[0];
        for (int i = 1; i < NSKY; i++) {
          if (e >= uSkyE[i]) return mix(uSkyC[i], uSkyC[i - 1], (e - uSkyE[i]) / max(uSkyE[i - 1] - uSkyE[i], 1e-4));
        }
        return uSkyC[NSKY - 1];
      }
      void main() {
        vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
        vec4 pv = uProjInv * vec4(ndc, 1.0, 1.0);
        vec3 rd = normalize((uCamWorld * vec4(pv.xyz / pv.w, 0.0)).xyz);
        vec3 ro = uCamPos;

        int hit; float ts = traceSpheres(ro, rd, hit);
        float tf = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
        vec3 col;
        if (hit >= 0 && ts < tf) {
          col = shadeSphere(ro + rd * ts, hit, -rd);
        } else if (tf < 1e8) {
          if (tf > uMaxDist) col = vec3(0.0);                       // beyond the tracer's range: black horizon line
          else {
            vec3 p = ro + rd * tf;
            col = floorColour(p, tf);
            if (inShadow(p + vec3(0.0, 1e-3, 0.0), uCount)) col *= uShadow;   // from the original view the far arch's shadow is hidden behind it
            vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
            int rh; float tr = traceSpheres(p + vec3(0.0, 1e-3, 0.0), rr, rh);
            if (rh >= 0) col = mix(col, shadeSphere(p + rr * tr, rh, -rr), uReflect);
          }
        } else {
          col = skyColour(rd);
        }
        gl_FragColor = vec4(floor(clamp(col, 0.0, 15.0) + 0.5) / 15.0, 1.0);  // 12-bit Amiga colour
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Two elliptical rings of spheres sunk into the floor, turning one sphere-step per 8 PAL fields.
  // The far ring is a smaller copy of the main one with its own yaw, tilt and flattening.
  function ringSpheres(frame) {
    const out = [], r = scene.ring, r2 = scene.ring2;
    const add = (cx, cz, yawDeg, tiltDeg, ell, phase, s) => {
      const yw = degToRad(yawDeg), dx = Math.sin(yw), dz = Math.cos(yw);
      const tl = degToRad(tiltDeg), ux = Math.cos(yw) * Math.sin(tl), uy = Math.cos(tl), uz = -Math.sin(yw) * Math.sin(tl);
      const N = Math.round(r.N), Rh = r.R * ell * s, Rv = r.R * s;
      for (let i = 0; i < N; i++) {
        const a = ((i + phase) / N) * Math.PI * 2, ca = Math.cos(a) * Rh, sa = Math.sin(a) * Rv;
        const cy = sa * uy - r.depth * s;
        if (cy < -r.rs * s) continue;
        out.push([cx + ca * dx + sa * ux, cy, cz + ca * dz + sa * uz, r.rs * s]);
      }
    };
    add(r.x, r.z, r.ryaw, r.tilt, r.ell, r.phase + r.dir * frame / 8, 1);
    add(r2.x, r2.z, r2.ryaw, r2.tilt, r2.ell, r2.phase + r.dir * frame / 8, r2.scale);
    return out;
  }

  return {
    render(renderer, camera, frame) {
      const u = material.uniforms, s = ringSpheres(frame);
      s.forEach((p, i) => u.uSpheres.value[i].set(p[0], p[1], p[2], p[3]));
      u.uCount.value = Math.min(s.length, MAX_SPHERES);
      camera.updateMatrixWorld();
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uCamPos.value.copy(camera.position);
      renderer.getDrawingBufferSize(u.uResolution.value);
      renderer.render(quadScene, quadCamera);
    },
  };
};
