"use client";

import { useEffect, useRef } from "react";

/**
 * WebGL2 mesh-gradient backdrop for the home hero.
 *
 * A custom fragment shader renders three layered FBM noise fields that
 * flow independently, each contributing one of the brand colours
 * (navy primary / steel accent / a softer steel highlight) blended
 * over the page background. Slow time progression (~0.04 rate) keeps
 * the motion ambient — closer to drifting weather than animated UI.
 *
 * Reads the live CSS HSL tokens so the gradient adapts to dark mode
 * automatically. Falls back silently to the CSS orbs if WebGL2 is
 * unavailable. Honours prefers-reduced-motion (frozen at t=0).
 */

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color_navy;
uniform vec3 u_color_steel;
uniform vec3 u_color_accent;
uniform vec3 u_color_base;

// Ashima 2D simplex noise — public-domain reference implementation.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0),
                          dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion — four octaves of simplex.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Aspect-corrected UV so the noise reads at the same scale on
  // ultrawide and mobile.
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.04;

  // Three noise fields drift on independent vectors. Different
  // frequencies + offsets ensure the three colour clouds never align
  // into a recognisable pattern.
  float n1 = fbm(uv * 1.2 + vec2(cos(t * 0.3) * 0.6, sin(t * 0.4) * 0.4));
  float n2 = fbm(uv * 2.4 + vec2( t * 0.5, -t * 0.7) + vec2(5.2, 10.7));
  float n3 = fbm(uv * 3.6 + vec2(-t * 0.6,  t * 0.2) + vec2(17.3, 31.1));

  // Soft-edged contributions; smoothstep keeps the colour transitions
  // organic instead of banded.
  float w1 = smoothstep(-0.10, 0.55, n1) * 0.34;
  float w2 = smoothstep( 0.05, 0.65, n2) * 0.42;
  float w3 = smoothstep( 0.20, 0.70, n3) * 0.22;

  vec3 color = u_color_base;
  color = mix(color, u_color_steel,  w1);
  color = mix(color, u_color_navy,   w2);
  color = mix(color, u_color_accent, w3);

  // Subtle vignette pulls slightly more colour toward the edges so
  // the centre stays clean for the headline.
  vec2 c = v_uv - 0.5;
  float vignette = smoothstep(0.0, 0.65, dot(c, c));
  color = mix(color, mix(color, u_color_navy, 0.18), vignette);

  outColor = vec4(color, 1.0);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Convert HSL components (h: 0–360, s/l: 0–100) to linear RGB 0–1. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Read an HSL CSS variable (formatted "H S% L%") and return RGB 0–1. */
function readHslVar(varName: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) return [0, 0, 0];
  const parts = raw.split(/\s+/).map((p) => parseFloat(p));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return [0, 0, 0];
  return hslToRgb(parts[0], parts[1], parts[2]);
}

export function HeroShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // WebGL2 — degrade gracefully if unsupported (CSS orbs remain).
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    // Fullscreen quad — a single TRIANGLE_STRIP of 4 vertices.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPosition = gl.getAttribLocation(program, "a_position");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uColorNavy = gl.getUniformLocation(program, "u_color_navy");
    const uColorSteel = gl.getUniformLocation(program, "u_color_steel");
    const uColorAccent = gl.getUniformLocation(program, "u_color_accent");
    const uColorBase = gl.getUniformLocation(program, "u_color_base");

    gl.useProgram(program);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    function applyColors() {
      const isDark =
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const navy = readHslVar("--primary");
      const steel = readHslVar("--steel");
      // No "accent" token at full vibrance for the hero — derive a
      // lighter steel by lifting lightness for the third highlight.
      const accent: [number, number, number] = isDark
        ? hslToRgb(213, 35, 75)
        : hslToRgb(204, 45, 80);

      // Light mode: near-white base. Dark mode: deep navy base.
      const base: [number, number, number] = isDark
        ? hslToRgb(217, 35, 9)
        : [1.0, 1.0, 1.0];

      gl!.uniform3f(uColorNavy, navy[0], navy[1], navy[2]);
      gl!.uniform3f(uColorSteel, steel[0], steel[1], steel[2]);
      gl!.uniform3f(uColorAccent, accent[0], accent[1], accent[2]);
      gl!.uniform3f(uColorBase, base[0], base[1], base[2]);
    }

    applyColors();

    // Re-read tokens when the .dark class flips on <html>.
    const themeObserver = new MutationObserver(applyColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Cap DPR — anything above 2 is wasted GPU on this kind of effect.
    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl!.viewport(0, 0, w, h);
      }
      gl!.uniform2f(uResolution, w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const start = performance.now();
    let raf = 0;
    let stopped = false;

    function frame(now: number) {
      if (stopped || !gl) return;
      const t = reduced ? 0 : (now - start) / 1000;
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Pause when the page is hidden — saves battery on tabbed-away tabs.
    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!stopped) {
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{ display: "block" }}
    />
  );
}
