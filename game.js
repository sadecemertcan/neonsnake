// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 20,
    GRID_COUNT: 20,
    INITIAL_SPEED: 120,
    MIN_SPEED: 40,
    SPEED_DECREASE: 8,
    POWER_UP_CHANCE: 0.2,
    POINTS_PER_FOOD: 10,
    LEVEL_UP_SCORE: 50
};

// RGB renk değişimi için değişkenler
let borderHue = 0;
const BORDER_COLOR_SPEED = 2;

// Arkaplan patlamaları için
const explosions = [];
const MAX_EXPLOSIONS = 5;

function createExplosion() {
    if (explosions.length >= MAX_EXPLOSIONS) return;
    
    explosions.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0,
        maxSize: 50 + Math.random() * 100,
        speed: 1 + Math.random() * 2,
        hue: Math.random() * 360,
        alpha: 1
    });
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.size += exp.speed;
        exp.alpha -= 0.01;
        
        if (exp.size >= exp.maxSize || exp.alpha <= 0) {
            explosions.splice(i, 1);
        }
    }
    
    if (Math.random() < 0.05) {
        createExplosion();
    }
}

function drawExplosions() {
    explosions.forEach(exp => {
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${exp.hue}, 100%, 50%, ${exp.alpha * 0.2})`;
        ctx.fill();
        
        ctx.strokeStyle = `hsla(${exp.hue}, 100%, 50%, ${exp.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// Hayvan Özellikleri
const ANIMALS = {
    SNAKE: {
        name: 'Yılan',
        color: '#0f0',
        speed: GAME_CONFIG.INITIAL_SPEED,
        specialAbility: null,
        movement: 'normal'
    },
    FROG: {
        name: 'Kurbağa',
        color: '#0f9',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.8,
        specialAbility: 'jump',
        movement: 'hop'
    },
    RABBIT: {
        name: 'Tavşan',
        color: '#fff',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.7,
        specialAbility: 'turbo',
        movement: 'accelerate'
    },
    TIGER: {
        name: 'Kaplan',
        color: '#f90',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.6,
        specialAbility: 'claw',
        movement: 'normal'
    },
    EAGLE: {
        name: 'Kartal',
        color: '#99f',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.5,
        specialAbility: 'fly',
        movement: 'free'
    },
    CROCODILE: {
        name: 'Timsah',
        color: '#090',
        speed: GAME_CONFIG.INITIAL_SPEED * 1.2,
        specialAbility: 'crush',
        movement: 'heavy'
    },
    WOLF: {
        name: 'Kurt',
        color: '#999',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.4,
        specialAbility: 'pack',
        movement: 'normal'
    },
    DRAGON: {
        name: 'Ejderha',
        color: '#f00',
        speed: GAME_CONFIG.INITIAL_SPEED * 0.3,
        specialAbility: 'fireball',
        movement: 'fly'
    }
};

// Güç Özellikleri Sabitleri
const POWER_UPS = {
    SPEED: {
        name: 'Hız Artışı',
        color: '#ff0',
        duration: 5000,
        apply: () => { gameSpeed = Math.max(GAME_CONFIG.MIN_SPEED, gameSpeed * 0.7); },
        remove: () => { gameSpeed = GAME_CONFIG.INITIAL_SPEED - (level - 1) * GAME_CONFIG.SPEED_DECREASE; }
    },
    GHOST: {
        name: 'Hayalet Modu',
        color: '#fff',
        duration: 5000,
        apply: () => {},
        remove: () => {}
    },
    SHRINK: {
        name: 'Küçülme',
        color: '#0ff',
        duration: 3000,
        apply: () => {
            const reduction = Math.min(3, Math.floor(snake.length / 2));
            snake = snake.slice(0, snake.length - reduction);
        },
        remove: () => {}
    }
};

// Neon renkler için sabitler
const NEON_COLORS = [
    '#0f0',  // Yeşil
    '#f0f',  // Pembe
    '#0ff',  // Cyan
    '#ff0',  // Sarı
    '#f00',  // Kırmızı
    '#00f',  // Mavi
    '#f50',  // Turuncu
    '#f0c',  // Mor
    '#0fc',  // Turkuaz
    '#fc0'   // Altın
];

// Renk değişim zamanı (ms)
const COLOR_CHANGE_INTERVAL = 2000;

// Arkaplan için neon grid renkleri
const BACKGROUND_COLORS = {
    grid: '#0f0',
    gridOpacity: 0.1,
    glow: '#0f0',
    glowOpacity: 0.2
};

// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas boyutunu ayarla
canvas.width = GAME_CONFIG.GRID_COUNT * GAME_CONFIG.GRID_SIZE;
canvas.height = GAME_CONFIG.GRID_COUNT * GAME_CONFIG.GRID_SIZE;

const eatSound = document.getElementById('eatSound');
const levelUpSound = document.getElementById('levelUpSound');
const gameOverSound = document.getElementById('gameOverSound');

// Oyun Durumu
let gameState = {
    snake: [],
    food: {},
    obstacles: [],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    level: 1,
    currentAnimal: 'SNAKE',
    gameSpeed: GAME_CONFIG.INITIAL_SPEED,
    gameLoop: null,
    lastRenderTime: 0,
    gameStarted: false,
    currentColorIndex: 0,
    lastColorChange: 0,
    gridCount: GAME_CONFIG.GRID_COUNT
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

// Dokunma kontrolü için değişkenler
let touchStartX = 0;
let touchStartY = 0;
let lastTouchTime = 0;

// Dokunma olayları
document.querySelector('.swipe-overlay').addEventListener('touchstart', handleTouchStart);
document.querySelector('.swipe-overlay').addEventListener('touchmove', handleTouchMove);
document.querySelector('.swipe-overlay').addEventListener('touchend', handleTouchEnd);

// Renk değiştirme fonksiyonu
function updateSnakeColor(currentTime) {
    if (currentTime - gameState.lastColorChange > COLOR_CHANGE_INTERVAL) {
        gameState.currentColorIndex = (gameState.currentColorIndex + 1) % NEON_COLORS.length;
        gameState.lastColorChange = currentTime;
        ANIMALS[gameState.currentAnimal].color = NEON_COLORS[gameState.currentColorIndex];
    }
}

// Oyun Döngüsü
function gameStep(currentTime) {
    if (!gameState.gameStarted) return;
    
    gameState.gameLoop = requestAnimationFrame(gameStep);
    
    // Renk güncelleme
    updateSnakeColor(currentTime);
    updateExplosions();
    
    const secondsSinceLastRender = (currentTime - gameState.lastRenderTime) / 1000;
    if (secondsSinceLastRender < gameState.gameSpeed / 1000) return;
    
    gameState.lastRenderTime = currentTime;
    
    updateGame();
    draw();
}

// Oyun Başlatma ve Sıfırlama
function initializeGame() {
    gameState = {
        snake: initializeSnake(),
        food: {},
        obstacles: [],
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        level: 1,
        currentAnimal: 'SNAKE',
        gameSpeed: GAME_CONFIG.INITIAL_SPEED,
        gameLoop: null,
        lastRenderTime: 0,
        gameStarted: false,
        currentColorIndex: 0,
        lastColorChange: 0,
        gridCount: GAME_CONFIG.GRID_COUNT
    };
    
    if (gameState.powerUpTimer) clearTimeout(gameState.powerUpTimer);
    if (gameState.specialAbilityTimer) clearTimeout(gameState.specialAbilityTimer);
    
    canvas.width = gameState.gridCount * GAME_CONFIG.GRID_SIZE;
    canvas.height = gameState.gridCount * GAME_CONFIG.GRID_SIZE;
    
    updateUI();
}

// Yılan Başlangıç Pozisyonu
function initializeSnake() {
    const centerPos = Math.floor(GAME_CONFIG.GRID_COUNT / 2);
    return [
        { x: centerPos, y: centerPos },
        { x: centerPos - 1, y: centerPos },
        { x: centerPos - 2, y: centerPos }
    ];
}

// Engel Oluşturma
function createObstacles() {
    gameState.obstacles = [];
    const obstacleCount = gameState.level * 2;
    
    for (let i = 0; i < obstacleCount; i++) {
        let obstacle;
        do {
            obstacle = {
                x: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT),
                y: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT)
            };
        } while (!isValidPosition(obstacle));
        
        gameState.obstacles.push(obstacle);
    }
}

// Pozisyon Geçerlilik Kontrolü
function isValidPosition(position) {
    // Yılan kontrolü
    if (gameState.snake.some(segment => segment.x === position.x && segment.y === position.y)) {
        return false;
    }
    
    // Yem kontrolü
    if (gameState.food.x === position.x && gameState.food.y === position.y) {
        return false;
    }
    
    // Engel kontrolü
    if (gameState.obstacles.some(obs => obs.x === position.x && obs.y === position.y)) {
        return false;
    }
    
    return true;
}

// Yem Oluşturma
function createFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT),
            y: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT)
        };
    } while (!isValidPosition(newFood));
    
    gameState.food = newFood;
}

