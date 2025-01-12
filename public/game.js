// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_COUNT: 100,
    INITIAL_SPEED: 16,
    MIN_SPEED: 16,
    SPEED_DECREASE: 5,
    FOOD_SIZE: 0.6,
    CAMERA_ZOOM: 2.5,
    COLLISION_DISTANCE: 1.2,
    FOOD_SPAWN_INTERVAL: 2000,
    NEON_GLOW: 15,
    FOOD_COUNT: 100,
    FOOD_VALUE: 10,
    RENDER_DISTANCE: 1000,
    SNAKE_SPEED: 0.3,
    WORLD_BOUNDS: {
        MIN_X: -2000,
        MAX_X: 2000,
        MIN_Y: -2000,
        MAX_Y: 2000
    },
    HEXAGON_SIZE: 50
};

// Arkaplan hexagon pattern'ı için offscreen canvas
const hexagonPattern = document.createElement('canvas');
const hexCtx = hexagonPattern.getContext('2d');

// Hexagon pattern'ı oluştur
function createHexagonPattern() {
    const size = GAME_CONFIG.HEXAGON_SIZE;
    const h = size * Math.sqrt(3);
    
    // Pattern canvas boyutunu ayarla
    hexagonPattern.width = size * 3;
    hexagonPattern.height = h * 2;
    
    hexCtx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    hexCtx.lineWidth = 1;
    
    // Tek bir hexagon çiz
    function drawHexagon(x, y) {
        hexCtx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const xPos = x + size * Math.cos(angle);
            const yPos = y + size * Math.sin(angle);
            if (i === 0) {
                hexCtx.moveTo(xPos, yPos);
            } else {
                hexCtx.lineTo(xPos, yPos);
            }
        }
        hexCtx.closePath();
        hexCtx.stroke();
    }
    
    // Pattern için hexagonları çiz
    drawHexagon(size * 1.5, h);
    drawHexagon(0, 0);
    drawHexagon(size * 3, 0);
    drawHexagon(0, h * 2);
    drawHexagon(size * 3, h * 2);
}

createHexagonPattern();

// Arkaplan çizimi
function drawBackground() {
    ctx.save();
    ctx.resetTransform();
    
    // Gradyan arkaplan
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a0033');
    gradient.addColorStop(0.5, '#000066');
    gradient.addColorStop(1, '#003300');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Hexagon pattern'ı tekrarla
    const pattern = ctx.createPattern(hexagonPattern, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.restore();
}

// Performans için offscreen canvas
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Oyun Durumu
let gameState = {
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set(),
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameStarted: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

let lastTime = 0;

// Görseller
const IMAGES = {
    background: new Image(),
    food: new Image(),
    snakeEyes: new Image()
};

IMAGES.background.src = '/assets/hexagon-pattern.png';
IMAGES.food.src = '/assets/food.png';
IMAGES.snakeEyes.src = '/assets/snake-eyes.png';

// Socket.IO bağlantısı
const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true
});

// Bağlantı durumu kontrolü
socket.on('connect', () => {
    console.log('Sunucuya bağlandı');
    document.getElementById('connectionStatus').style.display = 'none';
    
    // Bağlantı kurulduğunda direkt oyunu başlat
    if (!gameState.gameStarted) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        startGame();
    }
});

socket.on('connect_error', (error) => {
    console.error('Bağlantı hatası:', error);
    document.getElementById('connectionStatus').style.display = 'block';
    document.getElementById('connectionStatus').textContent = 'Sunucuya bağlanılamıyor... Yeniden deneniyor.';
});

socket.on('disconnect', () => {
    console.log('Sunucu bağlantısı kesildi');
    document.getElementById('connectionStatus').style.display = 'block';
    document.getElementById('connectionStatus').textContent = 'Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...';
});

// Oyun başlatma butonunu dinle
document.getElementById('play-button').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value.trim();
    if (nickname) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('gameCanvas').style.display = 'block';
        startGame(nickname);
    }
});

// Yapay Zeka Yılanları
const AI_SNAKES = [
    { name: 'NeonHunter', color: '#ff0000' },
    { name: 'CyberSnake', color: '#00ff00' },
    { name: 'VirtualViper', color: '#0000ff' },
    { name: 'PixelPython', color: '#ff00ff' }
];

