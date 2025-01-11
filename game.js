// Oyun değişkenleri
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let score = 0;
let currentLevel = 1;
let isGameRunning = false;
let isPaused = false;
let isSoundOn = true;
let dx = 10;
let dy = 0;
let snake = [{x: 200, y: 200}];
let food = {x: 0, y: 0};
let obstacles = [];
let lastRenderTime = 0;
let gameSpeed = 10;
let levelTarget = 100;
let highScore = localStorage.getItem('highScore') || 0;
let gameLoop;

// DOM elementleri
let messageDiv = document.getElementById('message');
let scoreSpan = document.getElementById('score');
let levelSpan = document.getElementById('level');
let levelInfo = document.getElementById('levelInfo');
let soundToggle = document.getElementById('soundToggle');
let startBtn = document.getElementById('startBtn');
let pauseBtn = document.getElementById('pauseBtn');

// Klavye kontrolleri
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(event) {
    if (!isGameRunning && event.code === 'Space') {
        startGame();
        return;
    }

    if (!isGameRunning || isPaused) return;

    switch (event.code) {
        case 'ArrowUp':
            if (dy === 0) {
                dx = 0;
                dy = -10;
            }
            break;
        case 'ArrowDown':
            if (dy === 0) {
                dx = 0;
                dy = 10;
            }
            break;
        case 'ArrowLeft':
            if (dx === 0) {
                dx = -10;
                dy = 0;
            }
            break;
        case 'ArrowRight':
            if (dx === 0) {
                dx = 10;
                dy = 0;
            }
            break;
        case 'Space':
            togglePause();
            break;
    }
}

// Buton kontrolleri
startBtn.addEventListener('click', () => {
    if (!isGameRunning) {
        startGame();
    } else {
        resetGame();
        startGame();
    }
});

pauseBtn.addEventListener('click', togglePause);

soundToggle.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    soundToggle.textContent = isSoundOn ? '🔊 Ses' : '🔈 Ses';
    if (isSoundOn) {
        if (isGameRunning && !isPaused) bgMusic.play();
    } else {
        bgMusic.pause();
    }
});

function togglePause() {
    if (!isGameRunning) return;
    
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Devam Et' : 'Durdur';
    
    if (isPaused) {
        if (isSoundOn) bgMusic.pause();
        cancelAnimationFrame(gameLoop);
    } else {
        if (isSoundOn) bgMusic.play();
        gameLoop = requestAnimationFrame(update);
    }
}

// Oyunu başlat
function startGame() {
    score = 0;
    currentLevel = 1;
    levelTarget = 100;
    gameSpeed = 10;
    dx = 10;
    dy = 0;
    snake = [{x: 200, y: 200}];
    isGameRunning = true;
    isPaused = false;
    
    // Oyun alanını hazırla
    generateFood();
    generateObstacles();
    updateScore();
    updateLevel();
    messageDiv.style.display = 'none';
    
    // Ses ayarları
    if (isSoundOn) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
    
    // Oyun döngüsünü başlat
    startBtn.textContent = 'Yeniden Başlat';
    lastRenderTime = performance.now();
    gameLoop = requestAnimationFrame(update);
}

// Ana oyun döngüsü
function update(currentTime) {
    if (!isGameRunning || isPaused) {
        return;
    }
    
    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / gameSpeed) {
        gameLoop = requestAnimationFrame(update);
        return;
    }
    
    lastRenderTime = currentTime;
    
    moveSnake();
    checkCollision();
    drawGame();
    
    gameLoop = requestAnimationFrame(update);
}

// Oyunu sıfırla
function resetGame() {
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    
    score = 0;
    currentLevel = 1;
    levelTarget = 100;
    gameSpeed = 10;
    dx = 10;
    dy = 0;
    snake = [{x: 200, y: 200}];
    obstacles = [];
    isGameRunning = false;
    isPaused = false;
    
    if (isSoundOn) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
    
    messageDiv.style.display = 'none';
    updateScore();
    updateLevel();
}