// Güç Özelliği Aktivasyonu
function activatePowerUp() {
    if (gameState.powerUpActive) return;
    
    const powerUpTypes = Object.keys(POWER_UPS);
    gameState.powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    gameState.powerUpActive = true;
    
    const powerUp = POWER_UPS[gameState.powerUpType];
    powerUp.apply();
    
    updatePowerUpUI(powerUp);
    
    gameState.powerUpTimer = setTimeout(() => {
        powerUp.remove();
        gameState.powerUpActive = false;
        gameState.powerUpType = null;
        document.getElementById('power-up').style.display = 'none';
    }, powerUp.duration);
}

// UI Güncelleme
function updateUI() {
    document.getElementById('score').textContent = `${TRANSLATIONS[currentLang].score}: ${gameState.score}`;
    document.getElementById('level').textContent = `${TRANSLATIONS[currentLang].level}: ${gameState.level}`;
    document.getElementById('animal').textContent = ANIMALS[gameState.currentAnimal].name;
}

function updatePowerUpUI(powerUp) {
    const powerUpElement = document.getElementById('power-up');
    powerUpElement.textContent = powerUp.name + ' aktif!';
    powerUpElement.style.color = powerUp.color;
    powerUpElement.style.display = 'block';
}

// Oyun Mantığı Güncelleme
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

