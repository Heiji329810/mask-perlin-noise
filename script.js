const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('container');

// Set canvas size
function resizeCanvas() {
    const size = Math.min(window.innerWidth - 40, window.innerHeight - 40, 800);
    canvas.width = size;
    canvas.height = size;
    init();
}

// Perlin noise instance
const perlin = new PerlinNoise();

// Layers
let paintingCanvas = null;
let paintingCtx = null;
let maskCanvas = null;
let maskCtx = null;

// Drawing state
let isDrawing = false;
let brushSize = 40;
let lastMousePos = { x: 0, y: 0 };

// Animation
let animationTime = 0;
let animationId = null;

// Particle system
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 3 + 2;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= this.decay;
        this.angle += this.rotationSpeed;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw sparkle
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.3, -this.size * 0.3);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(this.size * 0.3, this.size * 0.3);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.3, this.size * 0.3);
        ctx.lineTo(-this.size, 0);
        ctx.lineTo(-this.size * 0.3, -this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

let particles = [];

// Initialize the painting and mask
function init() {
    // Create offscreen canvases
    paintingCanvas = document.createElement('canvas');
    paintingCanvas.width = canvas.width;
    paintingCanvas.height = canvas.height;
    paintingCtx = paintingCanvas.getContext('2d');

    maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    maskCtx = maskCanvas.getContext('2d');

    // Fill mask with black (covering the painting)
    maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Clear particles
    particles = [];
    
    // Start animation loop
    if (animationId) cancelAnimationFrame(animationId);
    animate();
}

// Generate colorful animated Perlin noise painting
function generatePainting() {
    const imageData = paintingCtx.createImageData(paintingCanvas.width, paintingCanvas.height);
    const data = imageData.data;
    
    const time = animationTime * 0.001;
    const wave = Math.sin(time * 0.5) * 0.5 + 0.5;
    
    for (let y = 0; y < paintingCanvas.height; y++) {
        for (let x = 0; x < paintingCanvas.width; x++) {
            const index = (y * paintingCanvas.width + x) * 4;
            
            // Animated Perlin noise with multiple octaves
            const n1 = perlin.octaveNoise(x * 0.008 + time * 20, y * 0.008 + time * 15, 5, 0.6);
            const n2 = perlin.octaveNoise(x * 0.012 + 100 + time * 12, y * 0.012 + time * 18, 4, 0.5);
            const n3 = perlin.octaveNoise(x * 0.018 + 200 + time * 10, y * 0.018 + time * 22, 3, 0.4);
            
            // Add flowing motion
            const flowX = perlin.noise(x * 0.005 + time * 25, y * 0.005) * 50;
            const flowY = perlin.noise(x * 0.005, y * 0.005 + time * 25) * 50;
            const n4 = perlin.octaveNoise((x + flowX) * 0.015, (y + flowY) * 0.015, 2, 0.3);
            
            // Create vibrant, shifting colors
            const hue = (n1 * 180 + n4 * 180 + time * 30 + wave * 60) % 360;
            const saturation = 60 + n2 * 35 + wave * 10;
            const lightness = 35 + n3 * 35 + wave * 15;
            
            // Convert HSL to RGB
            const rgb = hslToRgb(hue / 360, saturation / 100, lightness / 100);
            
            data[index] = rgb[0];     // R
            data[index + 1] = rgb[1]; // G
            data[index + 2] = rgb[2]; // B
            data[index + 3] = 255;    // A
        }
    }
    
    paintingCtx.putImageData(imageData, 0, 0);
}

// HSL to RGB conversion
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Get color at position from painting
function getColorAt(x, y) {
    if (x < 0 || x >= paintingCanvas.width || y < 0 || y >= paintingCanvas.height) {
        return { r: 255, g: 200, b: 100 };
    }
    const imageData = paintingCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1);
    return {
        r: imageData.data[0],
        g: imageData.data[1],
        b: imageData.data[2]
    };
}

// Spawn particles at position
function spawnParticles(x, y, count = 15) {
    const color = getColorAt(x, y);
    const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
    
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, colorStr));
    }
}

// Render the final image (painting + mask + particles)
function render() {
    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the animated painting
    ctx.drawImage(paintingCanvas, 0, 0);
    
    // Draw the mask using composite operation
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw particles on top
    particles.forEach(particle => {
        particle.draw(ctx);
    });
}

// Update particles
function updateParticles() {
    particles = particles.filter(particle => {
        particle.update();
        return !particle.isDead() && 
               particle.x > -10 && particle.x < canvas.width + 10 &&
               particle.y > -10 && particle.y < canvas.height + 10;
    });
}

// Erase mask at position with smooth interpolation
function eraseMask(x, y, prevX = null, prevY = null) {
    maskCtx.globalCompositeOperation = 'destination-out';
    
    if (prevX !== null && prevY !== null) {
        // Smooth line interpolation
        const dx = x - prevX;
        const dy = y - prevY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(distance / 2));
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = prevX + dx * t;
            const py = prevY + dy * t;
            
            maskCtx.beginPath();
            maskCtx.arc(px, py, brushSize, 0, Math.PI * 2);
            maskCtx.fill();
            
            // Spawn particles along the path
            if (i % 2 === 0) {
                spawnParticles(px, py, 3);
            }
        }
    } else {
        maskCtx.beginPath();
        maskCtx.arc(x, y, brushSize, 0, Math.PI * 2);
        maskCtx.fill();
        spawnParticles(x, y, 10);
    }
    
    maskCtx.globalCompositeOperation = 'source-over';
}

// Animation loop
function animate() {
    animationTime += 16; // Assume ~60fps
    
    // Update animated painting periodically (every few frames for performance)
    if (Math.floor(animationTime / 16) % 3 === 0) {
        generatePainting();
    }
    
    // Update particles
    updateParticles();
    
    // Render
    render();
    
    animationId = requestAnimationFrame(animate);
}

// Get mouse position relative to canvas
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const pos = getMousePos(e);
    lastMousePos = { x: pos.x, y: pos.y };
    eraseMask(pos.x, pos.y);
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    if (isDrawing) {
        eraseMask(pos.x, pos.y, lastMousePos.x, lastMousePos.y);
        lastMousePos = { x: pos.x, y: pos.y };
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDrawing = true;
    const touch = e.touches[0];
    const pos = getMousePos(touch);
    lastMousePos = { x: pos.x, y: pos.y };
    eraseMask(pos.x, pos.y);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDrawing) {
        const touch = e.touches[0];
        const pos = getMousePos(touch);
        eraseMask(pos.x, pos.y, lastMousePos.x, lastMousePos.y);
        lastMousePos = { x: pos.x, y: pos.y };
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDrawing = false;
});

// Reset mask with 'R' key
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        particles = [];
        animationTime = 0;
    }
});

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Initialize on load
resizeCanvas();
