// blendSDF.js
// GPU SDF typing-style renderer: 每次触发绘制一个符号，已有内容左移

import { initGL, createProgram, createTexture } from './glUtils.js';

const EMOTIONS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

const PRESSED_KEYS = new Set();
const POSITIONS = {
    Q: { x: 0.206, y: 0.303 },
    W: { x: 0.258, y: 0.303 },
    E: { x: 0.310, y: 0.303 },
    R: { x: 0.365, y: 0.303 },
    T: { x: 0.418, y: 0.303 },
    Y: { x: 0.473, y: 0.303 },
    U: { x: 0.527, y: 0.303 },
    I: { x: 0.580, y: 0.303 },
    O: { x: 0.635, y: 0.303 },
    P: { x: 0.688, y: 0.303 },
    A: { x: 0.220, y: 0.480 },
    S: { x: 0.275, y: 0.480 },
    D: { x: 0.330, y: 0.480 },
    F: { x: 0.385, y: 0.480 },
    G: { x: 0.442, y: 0.480 },
    H: { x: 0.497, y: 0.480 },
    J: { x: 0.554, y: 0.480 },
    K: { x: 0.609, y: 0.480 },
    L: { x: 0.666, y: 0.480 },
    Z: { x: 0.237, y: 0.670 },
    X: { x: 0.292, y: 0.670 },
    C: { x: 0.351, y: 0.670 },
    V: { x: 0.410, y: 0.670 },
    B: { x: 0.469, y: 0.670 },
    N: { x: 0.528, y: 0.670 },
    M: { x: 0.587, y: 0.670 }
}

export async function setupKeyboardRenderer(canvas, imageNames, gridSize = 45) {
    const gl = initGL(canvas);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
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
    uniform bool key_down;

    void main() {
      vec2 uv = vUv;
      vec4 color = vec4(0.0);
      float edgeGlow = 0.0;
      for (int i = 0; i < 7; i++) {
        float d = texture2D(sdfTex[i], uv).r - 0.51;
        if (d < 0.0) d = -(pow(-d, 0.7));
        color += (d + 0.5) * weights[i];
        edgeGlow += exp(-pow(abs(d) * 5.0, 2.0)) * weights[i];
      }

      if(key_down) {
        float alpha = 1.0;
        if (color.r > 0.5)
        alpha = 2.0 - 2.0 * color.r;
        color = vec4(0.0, alpha, alpha, alpha);
      }
      else
      {
        if (color.r > 0.5)
            color = vec4(0.0, 0.0, 0.0, 0.0);
        else
            color = vec4(0.4, 0.4, 0.6, 1.0);
      }
      gl_FragColor = color;
    }
  `;

    const program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    // 纹理加载
    const texture_list = new Map();
    for (const key of ['A','B','C','D','E','F','G','H']) {
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

    gl.clearColor(0, 0, 0, 0);

    // ========== 绘制单个符号 ==========
    function drawSymbol(position, weights) {
        const x = position.x * 2.0 - 1.0;
        const y = 1.0 - position.y * 2.0;
        const scaleX = gridSize / canvas.width;
        const scaleY = gridSize / canvas.height;

        gl.uniform2f(uOffsetLoc, x, y);
        gl.uniform2f(uScaleLoc, scaleX, scaleY);
        gl.uniform1fv(weightLoc, weights);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ========== 渲染 ==========
    function render(expressions) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (expressions == null) {
            // 如果没有表情数据，默认为neutral
            expressions = { neutral: 1.0 };
        }
        const weights = new Float32Array(EMOTIONS.map(e => expressions[e] || 0.0));
        // 绘制符号
        for (const key in POSITIONS) {
            // console.log('Drawing key:', key);
            updateBindTexturesForKey(key);
            const pos = POSITIONS[key];
            if (PRESSED_KEYS.has(key))
                gl.uniform1i(gl.getUniformLocation(program, "key_down"), 1);
            else
                gl.uniform1i(gl.getUniformLocation(program, "key_down"), 0);
            drawSymbol(pos, weights);
        }
    }

    function keyDown(key) {
        PRESSED_KEYS.add(key.toUpperCase());
    }

    function keyUp(key) {
        PRESSED_KEYS.delete(key.toUpperCase());
    }

    function updateBindTexturesForKey(key) {
        if (['A','B','C','D','E','F','G','H'].includes(key)) {
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

    return { render, keyDown, keyUp };
}
