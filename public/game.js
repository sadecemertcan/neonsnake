// Socket.io bağlantısı
const socket = io();

// Bağlantı durumunu kontrol et
socket.on('connect', () => {
    document.getElementById('connectionStatus').style.display = 'none';
});

socket.on('disconnect', () => {
    document.getElementById('connectionStatus').style.display = 'block';
    document.getElementById('connectionStatus').textContent = 'Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...';
});

socket.on('connect_error', () => {
    document.getElementById('connectionStatus').style.display = 'block';
    document.getElementById('connectionStatus').textContent = 'Sunucuya bağlanılamıyor...';
});

// Oyuncu olaylarını dinle
socket.on('playerJoined', (player) => {
    if (player.id !== socket.id) {
        gameState.otherPlayers.set(player.id, player);
    }
});

socket.on('playerLeft', (playerId) => {
    gameState.otherPlayers.delete(playerId);
});

socket.on('playerUpdate', (player) => {
    if (player.id !== socket.id) {
        gameState.otherPlayers.set(player.id, player);
    }
});

socket.on('foodSpawned', (food) => {
    gameState.foods.add(food);
});

socket.on('foodEaten', (foodId) => {
    gameState.foods.delete(foodId);
});

// Canvas ve context tanımlamaları
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 20,
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
    SNAKE_SIZE: 1,
    RENDER_DISTANCE: 50,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    }
};

let lastTime = 0;

// Oyun Durumu
let gameState = {
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set(),
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameLoop: null,
    gameStarted: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Event Listeners
document.getElementById('play-button').addEventListener('click', () => {
    const nicknameInput = document.getElementById('nickname');
    const nickname = nicknameInput.value.trim();
    
    if (!nickname) {
        alert('Lütfen bir kullanıcı adı girin!');
        return;
    }

    // Oyun arayüzünü göster
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // Canvas'ı hazırla
    resizeCanvas();
    
    // Oyunu başlat
    startGame(nickname);
});

// Canvas boyutunu ayarla
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
}

// Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
window.addEventListener('resize', resizeCanvas);

// ... existing code ... 

function startGame(nickname) {
    if (gameState.gameStarted) return;
    
    // Oyun durumunu sıfırla
    gameState = {
        localPlayer: {
            id: socket.id,
            name: nickname,
            snake: [{x: 0, y: 0}],
            direction: {x: 1, y: 0},
            score: 0,
            color: '#' + Math.floor(Math.random()*16777215).toString(16)
        },
        otherPlayers: new Map(),
        foods: new Set(),
        direction: {x: 1, y: 0},
        nextDirection: {x: 1, y: 0},
        score: 0,
        gameLoop: null,
        gameStarted: true,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };

    // Sunucuya oyuncuyu bildir
    socket.emit('playerJoined', {
        id: socket.id,
        name: nickname,
        snake: gameState.localPlayer.snake,
        color: gameState.localPlayer.color
    });

    // Oyun döngüsünü başlat
    if (!gameState.gameLoop) {
        gameState.gameLoop = setInterval(() => {
            updateGame();
            render(performance.now());
        }, 1000 / 60);
    }

    // Kontrolleri etkinleştir
    setupControls();
}

// Kontrolleri ayarla
function setupControls() {
    if (gameState.isMobile) {
        // Mobil kontroller
        document.getElementById('controls').style.display = 'block';
        setupMobileControls();
    } else {
        // Klavye kontrolleri
        document.getElementById('controls').style.display = 'none';
        setupKeyboardControls();
    }
}

// Klavye kontrollerini ayarla
function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        switch(event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (gameState.direction.y !== 1) {
                    gameState.nextDirection = {x: 0, y: -1};
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (gameState.direction.y !== -1) {
                    gameState.nextDirection = {x: 0, y: 1};
                }
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (gameState.direction.x !== 1) {
                    gameState.nextDirection = {x: -1, y: 0};
                }
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (gameState.direction.x !== -1) {
                    gameState.nextDirection = {x: 1, y: 0};
                }
                break;
        }
    });
}

