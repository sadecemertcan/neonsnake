// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 25,
    GRID_COUNT: 20,
    INITIAL_SPEED: 200,
    MIN_SPEED: 50,
    SPEED_DECREASE: 5,
    POWER_UP_CHANCE: 0.3,
    POINTS_PER_FOOD: 10,
    LEVEL_UP_SCORE: 100
};

// RGB renk değişimi için değişkenler
let hue = 0;
const HUE_CHANGE_SPEED = 1;

// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const eatSound = document.getElementById('eatSound');
const levelUpSound = document.getElementById('levelUpSound');
const gameOverSound = document.getElementById('gameOverSound');

// Canvas boyutunu ayarla
canvas.width = GAME_CONFIG.GRID_COUNT * GAME_CONFIG.GRID_SIZE;
canvas.height = GAME_CONFIG.GRID_COUNT * GAME_CONFIG.GRID_SIZE;

// Oyun Durumu
let gameState = {
    snake: [],
    food: {},
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    level: 1,
    gameSpeed: GAME_CONFIG.INITIAL_SPEED,
    gameLoop: null,
    lastRenderTime: 0,
    gameStarted: false
};

// Dil desteği
const TRANSLATIONS = {
    tr: {
        score: 'Skor',
        level: 'Seviye',
        gameOver: 'Oyun Bitti!',
        finalScore: 'Skor',
        finalLevel: 'Seviye',
        tapToStart: 'Başlamak için dokun',
        swipeToMove: 'Kaydırarak hareket et',
        tapForAbility: 'Özel yetenek için dokun',
        controls: 'Kontroller'
    },
    en: {
        score: 'Score',
        level: 'Level',
        gameOver: 'Game Over!',
        finalScore: 'Score',
        finalLevel: 'Level',
        tapToStart: 'Tap to Start',
        swipeToMove: 'Swipe to Move',
        tapForAbility: 'Tap for Special Ability',
        controls: 'Controls'
    }
};

let currentLang = 'tr';

// Dil değiştirme
const languageSwitch = document.getElementById('language-switch');
languageSwitch.addEventListener('click', () => {
    currentLang = currentLang === 'tr' ? 'en' : 'tr';
    languageSwitch.textContent = currentLang === 'tr' ? 'EN' : 'TR';
    updateUI();
    updateMessages();
});

// Mobil cihaz kontrolü
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.querySelectorAll('.desktop-controls').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.mobile-controls').forEach(el => el.style.display = 'block');
} else {
    document.querySelectorAll('.mobile-controls').forEach(el => el.style.display = 'none');
}

// Dokunma kontrolü için değişkenler
let touchStartX = 0;
let touchStartY = 0;
let lastTouchTime = 0;

// Dokunma olayları
document.querySelector('.swipe-overlay').addEventListener('touchstart', handleTouchStart, { passive: false });
document.querySelector('.swipe-overlay').addEventListener('touchmove', handleTouchMove, { passive: false });
document.querySelector('.swipe-overlay').addEventListener('touchend', handleTouchEnd, { passive: false });

function handleTouchStart(event) {
    event.preventDefault();
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!touchStartX || !touchStartY) return;

    const touchEndX = event.touches[0].clientX;
    const touchEndY = event.touches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        gameState.nextDirection = { x: deltaX > 0 ? 1 : -1, y: 0 };
    } else {
        gameState.nextDirection = { x: 0, y: deltaY > 0 ? 1 : -1 };
    }

    touchStartX = null;
    touchStartY = null;
}

function handleTouchEnd(event) {
    event.preventDefault();
    const now = Date.now();
    if (now - lastTouchTime < 300) {
        if (!gameState.gameStarted) {
            startGame();
        }
    }
    lastTouchTime = now;
}

// Oyun Başlatma ve Sıfırlama
function initializeGame() {
    gameState = {
        snake: initializeSnake(),
        food: {},
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        level: 1,
        gameSpeed: GAME_CONFIG.INITIAL_SPEED,
        gameLoop: null,
        lastRenderTime: 0,
        gameStarted: false
    };
    
    createFood();
    updateUI();
}

