import * as THREE from 'three';

export function createStadiumFlashes(scene, width, height) {
  const numFlashes = 50; // Adjust for density
  const flashGeometry = new THREE.BufferGeometry();
  const flashPositions = new Float32Array(numFlashes * 3);
  const flashSizes = new Float32Array(numFlashes);
  const flashColors = new Float32Array(numFlashes * 3);
  const flashOpacities = new Float32Array(numFlashes);

  const color = new THREE.Color();

  for (let i = 0; i < numFlashes; i++) {
    // Position - Distribute evenly across the screen
    flashPositions[i * 3] = Math.random() * width;

    if (height/width)
    width, height

    var minValue = 0.45+0.15*(width/height)/(1.24)//0.6;
    var maxValue = 0.65+0.15*(width/height)/(1.24);
    flashPositions[i * 3 + 1] = (minValue + Math.random() * (maxValue - minValue)) * height;
    flashPositions[i * 3 + 2] = 0; // Z-position

    // Size - Limit the maximum size
    flashSizes[i] = Math.random() * 10 + 2; // Random size between 2 and 12

    // Color - Random HSL color
    color.setHSL(Math.random(), 1.0, 0.5);
    flashColors[i * 3] = 255//color.r;
    flashColors[i * 3 + 1] = 255//color.g;
    flashColors[i * 3 + 2] = 255//color.b;

    // Opacity - Reduce the opacity
    flashOpacities[i] = Math.random() * 0.5; // Opacity between 0 and 0.5
  }

  flashGeometry.setAttribute('position', new THREE.BufferAttribute(flashPositions, 3));
  flashGeometry.setAttribute('size', new THREE.BufferAttribute(flashSizes, 1));
  flashGeometry.setAttribute('color', new THREE.BufferAttribute(flashColors, 3));
  flashGeometry.setAttribute('opacity', new THREE.BufferAttribute(flashOpacities, 1));

  const flashMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute float opacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        vColor = color;
        vOpacity = opacity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (10.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        gl_FragColor = vec4(vColor, vOpacity);
        // Add a glow effect
        float distanceToCenter = length(gl_PointCoord - vec2(0.5, 0.5));
        float glow = 0.2 / distanceToCenter - 0.5;
        gl_FragColor += vec4(vColor * glow, glow * vOpacity);
      }
    `,
    blending: THREE.AdditiveBlending, // Experiment with different blending modes (e.g., THREE.NormalBlending)
    depthTest: false,
    transparent: true,
    vertexColors: true,
  });

  const flashParticles = new THREE.Points(flashGeometry, flashMaterial);
  scene.add(flashParticles);

  // Animation function
  function animateFlashes() {
    for (let i = 0; i < numFlashes; i++) {
      flashOpacities[i] = Math.random() * 0.5; // Vary opacity each frame
      flashSizes[i] = Math.random() * 10 + 2;
    }

    flashGeometry.attributes.opacity.needsUpdate = true;
    flashGeometry.attributes.size.needsUpdate = true;
  }

  return { flashParticles, animateFlashes };
}