// Yem Yeme İşlemi
function handleFoodCollision() {
    gameState.score += GAME_CONFIG.POINTS_PER_FOOD;
    updateUI();
    
    if (gameState.score >= gameState.level * GAME_CONFIG.LEVEL_UP_SCORE) {
        levelUp();
    }
    
    createFood();
    playSound(eatSound);
    
    if (Math.random() < GAME_CONFIG.POWER_UP_CHANCE) {
        activatePowerUp();
    }
}

// Seviye Atlama
function levelUp() {
    gameState.level++;
    changeAnimal();
    createObstacles();
    createFood();
    updateUI();
    playSound(levelUpSound);
}

// Çarpışma Kontrolü
function isCollision(position) {
    // Duvar kontrolü
    if (ANIMALS[gameState.currentAnimal].movement !== 'fly') {
        if (position.x < 0 || position.x >= GAME_CONFIG.GRID_COUNT ||
            position.y < 0 || position.y >= GAME_CONFIG.GRID_COUNT) {
            return true;
        }
    } else {
        // Duvardan geçiş
        position.x = (position.x + GAME_CONFIG.GRID_COUNT) % GAME_CONFIG.GRID_COUNT;
        position.y = (position.y + GAME_CONFIG.GRID_COUNT) % GAME_CONFIG.GRID_COUNT;
    }
    
    // Engel kontrolü
    if (gameState.obstacles.some(obs => obs.x === position.x && obs.y === position.y)) {
        if (gameState.currentAnimal === 'WOLF' && gameState.lives > 1) {
            gameState.lives--;
            updateAnimalUI();
            return false;
        }
        return true;
    }
    
    // Kendine çarpma kontrolü
    return gameState.snake.some(segment => segment.x === position.x && segment.y === position.y);
}

