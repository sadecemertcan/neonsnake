// Canvas ve context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun sabitleri
const GRID_SIZE = 20;
const GRID_COUNT = canvas.width / GRID_SIZE;
const INITIAL_SPEED = 200;
const MIN_SPEED = 50;
const SPEED_DECREASE = 5;

// Oyun durumu
let snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
];
let food = { x: 15, y: 15 };
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let gameSpeed = INITIAL_SPEED;
let gameLoop = null;
let lastRenderTime = 0;
let gameStarted = false;

// Oyunu çiz
function draw() {
    // Arka planı temizle
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Yılanı çiz
    snake.forEach((segment, index) => {
        // Gölge efekti
        ctx.shadowBlur = 20;
        ctx.shadowColor = index === 0 ? '#0ff' : '#0f0';
        ctx.fillStyle = index === 0 ? '#0ff' : '#0f0';
        
        // Segmenti çiz
        ctx.beginPath();
        ctx.rect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );
        ctx.fill();
    });
    
    // Yemi çiz
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f00';
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.rect(
        food.x * GRID_SIZE + 1,
        food.y * GRID_SIZE + 1,
        GRID_SIZE - 2,
        GRID_SIZE - 2
    );
    ctx.fill();
    
    // Gölge efektini sıfırla
    ctx.shadowBlur = 0;
}

// Oyunu başlat
function startGame() {
    if (gameLoop) return;
    
    // Oyunu sıfırla
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    gameSpeed = INITIAL_SPEED;
    updateScore();
    
    // Yeni yem oluştur
    createFood();
    
    // Oyun döngüsünü başlat
    gameStarted = true;
    lastRenderTime = 0;
    requestAnimationFrame(gameStep);
    
    // Mesajı gizle
    document.getElementById('message').style.display = 'none';
}

// Yeni yem oluştur
function createFood() {
    while (true) {
        food = {
            x: Math.floor(Math.random() * GRID_COUNT),
            y: Math.floor(Math.random() * GRID_COUNT)
        };
        
        // Yem yılanın üzerinde mi kontrol et
        let onSnake = false;
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                onSnake = true;
                break;
            }
        }
        
        if (!onSnake) break;
    }
}

// Skoru güncelle
function updateScore() {
    document.getElementById('score').textContent = `Skor: ${score}`;
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
        createFood();
        
        // Oyunu hızlandır
        gameSpeed = Math.max(MIN_SPEED, gameSpeed - SPEED_DECREASE);
    } else {
        snake.pop();
    }
    
    draw();
}

// Çarpışma kontrolü
function isCollision(position) {
    // Duvarlarla çarpışma
    if (position.x < 0 || position.x >= GRID_COUNT || 
        position.y < 0 || position.y >= GRID_COUNT) {
        return true;
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
    
    const message = document.getElementById('message');
    message.textContent = `Oyun Bitti! Skor: ${score}`;
    message.style.display = 'block';
}

// Klavye kontrollerini dinle
document.addEventListener('keydown', (event) => {
    if (!gameStarted && event.code === 'Space') {
        startGame();
        return;
    }
    
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
});

// İlk çizimi yap
draw();

// Başlangıç mesajını göster
const message = document.getElementById('message');
message.textContent = 'Başlamak için SPACE tuşuna basın';
message.style.display = 'block'; 