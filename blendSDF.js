// blendSDF.js
// GPU SDF typing-style renderer: 每次触发绘制一个符号，已有内容左移

import { initGL, createProgram, createTexture } from './glUtils.js';

const EMOTIONS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];



export async function setupSDFRenderer(canvas, imageNames) { 
  const gl = initGL(canvas);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  console.log(`Canvas size: ${canvas.width} x ${canvas.height}`);
  // 1158 x 642 by default
  gl.viewport(0, 0, canvas.width, canvas.height);

  // 顶点着色器
  const vsSource = `
    attribute vec2 aPos;
    varying vec2 vUv;
    uniform vec2 uOffset;   // 位置偏移
    uniform vec2 uScale;    // 缩放比例
    void main() {
      vUv = (aPos + 1.0) * 0.5;
      gl_Position = vec4(aPos * uScale + uOffset, 0.0, 1.0);
    }
  `;

  // 片元着色器
  const fsSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D sdfTex[7];
    uniform float weights[7];
    uniform bool is_bg;

    void main() {
      vec2 uv = vUv;
      if (is_bg) {
        gl_FragColor = vec4(0.0, 0.0, 0.2, 0.8);
        return;
      }

      // ===== SDF =====
      float sdf = 0.0;
      for (int i = 0; i < 7; i++) {
        float d = texture2D(sdfTex[i], uv).r - 0.5;
        if (d < 0.0) d = -(pow(-d, 0.7));
        sdf += (d + 0.5) * weights[i];
      }

      float shape = step(0.5, 1.0 - sdf);
      if (shape < 0.1) discard;

      // ===== 基础色 =====
      vec3 baseColor = vec3(0.0, 1.0, 0.0); // 绿色基调

      // ===== 点阵效果 =====
      float dotDensity = 100.0; // 点阵密度
      vec2 grid = floor(uv * dotDensity);
      float checker = mod(grid.x + grid.y, 2.0); // 交替明暗
      float brightness = mix(0.3, 1.0, checker);

      // ===== 计算边缘荧光 =====
      float edgeDist = abs(sdf - 0.5);          // 距离边缘的距离
      float glow = exp(-pow(edgeDist * 10.0, 2.0)); // 高斯衰减，越靠边越亮
      vec3 glowColor = vec3(0.2, 0.8, 0.6);     // 青绿色发光
      float glowIntensity = 0.6;                // 控制光的强度

      // ===== 混合结果 =====
      vec3 finalColor = baseColor * brightness; // 基础点阵亮度
      finalColor += glowColor * glow * glowIntensity; // 加上发光层

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const program = createProgram(gl, vsSource, fsSource);
  gl.useProgram(program);


  // 纹理加载
  const texture_list = new Map();
  for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    // console.log('Loading textures for key:', key);
    const textures = await Promise.all(imageNames.map(name => createTexture(gl, 'sdf/' + key + '_' + name)));
    texture_list.set(key, textures);
  }
  // const textures = await Promise.all(imagePaths.map(path => createTexture(gl, path)));
  const textures = texture_list.get('A'); // 默认加载A键的纹理
  textures.forEach((tex, i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(program, `sdfTex[${i}]`), i);
  });

  // 顶点缓冲区（一个矩形）
  const quad = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
  ]);
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const weightLoc = gl.getUniformLocation(program, "weights");
  const uOffsetLoc = gl.getUniformLocation(program, "uOffset");
  const uScaleLoc = gl.getUniformLocation(program, "uScale");

  const cols = 13;
  const rows = 5;
  console.log(`SDF Renderer Grid: ${cols} cols x ${rows} rows`);
  const fontSize = Math.floor(canvas.height / rows * 0.9);
  const symbolList = [];
  gl.clearColor(0, 0, 0, 1);

  // ========== 绘制单个符号 ==========
  function drawSymbol(idx, idy, num, key, weights) {
    // console.log('Drawing key:', key);

    //跳过空格
    if (key === ' ') {
      return;
    }

    // 绑定对应的纹理
    updateBindTexturesForKey(key);
    // 计算位置(居中排列)
    const num_rows = Math.ceil(num / cols);
    let x = 0.0;
    let y = 0.0;
    if(idy < num_rows - 1) {
      x = (idx + 0.5) / cols * 2.0 - 1.0;
    }
    else
    {
      const last_row_count = num - (num_rows - 1) * cols;
      x = (idx + 0.5 + (cols - last_row_count) / 2.0) / cols * 2.0 - 1.0;
    }
    y = (idy + 0.5 + (rows - num_rows) / 2.0) / rows * -2.0 + 1.0;

    let scaleX = fontSize / canvas.width * (1.0 - 0.5 * Math.pow(Math.abs(x), 1.3));
    let scaleY = fontSize / canvas.height * (1.0 - 0.1 * Math.pow(Math.abs(x), 1.3));

    gl.uniform2f(uOffsetLoc, x, y);
    gl.uniform2f(uScaleLoc, scaleX, scaleY);
    gl.uniform1fv(weightLoc, weights);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ========== 渲染 ==========
  function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    // 绘制背景
    gl.uniform2f(uOffsetLoc, 0.0, 0.0);
    gl.uniform2f(uScaleLoc, 1.0, 1.0);
    gl.uniform1fv(weightLoc, new Float32Array(7).fill(0.0));
    gl.uniform1i(gl.getUniformLocation(program, "is_bg"), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.uniform1i(gl.getUniformLocation(program, "is_bg"), 0);

    // 绘制符号
    for (let i = 0; i < symbolList.length; i++) {
      const idx = i % cols;
      const idy = Math.floor(i / cols);
      drawSymbol(idx, idy, symbolList.length, symbolList[i].key, symbolList[i].weights);
    }
  }

  // ========== 触发：新增符号 ==========
  function trigger(key, expressions) {
    if (expressions == null) {
      // 如果没有表情数据，默认为neutral
      expressions = { neutral: 1.0 };
    }
    const weights = new Float32Array(EMOTIONS.map(e => expressions[e] || 0.0));
    // 退格键
    console.log('Trigger key:', key);
    if (key === 'BACKSPACE') {
      symbolList.pop();
      render();
      return;
    }
    if (! ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', ' '].includes(key)) {
      return;
    }

    // 添加新符号
    symbolList.push({ key, weights });
    if (symbolList.length > cols * rows) {
      //移除第一行
      symbolList.splice(0, cols);
    }
    render();
  }

  function updateBindTexturesForKey(key) {
    if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(key)) {
      // console.log('Binding textures for key:', key);
      const textures = texture_list.get(key);
      textures.forEach((tex, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(program, `sdfTex[${i}]`), i);
      });
    }
    else {
      // use A as default
      const textures = texture_list.get('A');
      textures.forEach((tex, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(program, `sdfTex[${i}]`), i);
      });
    }
  }

  return { trigger, render };
}
