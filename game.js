// Canvas ve context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun sabitleri
const GRID_SIZE = 20;
const GRID_COUNT = canvas.width / GRID_SIZE;
const INITIAL_SPEED = 200;
const MIN_SPEED = 50;
const SPEED_DECREASE = 5;

// Ses efektleri
const eatSound = document.getElementById('eatSound');
const levelUpSound = document.getElementById('levelUpSound');
const gameOverSound = document.getElementById('gameOverSound');

// Oyun durumu
let snake = [];
let food = {};
let obstacles = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let level = 1;
let gameSpeed = INITIAL_SPEED;
let gameLoop = null;
let lastRenderTime = 0;
let gameStarted = false;
let powerUpActive = false;
let powerUpType = null;
let powerUpTimer = null;

// Güç özellikleri
const POWER_UPS = {
    SPEED: {
        name: 'Hız Artışı',
        color: '#ff0',
        duration: 5000,
        apply: () => {
            gameSpeed = Math.max(MIN_SPEED, gameSpeed * 0.7);
        },
        remove: () => {
            gameSpeed = INITIAL_SPEED - (level - 1) * SPEED_DECREASE;
        }
    },
    REVERSE: {
        name: 'Ters Kontrol',
        color: '#f0f',
        duration: 5000,
        apply: () => {
            // Kontroller ters çevrildi
        },
        remove: () => {
            // Kontroller normale döndü
        }
    },
    GHOST: {
        name: 'Hayalet Modu',
        color: '#fff',
        duration: 5000,
        apply: () => {
            // Engellerden geçebilir
        },
        remove: () => {
            // Normal mod
        }
    },
    SHRINK: {
        name: 'Küçülme',
        color: '#0ff',
        duration: 3000,
        apply: () => {
            const reduction = Math.min(3, Math.floor(snake.length / 2));
            for (let i = 0; i < reduction; i++) {
                snake.pop();
            }
        },
        remove: () => {}
    }
};

// Yılanı başlangıç pozisyonuna getir
function initializeSnake() {
    const centerPos = Math.floor(GRID_COUNT / 2);
    snake = [
        { x: centerPos, y: centerPos },
        { x: centerPos - 1, y: centerPos },
        { x: centerPos - 2, y: centerPos }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
}

// Engelleri oluştur
function createObstacles() {
    obstacles = [];
    const obstacleCount = level * 2;
    
    for (let i = 0; i < obstacleCount; i++) {
        let obstacle;
        let isValid;
        
        do {
            isValid = true;
            obstacle = {
                x: Math.floor(Math.random() * GRID_COUNT),
                y: Math.floor(Math.random() * GRID_COUNT)
            };
            
            // Yılanın üzerinde mi kontrol et
            for (let segment of snake) {
                if (segment.x === obstacle.x && segment.y === obstacle.y) {
                    isValid = false;
                    break;
                }
            }
            
            // Yemin üzerinde mi kontrol et
            if (food.x === obstacle.x && food.y === obstacle.y) {
                isValid = false;
            }
            
            // Diğer engellerle çakışıyor mu kontrol et
            for (let obs of obstacles) {
                if (obs.x === obstacle.x && obs.y === obstacle.y) {
                    isValid = false;
                    break;
                }
            }
            
        } while (!isValid);
        
        obstacles.push(obstacle);
    }
}

// Yeni yem oluştur
function createFood() {
    let isValid;
    
    do {
        isValid = true;
        food = {
            x: Math.floor(Math.random() * GRID_COUNT),
            y: Math.floor(Math.random() * GRID_COUNT)
        };
        
        // Yılanın üzerinde mi kontrol et
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                isValid = false;
                break;
            }
        }
        
        // Engellerin üzerinde mi kontrol et
        for (let obstacle of obstacles) {
            if (obstacle.x === food.x && obstacle.y === food.y) {
                isValid = false;
                break;
            }
        }
        
    } while (!isValid);
}

