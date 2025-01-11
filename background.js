const bgCanvas = document.getElementById('backgroundCanvas');
const bgCtx = bgCanvas.getContext('2d');

// Canvas boyutlarını pencere boyutuna ayarla
function resizeCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Ritim değişkenleri
let beatIntensity = 0;
let lastBeatTime = 0;
const beatDecay = 0.05;

// Bölümlere göre efekt ayarları
const levelEffects = {
    1: {
        particleCount: 75,
        burstCount: 5,
        particleSpeed: 4,
        colors: ['#00f3ff', '#0066ff', '#0033ff'],
        beatMultiplier: 1.5
    },
    2: {
        particleCount: 100,
        burstCount: 7,
        particleSpeed: 5,
        colors: ['#ff0080', '#ff00ff', '#ff3366'],
        beatMultiplier: 2
    },
    3: {
        particleCount: 150,
        burstCount: 10,
        particleSpeed: 6,
        colors: ['#7700ff', '#9900ff', '#cc00ff'],
        beatMultiplier: 2.5
    }
};

// Müzik ritmi eventi
window.addEventListener('musicBeat', (e) => {
    beatIntensity = e.detail.intensity * levelEffects[currentGameLevel].beatMultiplier;
    lastBeatTime = Date.now();
    
    // Ritimle birlikte yeni patlama efekti
    const burst = new LightBurst(currentGameLevel);
    burst.size = burst.maxSize * beatIntensity;
    bursts.push(burst);
    
    // Fazla patlamaları temizle
    if (bursts.length > levelEffects[currentGameLevel].burstCount) {
        bursts.shift();
    }
});

class NeonParticle {
    constructor(level = 1) {
        this.level = level;
        this.reset();
    }

    reset() {
        const effect = levelEffects[this.level];
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.size = Math.random() * 3 + 1;
        this.baseSize = this.size;
        this.speedX = (Math.random() - 0.5) * effect.particleSpeed;
        this.speedY = (Math.random() - 0.5) * effect.particleSpeed;
        this.life = Math.random() * 100 + 50;
        this.opacity = Math.random();
        this.color = effect.colors[Math.floor(Math.random() * effect.colors.length)];
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        this.opacity = Math.max(0, this.life / 150);
        
        // Ritme göre boyut değişimi
        this.size = this.baseSize * (1 + beatIntensity);

        if (this.life <= 0 || this.x < 0 || this.x > bgCanvas.width || this.y < 0 || this.y > bgCanvas.height) {
            this.reset();
        }
    }

    draw() {
        bgCtx.beginPath();
        bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        bgCtx.fillStyle = this.color;
        bgCtx.globalAlpha = this.opacity;
        bgCtx.shadowBlur = 15 + (beatIntensity * 10);
        bgCtx.shadowColor = this.color;
        bgCtx.fill();
        bgCtx.globalAlpha = 1;
        bgCtx.shadowBlur = 0;
    }
}

class LightBurst {
    constructor(level = 1) {
        this.level = level;
        this.reset();
    }

    reset() {
        const effect = levelEffects[this.level];
        this.x = Math.random() * bgCanvas.width;
        this.y = Math.random() * bgCanvas.height;
        this.size = 0;
        this.maxSize = Math.random() * 100 + 50;
        this.color = effect.colors[Math.floor(Math.random() * effect.colors.length)] + '80';
        this.opacity = 1;
        this.growing = true;
        this.growthSpeed = 1 + (this.level * 0.5) + beatIntensity;
    }

    update() {
        if (this.growing) {
            this.size += this.growthSpeed * (2 + beatIntensity);
            this.opacity -= 0.02;
            if (this.size >= this.maxSize) {
                this.growing = false;
            }
        } else {
            this.opacity -= 0.02;
        }

        if (this.opacity <= 0) {
            this.reset();
        }
    }

    draw() {
        bgCtx.beginPath();
        const gradient = bgCtx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');

        bgCtx.fillStyle = gradient;
        bgCtx.globalAlpha = this.opacity;
        bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.globalAlpha = 1;
    }
}

let currentGameLevel = 1;
let particles = [];
let bursts = [];

function updateEffects(level) {
    currentGameLevel = level;
    const effect = levelEffects[level];
    
    particles = Array.from({ length: effect.particleCount }, 
        () => new NeonParticle(level)
    );
    
    bursts = Array.from({ length: effect.burstCount }, 
        () => new LightBurst(level)
    );
}

updateEffects(1);

function animate() {
    // Ritim azalması
    if (beatIntensity > 0) {
        beatIntensity = Math.max(0, beatIntensity - beatDecay);
    }

    bgCtx.fillStyle = `rgba(10, 10, 42, ${0.2 - (currentGameLevel * 0.03)})`;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    bursts.forEach(burst => {
        burst.update();
        burst.draw();
    });

    requestAnimationFrame(animate);
}

animate();

// Her 100ms'de bir ritim eventi gönder (daha hızlı efektler için)
setInterval(() => {
    if (isGameRunning && !isPaused && isSoundOn) {
        emitBeat();
    }
}, 100); 