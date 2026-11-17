/* Living backdrops and the corridor: one WebGL fragment shader, several modes.

   0 retractbench    a grid of probes; a ripple goes out, then is taken back
   1 storygecko      slow scales, like gecko skin
   2 aquainspection  pool-light caustics
   3 riftforge       a rift at dusk
   4 box             the starfield behind the headline
   5 corridor        the inside of the box, in 3D: an endless corridor whose
                     doors are portals onto modes 0 to 3

   The corridor is not ray-marched. Walls, floor and ceiling are flat, so each
   pixel's ray is intersected with them directly, which is cheap and exact.
   The same arithmetic runs in JavaScript to pin the door labels in place and
   to work out which door a click landed on.

   No WebGL: flat colors, and the doors become an ordinary row of links.
   Reduced motion: a single still frame, no jump. Plain view: all of it off. */
(function () {
  "use strict";

  var ROOMS = {
    retractbench: { mode: 0, a: "#e3e7f7", b: "#c9d0f1", c: "#aab4e6" },
    storygecko: { mode: 1, a: "#e0efe3", b: "#cbe4d0", c: "#b3d6ba" },
    aquainspection: { mode: 2, a: "#cdebec", b: "#f6fdfd", c: "#a9dcdf" },
    riftforge: { mode: 3, a: "#1f1020", b: "#4a2145", c: "#e9b44c" },
    box: { mode: 4, a: "#10131f", b: "#2b3358", c: "#f4efe4" },
    corridor: { mode: 5, a: "#070912", b: "#1a1f36", c: "#f4efe4" }
  };

  /* Corridor geometry, shared by the shader and the JavaScript below. */
  var G = { W: 1.1, H: 1.25, D: 3.0, DW: 0.75, DH: 2.0, Z0: 1.1, EYE: -0.25 };

  var VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  var FRAG = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes;uniform float uTime;uniform float uMode;uniform float uSeed;",
    "uniform vec3 uA;uniform vec3 uB;uniform vec3 uC;",
    "uniform float uJump;uniform float uOz;uniform float uRoll;uniform float uFocal;",
    "uniform float uFog;uniform float uPattern;uniform vec2 uPointer;",
    "uniform float uOx;uniform vec4 uPerm;uniform float uEgg;",
    "vec3 gA;vec3 gB;vec3 gC;float gAsp;float gWide;float gRiftX;",

    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}",

    "vec3 probes(vec2 uv){",
    " float n=16.;vec2 g=fract(uv*n)-.5;vec2 id=floor(uv*n)/n;",
    " float dist=length(id-vec2(gAsp*.72,.45));",
    " float t=5.5*sin(uTime*.22);",                       /* out, then back */
    " float wave=exp(-pow((dist*6.-abs(t))*1.1,2.));",
    " float r=.07+.13*wave;",
    " float dotm=smoothstep(r+.03,r,length(g));",
    " return mix(gA,mix(gB,gC,wave),dotm);}",

    "vec3 scales(vec2 uv){",
    " vec2 p=uv*7.;vec2 ip=floor(p),fp=fract(p);float f1=8.,f2=8.;",
    " for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));",
    "  vec2 h=hash2(ip+o);h=.5+.42*sin(uTime*.25+6.2831*h);",
    "  float d=length(o+h-fp);if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}}",
    " float edge=smoothstep(.0,.09,f2-f1);",
    " vec3 col=mix(gB,gA,smoothstep(.0,.7,f1));",
    " return mix(gC,col,edge);}",

    "vec3 caustics(vec2 uv){",
    " float T=uTime*.35+23.;vec2 p=mod(uv*6.2831*.9,6.2831)-250.;vec2 i=p;float c=1.;float inten=.005;",
    " for(int n=0;n<5;n++){float t=T*(1.-(3.5/float(n+1)));",
    "  i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));",
    "  c+=1./length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));}",
    " c/=5.;c=1.17-pow(c,1.4);float v=clamp(pow(abs(c),8.),0.,1.);",
    " vec3 base=mix(gA,gC,.35*fbm(uv*1.5+uTime*.03));",
    " return mix(base,gB,v*.85);}",

    "vec3 rift(vec2 uv){",
    " float t=uTime*.12;",
    " vec3 col=mix(gA,gB,fbm(uv*1.6+vec2(t,-t*.5))*.9*smoothstep(0.,1.,uv.y+.2));",
    " float cx=gAsp*gRiftX+(fbm(vec2(uv.y*2.2,t*1.5))-.5)*mix(.18,.5,gWide)+(noise(vec2(uv.y*9.,t*3.))-.5)*.06;",
    " float d=abs(uv.x-cx);",
    " float taper=smoothstep(0.,.25,uv.y)*smoothstep(1.,.7,uv.y);",
    " float glow=min(.012/(d+.004),.75)*taper*(.8+.2*sin(uTime*.9))*mix(.6,1.,gWide);",
    " col+=gC*glow;col+=gB*.6*exp(-d*5.)*taper;",
    " return col;}",

    "vec3 stars(vec2 uv,float amount){",
    " vec3 col=vec3(0.);",
    " for(int k=0;k<3;k++){float fk=float(k);float L=14.+fk*13.;",
    "  vec2 g=uv*L+uSeed*17.+fk*31.;vec2 id=floor(g);vec2 f=fract(g)-.5;",
    "  vec2 h=hash2(id+fk*7.);float on=step(.8+fk*.04,hash(id+fk*3.+.5));",
    "  float d=length(f-(h-.5)*.7);float tw=.55+.45*sin(uTime*(.4+h.x*1.6)+h.y*6.2831);",
    "  col+=gC*on*tw*smoothstep(.07-fk*.015,0.,d)*(1.-fk*.25);}",
    " return col*amount;}",

    "vec3 sky(vec2 uv){",
    " vec3 col=gA+gB*.55*smoothstep(.42,.95,fbm(uv*1.25+uSeed*3.7));",
    " col+=gB*.25*smoothstep(.5,1.,fbm(uv*3.1-uSeed*1.9));",
    " col+=stars(uv,1.);",
    " vec2 f=uv-vec2(gAsp*.82,.8);",                    /* one star that is in the same place in every world */
    " col+=vec3(1.,.97,.9)*(1.1*exp(-length(f)*70.)+.5*exp(-abs(f.x)*400.-abs(f.y)*22.)+.5*exp(-abs(f.y)*400.-abs(f.x)*22.));",
    " return col;}",

    /* ---- the corridor ---- */
    "const float W=1.1;const float H=1.25;const float D=3.;const float DW=.75;const float DH=2.;const float Z0=1.1;",

    "vec3 tintOf(float i){",
    " if(i<.5)return vec3(.50,.58,1.);if(i<1.5)return vec3(.45,.86,.58);",
    " if(i<2.5)return vec3(.40,.86,.90);if(i<3.5)return vec3(.95,.70,.28);return vec3(1.,.96,.86);}",

    /* What you see through door i. uv.y runs 0..1 up the door. */
    "vec3 world(float i,vec2 uv){",
    " vec3 sa=gA,sb=gB,sc=gC;float sasp=gAsp;vec3 col;",
    " gAsp=.75;gWide=1.;gRiftX=.5;",
    " if(i<.5){gA=vec3(.89,.91,.97);gB=vec3(.72,.76,.95);gC=vec3(.52,.58,.92);col=probes(uv*.9);}",
    " else if(i<1.5){gA=vec3(.88,.94,.89);gB=vec3(.70,.88,.74);gC=vec3(.50,.76,.56);col=scales(uv*.8);}",
    " else if(i<2.5){gA=vec3(.74,.91,.92);gB=vec3(.97,1.,1.);gC=vec3(.55,.84,.87);col=caustics(uv*.8);}",
    " else if(i<3.5){gA=vec3(.12,.06,.13);gB=vec3(.29,.13,.27);gC=vec3(.91,.71,.30);col=rift(uv);}",
    " else{gA=vec3(.02,.02,.06);gB=vec3(.22,.24,.5);gC=vec3(1.,.97,.9);",          /* the door that should not be there */
    "  col=sky(uv*1.6+uTime*.01)+gC*(.9*exp(-length(uv-vec2(.375,.62))*16.)+.25*exp(-length(uv-vec2(.375,.62))*4.));}",
    " gA=sa;gB=sb;gC=sc;gAsp=sasp;return col;}",

    "float seams(vec3 p){",
    " float l=uPattern<.5?fract(p.z*.6667):uPattern<1.5?fract(p.y*2.4):min(fract(p.z*1.3333),fract(p.y*1.6));",
    " return smoothstep(0.,.035,l)*smoothstep(1.,.965,l);}",

    "vec3 scene(vec2 uv){",
    " float cr=cos(uRoll),sr=sin(uRoll);uv=vec2(cr*uv.x-sr*uv.y,sr*uv.x+cr*uv.y);",
    " vec3 ro=vec3(uOx,-.25,uOz);",
    " vec3 rd=normalize(vec3(uv+uPointer,uFocal));",
    " float rx=abs(rd.x)<1e-4?1e-4:rd.x;float ry=abs(rd.y)<1e-4?1e-4:rd.y;",
    " float tx=((rx>0.?W:-W)-ro.x)/rx;float ty=((ry>0.?H:-H)-ro.y)/ry;",
    " float t=min(tx,ty);vec3 p=ro+rd*t;",
    " float zz=p.z-Z0;float k=floor(zz/D);float dz=zz-(k+.5)*D;",
    " float side=p.x>0.?1.:0.;float slot=mod(k*2.+side,4.);",
    " float idx=slot<.5?uPerm.x:slot<1.5?uPerm.y:slot<2.5?uPerm.z:uPerm.w;",          /* which world is behind which door */
    " if(uEgg>.5&&abs(k-2.)<.5&&side<.5)idx=4.;",
    " vec3 tint=tintOf(idx);",
    " vec3 col;",
    " if(tx<ty){",
    "  float inx=abs(dz)/DW;float yy=(p.y+H)/DH;",
    "  if(inx<1.&&yy<1.){",
    "   vec2 q=vec2((dz/DW*.5+.5)*.75,yy);if(side<.5)q.x=.75-q.x;",
    "   col=world(idx,q);",
    "   float e=clamp(min(1.-inx,min(1.-yy,yy+.02))*9.,0.,1.);col*=.5+.5*e;",          /* depth of the frame */
    "  }else{",
    "   float dd=length(max(vec2(abs(dz)-DW,p.y-(-H+DH)),0.));",
    "   col=gB*(.45+.55*seams(p));",
    "   col+=tint*(.75*exp(-dd*6.)+.22*exp(-dd*1.3));",
    "   col+=tint*smoothstep(.035,0.,abs(dd-.045))*1.3;",                              /* the lit frame */
    "  }",
    " }else{",
    "  float wd=W-abs(p.x);float m=smoothstep(DW*1.6,DW*.2,abs(dz));",
    "  float fl=ry<0.?1.:.22;",
    "  col=gB*(.3+.3*seams(p.zxy));",
    "  col+=tint*m*exp(-wd*1.5)*fl;",                                                 /* light spilling from the door */
    "  if(ry<0.)col+=tint*m*.25*exp(-wd*.5)*smoothstep(.2,.0,abs(fract(p.z*2.)-.5)-.42);",
    " }",
    " float fog=1.-exp(-t*uFog);",
    " vec2 v=rd.xy/rd.z;",
    " vec3 far=gA+gC*.22*exp(-length(v)*9.)+stars(v*2.2,.8*smoothstep(.5,1.,fog));",
    " vec2 fs=v-vec2(.012,.028);",                      /* the same fixed star, at the end of every corridor */
    " far+=vec3(1.,.97,.9)*(1.4*exp(-length(fs)*260.)+.5*exp(-abs(fs.x)*1500.-abs(fs.y)*90.)+.5*exp(-abs(fs.y)*1500.-abs(fs.x)*90.));",
    " return mix(col,far,fog);}",

    "void main(){",
    " vec2 uv=gl_FragCoord.xy/uRes.y;vec3 col;",
    " gA=uA;gB=uB;gC=uC;gAsp=uRes.x/uRes.y;gWide=smoothstep(.6,1.4,gAsp);gRiftX=mix(.93,.78,gWide);",
    " if(uMode<.5)col=probes(uv);else if(uMode<1.5)col=scales(uv);",
    " else if(uMode<2.5)col=caustics(uv);else if(uMode<3.5)col=rift(uv);",
    " else if(uMode<4.5)col=sky(uv);",
    " else{",
    "  vec2 c=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    "  if(uJump>.001){float a=sin(3.14159*uJump);",                                   /* mid-jump: colors come apart */
    "   col=vec3(scene(c*(1.+.07*a)).r,scene(c).g,scene(c*(1.-.07*a)).b)+gC*pow(a,7.)*.9;}",
    "  else col=scene(c);",
    "  col*=1.-.35*dot(c,c);",
    " }",
    " gl_FragColor=vec4(col,1.);}"
  ].join("\n");

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  var root = document.documentElement;
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var UNIFORMS = ["uRes", "uTime", "uMode", "uSeed", "uA", "uB", "uC", "uJump", "uOz", "uRoll", "uFocal", "uFog", "uPattern", "uPointer", "uOx", "uPerm", "uEgg"];

  function Backdrop(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console) console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var vs = shader(gl.VERTEX_SHADER, VERT);
    var fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    UNIFORMS.forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1f(u.uFocal, 1);
    gl.uniform1f(u.uFog, 0.1);
    gl.uniform4fv(u.uPerm, [0, 1, 2, 3]);

    var self = this;
    var raf = 0;
    var visible = true;
    var start = performance.now();
    this.ok = true;
    this.canvas = canvas;
    this.onScreen = false;
    this.speed = 1;
    this.before = null;         /* called each frame, before drawing */

    this.set = function (name, a, b) {
      if (b !== undefined) gl.uniform2f(u[name], a, b);
      else if (a.length === 4) gl.uniform4fv(u[name], a);
      else if (a.length) gl.uniform3fv(u[name], a);
      else gl.uniform1f(u[name], a);
    };

    this.setRoom = function (name) {
      var r = ROOMS[name];
      if (!r) return false;
      gl.uniform1f(u.uMode, r.mode);
      gl.uniform3fv(u.uA, rgb(r.a));
      gl.uniform3fv(u.uB, rgb(r.b));
      gl.uniform3fv(u.uC, rgb(r.c));
      gl.uniform1f(u.uSeed, 0);
      return true;
    };

    /* The box changes with the world: a seed moves the stars, a tint colors the light. */
    this.setWorld = function (seed, tint) {
      gl.uniform1f(u.uSeed, (seed % 997) / 997 * 40);
      if (tint) gl.uniform3fv(u.uC, rgb(tint));
    };

    this.resize = function () {
      var scale = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(canvas.clientWidth * scale));
      var h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
    };

    this.draw = function () {
      if (self.before) self.before();
      gl.uniform1f(u.uTime, still ? 12.0 : (performance.now() - start) / 1000 * self.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      self.draw();
      if (!still || self.forceLoop) raf = requestAnimationFrame(frame);
    }

    this.play = function () {
      visible = true;
      self.resize();
      if (!raf) raf = requestAnimationFrame(frame);
    };
    this.pause = function () {
      visible = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && visible && !raf) raf = requestAnimationFrame(frame);
    });
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      self.pause();
      canvas.style.display = "none";
    });
  }

  function make(className) {
    var canvas = document.createElement("canvas");
    canvas.className = className;
    canvas.setAttribute("aria-hidden", "true");
    return canvas;
  }

  function create(canvas) {
    var b = new Backdrop(canvas);
    return b && b.ok ? b : null;
  }

  var all = [];
  function isPlain() {
    return root.classList.contains("plain");
  }

  function watch(b, host) {
    all.push(b);
    window.addEventListener("resize", function () {
      b.resize();
      b.draw();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        b.onScreen = entries[entries.length - 1].isIntersecting;
        if (b.onScreen && !isPlain()) b.play();
        else b.pause();
      }, { rootMargin: "80px" }).observe(host);
    } else {
      b.onScreen = true;
      if (!isPlain()) b.play();
    }
  }

  /* ---------- Project pages: one backdrop behind the masthead and title ---------- */
  var room = document.body.getAttribute("data-room");
  var head = document.querySelector(".room-head");
  try {
    /* Arriving through a door in the corridor: the room opens up from a door-shaped slot. */
    if (room && window.sessionStorage.getItem("re-enter") === "1") {
      window.sessionStorage.removeItem("re-enter");
      if (!still && !root.classList.contains("plain")) root.classList.add("arrive");
    }
  } catch (e) { /* storage is optional */ }
  if (room && head && ROOMS[room]) {
    var canvas = make("backdrop");
    document.body.insertBefore(canvas, document.body.firstChild);
    var size = function () {
      canvas.style.height = Math.ceil(head.getBoundingClientRect().bottom + window.scrollY) + "px";
    };
    size();
    var bd = create(canvas);
    if (bd) {
      bd.setRoom(room);
      window.addEventListener("resize", size);
      watch(bd, canvas);
    } else {
      canvas.remove();
    }
  }

  /* ---------- Front page: the sky behind the headline, and each world's band ---------- */
  var hosts = document.querySelectorAll(".band[data-room], [data-backdrop]");
  Array.prototype.forEach.call(hosts, function (host) {
    var name = host.getAttribute("data-backdrop") || host.getAttribute("data-room");
    if (!ROOMS[name]) return;
    var c = make("backdrop");
    host.insertBefore(c, host.firstChild);
    var b = create(c);
    if (!b) {
      c.remove();
      return;
    }
    b.setRoom(name);
    if (name === "box") {
      window.addEventListener("worldchange", function (e) {
        b.setWorld(e.detail.seed, e.detail.tint);
        if (!b.onScreen || still) { b.resize(); b.draw(); }
      });
    }
    b.resize();
    b.draw();
    watch(b, host);
  });

  /* ---------- Front page: the corridor ---------- */
  var hall = document.querySelector("[data-corridor]");
  if (hall) {
    var tags = Array.prototype.slice.call(hall.querySelectorAll(".door-tags a:not([data-egg])"));
    var eggTag = hall.querySelector(".door-tags a[data-egg]");
    var cc = make("corridor-view");
    hall.insertBefore(cc, hall.firstChild);
    var cor = create(cc);
    if (!cor) {
      cc.remove();
      hall.classList.add("flat");
    } else {
      cor.setRoom("corridor");
      hall.classList.add("live");

      var widths = {};
      var PERMS = [
        [0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0], [0, 2, 1, 3], [1, 3, 0, 2],
        [2, 0, 3, 1], [3, 1, 2, 0], [0, 3, 2, 1], [1, 2, 3, 0], [2, 1, 0, 3], [3, 0, 1, 2]
      ];
      var world = { tint: "#f4efe4", roll: 0, fog: 0.1, pattern: 0, seed: 0, speed: 1, perm: PERMS[0], egg: false, wall: ROOMS.corridor.b, deep: ROOMS.corridor.a };
      var pending = null;
      var jumpStart = 0;
      var JUMP_MS = 1150;
      var ENTER_MS = 800;
      var entering = null;       /* { start, k, side, href } while the camera flies into a door */
      var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      var view = { roll: 0, focal: 1, oz: 0, ox: 0, shear: 0 };

      var hsl = function (h, sat, light) {
        var a = sat * Math.min(light, 1 - light);
        var f = function (n) {
          var k = (n + h / 30) % 12;
          return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        };
        return [f(0), f(8), f(4)];
      };

      /* Everything about the corridor that depends on which world this is. */
      var params = function (seed, tint, speed) {
        var home = seed === 0;
        var hue = (seed * 47) % 360;
        return {
          seed: seed,
          tint: tint || "#f4efe4",
          roll: home ? 0 : ((seed % 9) - 4) * 0.014,
          fog: home ? 0.1 : 0.075 + (seed % 7) * 0.012,
          pattern: home ? 0 : seed % 3,
          speed: speed || 1,
          perm: home ? PERMS[0] : PERMS[seed % PERMS.length],     /* the doors trade places */
          egg: !home && seed % 9 === 0,                           /* about one world in nine has an extra door */
          wall: home ? rgb(ROOMS.corridor.b) : hsl(hue, 0.34, 0.15),
          deep: home ? rgb(ROOMS.corridor.a) : hsl(hue, 0.5, 0.04)
        };
      };

      var applyWorld = function (w) {
        world = w;
        cor.setWorld(w.seed, w.tint);
        cor.set("uFog", w.fog);
        cor.set("uPattern", w.pattern);
        cor.set("uPerm", w.perm);
        cor.set("uEgg", w.egg ? 1 : 0);
        cor.set("uA", w.deep.length ? w.deep : rgb(w.deep));
        cor.set("uB", w.wall.length === 3 && typeof w.wall !== "string" ? w.wall : rgb(w.wall));
        cor.speed = w.speed;
        widths = {};
        if (eggTag) eggTag.hidden = !w.egg;
        hall.classList.toggle("has-egg", w.egg);
      };

      var focalFor = function () {
        return cc.clientWidth / Math.max(1, cc.clientHeight) < 1.1 ? 0.78 : 1.0;
      };

      /* Where a point in the corridor lands on screen, in CSS pixels. */
      var project = function (x, y, z) {
        var vz = z - view.oz;
        var sx = (x - view.ox) / vz * view.focal - pointer.x;
        var sy = (y - G.EYE) / vz * view.focal - pointer.y;
        var c = Math.cos(-view.roll), s = Math.sin(-view.roll);
        var ux = c * sx - s * sy, uy = s * sx + c * sy;
        var h = cc.clientHeight;
        return { x: ux * h + cc.clientWidth / 2, y: h / 2 - uy * h, depth: vz };
      };

      /* Which door, if any, is under a point on screen. Mirrors the shader. */
      var doorAt = function (px, py) {
        var h = cc.clientHeight;
        var ux = (px - cc.clientWidth / 2) / h, uy = (h / 2 - py) / h;
        var c = Math.cos(view.roll), s = Math.sin(view.roll);
        var rx = c * ux - s * uy + pointer.x, ry = s * ux + c * uy + pointer.y, rz = view.focal;
        if (Math.abs(rx) < 1e-4) rx = 1e-4;
        if (Math.abs(ry) < 1e-4) ry = 1e-4;
        var tx = ((rx > 0 ? G.W : -G.W)) / rx;
        var ty = ((ry > 0 ? G.H : -G.H) - G.EYE) / ry;
        if (tx >= ty) return -1;
        var pz = view.oz + rz * tx, pyy = G.EYE + ry * tx;
        var zz = pz - G.Z0, k = Math.floor(zz / G.D), dz = zz - (k + 0.5) * G.D;
        if (Math.abs(dz) > G.DW || pyy > -G.H + G.DH) return -1;
        if (world.egg && k === 2 && rx < 0) return 4;                  /* the extra door */
        if (k < 0 || k > 1) return -1;
        return world.perm[k * 2 + (rx > 0 ? 1 : 0)];                   /* index into tags */
      };

      var put = function (tag, key, k, side, hide) {
        var cw = cc.clientWidth;
        var z = G.Z0 + (k + 0.5) * G.D;
        var top = project(side * G.W, -G.H + G.DH + 0.1, z);
        var size = Math.round(Math.max(15, Math.min(64, cc.clientHeight * 0.3 * view.focal / top.depth)));
        if (tag.style.fontSize !== size + "px") tag.style.fontSize = size + "px";
        var wk = key + ":" + size;
        if (!widths[wk]) widths[wk] = tag.offsetWidth;
        var w = widths[wk];
        /* Left-wall names hang to the left of their door, right-wall names to the right,
           so the two far ones never run into each other. Both stay inside the view. */
        var x = side < 0 ? top.x - w + size * 0.6 : top.x - size * 0.6;
        x = Math.max(6, Math.min(cw - w - 6, x));
        var y = Math.max(size * 1.75 + 6, top.y);
        tag.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translateY(-100%)";
        tag.style.opacity = hide ? "0" : "1";
      };

      var place = function () {
        var hide = jumpStart > 0 || !!entering;
        for (var slot = 0; slot < 4; slot++) {
          put(tags[world.perm[slot]], "t" + world.perm[slot], Math.floor(slot / 2), slot % 2 ? 1 : -1, hide);
        }
        if (eggTag && world.egg) put(eggTag, "egg", 2, -1, hide);
      };

      /* Fly the camera into a door, then go there. Returns false if it should just navigate. */
      var enter = function (tag) {
        if (still || isPlain() || entering || hall.classList.contains("flat")) return false;
        var k, side;
        if (tag === eggTag) {
          k = 2; side = -1;
        } else {
          var slot = world.perm.indexOf(tags.indexOf(tag));
          if (slot < 0) return false;
          k = Math.floor(slot / 2); side = slot % 2 ? 1 : -1;
        }
        entering = { start: performance.now(), k: k, side: side, href: tag.href, done: false };
        hall.style.setProperty("--enter", tag.getAttribute("data-wash") || "#10131f");
        cor.forceLoop = true;
        cor.play();
        return true;
      };

      tags.concat(eggTag ? [eggTag] : []).forEach(function (tag) {
        tag.addEventListener("click", function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
          if (enter(tag)) e.preventDefault();
        });
      });

      /* Coming back with the Back button: undo the fly-in. */
      window.addEventListener("pageshow", function (e) {
        if (!e.persisted) return;
        entering = null;
        hall.classList.remove("entering");
        cor.resize();
        cor.draw();
        if (cor.onScreen && !isPlain()) cor.play();
      });

      cor.before = function () {
        var now = performance.now();
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        var sway = still ? 0 : Math.sin(now / 4200 * world.speed) * 0.012;
        view.focal = focalFor();
        view.roll = world.roll;
        view.oz = 0;
        var jump = 0;
        if (jumpStart) {
          var t = (now - jumpStart) / JUMP_MS;
          if (t >= 1) {
            jumpStart = 0;
            cor.forceLoop = false;
          } else {
            jump = t;
            var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            view.oz = e * G.D * 2 * 4;                 /* past four pairs of doors: lands on the same pattern */
            view.focal *= 1 - 0.42 * Math.sin(Math.PI * t);
            view.roll += Math.sin(Math.PI * t) * 0.55 * (pending && pending.seed % 2 ? 1 : -1);
            if (t >= 0.5 && pending) {
              applyWorld(pending);
              pending = null;
            }
          }
        }
        view.ox = 0;
        view.shear = 0;
        if (entering) {
          var q = Math.min(1, (now - entering.start) / ENTER_MS);
          var ez = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          view.oz = ez * (G.Z0 + (entering.k + 0.5) * G.D);            /* walk level with the door */
          view.ox = entering.side * ez * 0.8;                          /* step toward it */
          view.shear = entering.side * q * q * q * 3.4;                /* and turn to face it */
          view.roll = world.roll * (1 - ez);
          if (q > 0.62) hall.classList.add("entering");
          if (q >= 1 && !entering.done) {
            entering.done = true;
            try { window.sessionStorage.setItem("re-enter", "1"); } catch (err) { /* optional */ }
            window.location.href = entering.href;
          }
        }
        cor.set("uJump", jump);
        cor.set("uOz", view.oz);
        cor.set("uOx", view.ox);
        cor.set("uRoll", view.roll);
        cor.set("uFocal", view.focal);
        cor.set("uPointer", pointer.x + sway + view.shear, pointer.y * (entering ? 0.3 : 1));
        place();
      };

      window.addEventListener("worldchange", function (e) {
        var next = params(e.detail.seed, e.detail.tint, e.detail.speed);
        if (e.detail.jump && !still && !isPlain() && cor.onScreen) {
          pending = next;
          jumpStart = performance.now();
          cor.forceLoop = true;
          cor.play();
        } else {
          applyWorld(next);
          cor.resize();
          cor.draw();
        }
      });

      hall.addEventListener("pointermove", function (e) {
        var r = cc.getBoundingClientRect();
        pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.16;
        pointer.ty = -((e.clientY - r.top) / r.height - 0.5) * 0.1;
        cc.style.cursor = doorAt(e.clientX - r.left, e.clientY - r.top) >= 0 ? "pointer" : "";
        if (still) cor.draw();
      });
      hall.addEventListener("pointerleave", function () {
        pointer.tx = 0;
        pointer.ty = 0;
      });
      cc.addEventListener("click", function (e) {
        var r = cc.getBoundingClientRect();
        var i = doorAt(e.clientX - r.left, e.clientY - r.top);
        if (i === 4 && eggTag) eggTag.click();
        else if (i >= 0 && tags[i]) tags[i].click();
      });

      cor.resize();
      cor.draw();
      watch(cor, hall);
    }
  }

  /* ---------- Plain view: stop every backdrop and hide it ---------- */
  function applyPlain() {
    var plain = isPlain();
    Array.prototype.forEach.call(document.querySelectorAll("canvas.backdrop, canvas.corridor-view"), function (c) {
      c.style.display = plain ? "none" : "";
    });
    if (hall) hall.classList.toggle("flat", plain || !hall.classList.contains("live"));
    all.forEach(function (b) {
      if (plain) b.pause();
      else if (b.onScreen) b.play();
    });
  }
  window.addEventListener("plainchange", applyPlain);
  if (isPlain()) applyPlain();
})();