// Rastgele pozisyon oluştur
function getRandomPosition() {
    // Güvenli bir başlangıç alanı tanımla (merkeze yakın)
    const safeArea = {
        minX: GAME_CONFIG.WORLD_BOUNDS.MIN_X / 2,
        maxX: GAME_CONFIG.WORLD_BOUNDS.MAX_X / 2,
        minY: GAME_CONFIG.WORLD_BOUNDS.MIN_Y / 2,
        maxY: GAME_CONFIG.WORLD_BOUNDS.MAX_Y / 2
    };

    return {
        x: Math.random() * (safeArea.maxX - safeArea.minX) + safeArea.minX,
        y: Math.random() * (safeArea.maxY - safeArea.minY) + safeArea.minY
    };
}

// Oyun başlatma fonksiyonunu güncelle
function startGame() {
    if (gameState.gameStarted) return;
    
    console.log('Oyun başlatılıyor...');
    initCanvas();
    
    // Her seferinde farklı bir renk seç
    const hue = Math.floor(Math.random() * 360);
    const randomColor = `hsl(${hue}, 100%, 50%)`;
    
    // Rastgele başlangıç pozisyonu
    const startPos = getRandomPosition();
    
    // Yılanı başlangıç pozisyonuna yerleştir
    const snake = [
        { x: startPos.x, y: startPos.y },
        { x: startPos.x - 1, y: startPos.y },
        { x: startPos.x - 2, y: startPos.y }
    ];
    
    // Oyun durumunu sıfırla
    gameState = {
        ...gameState,
        localPlayer: {
            id: socket.id,
            name: 'Oyuncu ' + Math.floor(Math.random() * 1000),
            color: randomColor,
            snake: snake,
            direction: { x: 1, y: 0 },
            score: 0
        },
        otherPlayers: new Map(),
        foods: new Set(),
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        gameStarted: true
    };

    // Sunucuya oyuncuyu kaydet
    socket.emit('playerJoin', {
        id: socket.id,
        name: gameState.localPlayer.name,
        color: randomColor,
        snake: snake,
        score: 0
    });

    // Başlangıç yemlerini oluştur
    for (let i = 0; i < GAME_CONFIG.FOOD_COUNT; i++) {
        spawnFood();
    }
    
    // Oyun döngüsünü başlat
    requestAnimationFrame(gameLoop);
    
    console.log('Oyun başlatıldı');
}

// Yem oluşturma fonksiyonu
function spawnFood() {
    const pos = getRandomPosition();
    const food = {
        x: Math.floor(pos.x / GAME_CONFIG.GRID_SIZE),
        y: Math.floor(pos.y / GAME_CONFIG.GRID_SIZE),
        value: 1,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };
    gameState.foods.add(food);
    socket.emit('foodSpawned', food);
    return food;
}

// Yem çizimi
function drawFood(food) {
    if (!food) return;
    
    const time = Date.now() / 1000;
    const size = GAME_CONFIG.GRID_SIZE * GAME_CONFIG.FOOD_SIZE * (1 + Math.sin(time * 2) * 0.1);
    const color = food.color || `hsl(${(time * 50) % 360}, 100%, 50%)`;
    
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    
    // Ana yem
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // İç parlama
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size * 0.5,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    ctx.restore();
}

// Yem yönetimi
setInterval(() => {
    if (gameState.gameStarted) {
        // Yem sayısını kontrol et
        const currentFoodCount = gameState.foods.size;
        const targetFoodCount = GAME_CONFIG.FOOD_COUNT;
        
        // Eksik yem varsa yeni yemler oluştur
        if (currentFoodCount < targetFoodCount) {
            const foodsToAdd = targetFoodCount - currentFoodCount;
            for (let i = 0; i < foodsToAdd; i++) {
                spawnFood();
            }
        }
    }
}, GAME_CONFIG.FOOD_SPAWN_INTERVAL);

// Yapay zeka yılanlarını başlat
function initAISnakes() {
    AI_SNAKES.forEach(ai => {
        const startPos = getRandomPosition();
        
        const aiSnake = {
            id: ai.name,
            name: ai.name,
            color: ai.color,
            snake: [
                { x: startPos.x, y: startPos.y },
                { x: startPos.x - 1, y: startPos.y },
                { x: startPos.x - 2, y: startPos.y }
            ],
            direction: { x: 1, y: 0 },
            score: 0,
            target: null
        };
        
        gameState.otherPlayers.set(ai.name, aiSnake);
    });
}

