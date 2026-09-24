import{av as V,ab as z,$ as W,A as H,D as _,G as O,au as Z,Z as $,ac as j,ar as k,P as L,a1 as q,S as N,i as K,E as X,c as Y,as as T}from"./three.module.CSz_Xow-.js";import{S as D,i as J,a as Q}from"./mapillary-card-scene.DjqpyAqE.js";const x="__brandHeroSceneCleanup",ee=5,te=.65,ae=.65,re=3,ne=6,oe=186;function se(e){typeof e[x]=="function"&&e[x](),e.querySelectorAll("canvas").forEach(t=>{(t.getContext("webgl2")||t.getContext("webgl")||t.getContext("experimental-webgl"))?.getExtension("WEBGL_lose_context")?.loseContext(),t.remove()})}function G(e){e.traverse(t=>{t.geometry&&t.geometry.dispose(),t.material&&(Array.isArray(t.material)?t.material.forEach(a=>a.dispose()):t.material.dispose())})}function ie(e,t){const a=e?.trim();return a?/^(?:https?:)?\/\//.test(a)||a.startsWith("/")?a:`${t}/${a.replace(/^\/+/,"")}`:""}function ce(){const e=document.querySelector("[data-brand-hero-canvas]");if(!e)return;se(e);const t=(e.dataset.base||"").replace(/\/$/,""),a=ie(e.dataset.brandSvg,t);if(!a)return;const f=document.createElement("canvas");f.style.cssText="position:absolute;inset:0;width:100%;height:100%",e.appendChild(f);const r=new V({canvas:f,alpha:!0,antialias:!1});r.setClearColor(0,0),r.setPixelRatio(window.devicePixelRatio||1);const o=new z,u=new W(38,1,1,1e3);u.position.set(0,0,380),o.add(new H(16777215,.74));const w=new _(16777215,1.9);w.position.set(-80,110,180),o.add(w);const E=new _(16777215,.72);E.position.set(120,-80,120),o.add(E);const n=new O;n.rotation.y=-.34,o.add(n);const d=new Z(1,1,{depthBuffer:!0,stencilBuffer:!1}),g=new z,b=new $(-1,1,1,-1,0,1);b.position.z=1;const m=new j({depthTest:!1,depthWrite:!1,transparent:!0,uniforms:{tDiffuse:{value:d.texture},uResolution:{value:new k(1,1)},uPixelSize:{value:ne}},vertexShader:`
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,fragmentShader:`
      precision highp float;

      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uPixelSize;
      varying vec2 vUv;

      float bayer4(vec2 cell) {
        vec2 p = mod(cell, 4.0);
        float x = p.x;
        float y = p.y;

        if (y < 1.0) {
          if (x < 1.0) return 0.0 / 16.0;
          if (x < 2.0) return 8.0 / 16.0;
          if (x < 3.0) return 2.0 / 16.0;
          return 10.0 / 16.0;
        }

        if (y < 2.0) {
          if (x < 1.0) return 12.0 / 16.0;
          if (x < 2.0) return 4.0 / 16.0;
          if (x < 3.0) return 14.0 / 16.0;
          return 6.0 / 16.0;
        }

        if (y < 3.0) {
          if (x < 1.0) return 3.0 / 16.0;
          if (x < 2.0) return 11.0 / 16.0;
          if (x < 3.0) return 1.0 / 16.0;
          return 9.0 / 16.0;
        }

        if (x < 1.0) return 15.0 / 16.0;
        if (x < 2.0) return 7.0 / 16.0;
        if (x < 3.0) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy / uPixelSize);
        vec2 snapped = (cell + 0.5) * uPixelSize;
        vec4 sampleColor = texture2D(tDiffuse, clamp(snapped / uResolution, 0.0, 1.0));
        float luma = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
        float coverage = clamp(sampleColor.a * luma * 1.35, 0.0, 1.0);
        float threshold = bayer4(cell);

        gl_FragColor = coverage > threshold ? vec4(vec3(1.0), 1.0) : vec4(0.0);
      }
    `});m.toneMapped=!1,g.add(new L(new q(2,2),m));const A=new N({color:16777215,metalness:.08,roughness:.34,side:K});let y=!1,C=0;function M(){const s=e.getBoundingClientRect(),p=Math.max(1,Math.floor(s.width)),h=Math.max(1,Math.floor(s.height));r.setSize(p,h,!1);const l=r.getPixelRatio(),i=Math.max(1,Math.floor(p*l)),c=Math.max(1,Math.floor(h*l));d.setSize(i,c),m.uniforms.uResolution.value.set(i,c),u.aspect=p/h,u.updateProjectionMatrix()}M();const R=new ResizeObserver(M);R.observe(e),fetch(a).then(s=>s.text()).then(s=>{if(y)return;new D().parse(s).paths.forEach(S=>{D.createShapes(S).forEach(F=>{const I=new X(F,{depth:ee,bevelEnabled:!0,bevelThickness:te,bevelSize:ae,bevelSegments:re}),U=new L(I,A.clone());n.add(U)})});const l=new Y().setFromObject(n),i=l.getCenter(new T),c=l.getSize(new T),B=Math.max(c.x,c.y,c.z),v=oe/Math.max(1,B);n.children.forEach(S=>{S.geometry.translate(-i.x,-i.y,-i.z)}),n.scale.set(v,-v,v)});function P(){C=requestAnimationFrame(P),n.rotation.y=-.34+performance.now()*42e-5,r.setRenderTarget(d),r.render(o,u),r.setRenderTarget(null),r.render(g,b)}e[x]=()=>{y=!0,cancelAnimationFrame(C),R.disconnect(),G(o),G(g),d.dispose(),m.dispose(),r.dispose(),f.remove(),e[x]=null},P()}ce();J();Q();
