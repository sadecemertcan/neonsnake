const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const tileCount = canvas.width / gridSize;

// Yılan özellikleri
let snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
];
let dx = 1;
let dy = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;

// Oyun durumu
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
let lastDirection = { dx: 1, dy: 0 };

// Yeni özellikler
let powerUps = {
    shield: false,
    speedBoost: false,
    slowMotion: false
};
let powerUpDuration = 5000; // 5 saniye
let powerUpTimers = {
    shield: null,
    speedBoost: null,
    slowMotion: null
};

// Yem türleri ve özellikleri
const foodTypes = {
    normal: {
        color: "#00f3ff",
        points: 10,
        chance: 0.7,
        effect: null
    },
    golden: {
        color: "#ffd700",
        points: 30,
        chance: 0.2,
        effect: "speedBoost"
    },
    super: {
        color: "#ff00ff",
        points: 50,
        chance: 0.1,
        effect: "shield"
    }
};

// Portal özellikleri
let portals = [];
const portalColors = ["#ff00ff", "#00ffff"];

// Oyun seviyeleri
const levels = {
    1: {
        name: "Neon Yılan",
        target: 100,
        color: "#00f3ff",
        obstacleColor: "#ff0000",
        speed: 150,
        character: "snake",
        obstacleCount: 0,
        portalCount: 0,
        movingObstacles: false
    },
    2: {
        name: "Ejderha",
        target: 250,
        color: "#ff0080",
        obstacleColor: "#00ff00",
        speed: 130,
        character: "dragon",
        obstacleCount: 3,
        portalCount: 2,
        movingObstacles: false
    },
    3: {
        name: "Işık Hızı",
        target: 500,
        color: "#7700ff",
        obstacleColor: "#ffff00",
        speed: 100,
        character: "lightspeed",
        obstacleCount: 5,
        portalCount: 4,
        movingObstacles: true
    }
};

// Oyun nesneleri
let food = { x: 15, y: 15, type: 'normal' };
let obstacles = [];
let movingObstacles = [];

// DOM elementleri
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const messageDiv = document.getElementById('message');
const levelInfo = document.getElementById('levelInfo');

// Event Listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(event) {
    const key = event.key.toLowerCase();
    
    if (key === ' ' || key === 'spacebar') {
        startGame();
        return;
    }

    if (!isGameRunning || isPaused) {
        if (key === ' ' || key === 'spacebar') {
            startGame();
        }
        return;
    }

    switch (key) {
        case 'arrowleft':
            if (dx !== 1 && lastDirection.dx !== 1) {
                dx = -1;
                dy = 0;
            }
            break;
        case 'arrowup':
            if (dy !== 1 && lastDirection.dy !== 1) {
                dx = 0;
                dy = -1;
            }
            break;
        case 'arrowright':
            if (dx !== -1 && lastDirection.dx !== -1) {
                dx = 1;
                dy = 0;
            }
            break;
        case 'arrowdown':
            if (dy !== -1 && lastDirection.dy !== -1) {
                dx = 0;
                dy = 1;
            }
            break;
    }
}

function generateFood() {
    let newFood;
    let isValidPosition = false;
    
    while (!isValidPosition) {
        newFood = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        
        // Yem türünü belirle
        const rand = Math.random();
        if (rand < foodTypes.normal.chance) {
            newFood.type = 'normal';
        } else if (rand < foodTypes.normal.chance + foodTypes.golden.chance) {
            newFood.type = 'golden';
        } else {
            newFood.type = 'super';
        }
        
        // Pozisyon kontrolü
        const isOnSnake = snake.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
        );
        const isOnObstacle = obstacles.some(obs => 
            obs.x === newFood.x && obs.y === newFood.y
        );
        const isOnPortal = portals.some(portal => 
            portal.x === newFood.x && portal.y === newFood.y
        );
        
        if (!isOnSnake && !isOnObstacle && !isOnPortal) {
            isValidPosition = true;
        }
    }
    
    food = newFood;
}