// Yapay zeka yılanlarını güncelle
function updateAISnakes() {
    AI_SNAKES.forEach(ai => {
        const aiSnake = gameState.otherPlayers.get(ai.name);
        if (aiSnake) {
            // Hedef belirle
            if (!aiSnake.target || Math.random() < 0.02) { // %2 şansla hedef değiştir
                // Yakındaki yemleri bul
                const foods = Array.from(gameState.foods);
                const playerHead = gameState.localPlayer.snake[0];
                
                // Hedef olarak ya en yakın yemi ya da oyuncuyu seç
                if (Math.random() < 0.7) { // %70 şansla yeme git
                    aiSnake.target = foods.reduce((closest, food) => {
                        const distToFood = getDistance(aiSnake.snake[0], food);
                        const distToClosest = closest ? getDistance(aiSnake.snake[0], closest) : Infinity;
                        return distToFood < distToClosest ? food : closest;
                    }, null);
                } else { // %30 şansla oyuncuya saldır
                    aiSnake.target = playerHead;
                }
            }
            
            if (aiSnake.target) {
                // Hedefe doğru yönlen
                const head = aiSnake.snake[0];
                const angle = Math.atan2(
                    aiSnake.target.y - head.y,
                    aiSnake.target.x - head.x
                );
                
                aiSnake.direction = {
                    x: Math.cos(angle),
                    y: Math.sin(angle)
                };
                
                // Hareketi uygula
                const newHead = {
                    x: head.x + aiSnake.direction.x * GAME_CONFIG.SNAKE_SPEED,
                    y: head.y + aiSnake.direction.y * GAME_CONFIG.SNAKE_SPEED
                };
                
                // Çarpışma kontrolü
                let collision = false;
                
                // Oyuncu ile çarpışma
                const distToPlayer = getDistance(newHead, gameState.localPlayer.snake[0]);
                if (distToPlayer < GAME_CONFIG.COLLISION_DISTANCE) {
                    collision = true;
                    gameOver();
                }
                
                if (!collision) {
                    aiSnake.snake.unshift(newHead);
                    aiSnake.snake.pop();
                    
                    // Yem yeme kontrolü
                    gameState.foods.forEach(food => {
                        if (getDistance(newHead, food) < GAME_CONFIG.FOOD_SIZE) {
                            gameState.foods.delete(food);
                            aiSnake.snake.push({ ...aiSnake.snake[aiSnake.snake.length - 1] });
                            aiSnake.score++;
                        }
                    });
                }
            }
        }
    });
}

// İki nokta arasındaki mesafeyi hesapla
function getDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) +
        Math.pow(point1.y - point2.y, 2)
    );
}