function initializeSnake() {
    const centerPos = Math.floor(GAME_CONFIG.GRID_COUNT / 2);
    return [
        { x: centerPos, y: centerPos },
        { x: centerPos - 1, y: centerPos },
        { x: centerPos - 2, y: centerPos }
    ];
}

function createFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT),
            y: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT)
        };
    } while (isSnakePosition(newFood));
    gameState.food = newFood;
}

function isSnakePosition(pos) {
    return gameState.snake.some(segment => segment.x === pos.x && segment.y === pos.y);
}

// UI Güncelleme
function updateUI() {
    document.getElementById('score').textContent = `${TRANSLATIONS[currentLang].score}: ${gameState.score}`;
    document.getElementById('level').textContent = `${TRANSLATIONS[currentLang].level}: ${gameState.level}`;
    document.getElementById('animal').textContent = `Yılan`;
}

function updateMessages() {
    const message = document.getElementById('message');
    if (!gameState.gameStarted) {
        message.textContent = TRANSLATIONS[currentLang].tapToStart;
    } else if (message.style.display === 'block') {
        message.textContent = `${TRANSLATIONS[currentLang].gameOver}\n${TRANSLATIONS[currentLang].finalScore}: ${gameState.score}\n${TRANSLATIONS[currentLang].finalLevel}: ${gameState.level}`;
    }
    document.querySelector('#controls p:first-child').textContent = TRANSLATIONS[currentLang].controls;
}

// Oyun Döngüsü
function gameStep(currentTime) {
    if (!gameState.gameStarted) return;
    
    gameState.gameLoop = requestAnimationFrame(gameStep);
    
    const secondsSinceLastRender = (currentTime - gameState.lastRenderTime) / 1000;
    if (secondsSinceLastRender < gameState.gameSpeed / 1000) return;
    
    gameState.lastRenderTime = currentTime;
    updateGame();
    draw();
}

// Oyun Mantığı
function updateGame() {
    gameState.direction = gameState.nextDirection;
    const head = {
        x: gameState.snake[0].x + gameState.direction.x,
        y: gameState.snake[0].y + gameState.direction.y
    };
    
    if (isCollision(head)) {
        gameOver();
        return;
    }
    
    gameState.snake.unshift(head);
    
    if (head.x === gameState.food.x && head.y === gameState.food.y) {
        handleFoodCollision();
    } else {
        gameState.snake.pop();
    }
}

function isCollision(position) {
    // Duvar kontrolü
    if (position.x < 0 || position.x >= GAME_CONFIG.GRID_COUNT ||
        position.y < 0 || position.y >= GAME_CONFIG.GRID_COUNT) {
        return true;
    }
    
    // Kendine çarpma kontrolü
    return gameState.snake.some(segment => segment.x === position.x && segment.y === position.y);
}

function handleFoodCollision() {
    gameState.score += GAME_CONFIG.POINTS_PER_FOOD;
    if (gameState.score >= gameState.level * GAME_CONFIG.LEVEL_UP_SCORE) {
        levelUp();
    }
    createFood();
    playSound(eatSound);
}

function levelUp() {
    gameState.level++;
    gameState.gameSpeed = Math.max(GAME_CONFIG.MIN_SPEED, 
        GAME_CONFIG.INITIAL_SPEED - (gameState.level - 1) * GAME_CONFIG.SPEED_DECREASE);
    updateUI();
    playSound(levelUpSound);
}

// Çizim İşlemleri
function draw() {
    drawBackground();
    drawSnake();
    drawFood();
}

