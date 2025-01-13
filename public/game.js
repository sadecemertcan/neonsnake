// Oyun yapılandırması ve değişkenler
const GAME_CONFIG = {
    GRID_COUNT: 100,
    INITIAL_SPEED: 50,
    MIN_SPEED: 50,
    SPEED_DECREASE: 5,
    FOOD_SIZE: 0.8,
    CAMERA_ZOOM: 2,
    MIN_CAMERA_ZOOM: 1.2,
    CAMERA_SMOOTH_FACTOR: 0.05,
    COLLISION_DISTANCE: 2,
    FOOD_SPAWN_INTERVAL: 3000,
    NEON_GLOW: 15,
    FOOD_COUNT: 25,
    FOOD_TYPES: {
        NORMAL: {
            SIZE: 0.8,
            POINTS: 1,
            COLOR: '#ffffff',
            PULSE_SPEED: 2,
            PULSE_SCALE: 0.2
        },
        DEAD_SNAKE: {
            SIZE: 1.2,
            MIN_POINTS: 5,
            MAX_POINTS: 20,
            COLOR: '#ffff00',
            PULSE_SPEED: 3,
            PULSE_SCALE: 0.3
        },
        AI: {
            SIZE: 1,
            POINTS: 3,
            COLOR: '#00ffff',
            PULSE_SPEED: 4,
            PULSE_SCALE: 0.25
        }
    },
    RENDER_DISTANCE: 50,
    SNAKE_SPEED: 0.4,
    INITIAL_SNAKE_SIZE: 1,
    SNAKE_GROWTH_RATE: 0.005,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    },
    SNAKE_SKINS: {
        DEFAULT: {
            bodyColor: '#00ff00',
            eyeColor: '#ffffff',
            glowColor: '#00ff00',
            pattern: 'solid'
        },
        NEON: {
            bodyColor: '#ff00ff',
            eyeColor: '#ffffff',
            glowColor: '#ff00ff',
            pattern: 'gradient'
        },
        RAINBOW: {
            bodyColor: 'rainbow',
            eyeColor: '#ffffff',
            glowColor: '#ffffff',
            pattern: 'rainbow'
        },
        GHOST: {
            bodyColor: '#4444ff',
            eyeColor: '#88ffff',
            glowColor: '#4444ff',
            pattern: 'ghost'
        }
    },
    POWERUPS: {
        SHIELD: {
            duration: 5000,
            color: '#4444ff',
            effect: 'invulnerable'
        },
        SPEED: {
            duration: 3000,
            color: '#ffff00',
            effect: 'speed_boost'
        },
        GHOST: {
            duration: 4000,
            color: '#44ffff',
            effect: 'ghost_mode'
        }
    }
};

// Global değişkenler
let socket;
let canvas;
let ctx;
let gameState = {
    gameStarted: false,
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set(),
    powerups: new Set()
};

// DOM yüklendikten sonra çalışacak kod
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

// Oyunu başlat
function initializeGame() {
    // Canvas ve context ayarları
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas elementi bulunamadı');
        return;
    }
    
    ctx = canvas.getContext('2d');
    
    // Canvas boyutlarını ayarla
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    // İlk boyutlandırma
    resizeCanvas();
    
    // Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
    window.addEventListener('resize', resizeCanvas);
    
    // Socket.io bağlantısı
    socket = io({
        transports: ['websocket'],
        upgrade: false
    });

    // Socket event listeners
    socket.on('connect', () => {
        console.log('Sunucuya bağlandı');
        setupGameEvents();
    });

    // Oyun başlatma butonu event listener'ı
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput && usernameInput.value.trim()) {
                const username = usernameInput.value.trim();
                const loginScreen = document.getElementById('loginScreen');
                const gameScreen = document.getElementById('gameScreen');
                
                if (loginScreen && gameScreen) {
                    loginScreen.style.display = 'none';
                    gameScreen.style.display = 'block';
                    startGame(username);
                }
            }
        });
    }
}

// Oyun olaylarını ayarla
function setupGameEvents() {
    if (!socket) return;

    socket.on('gameState', (state) => {
        if (state.players) {
            updateScoreboard(state.players);
        }
        // ... diğer state güncellemeleri
    });

    socket.on('playerJoined', (players) => {
        if (players) {
            updateScoreboard(players);
        }
    });

    // ... diğer socket olayları
}

// Skor tablosunu güncelle
function updateScoreboard(players) {
    const scoreBoard = document.getElementById('scoreBoard');
    if (!scoreBoard) return;

    const sortedPlayers = Array.from(Object.values(players))
        .sort((a, b) => b.score - a.score);

    let html = '<h3 style="color: #0ff; margin-bottom: 10px;">Skor Tablosu</h3>';
    sortedPlayers.forEach(player => {
        html += `<div class="score-item">${player.username}: ${player.score}</div>`;
    });
    scoreBoard.innerHTML = html;
}

