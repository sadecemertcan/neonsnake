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
    REVERSE: {
        name: 'Ters Kontrol',
        color: '#f0f',
        duration: 5000,
        apply: () => {},
        remove: () => {}
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
    powerUpActive: false,
    powerUpType: null,
    powerUpTimer: null,
    specialAbilityActive: false,
    specialAbilityTimer: null,
    lives: 1,
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

// Dokunma olaylarını engelle
document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });

document.addEventListener('touchstart', function(e) {
    if (e.target.tagName !== 'BUTTON') {
        e.preventDefault();
    }
}, { passive: false });

// Mobil cihaz kontrolü
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    // Mobil cihazlarda tarayıcı kaydırmasını engelle
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Mobil kontrolleri göster, masaüstü kontrollerini gizle
    document.querySelectorAll('.desktop-controls').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.mobile-controls').forEach(el => el.style.display = 'block');
} else {
    // Masaüstünde mobil kontrolleri gizle
    document.querySelectorAll('.mobile-controls').forEach(el => el.style.display = 'none');
}

// Dokunma kontrolü için değişkenler
let touchStartX = 0;
let touchStartY = 0;
let lastTouchTime = 0;
let touchTimeout = null;

// Dokunma olayları
document.querySelector('.swipe-overlay').addEventListener('touchstart', handleTouchStart, { passive: false });
document.querySelector('.swipe-overlay').addEventListener('touchmove', handleTouchMove, { passive: false });
document.querySelector('.swipe-overlay').addEventListener('touchend', handleTouchEnd, { passive: false });

function handleTouchStart(event) {
    event.preventDefault();
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    
    // Uzun dokunma kontrolü
    touchTimeout = setTimeout(() => {
        useSpecialAbility();
    }, 500);
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!touchStartX || !touchStartY) return;

    clearTimeout(touchTimeout);
    
    const touchEndX = event.touches[0].clientX;
    const touchEndY = event.touches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Minimum kaydırma mesafesi (daha hassas)
    if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) return;

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
    clearTimeout(touchTimeout);

    const now = Date.now();
    if (now - lastTouchTime < 300) {
        // Çift dokunma - özel yetenek
        useSpecialAbility();
    }
    lastTouchTime = now;

    if (!gameState.gameStarted) {
        startGame();
    }
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
        powerUpActive: false,
        powerUpType: null,
        powerUpTimer: null,
        specialAbilityActive: false,
        specialAbilityTimer: null,
        lives: 1,
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

