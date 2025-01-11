const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
];
let food = { x: 15, y: 15 };
let obstacles = [];
let dx = 1;
let dy = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameSpeed = 150;
let baseSpeed = 150;
let speedIncrease = 0.5;
let gameLoop;
let isPaused = false;
let isGameRunning = false;
let currentLevel = 1;
let glowIntensity = 0;
let glowIncreasing = true;
let lastMoveTime = 0;

const levels = {
    1: {
        name: "Neon Yılan",
        target: 100,
        color: "#00f3ff",
        obstacleColor: "#ff0000",
        speed: 150,
        character: "snake",
        obstacleCount: 0
    },
    2: {
        name: "Ejderha",
        target: 250,
        color: "#ff0080",
        obstacleColor: "#00ff00",
        speed: 130,
        character: "dragon",
        obstacleCount: 3
    },
    3: {
        name: "Işık Hızı",
        target: 500,
        color: "#7700ff",
        obstacleColor: "#ffff00",
        speed: 100,
        character: "lightspeed",
        obstacleCount: 5
    }
};

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const messageDiv = document.getElementById('message');
const levelInfo = document.getElementById('levelInfo');

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);

// Dokunmatik kontroller için event listener
canvas.addEventListener('touchstart', handleTouch, { passive: false });

function handleTouch(e) {
    e.preventDefault();
    
    // Oyun başlamamışsa veya bitmişse, dokunuşla başlat
    if (!isGameRunning || gameOver()) {
        startGame();
        return;
    }

    if (!isGameRunning || isPaused) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    
    // Dokunulan noktanın canvas içindeki koordinatları
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // Yılanın mevcut konumu (başının konumu)
    const snakeHeadX = snake[0].x * gridSize;
    const snakeHeadY = snake[0].y * gridSize;
    
    // Dokunulan noktanın yılanın başına göre konumu
    const deltaX = touchX - snakeHeadX;
    const deltaY = touchY - snakeHeadY;
    
    // Yatay ve dikey mesafelerin mutlak değerleri
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Eğer yatay mesafe dikey mesafeden büyükse
    if (absX > absY) {
        if (deltaX > 0 && dx !== -1) {
            // Sağa
            dx = 1;
            dy = 0;
        } else if (deltaX < 0 && dx !== 1) {
            // Sola
            dx = -1;
            dy = 0;
        }
    } else {
        if (deltaY > 0 && dy !== -1) {
            // Aşağı
            dx = 0;
            dy = 1;
        } else if (deltaY < 0 && dy !== 1) {
            // Yukarı
            dx = 0;
            dy = -1;
        }
    }
}

// Mobil cihaz kontrolü
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// Oyun başladığında mobil ayarları yap
window.onload = function() {
    updateLevelInfo();
    if (isMobile()) {
        resizeGameForMobile();
    }
};

// Mobil için oyun alanını yeniden boyutlandır
function resizeGameForMobile() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const gameContainer = document.querySelector('.game-container');
    const size = Math.min(screenWidth * 0.95, 400);

    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    gameContainer.style.width = size + 'px';
}

// Ekran döndürme ve yeniden boyutlandırma olaylarını dinle
window.addEventListener('orientationchange', () => {
    if (isMobile()) {
        setTimeout(resizeGameForMobile, 100);
    }
});

window.addEventListener('resize', () => {
    if (isMobile()) {
        resizeGameForMobile();
    }
}); 