// Mobil kontrolleri ayarla
function setupMobileControls() {
    const controls = ['up', 'down', 'left', 'right'];
    controls.forEach(direction => {
        document.getElementById(direction).addEventListener('touchstart', (event) => {
            event.preventDefault();
            switch(direction) {
                case 'up':
                    if (gameState.direction.y !== 1) {
                        gameState.nextDirection = {x: 0, y: -1};
                    }
                    break;
                case 'down':
                    if (gameState.direction.y !== -1) {
                        gameState.nextDirection = {x: 0, y: 1};
                    }
                    break;
                case 'left':
                    if (gameState.direction.x !== 1) {
                        gameState.nextDirection = {x: -1, y: 0};
                    }
                    break;
                case 'right':
                    if (gameState.direction.x !== -1) {
                        gameState.nextDirection = {x: 1, y: 0};
                    }
                    break;
            }
        });
    });
} 

// Oyun mantığını güncelle
function updateGame() {
    if (!gameState.localPlayer) return;

    // Yönü güncelle
    gameState.direction = gameState.nextDirection;

    // Yılanın başını al
    const head = {...gameState.localPlayer.snake[0]};
    
    // Yeni baş pozisyonunu hesapla
    const newHead = {
        x: head.x + gameState.direction.x,
        y: head.y + gameState.direction.y
    };

    // Dünya sınırlarını kontrol et
    newHead.x = Math.max(GAME_CONFIG.WORLD_BOUNDS.MIN_X, Math.min(GAME_CONFIG.WORLD_BOUNDS.MAX_X, newHead.x));
    newHead.y = Math.max(GAME_CONFIG.WORLD_BOUNDS.MIN_Y, Math.min(GAME_CONFIG.WORLD_BOUNDS.MAX_Y, newHead.y));

    // Yılanın başını güncelle
    gameState.localPlayer.snake.unshift(newHead);

    // Yem kontrolü
    let foodEaten = false;
    gameState.foods.forEach(food => {
        if (isColliding(newHead, food)) {
            foodEaten = true;
            gameState.foods.delete(food);
            gameState.score += 10;
            socket.emit('foodEaten', food.id);
            updateScore();
        }
    });

    // Eğer yem yemediyse kuyruğu kısalt
    if (!foodEaten) {
        gameState.localPlayer.snake.pop();
    }

    // Çarpışma kontrolü
    if (checkCollision()) {
        gameOver();
        return;
    }

    // Sunucuya pozisyon güncelleme gönder
    socket.emit('playerUpdate', {
        id: socket.id,
        name: gameState.localPlayer.name,
        snake: gameState.localPlayer.snake,
        score: gameState.score,
        color: gameState.localPlayer.color
    });
}

// Çarpışma kontrolü
function checkCollision() {
    const head = gameState.localPlayer.snake[0];

    // Diğer oyuncularla çarpışma kontrolü
    for (const [id, player] of gameState.otherPlayers) {
        for (const segment of player.snake) {
            if (isColliding(head, segment)) {
                return true;
            }
        }
    }

    // Kendisiyle çarpışma kontrolü (baş hariç)
    for (let i = 1; i < gameState.localPlayer.snake.length; i++) {
        if (isColliding(head, gameState.localPlayer.snake[i])) {
            return true;
        }
    }

    return false;
}

// İki nokta arasında çarpışma kontrolü
function isColliding(point1, point2) {
    const distance = Math.sqrt(
        Math.pow((point1.x - point2.x), 2) + 
        Math.pow((point1.y - point2.y), 2)
    );
    return distance < GAME_CONFIG.COLLISION_DISTANCE;
}

// Skoru güncelle
function updateScore() {
    document.getElementById('score').textContent = `SKOR: ${gameState.score}`;
}

// Oyun bitti
function gameOver() {
    clearInterval(gameState.gameLoop);
    gameState.gameLoop = null;
    gameState.gameStarted = false;
    
    // Menüyü göster
    document.getElementById('menu-container').style.display = 'block';
    document.getElementById('game-container').style.display = 'none';
    
    // Skoru sıfırla
    gameState.score = 0;
    updateScore();
    
    // Sunucuya bildir
    socket.emit('playerLeft', socket.id);
}

// Render fonksiyonu
function render(timestamp) {
    if (!gameState.gameStarted) return;

    // FPS kontrolü
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Kamera pozisyonunu hesapla
    const cameraPos = calculateCameraPosition();

    // Dünyayı çiz
    drawWorld(ctx, cameraPos);

    // Yemleri çiz
    drawFoods(ctx, cameraPos);

    // Diğer oyuncuları çiz
    drawOtherSnakes(ctx, cameraPos);

    // Yerel oyuncuyu çiz
    drawLocalSnake(ctx, cameraPos);

    // Skor tablosunu çiz
    drawScoreboard(ctx);
}

