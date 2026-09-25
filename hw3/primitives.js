/*
Sanjaya Basyal
101977557
HW-3 Intro to Computer Graphics
*/

// Geometric primitives for HW3
// Each shape is an object with its own positions, colors, indices.

// Cube
const cube = {
  positions: new Float32Array([
    -1, -1, -1,  // 0
     1, -1, -1,  // 1
     1,  1, -1,  // 2
    -1,  1, -1,  // 3
    -1, -1,  1,  // 4
     1, -1,  1,  // 5
     1,  1,  1,  // 6
    -1,  1,  1   // 7
  ]),
  colors: new Float32Array([
    1,0,0,  0,1,0,  0,0,1, 1,1,0, 1,0,1, 0,1,1, 1,1,0, 1,0,1
  ]),
  indices: new Uint16Array([
    4, 5, 6,   4, 6, 7,   // Front
    1, 0, 3,   1, 3, 2,   // Back
    3, 7, 6,   3, 6, 2,   // Top
    0, 1, 5,   0, 5, 4,   // Bottom
    1, 2, 6,   1, 6, 5,   // Right
    0, 4, 7,   0, 7, 3    // Left
  ])
};

// Pyramid (square base + apex on top) - 5 vertices
const pyramid = {
  positions: new Float32Array([
    -1, -1, -1,  // 0 base
     1, -1, -1,  // 1 base
     1, -1,  1,  // 2 base
    -1, -1,  1,  // 3 base
     0,  1,  0   // 4 apex
  ]),
  colors: new Float32Array([
    1,0,0,  0,1,0,  0,0,1,  1,1,0,  1,1,1
  ]),
  indices: new Uint16Array([
    0, 1, 2,   0, 2, 3,   // base
    0, 1, 4,              // side
    1, 2, 4,              // side
    2, 3, 4,              // side
    3, 0, 4               // side
  ])
};

// Octahedron (two pyramids joined at the base) - 6 vertices
const octahedron = {
  positions: new Float32Array([
     1,  0,  0,  // 0 +x
    -1,  0,  0,  // 1 -x
     0,  1,  0,  // 2 +y (top)
     0, -1,  0,  // 3 -y (bottom)
     0,  0,  1,  // 4 +z
     0,  0, -1   // 5 -z
  ]),
  colors: new Float32Array([
    1,0,0,  0,1,0,  0,0,1,  1,1,0,  1,0,1,  0,1,1
  ]),
  indices: new Uint16Array([
    2, 0, 4,   2, 4, 1,   2, 1, 5,   2, 5, 0,   // top four faces
    3, 4, 0,   3, 1, 4,   3, 5, 1,   3, 0, 5    // bottom four faces
  ])
};
