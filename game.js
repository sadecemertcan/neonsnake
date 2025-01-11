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
    gameStarted: false
};

function draw() {
    drawBackground();
    drawObstacles();
    drawSnake();
    drawFood();
}

function drawBackground() {
    // Sade siyah arkaplan
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Beyaz çerçeve
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Sade grid çizgileri
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    
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
}

function drawSnake() {
    // Sade yılan çizimi
    gameState.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#fff' : '#666';
        ctx.fillRect(
            segment.x * GAME_CONFIG.GRID_SIZE,
            segment.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE - 1,
            GAME_CONFIG.GRID_SIZE - 1
        );
        
        if (index === 0) {
            drawSnakeEyes(segment);
        }
    });
}

function drawSnakeEyes(head) {
    ctx.fillStyle = '#000';
    const eyeSize = 3;
    const eyeOffset = 4;
    
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
    // Sade yem çizimi
    ctx.fillStyle = '#fff';
    ctx.fillRect(
        gameState.food.x * GAME_CONFIG.GRID_SIZE,
        gameState.food.y * GAME_CONFIG.GRID_SIZE,
        GAME_CONFIG.GRID_SIZE - 1,
        GAME_CONFIG.GRID_SIZE - 1
    );
}

function drawObstacles() {
    // Sade engel çizimi
    ctx.fillStyle = '#333';
    
    gameState.obstacles.forEach(obstacle => {
        ctx.fillRect(
            obstacle.x * GAME_CONFIG.GRID_SIZE,
            obstacle.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE - 1,
            GAME_CONFIG.GRID_SIZE - 1
        );
    });
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