// Rastgele güç özelliği seç
function activatePowerUp() {
    if (powerUpActive) return;
    
    const powerUps = Object.keys(POWER_UPS);
    powerUpType = powerUps[Math.floor(Math.random() * powerUps.length)];
    powerUpActive = true;
    
    const powerUp = POWER_UPS[powerUpType];
    powerUp.apply();
    
    // Güç özelliğini göster
    const powerUpElement = document.getElementById('power-up');
    powerUpElement.textContent = powerUp.name + ' aktif!';
    powerUpElement.style.color = powerUp.color;
    powerUpElement.style.display = 'block';
    
    // Zamanlayıcıyı başlat
    powerUpTimer = setTimeout(() => {
        powerUp.remove();
        powerUpActive = false;
        powerUpType = null;
        powerUpElement.style.display = 'none';
    }, powerUp.duration);
}

// Oyunu başlat
function startGame() {
    if (gameLoop) return;
    
    // Oyunu sıfırla
    score = 0;
    level = 1;
    gameSpeed = INITIAL_SPEED;
    updateScore();
    updateLevel();
    
    // Oyun nesnelerini yerleştir
    initializeSnake();
    createObstacles();
    createFood();
    
    // Güç özelliklerini sıfırla
    if (powerUpTimer) clearTimeout(powerUpTimer);
    powerUpActive = false;
    powerUpType = null;
    document.getElementById('power-up').style.display = 'none';
    
    // Oyun döngüsünü başlat
    gameStarted = true;
    lastRenderTime = 0;
    requestAnimationFrame(gameStep);
    
    // Mesajı gizle
    document.getElementById('message').style.display = 'none';
}

// Skoru güncelle
function updateScore() {
    document.getElementById('score').textContent = `Skor: ${score}`;
}

// Seviyeyi güncelle
function updateLevel() {
    document.getElementById('level').textContent = `Seviye: ${level}`;
}

// Oyun döngüsü
function gameStep(currentTime) {
    if (!gameStarted) return;
    
    gameLoop = requestAnimationFrame(gameStep);
    
    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    if (secondsSinceLastRender < gameSpeed / 1000) return;
    
    lastRenderTime = currentTime;
    
    // Yılanın yönünü güncelle
    direction = nextDirection;
    
    // Yılanı hareket ettir
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    
    // Çarpışma kontrolü
    if (isCollision(head)) {
        gameOver();
        return;
    }
    
    snake.unshift(head);
    
    // Yem yeme kontrolü
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        
        // Seviye kontrolü
        if (score >= level * 100) {
            levelUp();
        }
        
        // Yeni yem oluştur
        createFood();
        
        // Ses efekti
        eatSound.currentTime = 0;
        eatSound.play();
        
        // Güç özelliği şansı
        if (Math.random() < 0.3) {
            activatePowerUp();
        }
    } else {
        snake.pop();
    }
    
    draw();
}

// Seviye atlama
function levelUp() {
    level++;
    updateLevel();
    
    // Oyun hızını artır
    gameSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - (level - 1) * SPEED_DECREASE);
    
    // Yeni engeller oluştur
    createObstacles();
    
    // Ses efekti
    levelUpSound.currentTime = 0;
    levelUpSound.play();
}

// Çarpışma kontrolü
function isCollision(position) {
    // Duvarlarla çarpışma
    if (position.x < 0 || position.x >= GRID_COUNT || 
        position.y < 0 || position.y >= GRID_COUNT) {
        return true;
    }
    
    // Engellerle çarpışma
    if (!powerUpType || powerUpType !== 'GHOST') {
        for (let obstacle of obstacles) {
            if (position.x === obstacle.x && position.y === obstacle.y) {
                return true;
            }
        }
    }
    
    // Kendisiyle çarpışma
    for (let segment of snake) {
        if (position.x === segment.x && position.y === segment.y) {
            return true;
        }
    }
    
    return false;
}

// Oyun bitti
function gameOver() {
    gameStarted = false;
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
    
    // Ses efekti
    gameOverSound.currentTime = 0;
    gameOverSound.play();
    
    // Mesajı göster
    const message = document.getElementById('message');
    message.textContent = `Oyun Bitti!\nSkor: ${score}\nSeviye: ${level}`;
    message.style.display = 'block';
}