// Kamera pozisyonunu hesapla
function calculateCameraPosition() {
    if (!gameState.localPlayer || !gameState.localPlayer.snake.length) return { x: 0, y: 0 };

    const head = gameState.localPlayer.snake[0];
    return {
        x: head.x * GAME_CONFIG.GRID_SIZE,
        y: head.y * GAME_CONFIG.GRID_SIZE
    };
}

// Dünyayı çiz
function drawWorld(ctx, cameraPos) {
    // Arka planı çiz
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid çiz
    drawGrid(ctx, cameraPos);
}

// Grid çiz
function drawGrid(ctx, cameraPos) {
    const gridSize = GAME_CONFIG.GRID_SIZE;
    const startX = Math.floor((cameraPos.x - canvas.width / 2) / gridSize) * gridSize;
    const startY = Math.floor((cameraPos.y - canvas.height / 2) / gridSize) * gridSize;
    const endX = startX + canvas.width + gridSize;
    const endY = startY + canvas.height + gridSize;

    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - cameraPos.x + canvas.width / 2, 0);
        ctx.lineTo(x - cameraPos.x + canvas.width / 2, canvas.height);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - cameraPos.y + canvas.height / 2);
        ctx.lineTo(canvas.width, y - cameraPos.y + canvas.height / 2);
        ctx.stroke();
    }
}

// Yemleri çiz
function drawFoods(ctx, cameraPos) {
    gameState.foods.forEach(food => {
        const screenX = food.x * GAME_CONFIG.GRID_SIZE - cameraPos.x + canvas.width / 2;
        const screenY = food.y * GAME_CONFIG.GRID_SIZE - cameraPos.y + canvas.height / 2;

        // Ekran dışındaysa çizme
        if (isOffscreen(screenX, screenY)) return;

        // Yem parıltısı
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, GAME_CONFIG.FOOD_SIZE * GAME_CONFIG.GRID_SIZE
        );
        gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(screenX, screenY, GAME_CONFIG.FOOD_SIZE * GAME_CONFIG.GRID_SIZE * 2, 0, Math.PI * 2);
        ctx.fill();

        // Yem
        ctx.beginPath();
        ctx.fillStyle = '#0f0';
        ctx.arc(screenX, screenY, GAME_CONFIG.FOOD_SIZE * GAME_CONFIG.GRID_SIZE, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Ekran dışında mı kontrol et
function isOffscreen(x, y) {
    return x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50;
}

// Diğer yılanları çiz
function drawOtherSnakes(ctx, cameraPos) {
    gameState.otherPlayers.forEach(player => {
        drawSnake(ctx, player.snake, player.color, cameraPos);
    });
}

// Yerel yılanı çiz
function drawLocalSnake(ctx, cameraPos) {
    if (!gameState.localPlayer) return;
    drawSnake(ctx, gameState.localPlayer.snake, gameState.localPlayer.color, cameraPos);
}

// Yılan çizimi
function drawSnake(ctx, snake, color, cameraPos) {
    if (!snake.length) return;

    snake.forEach((segment, index) => {
        const screenX = segment.x * GAME_CONFIG.GRID_SIZE - cameraPos.x + canvas.width / 2;
        const screenY = segment.y * GAME_CONFIG.GRID_SIZE - cameraPos.y + canvas.height / 2;

        // Ekran dışındaysa çizme
        if (isOffscreen(screenX, screenY)) return;

        // Parıltı efekti
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, GAME_CONFIG.GRID_SIZE
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(screenX, screenY, GAME_CONFIG.GRID_SIZE * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Yılan segmenti
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(screenX, screenY, GAME_CONFIG.GRID_SIZE * GAME_CONFIG.SNAKE_SIZE, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Skor tablosunu çiz
function drawScoreboard(ctx) {
    const players = [...gameState.otherPlayers.values()];
    if (gameState.localPlayer) {
        players.push(gameState.localPlayer);
    }

    // Oyuncuları skora göre sırala
    players.sort((a, b) => b.score - a.score);

    // Skor tablosu arka planı
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 30 + players.length * 25);

    // Başlık
    ctx.fillStyle = '#0f0';
    ctx.font = '20px Arial';
    ctx.fillText('Skor Tablosu', 20, 30);

    // Oyuncular
    ctx.font = '16px Arial';
    players.forEach((player, index) => {
        const isLocal = player.id === socket.id;
        ctx.fillStyle = isLocal ? '#0f0' : '#fff';
        ctx.fillText(`${player.name}: ${player.score}`, 20, 55 + index * 25);
    });
} 