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
let lastDirection = { dx: 1, dy: 0 };

// Mobil kontrol değişkenleri
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let lastTapTime = 0;
let rotationDirection = 1; // 1: saat yönü, -1: saat yönünün tersi

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
document.addEventListener('keydown', handleKeyPress);

// Mobil kontrolleri ekle
if (isMobile) {
    const tapArea = document.getElementById('tapArea');
    
    // Dokunma olayları
    tapArea.addEventListener('touchstart', handleTap);
    
    // Çift dokunmayı engelle
    tapArea.addEventListener('touchend', (e) => {
        e.preventDefault();
    });
}

function handleKeyPress(event) {
    const key = event.key.toLowerCase();
    
    // Space tuşu kontrolü
    if (key === ' ' || key === 'spacebar') {
        startGame();
        return;
    }

    if (!isGameRunning || isPaused) {
        // Oyun bittiyse veya duraklatıldıysa space tuşu ile başlat
        if (key === ' ' || key === 'spacebar') {
            startGame();
        }
        return;
    }

    // Yön tuşları kontrolü
    switch (key) {
        case 'arrowleft':
            if (dx !== 1 && lastDirection.dx !== 1) { // Sağa gitmiyorsa sola dönebilir
                dx = -1;
                dy = 0;
            }
            break;
        case 'arrowup':
            if (dy !== 1 && lastDirection.dy !== 1) { // Aşağı gitmiyorsa yukarı dönebilir
                dx = 0;
                dy = -1;
            }
            break;
        case 'arrowright':
            if (dx !== -1 && lastDirection.dx !== -1) { // Sola gitmiyorsa sağa dönebilir
                dx = 1;
                dy = 0;
            }
            break;
        case 'arrowdown':
            if (dy !== -1 && lastDirection.dy !== -1) { // Yukarı gitmiyorsa aşağı dönebilir
                dx = 0;
                dy = 1;
            }
            break;
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

function drawGame() {
    if (isPaused) return;
    
    const now = Date.now();
    if (now - lastMoveTime > gameSpeed) {
        lastMoveTime = now;
        moveSnake();
    }
    
    updateGlow();
    clearCanvas();
    drawObstacles();
    drawFood();
    drawSnake();
    checkLevelProgress();
    
    if (gameOver()) {
        handleGameOver();
        return;
    }
    
    requestAnimationFrame(drawGame);
}

function updateGlow() {
    if (glowIncreasing) {
        glowIntensity += 0.1;
        if (glowIntensity >= 1) glowIncreasing = false;
    } else {
        glowIntensity -= 0.1;
        if (glowIntensity <= 0) glowIncreasing = true;
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

function drawFood() {
    const level = levels[currentLevel];
    ctx.shadowBlur = 15 + (glowIntensity * 5);
    ctx.shadowColor = level.color;
    ctx.fillStyle = level.color;
    
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

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Çarpışma kontrolü
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
    
    lastDirection = { dx, dy };
    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('score').textContent = score;
        
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            updateLevelInfo();
        }
        
        generateFood();
        gameSpeed = Math.max(70, baseSpeed - (score * speedIncrease));
        SoundManager.playEat();
        showMessage('+10', 300);
    } else {
        snake.pop();
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
        
        // Sadece yılanın üzerinde mi kontrol et
        const isOnSnake = snake.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
        );
        
        if (!isOnSnake) {
            isValidPosition = true;
        }
    }
    
    food = newFood;
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

function handleTap(e) {
    e.preventDefault();
    
    if (!isGameRunning) {
        startGame();
        return;
    }

    const now = Date.now();
    if (now - lastTapTime < 100) return; // Çok hızlı tıklamaları engelle
    lastTapTime = now;

    // Flappy Bird tarzı kontrol: Her dokunuşta 90 derece dön
    rotateSnake();
}

function rotateSnake() {
    // Mevcut yönü al
    const currentDirection = { dx, dy };
    
    // Saat yönünde 90 derece döndür
    if (currentDirection.dx === 1 && currentDirection.dy === 0) {
        dx = 0;
        dy = 1;
    } else if (currentDirection.dx === 0 && currentDirection.dy === 1) {
        dx = -1;
        dy = 0;
    } else if (currentDirection.dx === -1 && currentDirection.dy === 0) {
        dx = 0;
        dy = -1;
    } else if (currentDirection.dx === 0 && currentDirection.dy === -1) {
        dx = 1;
        dy = 0;
    }
    
    lastDirection = { dx, dy };
}

// Oyun hızını mobil için ayarla
if (isMobile) {
    baseSpeed = 200; // Mobilde biraz daha yavaş
    gameSpeed = baseSpeed;
    speedIncrease = 0.3; // Hız artışını azalt
} 