function generatePortals() {
    portals = [];
    const level = levels[currentLevel];
    
    for (let i = 0; i < level.portalCount; i += 2) {
        let portal1, portal2;
        let isValid = false;
        
        while (!isValid) {
            portal1 = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                pair: i + 1
            };
            
            portal2 = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                pair: i
            };
            
            const isValidPosition = pos => {
                const isOnSnake = snake.some(segment => 
                    segment.x === pos.x && segment.y === pos.y
                );
                const isOnFood = food.x === pos.x && food.y === pos.y;
                const isOnObstacle = obstacles.some(obs => 
                    obs.x === pos.x && obs.y === pos.y
                );
                const isOnOtherPortal = portals.some(p => 
                    p.x === pos.x && p.y === pos.y
                );
                
                return !isOnSnake && !isOnFood && !isOnObstacle && !isOnOtherPortal;
            };
            
            if (isValidPosition(portal1) && isValidPosition(portal2)) {
                isValid = true;
            }
        }
        
        portals.push(portal1, portal2);
    }
}

function activatePowerUp(type) {
    powerUps[type] = true;
    
    // Önceki zamanlayıcıyı temizle
    if (powerUpTimers[type]) {
        clearTimeout(powerUpTimers[type]);
    }
    
    // Güç etkilerini uygula
    switch(type) {
        case 'shield':
            showMessage('🛡️ Kalkan Aktif!', 1000);
            break;
        case 'speedBoost':
            gameSpeed = baseSpeed * 0.7; // %30 daha hızlı
            showMessage('⚡ Hızlanma!', 1000);
            break;
        case 'slowMotion':
            gameSpeed = baseSpeed * 1.3; // %30 daha yavaş
            showMessage('🐌 Yavaşlama!', 1000);
            break;
    }
    
    // Güç süresini başlat
    powerUpTimers[type] = setTimeout(() => {
        powerUps[type] = false;
        if (type === 'speedBoost' || type === 'slowMotion') {
            gameSpeed = baseSpeed;
        }
    }, powerUpDuration);
}

function moveObstacles() {
    if (!levels[currentLevel].movingObstacles) return;
    
    movingObstacles.forEach(obstacle => {
        // Rastgele hareket
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];
        
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const newX = obstacle.x + dir.dx;
        const newY = obstacle.y + dir.dy;
        
        // Sınırları kontrol et
        if (newX >= 0 && newX < tileCount && newY >= 0 && newY < tileCount) {
            obstacle.x = newX;
            obstacle.y = newY;
        }
    });
}

function drawGame() {
    if (isPaused) return;
    
    const now = Date.now();
    if (now - lastMoveTime > gameSpeed) {
        lastMoveTime = now;
        moveSnake();
        if (levels[currentLevel].movingObstacles) {
            moveObstacles();
        }
    }
    
    updateGlow();
    clearCanvas();
    drawPortals();
    drawObstacles();
    drawFood();
    drawSnake();
    drawPowerUpEffects();
    checkLevelProgress();
    
    if (gameOver()) {
        handleGameOver();
        return;
    }
    
    requestAnimationFrame(drawGame);
}

function drawPortals() {
    portals.forEach((portal, index) => {
        ctx.shadowBlur = 20 + (glowIntensity * 5);
        ctx.shadowColor = portalColors[index % 2];
        ctx.fillStyle = portalColors[index % 2];
        
        // Portal animasyonu
        const portalSize = gridSize + Math.sin(Date.now() * 0.01) * 2;
        
        ctx.beginPath();
        ctx.arc(
            portal.x * gridSize + gridSize/2,
            portal.y * gridSize + gridSize/2,
            portalSize/2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
    ctx.shadowBlur = 0;
}

function drawPowerUpEffects() {
    if (powerUps.shield) {
        // Kalkan efekti
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        const head = snake[0];
        ctx.beginPath();
        ctx.arc(
            head.x * gridSize + gridSize/2,
            head.y * gridSize + gridSize/2,
            gridSize * 1.2,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }
}

function drawFood() {
    const foodType = foodTypes[food.type];
    ctx.shadowBlur = 15 + (glowIntensity * 5);
    ctx.shadowColor = foodType.color;
    ctx.fillStyle = foodType.color;
    
    const foodSize = gridSize - 4;
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize/2,
        food.y * gridSize + gridSize/2,
        foodSize/2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // Özel yem efektleri
    if (food.type !== 'normal') {
        ctx.beginPath();
        ctx.arc(
            food.x * gridSize + gridSize/2,
            food.y * gridSize + gridSize/2,
            foodSize/4,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Portal kontrolü
    const portal = portals.find(p => p.x === head.x && p.y === head.y);
    if (portal) {
        const exitPortal = portals.find(p => p.pair === portal.pair);
        head.x = exitPortal.x;
        head.y = exitPortal.y;
        SoundManager.playPortal();
    }
    
    // Çarpışma kontrolü
    if (!powerUps.shield) {
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            SoundManager.playHit();
            handleGameOver();
            return;
        }
        
        // Engellere çarpma kontrolü
        if (obstacles.some(obs => obs.x === head.x && obs.y === head.y)) {
            SoundManager.playHit();
            handleGameOver();
            return;
        }
        
        // Kendine çarpma kontrolü
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                SoundManager.playHit();
                handleGameOver();
                return;
            }
        }
    }
    
    lastDirection = { dx, dy };
    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        // Yem türüne göre puan ve efekt
        const foodType = foodTypes[food.type];
        score += foodType.points;
        document.getElementById('score').textContent = score;
        
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            updateLevelInfo();
        }
        
        // Güç efektini aktifleştir
        if (foodType.effect) {
            activatePowerUp(foodType.effect);
        }
        
        generateFood();
        gameSpeed = Math.max(70, baseSpeed - (score * speedIncrease));
        SoundManager.playEat();
        showMessage(`+${foodType.points}`, 300);
    } else {
        snake.pop();
    }
}

function updateLevelInfo() {
    const level = levels[currentLevel];
    document.getElementById('level').textContent = currentLevel;
    levelInfo.textContent = `Hedef: ${level.target} | En Yüksek Skor: ${highScore}`;
}

function showMessage(text, duration = 1000) {
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, duration);
    }
}