// Yemeği rastgele konumlandır
function generateFood() {
    let maxAttempts = 50;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        let newFood = {
            x: Math.floor(Math.random() * (canvas.width / 10)) * 10,
            y: Math.floor(Math.random() * (canvas.height / 10)) * 10
        };
        
        // Yemek yılanın üzerinde mi kontrol et
        let isOnSnake = snake.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
        );
        
        // Yemek engellerin üzerinde mi kontrol et
        let isOnObstacle = obstacles.some(obstacle => 
            obstacle.x === newFood.x && obstacle.y === newFood.y
        );
        
        if (!isOnSnake && !isOnObstacle) {
            food = newFood;
            return;
        }
        
        attempts++;
    }
    
    // Eğer uygun konum bulunamazsa, varsayılan konumu kullan
    food = {x: 0, y: 0};
}

// Engelleri oluştur
function generateObstacles() {
    obstacles = [];
    let obstacleCount = Math.min(currentLevel * 2, 20);
    
    for (let i = 0; i < obstacleCount; i++) {
        let obstacle = {
            x: Math.floor(Math.random() * (canvas.width / 10)) * 10,
            y: Math.floor(Math.random() * (canvas.height / 10)) * 10
        };
        
        // Engel yılanın veya yemeğin üzerinde değilse ekle
        if (!isColliding(obstacle, snake[0]) && !isColliding(obstacle, food)) {
            obstacles.push(obstacle);
        }
    }
}

// Çarpışma kontrolü
function isColliding(pos1, pos2) {
    return pos1.x === pos2.x && pos1.y === pos2.y;
}

// Yılanı hareket ettir
function moveSnake() {
    const head = {x: snake[0].x + dx, y: snake[0].y + dy};
    snake.unshift(head);
    
    if (isColliding(head, food)) {
        score += 10;
        updateScore();
        checkLevelProgress();
        generateFood();
        SoundManager.playEat();
    } else {
        snake.pop();
    }
}

// Çarpışmaları kontrol et
function checkCollision() {
    const head = snake[0];
    
    // Duvarlarla çarpışma
    if (head.x < 0 || head.x >= canvas.width || 
        head.y < 0 || head.y >= canvas.height) {
        gameOver();
        return;
    }
    
    // Yılanın kendisiyle çarpışması
    for (let i = 1; i < snake.length; i++) {
        if (isColliding(head, snake[i])) {
            gameOver();
            return;
        }
    }
    
    // Engellerle çarpışma
    for (let obstacle of obstacles) {
        if (isColliding(head, obstacle)) {
            gameOver();
            return;
        }
    }
}

// Oyunu çiz
function drawGame() {
    // Arka planı temizle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Yılanı çiz
    ctx.fillStyle = '#00f3ff';
    snake.forEach((segment, index) => {
        let alpha = 1 - (index / snake.length) * 0.6;
        ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
        ctx.fillRect(segment.x, segment.y, 8, 8);
        
        // Neon efekti
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    });
    
    // Yemeği çiz
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.fillRect(food.x, food.y, 8, 8);
    
    // Engelleri çiz
    ctx.fillStyle = '#f00';
    ctx.shadowColor = '#f00';
    obstacles.forEach(obstacle => {
        ctx.fillRect(obstacle.x, obstacle.y, 8, 8);
    });
    
    // Shadow efektini sıfırla
    ctx.shadowBlur = 0;
}

// Skor güncelleme
function updateScore() {
    scoreSpan.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
}

// Seviye güncelleme
function updateLevel() {
    levelSpan.textContent = currentLevel;
    levelInfo.textContent = `Hedef: ${levelTarget}`;
}

// Seviye ilerlemesini kontrol et
function checkLevelProgress() {
    if (score >= levelTarget) {
        currentLevel++;
        levelTarget = currentLevel * 100;
        gameSpeed = Math.min(gameSpeed + 1, 20);
        generateObstacles();
        updateLevel();
        SoundManager.playLevelUp();
    }
}

// Oyun bitti
function gameOver() {
    isGameRunning = false;
    SoundManager.playGameOver();
    bgMusic.pause();
    bgMusic.currentTime = 0;
    
    messageDiv.textContent = `Öldün! Skor: ${score} - Bölüm: ${currentLevel}`;
    messageDiv.style.display = 'block';
    startBtn.textContent = 'Başla';
} 