// Ses Çalma
function playSound(sound) {
    sound.currentTime = 0;
    sound.play();
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

// Çizim İşlemleri
function draw() {
    drawBackground();
    drawObstacles();
    drawSnake();
    drawFood();
}

function drawBackground() {
    // Siyah arkaplan
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Neon patlamaları çiz
    drawExplosions();
    
    // RGB border rengi güncelle
    borderHue = (borderHue + BORDER_COLOR_SPEED) % 360;
    const borderColor = `hsl(${borderHue}, 100%, 50%)`;
    
    // Oyun alanı kenarları
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = borderColor;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Neon grid çizgileri
    const gridSize = 20;
    ctx.strokeStyle = BACKGROUND_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = BACKGROUND_COLORS.gridOpacity;
    ctx.shadowBlur = 0;
    
    // Yatay ve dikey çizgiler
    for (let i = 0; i <= GAME_CONFIG.GRID_COUNT; i++) {
        const pos = i * GAME_CONFIG.GRID_SIZE;
        
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
}

function drawObstacles() {
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#888';
    ctx.fillStyle = '#888';
    
    gameState.obstacles.forEach(obstacle => {
        ctx.fillRect(
            obstacle.x * GAME_CONFIG.GRID_SIZE,
            obstacle.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE - 1,
            GAME_CONFIG.GRID_SIZE - 1
        );
    });
    
    ctx.shadowBlur = 0;
}

function drawSnake() {
    if (gameState.powerUpType === 'GHOST') {
        ctx.globalAlpha = 0.5;
    }
    
    // Neon efekti için glow artırıldı
    ctx.shadowBlur = 15;
    ctx.shadowColor = ANIMALS[gameState.currentAnimal].color;
    
    gameState.snake.forEach((segment, index) => {
        // Ana renk
        ctx.fillStyle = index === 0 ? 
            ANIMALS[gameState.currentAnimal].color : 
            shadeColor(ANIMALS[gameState.currentAnimal].color, -20);
            
        // Yılan parçalarını büyüttük
        ctx.fillRect(
            segment.x * GAME_CONFIG.GRID_SIZE,
            segment.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE - 1,
            GAME_CONFIG.GRID_SIZE - 1
        );
        
        // İç kısım için daha parlak renk
        if (index === 0) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(
                segment.x * GAME_CONFIG.GRID_SIZE + 3,
                segment.y * GAME_CONFIG.GRID_SIZE + 3,
                GAME_CONFIG.GRID_SIZE - 7,
                GAME_CONFIG.GRID_SIZE - 7
            );
            drawSnakeEyes(segment);
        }
    });
    
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawSnakeEyes(head) {
    ctx.fillStyle = '#000';
    const eyeSize = 3; // Göz boyutu artırıldı
    const eyeOffset = 4; // Göz konumu ayarlandı
    
    const eyePositions = {
        '1,0': [
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - 2, y: eyeOffset },
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - 2, y: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize }
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
            { x: eyeOffset, y: GAME_CONFIG.GRID_SIZE - eyeOffset - 2 },
            { x: GAME_CONFIG.GRID_SIZE - eyeOffset - eyeSize, y: GAME_CONFIG.GRID_SIZE - eyeOffset - 2 }
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
    // Neon efekti için glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0';
    
    // Ana yem
    ctx.fillStyle = '#ff0';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE,
        gameState.food.y * GAME_CONFIG.GRID_SIZE,
        GAME_CONFIG.GRID_SIZE - 1,
        GAME_CONFIG.GRID_SIZE - 1
    );
    
    // İç kısım için daha parlak renk
    ctx.fillStyle = '#fff';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE + 2,
        gameState.food.y * GAME_CONFIG.GRID_SIZE + 2,
        GAME_CONFIG.GRID_SIZE - 5,
        GAME_CONFIG.GRID_SIZE - 5
    );
    
    ctx.shadowBlur = 0;
}

// Klavye Kontrolleri
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(event) {
    event.preventDefault();
    
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
    changeAnimal();
    gameState.gameStarted = true;
    gameState.lastRenderTime = 0;
    
    createFood();
    createObstacles();
    requestAnimationFrame(gameStep);
    
    document.getElementById('message').style.display = 'none';
}