function startGame() {
    if (!isGameRunning) {
        isGameRunning = true;
        isPaused = false;
        resetGame();
        showMessage('Bölüm 1', 1000);
        startBtn.textContent = 'Yeniden Başlat';
        SoundManager.startBgMusic();
        drawGame();
    } else {
        resetGame();
        showMessage('Yeniden Başladı', 1000);
        SoundManager.startBgMusic();
    }
}

function togglePause() {
    if (!isGameRunning) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        clearTimeout(gameLoop);
        showMessage('Duraklatıldı', 0);
        pauseBtn.textContent = 'Devam Et';
        SoundManager.pauseBgMusic();
    } else {
        messageDiv.style.display = 'none';
        drawGame();
        pauseBtn.textContent = 'Durdur';
        SoundManager.resumeBgMusic();
    }
}

function clearCanvas() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
    const level = levels[currentLevel];
    
    // Neon efekti için glow
    ctx.shadowBlur = 15 + (glowIntensity * 5);
    ctx.shadowColor = level.color;
    
    // Yılan başı
    const head = snake[0];
    ctx.fillStyle = level.color;
    
    if (level.character === "dragon") {
        // Ejderha başı için özel çizim
        ctx.fillRect(head.x * gridSize - 2, head.y * gridSize - 2, gridSize + 4, gridSize + 4);
        // Kanatlar
        ctx.fillRect(head.x * gridSize - 5, head.y * gridSize + 2, 5, 8);
        ctx.fillRect(head.x * gridSize + gridSize, head.y * gridSize + 2, 5, 8);
    } else {
        ctx.fillRect(head.x * gridSize, head.y * gridSize, gridSize - 2, gridSize - 2);
    }
    
    // Gözler
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    const eyeSize = level.character === "dragon" ? 6 : 4;
    const eyeOffset = level.character === "dragon" ? 6 : 4;
    
    if (dx === 1) {
        ctx.fillRect(head.x * gridSize + gridSize - eyeOffset, head.y * gridSize + eyeOffset, eyeSize, eyeSize);
        ctx.fillRect(head.x * gridSize + gridSize - eyeOffset, head.y * gridSize + gridSize - eyeOffset - 4, eyeSize, eyeSize);
    } else if (dx === -1) {
        ctx.fillRect(head.x * gridSize + eyeOffset - 2, head.y * gridSize + eyeOffset, eyeSize, eyeSize);
        ctx.fillRect(head.x * gridSize + eyeOffset - 2, head.y * gridSize + gridSize - eyeOffset - 4, eyeSize, eyeSize);
    } else if (dy === -1) {
        ctx.fillRect(head.x * gridSize + eyeOffset, head.y * gridSize + eyeOffset - 2, eyeSize, eyeSize);
        ctx.fillRect(head.x * gridSize + gridSize - eyeOffset - 4, head.y * gridSize + eyeOffset - 2, eyeSize, eyeSize);
    } else if (dy === 1) {
        ctx.fillRect(head.x * gridSize + eyeOffset, head.y * gridSize + gridSize - eyeOffset - 2, eyeSize, eyeSize);
        ctx.fillRect(head.x * gridSize + gridSize - eyeOffset - 4, head.y * gridSize + gridSize - eyeOffset - 2, eyeSize, eyeSize);
    }
    
    // Yılan vücudu
    ctx.shadowBlur = 10 + (glowIntensity * 3);
    for (let i = 1; i < snake.length; i++) {
        const segment = snake[i];
        ctx.fillStyle = level.color;
        if (level.character === "lightspeed") {
            // Işık hızı efekti
            ctx.globalAlpha = 1 - (i / snake.length) * 0.6;
        }
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawObstacles() {
    const level = levels[currentLevel];
    ctx.shadowBlur = 30;
    ctx.shadowColor = level.obstacleColor;
    ctx.fillStyle = level.obstacleColor;
    
    obstacles.forEach(obstacle => {
        // Yılan boyutunda engeller
        ctx.fillRect(
            obstacle.x * gridSize,
            obstacle.y * gridSize,
            gridSize - 2,
            gridSize - 2
        );
        
        // Neon parlaklık efekti için iç kısım
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(
            obstacle.x * gridSize + 4,
            obstacle.y * gridSize + 4,
            gridSize - 10,
            gridSize - 10
        );
        
        ctx.globalAlpha = 1;
        ctx.fillStyle = level.obstacleColor;
    });
    
    ctx.shadowBlur = 0;
}

function checkLevelProgress() {
    const level = levels[currentLevel];
    if (score >= level.target && currentLevel < Object.keys(levels).length) {
        currentLevel++;
        const newLevel = levels[currentLevel];
        baseSpeed = newLevel.speed;
        gameSpeed = Math.max(70, baseSpeed - (score * speedIncrease));
        generateObstacles();
        SoundManager.playLevelUp();
        SoundManager.increaseBgMusicVolume();
        showMessage(`Tebrikler! Bölüm ${currentLevel}: ${newLevel.name} Başlıyor!`, 2000);
        updateLevelInfo();
        
        // Arka plan efektlerini güncelle
        const event = new CustomEvent('levelChange', { detail: { level: currentLevel } });
        window.dispatchEvent(event);
    }
}

function handleGameOver() {
    // Önce sesi çal
    SoundManager.playGameOver();
    // Sonra mesajı göster
    showMessage(`Öldün! Skor: ${score} - Bölüm: ${currentLevel}`, 0);
    isGameRunning = false;
    startBtn.textContent = 'Başla';
}

function gameOver() {
    const head = snake[0];
    return (
        head.x < 0 || 
        head.x >= tileCount || 
        head.y < 0 || 
        head.y >= tileCount ||
        snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)
    );
}