// Oyunu başlat
function startGame(username) {
    if (!socket || !canvas || !ctx) {
        console.error('Oyun başlatılamıyor: Gerekli bileşenler eksik');
        return;
    }

    gameState.gameStarted = true;
    
    // Başlangıç yılan pozisyonu
    const startX = Math.floor(Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X)) + GAME_CONFIG.WORLD_BOUNDS.MIN_X;
    const startY = Math.floor(Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y)) + GAME_CONFIG.WORLD_BOUNDS.MIN_Y;
    
    // Yerel oyuncu oluştur
    gameState.localPlayer = {
        id: socket.id,
        username: username,
        snake: [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ],
        direction: { x: 1, y: 0 },
        score: 0,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        skin: 'DEFAULT'
    };

    // Sunucuya katılma bildirimi gönder
    socket.emit('join', username);

    // Oyun döngüsünü başlat
    requestAnimationFrame(gameLoop);

    // Klavye kontrollerini etkinleştir
    window.addEventListener('keydown', handleKeyPress);
}

// Klavye kontrollerini yönet
function handleKeyPress(event) {
    if (!gameState.gameStarted || !gameState.localPlayer) return;

    const currentDirection = gameState.localPlayer.direction;
    let newDirection = { ...currentDirection };

    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (currentDirection.y === 0) {
                newDirection = { x: 0, y: -1 };
            }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (currentDirection.y === 0) {
                newDirection = { x: 0, y: 1 };
            }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (currentDirection.x === 0) {
                newDirection = { x: -1, y: 0 };
            }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (currentDirection.x === 0) {
                newDirection = { x: 1, y: 0 };
            }
            break;
    }

    if (newDirection.x !== currentDirection.x || newDirection.y !== currentDirection.y) {
        gameState.localPlayer.direction = newDirection;
        socket.emit('updateDirection', newDirection);
    }
}

// Oyun döngüsü
let lastTime = 0;
function gameLoop(currentTime) {
    if (!gameState.gameStarted) return;

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Oyun mantığını güncelle
    updateGame(deltaTime);

    // Ekranı temizle
    ctx.fillStyle = '#001800';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Oyun dünyasını çiz
    drawGame();

    // Bir sonraki kareyi planla
    requestAnimationFrame(gameLoop);
}

// Oyun mantığını güncelle
function updateGame(deltaTime) {
    if (!gameState.localPlayer) return;

    // Yılan hareketini güncelle
    const head = gameState.localPlayer.snake[0];
    const newHead = {
        x: head.x + gameState.localPlayer.direction.x * GAME_CONFIG.SNAKE_SPEED * deltaTime,
        y: head.y + gameState.localPlayer.direction.y * GAME_CONFIG.SNAKE_SPEED * deltaTime
    };

    // Yeni pozisyonu sunucuya gönder
    socket.emit('updatePosition', {
        snake: [newHead, ...gameState.localPlayer.snake.slice(0, -1)],
        direction: gameState.localPlayer.direction,
        score: gameState.localPlayer.score
    });

    // Yerel yılanı güncelle
    gameState.localPlayer.snake = [newHead, ...gameState.localPlayer.snake.slice(0, -1)];
}

// Oyun dünyasını çiz
function drawGame() {
    if (!gameState.localPlayer) return;

    // Kamera pozisyonunu ayarla
    const cameraX = -gameState.localPlayer.snake[0].x * GAME_CONFIG.CAMERA_ZOOM + canvas.width / 2;
    const cameraY = -gameState.localPlayer.snake[0].y * GAME_CONFIG.CAMERA_ZOOM + canvas.height / 2;

    ctx.save();
    ctx.translate(cameraX, cameraY);
    ctx.scale(GAME_CONFIG.CAMERA_ZOOM, GAME_CONFIG.CAMERA_ZOOM);

    // Yılanları çiz
    drawSnake(gameState.localPlayer);
    gameState.otherPlayers.forEach(player => drawSnake(player));

    // Yemleri çiz
    gameState.foods.forEach(food => drawFood(food));

    // Power-up'ları çiz
    gameState.powerups.forEach(powerup => drawPowerup(powerup));

    ctx.restore();
}

// Yılan çizimi
function drawSnake(player) {
    const skin = GAME_CONFIG.SNAKE_SKINS[player.skin || 'DEFAULT'];
    
    player.snake.forEach((segment, index) => {
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = skin.bodyColor;
        ctx.shadowColor = skin.glowColor;
        ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
        ctx.fill();

        // Baş kısmı için gözler
        if (index === 0) {
            const eyeOffset = 0.2;
            const eyeSize = 0.1;
            
            // Sol göz
            ctx.beginPath();
            ctx.arc(
                segment.x + player.direction.x * eyeOffset - player.direction.y * eyeOffset,
                segment.y + player.direction.y * eyeOffset + player.direction.x * eyeOffset,
                eyeSize, 0, Math.PI * 2
            );
            ctx.fillStyle = skin.eyeColor;
            ctx.fill();

            // Sağ göz
            ctx.beginPath();
            ctx.arc(
                segment.x + player.direction.x * eyeOffset + player.direction.y * eyeOffset,
                segment.y + player.direction.y * eyeOffset - player.direction.x * eyeOffset,
                eyeSize, 0, Math.PI * 2
            );
            ctx.fillStyle = skin.eyeColor;
            ctx.fill();
        }
    });
}

// Yem çizimi
function drawFood(food) {
    ctx.beginPath();
    ctx.arc(food.x, food.y, GAME_CONFIG.FOOD_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.shadowColor = food.color;
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.fill();
}

// Power-up çizimi
function drawPowerup(powerup) {
    const config = GAME_CONFIG.POWERUPS[powerup.type];
    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.shadowColor = config.color;
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.fill();
}

// ... rest of the existing code ... 