// İlk çizimi yap ve başlangıç mesajını göster
draw();
const message = document.getElementById('message');
message.textContent = TRANSLATIONS[currentLang].tapToStart;
message.style.display = 'block';

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3), 16);
    let G = parseInt(color.substring(3,5), 16);
    let B = parseInt(color.substring(5,7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;  
    G = (G < 255) ? G : 255;  
    B = (B < 255) ? B : 255;  

    const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

    return "#"+RR+GG+BB;
} 

// Hayvan Değişimi
function changeAnimal() {
    const animalOrder = ['SNAKE', 'FROG', 'RABBIT', 'TIGER', 'EAGLE', 'CROCODILE', 'WOLF', 'DRAGON'];
    const newAnimalIndex = Math.min(gameState.level - 1, animalOrder.length - 1);
    const newAnimal = animalOrder[newAnimalIndex];
    
    gameState.currentAnimal = newAnimal;
    gameState.gameSpeed = ANIMALS[newAnimal].speed;
    gameState.lives = newAnimal === 'WOLF' ? 3 : 1;
    
    if (gameState.specialAbilityTimer) {
        clearTimeout(gameState.specialAbilityTimer);
    }
    gameState.specialAbilityActive = false;
    
    updateAnimalUI();
}

// UI Güncelleme
function updateAnimalUI() {
    const animal = ANIMALS[gameState.currentAnimal];
    const animalElement = document.getElementById('animal');
    if (animalElement) {
        animalElement.textContent = `${animal.name} - ${gameState.lives > 1 ? 'Can: ' + gameState.lives : ''}`;
        animalElement.style.color = animal.color;
    }
}

// Hareket Güncelleme
function updateMovement() {
    const animal = ANIMALS[gameState.currentAnimal];
    
    switch(animal.movement) {
        case 'hop':
            // Kurbağa hareketi: Her 2 karede bir hareket
            if (gameState.lastRenderTime % 2 === 0) {
                return;
            }
            break;
            
        case 'zigzag':
            // Kertenkele hareketi: Rastgele zikzak
            if (Math.random() < 0.3) {
                const randomDir = Math.random() < 0.5 ? -1 : 1;
                if (gameState.direction.x !== 0) {
                    gameState.nextDirection = { x: gameState.direction.x, y: randomDir };
                } else {
                    gameState.nextDirection = { x: randomDir, y: gameState.direction.y };
                }
            }
            break;
            
        case 'accelerate':
            // Tavşan hareketi: Sürekli hızlanma
            gameState.gameSpeed = Math.max(
                GAME_CONFIG.MIN_SPEED,
                ANIMALS[gameState.currentAnimal].speed * (0.95 ** gameState.score)
            );
            break;
            
        case 'free':
            // Kartal/Ejderha hareketi: Serbest uçuş
            // Bu modda çapraz hareket mümkün
            break;
            
        case 'heavy':
            // Timsah hareketi: Ağır ama güçlü
            gameState.gameSpeed = ANIMALS[gameState.currentAnimal].speed * 1.5;
            break;
    }
}

// Dokunma olayları
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

    // Minimum kaydırma mesafesi
    if (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30) return;

    // Yön belirleme
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Yatay hareket
        if (deltaX > 0) {
            gameState.nextDirection = { x: 1, y: 0 };
        } else {
            gameState.nextDirection = { x: -1, y: 0 };
        }
    } else {
        // Dikey hareket
        if (deltaY > 0) {
            gameState.nextDirection = { x: 0, y: 1 };
        } else {
            gameState.nextDirection = { x: 0, y: -1 };
        }
    }

    touchStartX = null;
    touchStartY = null;
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!gameState.gameStarted) {
        startGame();
    }
}

function updateMessages() {
    const message = document.getElementById('message');
    if (!gameState.gameStarted) {
        message.textContent = TRANSLATIONS[currentLang].tapToStart;
    } else if (message.style.display === 'block') {
        message.textContent = `${TRANSLATIONS[currentLang].gameOver}\n${TRANSLATIONS[currentLang].finalScore}: ${gameState.score}\n${TRANSLATIONS[currentLang].finalLevel}: ${gameState.level}`;
    }

    // Kontrol metinlerini güncelle
    document.querySelector('#controls p:first-child').textContent = TRANSLATIONS[currentLang].controls;
} 