/* WebGL2 helpers: the photo pipeline (adjustments, real 3D LUTs, tray effect) and the loupe lens. */
(function () {
  "use strict";

  const LUT_SIZE = 17;

  const VERTEX = `#version 300 es
  out vec2 vUv;
  void main() {
    vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1., float((gl_VertexID & 2) << 1) - 1.);
    vUv = p * .5 + .5;
    gl_Position = vec4(p, 0., 1.);
  }`;

  const PHOTO = `#version 300 es
  precision highp float;
  precision highp sampler3D;
  in vec2 vUv;
  out vec4 color;
  uniform sampler2D uImage;
  uniform sampler3D uL0, uL1, uL2;
  uniform vec3 uStrength;
  uniform vec2 uCover;
  uniform float uExposure, uContrast, uHighlights, uShadows, uTemp, uSaturation, uFade;
  uniform float uWipe, uDevelop, uRipple, uSafe, uTime;

  const float N = ${LUT_SIZE}.;
  const vec3 LUMA = vec3(.2126, .7152, .0722);

  vec3 look(sampler3D table, vec3 c) {
    return texture(table, (c * (N - 1.) + .5) / N).rgb;
  }

  vec3 adjust(vec3 c) {
    c = pow(c, vec3(2.2)) * pow(2., uExposure);
    c = pow(max(c, vec3(0.)), vec3(1. / 2.2));
    float l = dot(c, LUMA);
    c += uShadows * (1. - smoothstep(0., .55, l)) * .3;
    c += uHighlights * smoothstep(.45, 1., l) * .3;
    c += vec3(uTemp, uTemp * .08, -uTemp) * .1;
    c = clamp(c, 0., 1.);
    vec3 s = c * c * (3. - 2. * c);
    c = uContrast >= 0. ? mix(c, s, uContrast) : mix(c, vec3(.48), -uContrast);
    c = mix(vec3(dot(c, LUMA)), c, 1. + uSaturation);
    return clamp(mix(c, c * .84 + .1, uFade), 0., 1.);
  }

  void main() {
    vec2 uv = (vUv - .5) * uCover + .5;
    if (uRipple > 0.) {
      vec2 p = vUv - vec2(.5, .42);
      float d = length(p);
      uv += normalize(p + 1e-4) * sin(d * 34. - uTime * 2.6) * .006 * uRipple * smoothstep(0., .2, d);
      uv += vec2(sin(vUv.y * 9. + uTime), cos(vUv.x * 8. - uTime * .8)) * .0028 * uRipple;
    }
    vec3 source = texture(uImage, uv).rgb;
    vec3 c = adjust(source);
    if (uStrength.x > 0.) c = mix(c, look(uL0, c), uStrength.x);
    if (uStrength.y > 0.) c = mix(c, look(uL1, c), uStrength.y);
    if (uStrength.z > 0.) c = mix(c, look(uL2, c), uStrength.z);
    if (vUv.x < uWipe) c = source;

    if (uDevelop < 1.) {
      // Shadows arrive first, the way a print comes up in the tray.
      float l = dot(c, LUMA);
      float reveal = smoothstep(0., .55, uDevelop * 1.55 - l * .55);
      c = mix(vec3(.66, .64, .6), c, reveal);
    }
    if (uSafe > 0.) {
      float l = dot(c, LUMA);
      c = mix(c, vec3(l * .84, l * .15, l * .09), uSafe);
    }
    color = vec4(c, 1.);
  }`;

  const LENS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 color;
  uniform sampler2D uScene;
  void main() {
    vec2 p = (vUv - .5) * 2.;
    float r = length(p);
    // Barrel refraction grows sharply towards the rim, with colour fringing.
    float bend = pow(r, 6.);
    vec2 base = p * (1. - bend * .3);
    vec2 uvR = base * (1. + bend * .012) * .5 + .5;
    vec2 uvG = base * .5 + .5;
    vec2 uvB = base * (1. - bend * .012) * .5 + .5;
    vec3 c = vec3(texture(uScene, uvR).r, texture(uScene, uvG).g, texture(uScene, uvB).b);
    c *= 1. - smoothstep(.8, 1., r) * .36;
    float glint = smoothstep(.97, .78, r) * smoothstep(.62, .92, r) * max(0., dot(normalize(p + 1e-4), normalize(vec2(-.6, .8))));
    c += glint * glint * .55;
    float edge = 1. - smoothstep(.985, 1., r);
    color = vec4(c * edge, edge);
  }`;

  function compile(gl, vertex, fragment) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());
    return program;
  }

  const lutCache = new Map();
  function loadLut(id) {
    if (!lutCache.has(id)) {
      lutCache.set(id, fetch(`assets/lut/${id}.bin`).then((response) => {
        if (!response.ok) throw new Error(`LUT ${id}: ${response.status}`);
        return response.arrayBuffer();
      }).then((buffer) => new Uint8Array(buffer)));
    }
    return lutCache.get(id);
  }

  class PhotoGL {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
      if (!gl) throw new Error("webgl2 unavailable");
      this.gl = gl;
      this.program = compile(gl, VERTEX, PHOTO);
      this.locations = {};
      for (const name of ["uCover", "uStrength", "uExposure", "uContrast", "uHighlights", "uShadows", "uTemp", "uSaturation", "uFade", "uWipe", "uDevelop", "uRipple", "uSafe", "uTime"]) {
        this.locations[name] = gl.getUniformLocation(this.program, name);
      }
      gl.uniform1i(gl.getUniformLocation(this.program, "uImage"), 0);
      ["uL0", "uL1", "uL2"].forEach((name, index) => gl.uniform1i(gl.getUniformLocation(this.program, name), index + 1));
      this.image = gl.createTexture();
      this.luts = [gl.createTexture(), gl.createTexture(), gl.createTexture()];
      this.strength = [0, 0, 0];
      this.imageAspect = 1.5;
      this.state = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, temp: 0, saturation: 0, fade: 0, wipe: 0, develop: 1, ripple: 0, safe: 0, time: 0 };
      this.ready = false;
      this.probe = null;
    }

    setImage(image) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.imageAspect = image.naturalWidth / image.naturalHeight;
      this.ready = true;
    }

    async setLut(slot, id, strength) {
      this.strength[slot] = 0;
      if (!id) return;
      const data = await loadLut(id);
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1 + slot);
      gl.bindTexture(gl.TEXTURE_3D, this.luts[slot]);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, LUT_SIZE, LUT_SIZE, LUT_SIZE, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
      for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.LINEAR);
      for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.CLAMP_TO_EDGE);
      this.strength[slot] = strength;
    }

    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(2, Math.round(rect.width * ratio));
      const height = Math.max(2, Math.round(rect.height * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }

    draw(width, height) {
      const { gl, locations: at, state } = this;
      const view = width / height;
      const cover = view > this.imageAspect ? [1, this.imageAspect / view] : [view / this.imageAspect, 1];
      gl.viewport(0, 0, width, height);
      gl.uniform2f(at.uCover, cover[0], cover[1]);
      gl.uniform3f(at.uStrength, this.strength[0], this.strength[1], this.strength[2]);
      gl.uniform1f(at.uExposure, state.exposure);
      gl.uniform1f(at.uContrast, state.contrast);
      gl.uniform1f(at.uHighlights, state.highlights);
      gl.uniform1f(at.uShadows, state.shadows);
      gl.uniform1f(at.uTemp, state.temp);
      gl.uniform1f(at.uSaturation, state.saturation);
      gl.uniform1f(at.uFade, state.fade);
      gl.uniform1f(at.uWipe, state.wipe);
      gl.uniform1f(at.uDevelop, state.develop);
      gl.uniform1f(at.uRipple, state.ripple);
      gl.uniform1f(at.uSafe, state.safe);
      gl.uniform1f(at.uTime, state.time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    render() {
      if (!this.ready) return;
      this.resize();
      this.draw(this.canvas.width, this.canvas.height);
    }

    /* Three-channel histogram of the current look, from a small off-screen render. */
    histogram(bins = 64) {
      if (!this.ready) return null;
      const gl = this.gl;
      const width = 96;
      const height = 60;
      if (!this.probe) {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
        const buffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        this.probe = { buffer, pixels: new Uint8Array(width * height * 4) };
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.probe.buffer);
      this.draw(width, height);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.probe.pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const counts = [new Float32Array(bins), new Float32Array(bins), new Float32Array(bins)];
      const { pixels } = this.probe;
      for (let index = 0; index < pixels.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          counts[channel][Math.min(bins - 1, (pixels[index + channel] * bins) >> 8)] += 1;
        }
      }
      return counts;
    }
  }

  class LensGL {
    constructor(canvas, size) {
      canvas.width = canvas.height = size;
      const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) throw new Error("webgl2 unavailable");
      this.gl = gl;
      compile(gl, VERTEX, LENS);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.viewport(0, 0, size, size);
    }

    render(scene) {
      const gl = this.gl;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  window.PhotoGL = PhotoGL;
  window.LensGL = LensGL;
})();