// Oyun Döngüsü
function gameStep(currentTime) {
    if (!gameState.gameStarted) return;
    
    gameState.gameLoop = requestAnimationFrame(gameStep);
    
    const secondsSinceLastRender = (currentTime - gameState.lastRenderTime) / 1000;
    if (secondsSinceLastRender < gameState.gameSpeed / 1000) return;
    
    gameState.lastRenderTime = currentTime;
    
    // Hareket güncelleme
    updateMovement();
    
    updateGame();
    draw();
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    // RGB renk değişimi
    hue = (hue + HUE_CHANGE_SPEED) % 360;
    const snakeColor = `hsl(${hue}, 100%, 50%)`;
    
    if (gameState.powerUpType === 'GHOST') {
        ctx.globalAlpha = 0.5;
    }
    
    // Neon efekti için glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = snakeColor;
    
    gameState.snake.forEach((segment, index) => {
        // Ana renk
        ctx.fillStyle = index === 0 ? snakeColor : `hsl(${(hue + 20) % 360}, 100%, 40%)`;
            
        // Yılan parçalarını büyük çiz
        ctx.fillRect(
            segment.x * GAME_CONFIG.GRID_SIZE + 1,
            segment.y * GAME_CONFIG.GRID_SIZE + 1,
            GAME_CONFIG.GRID_SIZE - 2,
            GAME_CONFIG.GRID_SIZE - 2
        );
        
        // İç kısım için daha parlak renk
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
    ctx.globalAlpha = 1;
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
    // Neon efekti için glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
    
    // Ana yem
    ctx.fillStyle = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE + 2,
        gameState.food.y * GAME_CONFIG.GRID_SIZE + 2,
        GAME_CONFIG.GRID_SIZE - 4,
        GAME_CONFIG.GRID_SIZE - 4
    );
    
    // İç kısım için daha parlak renk
    ctx.fillStyle = '#fff';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE + 6,
        gameState.food.y * GAME_CONFIG.GRID_SIZE + 6,
        GAME_CONFIG.GRID_SIZE - 12,
        GAME_CONFIG.GRID_SIZE - 12
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
    
    // Özel yetenek aktivasyonu - F tuşu
    if (event.code === 'KeyF' && gameState.gameStarted) {
        useSpecialAbility();
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
    
    // Serbest hareket için çapraz kontrol
    if (ANIMALS[gameState.currentAnimal].movement === 'free') {
        gameState.nextDirection = newDirection;
    } else {
        // Normal hareket için ters yön kontrolü
        const currentDirection = gameState.direction;
        if (newDirection.x === -currentDirection.x || newDirection.y === -currentDirection.y) {
            return;
        }
        gameState.nextDirection = newDirection;
    }
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

// Özel Yetenek Kullanımı
function useSpecialAbility() {
    if (gameState.specialAbilityActive) return;
    
    const animal = ANIMALS[gameState.currentAnimal];
    if (!animal.specialAbility) return;
    
    gameState.specialAbilityActive = true;
    
    switch(animal.specialAbility) {
        case 'turbo':
            // Tavşan turbo modu
            const originalSpeed = gameState.gameSpeed;
            gameState.gameSpeed *= 0.5;
            gameState.specialAbilityTimer = setTimeout(() => {
                gameState.gameSpeed = originalSpeed;
                gameState.specialAbilityActive = false;
            }, 3000);
            break;
            
        case 'claw':
            // Kaplan pençe saldırısı
            removeNearbyObstacles();
            gameState.specialAbilityTimer = setTimeout(() => {
                gameState.specialAbilityActive = false;
            }, 1000);
            break;
            
        case 'fireball':
            // Ejderha ateş topu
            shootFireball();
            gameState.specialAbilityTimer = setTimeout(() => {
                gameState.specialAbilityActive = false;
            }, 2000);
            break;
    }
}

// Engel Kaldırma (Kaplan için)
function removeNearbyObstacles() {
    const head = gameState.snake[0];
    const range = 2;
    
    gameState.obstacles = gameState.obstacles.filter(obs => {
        const distance = Math.abs(obs.x - head.x) + Math.abs(obs.y - head.y);
        return distance > range;
    });
}

// Ateş Topu (Ejderha için)
function shootFireball() {
    const head = gameState.snake[0];
    const direction = gameState.direction;
    
    let fireball = { ...head };
    const interval = setInterval(() => {
        fireball.x += direction.x * 2;
        fireball.y += direction.y * 2;
        
        // Engelleri yok et
        gameState.obstacles = gameState.obstacles.filter(obs => 
            obs.x !== fireball.x || obs.y !== fireball.y
        );
        
        // Ekran dışına çıktıysa durdur
        if (fireball.x < 0 || fireball.x >= GAME_CONFIG.GRID_COUNT ||
            fireball.y < 0 || fireball.y >= GAME_CONFIG.GRID_COUNT) {
            clearInterval(interval);
        }
    }, 100);
} 

// Renk değiştirme işleyicisi
function initializeColorPicker() {
    const buttons = document.querySelectorAll('.color-btn');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.dataset.color;
            ANIMALS[gameState.currentAnimal].color = color;
            
            // Aktif butonu güncelle
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // UI'ı güncelle
            updateAnimalUI();
        });
        
        // İlk rengi aktif olarak işaretle
        if (button.dataset.color === ANIMALS[gameState.currentAnimal].color) {
            button.classList.add('active');
        }
    });
}

// Oyunu başlatmadan önce renk seçiciyi başlat
initializeColorPicker(); 

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