function resetGame() {
    currentLevel = 1;
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    food = { x: 15, y: 15 };
    obstacles = [];
    dx = 1;
    dy = 0;
    lastDirection = { dx: 1, dy: 0 };
    score = 0;
    baseSpeed = levels[currentLevel].speed;
    gameSpeed = baseSpeed;
    lastMoveTime = Date.now();
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = currentLevel;
    messageDiv.style.display = 'none';
    updateLevelInfo();
    generateObstacles();
}

function generateObstacles() {
    obstacles = [];
    const level = levels[currentLevel];
    
    for (let i = 0; i < level.obstacleCount; i++) {
        let obstacle;
        let isValid = false;
        
        while (!isValid) {
            obstacle = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount)
            };
            
            // Yılanın üzerinde veya yiyeceğin üzerinde olmamalı
            const isOnSnake = snake.some(segment => 
                segment.x === obstacle.x && segment.y === obstacle.y
            );
            const isOnFood = food.x === obstacle.x && food.y === obstacle.y;
            const isOnOtherObstacle = obstacles.some(obs => 
                obs.x === obstacle.x && obs.y === obstacle.y
            );
            
            if (!isOnSnake && !isOnFood && !isOnOtherObstacle) {
                isValid = true;
            }
        }
        
        obstacles.push(obstacle);
    }
}

// Müzik ritmi için event gönder
function emitBeat() {
    const event = new CustomEvent('musicBeat', { 
        detail: { 
            intensity: Math.random(),
            currentLevel: currentLevel 
        } 
    });
    window.dispatchEvent(event);
}

// Oyun başladığında rekor bilgisini göster
window.onload = function() {
    updateLevelInfo();
}; 