// Oyunu çiz
function draw() {
    // Arka planı temizle
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Engelleri çiz
    ctx.fillStyle = '#888';
    for (let obstacle of obstacles) {
        ctx.fillRect(
            obstacle.x * GRID_SIZE,
            obstacle.y * GRID_SIZE,
            GRID_SIZE - 1,
            GRID_SIZE - 1
        );
    }
    
    // Yılanı çiz
    snake.forEach((segment, index) => {
        if (powerUpType === 'GHOST') {
            ctx.globalAlpha = 0.5;
        }
        
        ctx.fillStyle = index === 0 ? '#0f0' : '#090';
        ctx.fillRect(
            segment.x * GRID_SIZE,
            segment.y * GRID_SIZE,
            GRID_SIZE - 1,
            GRID_SIZE - 1
        );
        
        if (index === 0) {
            // Yılanın gözlerini çiz
            ctx.fillStyle = '#000';
            const eyeSize = 4;
            const eyeOffset = 4;
            
            if (direction.x === 1) {
                ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - eyeOffset, segment.y * GRID_SIZE + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - eyeOffset, segment.y * GRID_SIZE + GRID_SIZE - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction.x === -1) {
                ctx.fillRect(segment.x * GRID_SIZE + eyeOffset - eyeSize, segment.y * GRID_SIZE + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * GRID_SIZE + eyeOffset - eyeSize, segment.y * GRID_SIZE + GRID_SIZE - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction.y === -1) {
                ctx.fillRect(segment.x * GRID_SIZE + eyeOffset, segment.y * GRID_SIZE + eyeOffset - eyeSize, eyeSize, eyeSize);
                ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - eyeOffset - eyeSize, segment.y * GRID_SIZE + eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction.y === 1) {
                ctx.fillRect(segment.x * GRID_SIZE + eyeOffset, segment.y * GRID_SIZE + GRID_SIZE - eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - eyeOffset - eyeSize, segment.y * GRID_SIZE + GRID_SIZE - eyeOffset, eyeSize, eyeSize);
            }
        }
        
        ctx.globalAlpha = 1;
    });
    
    // Yemi çiz
    ctx.fillStyle = '#ff0';
    ctx.fillRect(
        food.x * GRID_SIZE,
        food.y * GRID_SIZE,
        GRID_SIZE - 1,
        GRID_SIZE - 1
    );
}

// Klavye kontrollerini dinle
document.addEventListener('keydown', (event) => {
    if (!gameStarted && event.code === 'Space') {
        startGame();
        return;
    }
    
    if (powerUpType === 'REVERSE') {
        switch (event.key) {
            case 'ArrowUp':
                if (direction.y === 0) {
                    nextDirection = { x: 0, y: 1 };
                }
                break;
            case 'ArrowDown':
                if (direction.y === 0) {
                    nextDirection = { x: 0, y: -1 };
                }
                break;
            case 'ArrowLeft':
                if (direction.x === 0) {
                    nextDirection = { x: 1, y: 0 };
                }
                break;
            case 'ArrowRight':
                if (direction.x === 0) {
                    nextDirection = { x: -1, y: 0 };
                }
                break;
        }
    } else {
        switch (event.key) {
            case 'ArrowUp':
                if (direction.y === 0) {
                    nextDirection = { x: 0, y: -1 };
                }
                break;
            case 'ArrowDown':
                if (direction.y === 0) {
                    nextDirection = { x: 0, y: 1 };
                }
                break;
            case 'ArrowLeft':
                if (direction.x === 0) {
                    nextDirection = { x: -1, y: 0 };
                }
                break;
            case 'ArrowRight':
                if (direction.x === 0) {
                    nextDirection = { x: 1, y: 0 };
                }
                break;
        }
    }
});

// İlk çizimi yap
draw();

// Başlangıç mesajını göster
const message = document.getElementById('message');
message.textContent = 'Başlamak için SPACE tuşuna basın';
message.style.display = 'block'; 