/* Living backdrops: one small WebGL fragment shader with a mode per room.
   retractbench  a grid of probes; a ripple goes out, then is taken back
   storygecko    slow scales, like gecko skin
   aquainspection  pool-light caustics
   riftforge     a rift at dusk
   Falls back to the flat page colour when WebGL is missing. Draws a single
   still frame when the visitor prefers reduced motion. Pauses when hidden. */
(function () {
  "use strict";

  var ROOMS = {
    retractbench: { mode: 0, a: "#e3e7f7", b: "#c9d0f1", c: "#aab4e6" },
    storygecko: { mode: 1, a: "#e0efe3", b: "#cbe4d0", c: "#b3d6ba" },
    aquainspection: { mode: 2, a: "#cdebec", b: "#f6fdfd", c: "#a9dcdf" },
    riftforge: { mode: 3, a: "#1f1020", b: "#4a2145", c: "#e9b44c" }
  };

  var VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes;uniform float uTime;uniform float uMode;",
    "uniform vec3 uA;uniform vec3 uB;uniform vec3 uC;",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}",

    "vec3 probes(vec2 uv){",
    " float n=16.;vec2 g=fract(uv*n)-.5;vec2 id=floor(uv*n)/n;",
    " float dist=length(id-vec2(uRes.x/uRes.y*.72,.45));",
    " float t=5.5*sin(uTime*.22);",                       /* out, then back */
    " float wave=exp(-pow((dist*6.-abs(t))*1.1,2.));",
    " float r=.07+.13*wave;",
    " float dotm=smoothstep(r+.03,r,length(g));",
    " return mix(uA,mix(uB,uC,wave),dotm);}",

    "vec3 scales(vec2 uv){",
    " vec2 p=uv*7.;vec2 ip=floor(p),fp=fract(p);float f1=8.,f2=8.;",
    " for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));",
    "  vec2 h=hash2(ip+o);h=.5+.42*sin(uTime*.25+6.2831*h);",
    "  float d=length(o+h-fp);if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}}",
    " float edge=smoothstep(.0,.09,f2-f1);",
    " vec3 col=mix(uB,uA,smoothstep(.0,.7,f1));",
    " return mix(uC,col,edge);}",

    "vec3 caustics(vec2 uv){",
    " float T=uTime*.35+23.;vec2 p=mod(uv*6.2831*.9,6.2831)-250.;vec2 i=p;float c=1.;float inten=.005;",
    " for(int n=0;n<5;n++){float t=T*(1.-(3.5/float(n+1)));",
    "  i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));",
    "  c+=1./length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));}",
    " c/=5.;c=1.17-pow(c,1.4);float v=clamp(pow(abs(c),8.),0.,1.);",
    " vec3 base=mix(uA,uC,.35*fbm(uv*1.5+uTime*.03));",
    " return mix(base,uB,v*.85);}",

    "vec3 rift(vec2 uv){",
    " float asp=uRes.x/uRes.y;float t=uTime*.12;",
    " vec3 col=mix(uA,uB,fbm(uv*1.6+vec2(t,-t*.5))*.9*smoothstep(0.,1.,uv.y+.2));",
    " float wide=smoothstep(.6,1.4,asp);",                 /* narrow screens: rift hugs the edge, dimmer */
    " float cx=asp*mix(.93,.78,wide)+(fbm(vec2(uv.y*2.2,t*1.5))-.5)*mix(.18,.5,wide)+(noise(vec2(uv.y*9.,t*3.))-.5)*.06;",
    " float d=abs(uv.x-cx);",
    " float taper=smoothstep(0.,.25,uv.y)*smoothstep(1.,.7,uv.y);",
    " float glow=min(.012/(d+.004),.75)*taper*(.8+.2*sin(uTime*.9))*mix(.6,1.,wide);",
    " col+=uC*glow;col+=uB*.6*exp(-d*5.)*taper;",
    " return col;}",

    "void main(){",
    " vec2 uv=gl_FragCoord.xy/uRes.y;vec3 col;",
    " if(uMode<.5)col=probes(uv);else if(uMode<1.5)col=scales(uv);",
    " else if(uMode<2.5)col=caustics(uv);else col=rift(uv);",
    " gl_FragColor=vec4(col,1.);}"
  ].join("\n");

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function Backdrop(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
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
    ["uRes", "uTime", "uMode", "uA", "uB", "uC"].forEach(function (n) {
      u[n] = gl.getUniformLocation(prog, n);
    });

    var self = this;
    var raf = 0;
    var visible = true;
    var start = performance.now();

    this.setRoom = function (name) {
      var r = ROOMS[name];
      if (!r) return false;
      gl.uniform1f(u.uMode, r.mode);
      gl.uniform3fv(u.uA, rgb(r.a));
      gl.uniform3fv(u.uB, rgb(r.b));
      gl.uniform3fv(u.uC, rgb(r.c));
      return true;
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
      gl.uniform1f(u.uTime, still ? 12.0 : (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      self.draw();
      if (!still) raf = requestAnimationFrame(frame);
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

  /* Project page: one backdrop behind the masthead and the title block. */
  var room = document.body.getAttribute("data-room");
  var head = document.querySelector(".room-head");
  if (room && head && ROOMS[room]) {
    var canvas = make("backdrop");
    document.body.insertBefore(canvas, document.body.firstChild);
    var size = function () {
      canvas.style.height = Math.ceil(head.getBoundingClientRect().bottom + window.scrollY) + "px";
    };
    size();
    var bd = new Backdrop(canvas);
    if (bd && bd.setRoom) {
      bd.setRoom(room);
      bd.play();
      window.addEventListener("resize", function () {
        size();
        bd.resize();
        if (still) bd.draw();
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) bd.play();
          else bd.pause();
        }).observe(canvas);
      }
    } else {
      canvas.remove();
    }
  }

  /* Front page: hovering a project shows a glimpse of its room. One canvas,
     moved to whichever row is under the pointer. Skipped on touch screens. */
  var rows = document.querySelectorAll(".rooms li[data-room]");
  if (rows.length && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var peek = make("backdrop-peek");
    var pb = null;
    var failed = false;
    Array.prototype.forEach.call(rows, function (li) {
      var link = li.querySelector("a");
      function enter() {
        if (failed) return;
        link.insertBefore(peek, link.firstChild);
        if (!pb) {
          pb = new Backdrop(peek);
          if (!pb || !pb.setRoom) {
            failed = true;
            peek.remove();
            return;
          }
        }
        pb.setRoom(li.getAttribute("data-room"));
        li.classList.add("peeking");
        pb.play();
      }
      function leave() {
        li.classList.remove("peeking");
        if (pb && pb.pause) pb.pause();
        if (peek.parentNode) peek.remove();
      }
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);
      link.addEventListener("focus", enter);
      link.addEventListener("blur", leave);
    });
  }
})();