// Yılan çizim fonksiyonu
function drawSnake(snake, color) {
    if (!snake || snake.length === 0) return;
    
    ctx.save();
    
    // Neon efekti
    ctx.shadowColor = color;
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.lineWidth = GAME_CONFIG.GRID_SIZE * 0.8;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    
    // Yılan gövdesini çiz
    ctx.beginPath();
    ctx.moveTo(snake[0].x * GAME_CONFIG.GRID_SIZE, snake[0].y * GAME_CONFIG.GRID_SIZE);
    
    for (let i = 1; i < snake.length; i++) {
        const current = snake[i];
        if (current) {
            ctx.lineTo(current.x * GAME_CONFIG.GRID_SIZE, current.y * GAME_CONFIG.GRID_SIZE);
        }
    }
    ctx.stroke();
    
    // Yılan başını çiz
    const head = snake[0];
    if (head) {
        ctx.beginPath();
        ctx.arc(
            head.x * GAME_CONFIG.GRID_SIZE,
            head.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE * 0.5,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Gözleri çiz
        const eyeOffset = GAME_CONFIG.GRID_SIZE * 0.2;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(
            head.x * GAME_CONFIG.GRID_SIZE + eyeOffset,
            head.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
            GAME_CONFIG.GRID_SIZE * 0.15,
            0,
            Math.PI * 2
        );
        ctx.arc(
            head.x * GAME_CONFIG.GRID_SIZE - eyeOffset,
            head.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
            GAME_CONFIG.GRID_SIZE * 0.15,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    ctx.restore();
}

// Oyun döngüsünü güncelle
function gameLoop(currentTime) {
    if (!gameState.gameStarted) return;
    
    if (!lastTime) lastTime = currentTime;
    
    const deltaTime = currentTime - lastTime;
    if (deltaTime >= GAME_CONFIG.INITIAL_SPEED) {
        updateGame();
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Arkaplanı çiz
        drawBackground();
        
        // Kamerayı ayarla
        if (gameState.localPlayer && gameState.localPlayer.snake && gameState.localPlayer.snake[0]) {
            const head = gameState.localPlayer.snake[0];
            ctx.setTransform(
                GAME_CONFIG.CAMERA_ZOOM,
                0,
                0,
                GAME_CONFIG.CAMERA_ZOOM,
                canvas.width/2 - head.x * GAME_CONFIG.GRID_SIZE * GAME_CONFIG.CAMERA_ZOOM,
                canvas.height/2 - head.y * GAME_CONFIG.GRID_SIZE * GAME_CONFIG.CAMERA_ZOOM
            );
        }
        
        // Yemleri çiz
        gameState.foods.forEach(food => {
            if (food) drawFood(food);
        });
        
        // Diğer oyuncuları çiz
        gameState.otherPlayers.forEach(player => {
            if (player && player.snake && player.snake.length > 0) {
                drawSnake(player.snake, player.color);
            }
        });
        
        // Yerel oyuncuyu çiz
        if (gameState.localPlayer && gameState.localPlayer.snake && gameState.localPlayer.snake.length > 0) {
            drawSnake(gameState.localPlayer.snake, gameState.localPlayer.color);
        }
        
        lastTime = currentTime;
    }
    
    requestAnimationFrame(gameLoop);
}

// Oyun Mantığı Güncelleme
function updateGame() {
    if (!gameState.localPlayer || !gameState.localPlayer.snake || gameState.localPlayer.snake.length === 0) return;

    const head = { ...gameState.localPlayer.snake[0] };
    if (!head) return;

    const speed = GAME_CONFIG.SNAKE_SPEED;
    
    // Yönü normalize et
    const length = Math.sqrt(
        gameState.nextDirection.x * gameState.nextDirection.x +
        gameState.nextDirection.y * gameState.nextDirection.y
    );
    
    if (length === 0) return;
    
    head.x += (gameState.nextDirection.x / length) * speed;
    head.y += (gameState.nextDirection.y / length) * speed;
    
    // Dünya sınırlarını kontrol et
    if (head.x < GAME_CONFIG.WORLD_BOUNDS.MIN_X / GAME_CONFIG.GRID_SIZE ||
        head.x > GAME_CONFIG.WORLD_BOUNDS.MAX_X / GAME_CONFIG.GRID_SIZE ||
        head.y < GAME_CONFIG.WORLD_BOUNDS.MIN_Y / GAME_CONFIG.GRID_SIZE ||
        head.y > GAME_CONFIG.WORLD_BOUNDS.MAX_Y / GAME_CONFIG.GRID_SIZE) {
        gameOver();
        return;
    }
    
    // Çarpışma kontrolü
    let collision = false;
    
    // Diğer oyuncularla çarpışma kontrolü
    gameState.otherPlayers.forEach((player) => {
        if (player && player.snake && player.snake.length > 0) {
            for (let segment of player.snake) {
                if (!segment) continue;
                
                const distance = Math.sqrt(
                    Math.pow(head.x - segment.x, 2) +
                    Math.pow(head.y - segment.y, 2)
                );
                
                if (distance < GAME_CONFIG.COLLISION_DISTANCE) {
                    collision = true;
                    break;
                }
            }
        }
    });
    
    if (collision) {
        gameOver();
        return;
    }
    
    // Yem yeme kontrolü
    const foodEaten = checkFoodCollision(head);
    
    // Yılanı güncelle
    gameState.localPlayer.snake.unshift(head);
    if (!foodEaten) {
        gameState.localPlayer.snake.pop();
    }
    
    // Pozisyonu sunucuya gönder
    socket.emit('updatePosition', {
        id: socket.id,
        name: gameState.localPlayer.name,
        snake: gameState.localPlayer.snake,
        direction: gameState.nextDirection,
        score: gameState.localPlayer.score,
        color: gameState.localPlayer.color
    });
}

// Yem düşürme fonksiyonu
function dropFood(snake) {
    const foodCount = Math.min(snake.length, 10); // En fazla 10 yem düşür
    for (let i = 0; i < foodCount; i++) {
        const segment = snake[Math.floor(Math.random() * snake.length)];
        const food = {
            x: segment.x + (Math.random() * 2 - 1), // Rastgele offset ekle
            y: segment.y + (Math.random() * 2 - 1),
            value: 1
        };
        socket.emit('foodSpawned', food);
    }
}

// Çizim İşlemleri
function draw() {
    offscreenCtx.save();
    
    // Ekranı temizle
    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Kamerayı güncelle ve uygula
    camera.followPlayer();
    offscreenCtx.translate(camera.x, camera.y);
    offscreenCtx.scale(camera.scale, camera.scale);
    
    // Arkaplanı çiz
    drawBackground();
    
    // Grid çiz
    drawGrid();
    
    // Görüş alanındaki nesneleri çiz
    const viewArea = {
        minX: (-camera.x / camera.scale - GAME_CONFIG.RENDER_DISTANCE) / GAME_CONFIG.GRID_SIZE,
        maxX: (-camera.x / camera.scale + canvas.width / camera.scale + GAME_CONFIG.RENDER_DISTANCE) / GAME_CONFIG.GRID_SIZE,
        minY: (-camera.y / camera.scale - GAME_CONFIG.RENDER_DISTANCE) / GAME_CONFIG.GRID_SIZE,
        maxY: (-camera.y / camera.scale + canvas.height / camera.scale + GAME_CONFIG.RENDER_DISTANCE) / GAME_CONFIG.GRID_SIZE
    };
    
    // Görüş alanındaki yemleri çiz
    for (const food of gameState.foods) {
        if (isInViewArea(food, viewArea)) {
            drawFood(food);
        }
    }
    
    // Görüş alanındaki yılanları çiz
    for (const [id, player] of gameState.otherPlayers) {
        if (player.snake.length > 0 && isInViewArea(player.snake[0], viewArea)) {
            drawSnake(player.snake, player.color);
        }
    }
    
    // Yerel oyuncuyu çiz
    if (gameState.localPlayer) {
        drawSnake(gameState.localPlayer.snake, gameState.localPlayer.color);
    }
    
    offscreenCtx.restore();
    
    // Offscreen canvas'ı ana canvas'a kopyala
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
}

// Yem yeme kontrolü
function checkFoodCollision(head) {
    if (!head) return false;
    
    let foodEaten = false;
    gameState.foods.forEach(food => {
        if (!food) return;
        
        const distance = Math.sqrt(
            Math.pow(head.x - food.x, 2) +
            Math.pow(head.y - food.y, 2)
        );
        
        if (distance < GAME_CONFIG.FOOD_SIZE * 2) {
            foodEaten = true;
            socket.emit('foodEaten', { x: food.x, y: food.y });
            gameState.foods.delete(food);
            
            if (gameState.localPlayer) {
                gameState.localPlayer.score += GAME_CONFIG.FOOD_VALUE;
                document.getElementById('score').textContent = `SKOR: ${gameState.localPlayer.score}`;
                
                // Yılanı uzat
                if (gameState.localPlayer.snake && gameState.localPlayer.snake.length > 0) {
                    const tail = gameState.localPlayer.snake[gameState.localPlayer.snake.length - 1];
                    if (tail) {
                        gameState.localPlayer.snake.push({ ...tail });
                    }
                }
            }
        }
    });
    return foodEaten;
}

// Oyun Bitişi
function gameOver() {
    gameState.gameStarted = false;
    
    const message = document.getElementById('message');
    message.innerHTML = `
        <div style="background: rgba(0,0,0,0.9); padding: 20px; border-radius: 10px; border: 2px solid #0f0;">
            <h2 style="color: #0f0; margin-bottom: 15px;">Oyun Bitti!</h2>
            <p style="color: #0f0; margin-bottom: 20px;">Skor: ${gameState.localPlayer.score}</p>
            <button onclick="location.reload()" style="
                background: linear-gradient(45deg, #0f0, #0ff);
                border: none;
                padding: 10px 20px;
                color: white;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">Tekrar Oyna</button>
        </div>
    `;
    message.style.display = 'block';
}

// Socket.IO Event Handlers
socket.on('playerJoined', (player) => {
    gameState.otherPlayers.set(player.id, player);
    updatePlayerList();
});

socket.on('playerLeft', (playerId) => {
    gameState.otherPlayers.delete(playerId);
    updatePlayerList();
});

socket.on('playerMoved', (data) => {
    const player = gameState.otherPlayers.get(data.id);
    if (player) {
        player.snake = data.snake;
        player.direction = data.direction;
    }
});

// Yön Değiştirme Fonksiyonu
function changeDirection(newDirection) {
    if (!gameState.gameStarted || !gameState.localPlayer) return;
    
    // Ters yöne gitmeyi engelle
    if (newDirection.x === -gameState.localPlayer.direction.x || 
        newDirection.y === -gameState.localPlayer.direction.y) {
        return;
    }
    
    gameState.nextDirection = newDirection;
}

// Klavye Kontrolleri
document.addEventListener('keydown', (event) => {
    const keyMappings = {
        'ArrowUp': { x: 0, y: -1 },
        'ArrowDown': { x: 0, y: 1 },
        'ArrowLeft': { x: -1, y: 0 },
        'ArrowRight': { x: 1, y: 0 }
    };
    
    const newDirection = keyMappings[event.key];
    if (newDirection) {
        changeDirection(newDirection);
    }
});

// Mobil Kontroller
if (gameState.isMobile) {
    const controls = document.getElementById('controls');
    if (controls) {
        controls.style.display = 'none';
    }
}

// Dokunmatik yüzey kontrollerini kaldır
canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Yem güncellemeleri
socket.on('foodSpawned', (foods) => {
    gameState.foods = new Set(foods.map(food => ({...food})));
});

// Skor tablosu güncellemeleri
socket.on('leaderboardUpdate', (leaderboard) => {
    updateLeaderboard(leaderboard);
});

// Skor tablosunu güncelle
function updateLeaderboard(leaderboard) {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '<h3 style="color: #0f0; margin-bottom: 10px;">Sıralama</h3>';
    
    // Tüm oyuncuları birleştir ve sırala
    const allPlayers = [...gameState.otherPlayers.values()];
    if (gameState.localPlayer) {
        allPlayers.push(gameState.localPlayer);
    }
    
    allPlayers.sort((a, b) => b.score - a.score);
    
    allPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.style.color = player.color;
        div.style.padding = '5px';
        div.style.marginBottom = '5px';
        div.style.borderRadius = '3px';
        div.style.background = 'rgba(0,0,0,0.5)';
        
        const crown = index === 0 ? '👑 ' : '';
        const medal = index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
        const isLocal = player.id === socket.id ? ' (Sen)' : '';
        
        div.textContent = `${crown}${medal}${player.name}${isLocal}: ${player.score}`;
        playerList.appendChild(div);
    });
}

// Canvas boyutunu ayarla ve responsive yap
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    offscreenCanvas.width = window.innerWidth;
    offscreenCanvas.height = window.innerHeight;
    GAME_CONFIG.GRID_SIZE = Math.min(canvas.width, canvas.height) / GAME_CONFIG.GRID_COUNT;

    if (gameState.gameStarted) {
        draw();
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Kamera pozisyonu
const camera = {
    x: 0,
    y: 0,
    scale: GAME_CONFIG.CAMERA_ZOOM,
    followPlayer: function() {
        if (!gameState.localPlayer || !gameState.localPlayer.snake[0]) return;
        
        const head = gameState.localPlayer.snake[0];
        const targetX = canvas.width/2 - head.x * GAME_CONFIG.GRID_SIZE * this.scale;
        const targetY = canvas.height/2 - head.y * GAME_CONFIG.GRID_SIZE * this.scale;
        
        // Yumuşak kamera hareketi
        this.x += (targetX - this.x) * 0.1;
        this.y += (targetY - this.y) * 0.1;
        
        // Kamera transformasyonunu uygula
        ctx.setTransform(
            this.scale, 0,
            0, this.scale,
            this.x, this.y
        );
    }
};

// Mouse kontrolü
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    updatePlayerDirection();
});

// Dokunmatik kontrol
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    updatePlayerDirection();
}, { passive: false });

function updatePlayerDirection() {
    if (!gameState.localPlayer || !gameState.gameStarted) return;

    const head = gameState.localPlayer.snake[0];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Mouse pozisyonunu kamera zoom'una göre ayarla
    const zoomedMouseX = (mouseX - centerX) / camera.scale + centerX;
    const zoomedMouseY = (mouseY - centerY) / camera.scale + centerY;
    
    const angle = Math.atan2(zoomedMouseY - centerY, zoomedMouseX - centerX);
    
    gameState.nextDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle)
    };
}

// Nesnenin görüş alanında olup olmadığını kontrol et
function isInViewArea(obj, viewArea) {
    return obj.x >= viewArea.minX && obj.x <= viewArea.maxX &&
           obj.y >= viewArea.minY && obj.y <= viewArea.maxY;
} 