const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModelView;
uniform mat4 uProjection;

out vec3 vPosition;
out vec3 vNormal;        // smooth-interpolated normal
flat out vec3 vNormalFlat;  // NOT interpolated -> flat shading

void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  vec3 n = mat3(uModelView) * aNormal;
  vNormal = n;
  vNormalFlat = n;
  gl_Position = uProjection * p;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;           // smooth normal
flat in vec3 vNormalFlat;  // flat (per-face) normal

uniform vec3 uLightPos;    // light 1 (eye space)
uniform vec3 uLightPos2;   // light 2 (eye space)
uniform vec3 uColor;
uniform bool uFlat;        // true -> flat shading, false -> smooth shading
uniform float uShininess;  // specular exponent (controlled by a slider)
uniform float uBrightness; // overall light brightness (controlled by a slider)

out vec4 fragColor;

// Diffuse + specular contribution from ONE light
vec3 lightContribution(vec3 lightPos, vec3 N, vec3 V, vec3 Kd, vec3 Ks, float shininess) {
  vec3 L = normalize(lightPos - vPosition);
  vec3 R = reflect(-L, N);
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(V, R), 0.0), shininess);
  return Kd * diff + Ks * spec;
}

void main() {
  vec3 Ka = 0.2 * uColor;
  vec3 Kd = 0.8 * uColor;
  vec3 Ks = vec3(0.5);
  float shininess = uShininess;

  // Pick the flat (per-face) normal or the smooth (interpolated) normal
  vec3 N = normalize(uFlat ? vNormalFlat : vNormal);
  vec3 V = normalize(-vPosition);           // camera sits at the origin

  // Ambient once, then ADD each light's diffuse + specular (scaled by brightness)
  vec3 color = Ka;
  color += uBrightness * lightContribution(uLightPos,  N, V, Kd, Ks, shininess);
  color += uBrightness * lightContribution(uLightPos2, N, V, Kd, Ks, shininess);

  fragColor = vec4(color, 1.0);
}
`;

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

// Fixed attribute slots, so the meshes stay valid when the shaders are recompiled
const ATTRIBUTES = { aPosition: 0, aNormal: 1 };

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// Shader editors
const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

let program, uModelView, uProjection, uLightPos, uLightPos2, uColor, uFlat, uShininess, uBrightness;

function updateProgram() {
  try {
    const prog = createProgram(vertEditor.value, fragEditor.value);
    gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);
    uModelView = gl.getUniformLocation(program, "uModelView");
    uProjection = gl.getUniformLocation(program, "uProjection");
    uLightPos = gl.getUniformLocation(program, "uLightPos");
    uLightPos2 = gl.getUniformLocation(program, "uLightPos2");
    uColor = gl.getUniformLocation(program, "uColor");
    uFlat = gl.getUniformLocation(program, "uFlat");
    uShininess = gl.getUniformLocation(program, "uShininess");
    uBrightness = gl.getUniformLocation(program, "uBrightness");
    shaderError.textContent = "";
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");  // some drivers end the log with \0
  }
}
updateProgram();
vertEditor.addEventListener("input", updateProgram);
fragEditor.addEventListener("input", updateProgram);

function bindAttribute(name, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions);
  bindAttribute("aNormal", normals);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { vao, count: indices.length };
}

const cubeMesh = createMesh(createCube());
const cylinderMesh = createMesh(createCylinder(32));
const sphereMesh = createMesh(createSphere(32, 16));

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0, 0, 0, 1);
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
const lightWorld = [3, 4, 5];       // light 1: upper-right, in front
const lightWorld2 = [-4, -2, 3];    // light 2: lower-left, in front

// interactive controls
let dragRotX = 0, dragRotY = -0.5;      // mouse drag
let camX = 0, camY = 0, camZ = -7;      // arrow keys, w, s
let sliderAngle = 0;                    // degrees
let spinning = false, spinAngle = 0;    // Start/Stop button
let upperArmAngle = 0, foreArmAngle = 0; // user-controlled joint angles (radians)
let shininess = 32.0;                    // specular exponent (slider)
let brightness = 1.0;                    // light brightness (slider)

let mouseDown = false, lastX, lastY;
canvas.addEventListener("mousedown", e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", e => {
  if (!mouseDown) return;
  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;
  lastX = e.clientX; lastY = e.clientY;
});

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;  // let the editors use the keys
  const step = 0.2;
  switch (e.key) {
    case "ArrowUp": camY -= step; break;
    case "ArrowDown": camY += step; break;
    case "ArrowLeft": camX += step; break;
    case "ArrowRight": camX -= step; break;
    case "w": camZ += step; break;
    case "s": camZ -= step; break;
    default: return;
  }
  e.preventDefault();  // keep the arrow keys from scrolling the page
});

const axisSelect = document.getElementById("axisSelect");
document.getElementById("slider").addEventListener("input", e => {
  sliderAngle = Number(e.target.value);
  document.getElementById("sliderValue").textContent = sliderAngle;
});
document.getElementById("spinButton").addEventListener("click", () => spinning = !spinning);

// Sliders to bend two joints by hand (degrees -> radians)
document.getElementById("upperArmSlider").addEventListener("input", e => {
  upperArmAngle = Number(e.target.value) * Math.PI / 180;
  document.getElementById("upperArmValue").textContent = e.target.value;
});
document.getElementById("foreArmSlider").addEventListener("input", e => {
  foreArmAngle = Number(e.target.value) * Math.PI / 180;
  document.getElementById("foreArmValue").textContent = e.target.value;
});

// Sliders for material shininess and light brightness
document.getElementById("shininessSlider").addEventListener("input", e => {
  shininess = Number(e.target.value);
  document.getElementById("shininessValue").textContent = e.target.value;
});
document.getElementById("brightnessSlider").addEventListener("input", e => {
  brightness = Number(e.target.value) / 100;   // percent -> multiplier
  document.getElementById("brightnessValue").textContent = e.target.value;
});



function createNode(mesh, color, shape, flatShade) {
  return { mesh, color, shape, flatShade, joint: null, children: [] };
}

// Lower arm (level 1, root): smooth-shaded cylinder
const lowerArm = createNode(cylinderMesh, [1, 0.2, 0.2],
  multiply(translate(0, 0.6, 0), scale(0.3, 0.6, 0.3)), false);

// Upper arm (level 2): a cube (flat by nature)
const upperArm = createNode(cubeMesh, [0.2, 0.4, 1],
  multiply(translate(0, 0.5, 0), scale(0.2, 0.5, 0.2)), true);

// Forearm (level 3): a cylinder forced to FLAT shading -> shows visible facets
const foreArm = createNode(cylinderMesh, [0.2, 1, 0.4],
  multiply(translate(0, 0.45, 0), scale(0.15, 0.45, 0.15)), true);

// Hand (level 4): a SMOOTH-shaded sphere -> perfectly round
const hand = createNode(sphereMesh, [1, 0.9, 0.2],
  scale(0.25, 0.25, 0.25), false);

// Build the 4-level tree:  lowerArm -> upperArm -> foreArm -> hand
lowerArm.children.push(upperArm);
upperArm.children.push(foreArm);
foreArm.children.push(hand);

function drawNode(node, frame) {
  gl.uniformMatrix4fv(uModelView, false, multiply(frame, node.shape));
  gl.uniform3fv(uColor, node.color);
  gl.uniform1i(uFlat, node.flatShade ? 1 : 0);   // tell the shader flat or smooth
  gl.bindVertexArray(node.mesh.vao);
  gl.drawElements(gl.TRIANGLES, node.mesh.count, gl.UNSIGNED_SHORT, 0);
}

//Data structure
function drawTree(root, rootFrame) {
  const stack = [[root, rootFrame]];
  while (stack.length > 0) {
    const [node, parentFrame] = stack.pop();
    const frame = multiply(parentFrame, node.joint);
    drawNode(node, frame);
    for (const child of node.children) stack.push([child, frame]);
  }
}

// Render loop
let lastTime = 0;
function render(time) {
  const t = time / 1000;
  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera moves with the keys; the light stays fixed in the world
  const view = translate(camX, camY, camZ);
  gl.uniformMatrix4fv(uProjection, false, projection);
  gl.uniform3fv(uLightPos, transformPoint(view, lightWorld));
  gl.uniform3fv(uLightPos2, transformPoint(view, lightWorld2));
  gl.uniform1f(uShininess, shininess);
  gl.uniform1f(uBrightness, brightness);

  // Whole-model rotation
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * Math.PI / 180 + spinAngle);
  const rotation = multiply(multiply(rotateY(dragRotY), rotateX(dragRotX)), axisRotation);

  // Lower arm (root)
  lowerArm.joint = multiply(multiply(translate(0, -2, 0), rotation), rotateZ(0.5 * Math.sin(t)));


  upperArm.joint = multiply(translate(0, 1.2, 0), rotateZ(upperArmAngle));

  
  foreArm.joint = multiply(translate(0, 1.0, 0), rotateZ(foreArmAngle));

  
  hand.joint = multiply(translate(0, 0.9, 0), rotateZ(0.8 * Math.sin(3.0 * t)));

  drawTree(lowerArm, view);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