function drawBackground() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
    hue = (hue + HUE_CHANGE_SPEED) % 360;
    const snakeColor = `hsl(${hue}, 100%, 50%)`;
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = snakeColor;
    
    gameState.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? snakeColor : `hsl(${(hue + 20) % 360}, 100%, 40%)`;
        
        ctx.fillRect(
            segment.x * GAME_CONFIG.GRID_SIZE + 1,
            segment.y * GAME_CONFIG.GRID_SIZE + 1,
            GAME_CONFIG.GRID_SIZE - 2,
            GAME_CONFIG.GRID_SIZE - 2
        );
        
        if (index === 0) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(
                segment.x * GAME_CONFIG.GRID_SIZE + 5,
                segment.y * GAME_CONFIG.GRID_SIZE + 5,
                GAME_CONFIG.GRID_SIZE - 10,
                GAME_CONFIG.GRID_SIZE - 10
            );
            drawSnakeEyes(segment);
        }
    });
    
    ctx.shadowBlur = 0;
}

function drawSnakeEyes(head) {
    ctx.fillStyle = '#000';
    const eyeSize = 4;
    const eyeOffset = 6;
    
    const eyePositions = {
        '1,0': [
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize, y: eyeOffset },
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize, y: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize }
        ],
        '-1,0': [
            { x: eyeOffset, y: eyeOffset },
            { x: eyeOffset, y: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize }
        ],
        '0,-1': [
            { x: eyeOffset, y: eyeOffset },
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize, y: eyeOffset }
        ],
        '0,1': [
            { x: eyeOffset, y: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize },
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize, y: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize }
        ]
    };
    
    const key = `${gameState.direction.x},${gameState.direction.y}`;
    const positions = eyePositions[key] || [];
    
    positions.forEach(pos => {
        ctx.fillRect(
            head.x * GAME_CONFIG.GRID_SIZE + pos.x,
            head.y * GAME_CONFIG.GRID_SIZE + pos.y,
            eyeSize,
            eyeSize
        );
    });
}

function drawFood() {
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
    
    ctx.fillStyle = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE + 2,
        gameState.food.y * GAME_CONFIG.GRID_SIZE + 2,
        GAME_CONFIG.GRID_SIZE - 4,
        GAME_CONFIG.GRID_SIZE - 4
    );
    
    ctx.fillStyle = '#fff';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE + 6,
        gameState.food.y * GAME_CONFIG.GRID_SIZE + 6,
        GAME_CONFIG.GRID_SIZE - 12,
        GAME_CONFIG.GRID_SIZE - 12
    );
    
    ctx.shadowBlur = 0;
}

// Ses Çalma
function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

// Oyun Bitişi
function gameOver() {
    gameState.gameStarted = false;
    cancelAnimationFrame(gameState.gameLoop);
    gameState.gameLoop = null;
    
    playSound(gameOverSound);
    
    const message = document.getElementById('message');
    message.textContent = `${TRANSLATIONS[currentLang].gameOver}\n${TRANSLATIONS[currentLang].finalScore}: ${gameState.score}\n${TRANSLATIONS[currentLang].finalLevel}: ${gameState.level}`;
    message.style.display = 'block';
}

// Klavye Kontrolleri
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(event) {
    if (!gameState.gameStarted && event.code === 'Space') {
        startGame();
        return;
    }
    
    const keyMappings = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
    };
    
    const newDirection = keyMappings[event.key];
    if (!newDirection) return;
    
    const currentDirection = gameState.direction;
    if (newDirection.x === -currentDirection.x || newDirection.y === -currentDirection.y) {
        return;
    }
    gameState.nextDirection = newDirection;
}

// Oyunu Başlat
function startGame() {
    if (gameState.gameLoop) return;
    
    initializeGame();
    gameState.gameStarted = true;
    gameState.lastRenderTime = 0;
    requestAnimationFrame(gameStep);
    
    document.getElementById('message').style.display = 'none';
}

// İlk çizimi yap ve başlangıç mesajını göster
draw();
const message = document.getElementById('message');
message.textContent = TRANSLATIONS[currentLang].tapToStart;
message.style.display = 'block'; 