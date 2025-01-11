// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 15,
    GRID_COUNT: window.innerWidth < 768 ? 15 : 30,
    INITIAL_SPEED: 200,
    MIN_SPEED: 50,
    SPEED_DECREASE: 5,
    POWER_UP_CHANCE: 0.3,
    POINTS_PER_FOOD: 10,
    LEVEL_UP_SCORE: 100
};

// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas boyutunu ayarla ve responsive yap
function resizeCanvas() {
    const isMobile = window.innerWidth < 768;
    const size = isMobile ? 
        Math.min(window.innerWidth - 60, window.innerHeight - 250) :
        Math.min(600, window.innerHeight - 100);
    
    canvas.width = size;
    canvas.height = size;
    
    // Grid boyutunu canvas'a göre ayarla
    GAME_CONFIG.GRID_SIZE = size / GAME_CONFIG.GRID_COUNT;
}

// İlk boyutlandırma
resizeCanvas();

// Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameState.gameStarted) {
        draw();
    }
});

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
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Yılan Başlangıç Pozisyonu
function initializeSnake() {
    const centerPos = Math.floor(GAME_CONFIG.GRID_COUNT / 2);
    return [
        { x: centerPos, y: centerPos },
        { x: centerPos - 1, y: centerPos },
        { x: centerPos - 2, y: centerPos }
    ];
}

// Yem Oluşturma
function createFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT),
            y: Math.floor(Math.random() * GAME_CONFIG.GRID_COUNT)
        };
    } while (gameState.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    
    gameState.food = newFood;
}

// Oyun Başlatma
function startGame() {
    gameState = {
        ...gameState,
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
        gameStarted: true
    };
    
    createFood();
    gameLoop();
    
    document.getElementById('message').style.display = 'none';
}

// Oyun Döngüsü
function gameLoop() {
    if (!gameState.gameStarted) return;
    
    updateGame();
    draw();
    
    gameState.gameLoop = setTimeout(gameLoop, gameState.gameSpeed);
}

// Oyun Mantığı Güncelleme
function updateGame() {
    const head = { ...gameState.snake[0] };
    gameState.direction = gameState.nextDirection;
    
    head.x += gameState.direction.x;
    head.y += gameState.direction.y;
    
    // Duvar çarpışma kontrolü
    if (head.x < 0 || head.x >= GAME_CONFIG.GRID_COUNT || 
        head.y < 0 || head.y >= GAME_CONFIG.GRID_COUNT) {
        gameOver();
        return;
    }
    
    // Kendine çarpma kontrolü
    if (gameState.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }
    
    gameState.snake.unshift(head);
    
    // Yem yeme kontrolü
    if (head.x === gameState.food.x && head.y === gameState.food.y) {
        gameState.score += GAME_CONFIG.POINTS_PER_FOOD;
        document.getElementById('score').textContent = `SKOR: ${gameState.score}`;
        createFood();
    } else {
        gameState.snake.pop();
    }
}

// Çizim İşlemleri
function draw() {
    // Arka planı temizle
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Yılanı çiz
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0f0';
    ctx.fillStyle = '#0f0';
    
    gameState.snake.forEach((segment, index) => {
        ctx.fillRect(
            segment.x * GAME_CONFIG.GRID_SIZE,
            segment.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE - 1,
            GAME_CONFIG.GRID_SIZE - 1
        );
    });
    
    // Yemi çiz
    ctx.shadowColor = '#ff0';
    ctx.fillStyle = '#ff0';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE,
        gameState.food.y * GAME_CONFIG.GRID_SIZE,
        GAME_CONFIG.GRID_SIZE - 1,
        GAME_CONFIG.GRID_SIZE - 1
    );
    
    ctx.shadowBlur = 0;
}

// Oyun Bitişi
function gameOver() {
    gameState.gameStarted = false;
    if (gameState.gameLoop) {
        clearTimeout(gameState.gameLoop);
        gameState.gameLoop = null;
    }
    const message = document.getElementById('message');
    message.textContent = gameState.isMobile ? 
        `Oyun Bitti!\nSkor: ${gameState.score}\nTekrar başlamak için dokun` :
        `Oyun Bitti!\nSkor: ${gameState.score}\nTekrar başlamak için SPACE tuşuna basın`;
    message.style.display = 'block';
}

// Yön Değiştirme
function changeDirection(newDirection) {
    if (!gameState.gameStarted) {
        startGame();
        return;
    }
    
    if (!newDirection) return;
    
    // Ters yöne gitmeyi engelle
    if (newDirection.x === -gameState.direction.x || 
        newDirection.y === -gameState.direction.y) {
        return;
    }
    
    gameState.nextDirection = newDirection;
}

// Klavye Kontrolleri
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(event) {
    if (!gameState.gameStarted && event.code === 'Space') {
        startGame();
        return;
    }
    
    const keyMappings = {
        'ArrowUp': { x: 0, y: -1 },
        'ArrowDown': { x: 0, y: 1 },
        'ArrowLeft': { x: -1, y: 0 },
        'ArrowRight': { x: 1, y: 0 }
    };
    
    changeDirection(keyMappings[event.key]);
}

// Dokunmatik Kontroller
let touchStartX = 0;
let touchStartY = 0;
const MIN_SWIPE_DISTANCE = 30;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touchStartX || !touchStartY) return;
    
    const xDiff = touchStartX - e.touches[0].clientX;
    const yDiff = touchStartY - e.touches[0].clientY;
    
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (Math.abs(xDiff) < MIN_SWIPE_DISTANCE) return;
        changeDirection(xDiff > 0 ? { x: -1, y: 0 } : { x: 1, y: 0 });
    } else {
        if (Math.abs(yDiff) < MIN_SWIPE_DISTANCE) return;
        changeDirection(yDiff > 0 ? { x: 0, y: -1 } : { x: 0, y: 1 });
    }
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!gameState.gameStarted) {
        startGame();
    }
    touchStartX = 0;
    touchStartY = 0;
}, { passive: false });

// Başlangıç mesajını göster
const message = document.getElementById('message');
message.textContent = gameState.isMobile ? 
    'Başlamak için dokun\nKontrol için parmağını kaydır' :
    'Başlamak için SPACE tuşuna basın\nKontrol için ok tuşlarını kullan';
message.style.display = 'block';

// İlk çizimi yap
draw(); 