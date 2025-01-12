// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_COUNT: 100,
    INITIAL_SPEED: 50,
    MIN_SPEED: 50,
    SPEED_DECREASE: 5,
    FOOD_SIZE: 0.4,
    CAMERA_ZOOM: gameState?.isMobile ? 2.5 : 1.8,
    COLLISION_DISTANCE: 0.8,
    FOOD_SPAWN_INTERVAL: 1000,
    NEON_GLOW: 10,
    FOOD_COUNT: 1000,
    FOOD_VALUE: 1,
    RENDER_DISTANCE: 2000,
    SNAKE_SPEED: 0.3,
    WORLD_BOUNDS: {
        MIN_X: -5000,
        MAX_X: 5000,
        MIN_Y: -5000,
        MAX_Y: 5000
    },
    HEXAGON_SIZE: 50,
    SAFE_START_RADIUS: 1000,
    BOT_COUNT: 10,
    BOT_VIEW_RANGE: 50,
    BOT_ATTACK_CHANCE: 0.3
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
    
    // Düz siyah arkaplan
    ctx.fillStyle = '#000000';
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
    gameLoop: null,
    gameStarted: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

let lastTime = 0; // lastTime değişkenini tanımla

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
    transports: ['websocket', 'polling']
});

// Bağlantı durumu kontrolü
socket.on('connect', () => {
    console.log('Sunucuya bağlandı');
    document.getElementById('connectionStatus').style.display = 'none';
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
    if (gameState.gameStarted) {
        gameOver();
    }
});

// Oyun başlatma butonunu dinle
document.getElementById('play-button').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value.trim();
    if (nickname) {
        console.log('Oyun başlatılıyor...');
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        startGame(nickname);
    }
});

// Yapay Zeka Yılanları
const AI_NAMES = [
    'HızlıAvcı', 'KurnazYılan', 'ZehirliOk', 'GölgeAvcısı', 'KralKobra',
    'ÇevikAvcı', 'ZekiYılan', 'HızlıKobra', 'KaranlıkAvcı', 'KralPython'
];

// Rastgele pozisyon oluştur
function getRandomPosition() {
    const margin = 100;
    const x = Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X - margin * 2) + 
              GAME_CONFIG.WORLD_BOUNDS.MIN_X + margin;
    const y = Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y - margin * 2) + 
              GAME_CONFIG.WORLD_BOUNDS.MIN_Y + margin;
    
    return {
        x: x / GAME_CONFIG.GRID_SIZE,
        y: y / GAME_CONFIG.GRID_SIZE
    };
}

// Yem oluşturma fonksiyonu
function spawnFood() {
    const pos = getRandomPosition();
    const food = {
        x: pos.x,
        y: pos.y,
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
    const size = GAME_CONFIG.GRID_SIZE * GAME_CONFIG.FOOD_SIZE;
    const glowSize = size * 1.5;
    
    ctx.save();
    
    // Dış parlaklık
    const gradient = ctx.createRadialGradient(
        food.x * GAME_CONFIG.GRID_SIZE, food.y * GAME_CONFIG.GRID_SIZE, 0,
        food.x * GAME_CONFIG.GRID_SIZE, food.y * GAME_CONFIG.GRID_SIZE, glowSize
    );
    
    gradient.addColorStop(0, food.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        glowSize,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // Ana yem
    ctx.fillStyle = food.color;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size,
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

// Bot yılanları başlat
function initBots() {
    for (let i = 0; i < GAME_CONFIG.BOT_COUNT; i++) {
        const startPos = getRandomPosition();
        const direction = Math.random() * Math.PI * 2;
        const botColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        
        const bot = {
            id: `bot_${i}`,
            name: AI_NAMES[i],
            color: botColor,
            snake: [
                { x: startPos.x, y: startPos.y },
                { x: startPos.x - Math.cos(direction), y: startPos.y - Math.sin(direction) },
                { x: startPos.x - Math.cos(direction) * 2, y: startPos.y - Math.sin(direction) * 2 }
            ],
            direction: { x: Math.cos(direction), y: Math.sin(direction) },
            score: 0,
            isBot: true,
            target: null,
            state: 'searching'
        };
        
        gameState.otherPlayers.set(bot.id, bot);
    }
}

// Bot davranışlarını güncelle
function updateBots() {
    gameState.otherPlayers.forEach(bot => {
        if (!bot.isBot) return;
        
        const head = bot.snake[0];
        let nearestFood = null;
        let nearestPlayer = null;
        let minFoodDist = Infinity;
        let minPlayerDist = Infinity;
        
        // En yakın yemi ve oyuncuyu bul
        gameState.foods.forEach(food => {
            const dist = getDistance(head, food);
            if (dist < minFoodDist && dist < GAME_CONFIG.BOT_VIEW_RANGE) {
                minFoodDist = dist;
                nearestFood = food;
            }
        });
        
        // Oyuncuları kontrol et
        if (gameState.localPlayer && gameState.localPlayer.snake.length > 0) {
            const playerHead = gameState.localPlayer.snake[0];
            const dist = getDistance(head, playerHead);
            if (dist < minPlayerDist && dist < GAME_CONFIG.BOT_VIEW_RANGE) {
                minPlayerDist = dist;
                nearestPlayer = gameState.localPlayer;
            }
        }
        
        // Bot davranışını belirle
        if (nearestPlayer && Math.random() < GAME_CONFIG.BOT_ATTACK_CHANCE) {
            // Saldırı modu
            bot.state = 'attacking';
            bot.target = nearestPlayer.snake[0];
        } else if (nearestFood) {
            // Yem toplama modu
            bot.state = 'chasing';
            bot.target = nearestFood;
        } else {
            // Arama modu
            bot.state = 'searching';
            if (!bot.target || Math.random() < 0.05) {
                bot.target = {
                    x: head.x + (Math.random() - 0.5) * 50,
                    y: head.y + (Math.random() - 0.5) * 50
                };
            }
        }
        
        // Hedefe doğru hareket et
        if (bot.target) {
            const angle = Math.atan2(
                bot.target.y - head.y,
                bot.target.x - head.x
            );
            
            bot.direction = {
                x: Math.cos(angle),
                y: Math.sin(angle)
            };
            
            // Yeni pozisyonu hesapla
            const newHead = {
                x: head.x + bot.direction.x * GAME_CONFIG.SNAKE_SPEED,
                y: head.y + bot.direction.y * GAME_CONFIG.SNAKE_SPEED
            };
            
            // Çarpışma kontrolü
            let collision = false;
            gameState.otherPlayers.forEach(otherBot => {
                if (otherBot.id !== bot.id && otherBot.snake) {
                    const dist = getDistance(newHead, otherBot.snake[0]);
                    if (dist < GAME_CONFIG.COLLISION_DISTANCE) {
                        collision = true;
                    }
                }
            });
            
            if (!collision) {
                bot.snake.unshift(newHead);
                bot.snake.pop();
                
                // Yem yeme kontrolü
                gameState.foods.forEach(food => {
                    if (getDistance(newHead, food) < GAME_CONFIG.FOOD_SIZE * 2) {
                        gameState.foods.delete(food);
                        bot.score += GAME_CONFIG.FOOD_VALUE;
                        bot.snake.push({ ...bot.snake[bot.snake.length - 1] });
                    }
                });
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
    
    // Gövde kalınlığı
    const baseThickness = GAME_CONFIG.GRID_SIZE * 0.8;
    
    // Gövdeyi çiz
    ctx.lineWidth = baseThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Dış parlaklık
    ctx.shadowColor = color;
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.strokeStyle = color;
    
    ctx.beginPath();
    ctx.moveTo(snake[0].x * GAME_CONFIG.GRID_SIZE, snake[0].y * GAME_CONFIG.GRID_SIZE);
    
    for (let i = 1; i < snake.length; i++) {
        const current = snake[i];
        ctx.lineTo(current.x * GAME_CONFIG.GRID_SIZE, current.y * GAME_CONFIG.GRID_SIZE);
    }
    ctx.stroke();
    
    // Baş kısmı
    const head = snake[0];
    const headSize = baseThickness * 1.2;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
        head.x * GAME_CONFIG.GRID_SIZE,
        head.y * GAME_CONFIG.GRID_SIZE,
        headSize / 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // Gözler
    const eyeOffset = headSize * 0.3;
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.arc(
        head.x * GAME_CONFIG.GRID_SIZE + eyeOffset,
        head.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
        headSize * 0.15,
        0,
        Math.PI * 2
    );
    ctx.arc(
        head.x * GAME_CONFIG.GRID_SIZE - eyeOffset,
        head.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
        headSize * 0.15,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    ctx.restore();
}

// Oyun başlatma fonksiyonu
function startGame(nickname) {
    console.log('startGame fonksiyonu çağrıldı');
    
    if (gameState.gameStarted) {
        console.log('Oyun zaten başlatılmış');
        return;
    }
    
    // Canvas'ı görünür yap
    canvas.style.display = 'block';
    
    // Rastgele renk seç
    const hue = Math.floor(Math.random() * 360);
    const randomColor = `hsl(${hue}, 100%, 50%)`;
    
    // Rastgele başlangıç pozisyonu
    const startPos = getRandomPosition();
    const direction = Math.random() * Math.PI * 2;
    
    // Yılanı oluştur
    const snake = [
        { x: startPos.x, y: startPos.y },
        { x: startPos.x - Math.cos(direction), y: startPos.y - Math.sin(direction) },
        { x: startPos.x - Math.cos(direction) * 2, y: startPos.y - Math.sin(direction) * 2 }
    ];
    
    // Oyuncu bilgilerini ayarla
    const player = {
        id: socket.id,
        name: nickname,
        color: randomColor,
        snake: snake,
        direction: { x: Math.cos(direction), y: Math.sin(direction) },
        score: 0
    };
    
    // Oyun durumunu güncelle
    gameState.localPlayer = player;
    gameState.gameStarted = true;
    
    console.log('Oyuncu oluşturuldu:', player);
    
    // Sunucuya oyuncuyu gönder
    socket.emit('playerJoin', player);
    
    // Oyun döngüsünü başlat
    requestAnimationFrame(gameLoop);
    
    console.log('Oyun başlatıldı');
}

// Oyun döngüsü
function gameLoop(currentTime) {
    if (!gameState.gameStarted) return;
    
    if (!lastTime) lastTime = currentTime;
    
    const deltaTime = currentTime - lastTime;
    if (deltaTime >= GAME_CONFIG.INITIAL_SPEED) {
        updateGame();
        updateBots();
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Arkaplanı çiz
        drawBackground();
        
        // Kamerayı ayarla
        if (gameState.localPlayer && gameState.localPlayer.snake[0]) {
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
            drawFood(food);
        });
        
        // Diğer oyuncuları çiz
        gameState.otherPlayers.forEach(player => {
            if (player && player.snake && player.snake.length > 0) {
                drawSnake(player.snake, player.color);
            }
        });
        
        // Yerel oyuncuyu çiz
        if (gameState.localPlayer && gameState.localPlayer.snake) {
            drawSnake(gameState.localPlayer.snake, gameState.localPlayer.color);
        }
        
        // Mini haritayı çiz
        drawMinimap();
        
        lastTime = currentTime;
    }
    
    requestAnimationFrame(gameLoop);
}

// Oyun Mantığı Güncelleme
function updateGame() {
    if (!gameState.localPlayer || !gameState.localPlayer.snake || gameState.localPlayer.snake.length === 0) return;

    const head = { ...gameState.localPlayer.snake[0] };
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
        if (player.snake && player.snake.length > 0) {
            // Sadece başla çarpışmayı kontrol et
            const distance = Math.sqrt(
                Math.pow(head.x - player.snake[0].x, 2) +
                Math.pow(head.y - player.snake[0].y, 2)
            );
            
            if (distance < GAME_CONFIG.COLLISION_DISTANCE) {
                collision = true;
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
    const foodCount = Math.ceil(snake.length / 2);
    
    for (let i = 0; i < foodCount; i++) {
        const segment = snake[Math.floor(Math.random() * snake.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 20; // Yemler daha geniş bir alana dağılsın
        
        const food = {
            x: segment.x + Math.cos(angle) * distance,
            y: segment.y + Math.sin(angle) * distance,
            value: 1,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
        
        gameState.foods.add(food);
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
    let foodEaten = false;
    gameState.foods.forEach(food => {
        const distance = Math.sqrt(
            Math.pow(head.x - food.x, 2) +
            Math.pow(head.y - food.y, 2)
        );
        
        if (distance < GAME_CONFIG.FOOD_SIZE * 2) {
            foodEaten = true;
            socket.emit('foodEaten', { x: food.x, y: food.y });
            gameState.foods.delete(food);
            gameState.localPlayer.score += GAME_CONFIG.FOOD_VALUE;
            document.getElementById('score').textContent = `SKOR: ${gameState.localPlayer.score}`;
            
            // Yılanı uzat
            const tail = gameState.localPlayer.snake[gameState.localPlayer.snake.length - 1];
            gameState.localPlayer.snake.push({ ...tail });
        }
    });
    return foodEaten;
}

// Oyun Bitişi
function gameOver() {
    if (gameState.localPlayer && gameState.localPlayer.snake) {
        dropFood(gameState.localPlayer.snake); // Yılan öldüğünde yem düşür
    }
    
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
    if (!playerList) return;
    
    playerList.innerHTML = `
        <div style="
            background: rgba(0,0,0,0.7);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(5px);
        ">
            <h3 style="color: #fff; margin-bottom: 10px; text-align: center;">Sıralama</h3>
            <div id="playerEntries"></div>
        </div>
    `;
    
    const playerEntries = document.getElementById('playerEntries');
    
    // Tüm oyuncuları birleştir
    const allPlayers = [];
    
    // Diğer oyuncuları ekle
    gameState.otherPlayers.forEach(player => {
        if (player && player.name) {
            allPlayers.push({
                name: player.name,
                score: player.score || 0,
                color: player.color,
                id: player.id
            });
        }
    });
    
    // Yerel oyuncuyu ekle
    if (gameState.localPlayer) {
        allPlayers.push({
            name: gameState.localPlayer.name,
            score: gameState.localPlayer.score || 0,
            color: gameState.localPlayer.color,
            id: socket.id
        });
    }
    
    // Skora göre sırala
    allPlayers.sort((a, b) => b.score - a.score);
    
    // İlk 10 oyuncuyu göster
    allPlayers.slice(0, 10).forEach((player, index) => {
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 10px;
            margin-bottom: 5px;
            border-radius: 5px;
            background: ${player.id === socket.id ? 'rgba(255,255,255,0.1)' : 'transparent'};
            color: ${player.color};
            font-size: 14px;
            text-shadow: 0 0 5px ${player.color};
        `;
        
        const rank = index + 1;
        const medal = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const isLocal = player.id === socket.id ? ' (Sen)' : '';
        
        div.innerHTML = `
            <span>${medal} ${player.name}${isLocal}</span>
            <span>${player.score}</span>
        `;
        
        playerEntries.appendChild(div);
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

// Mini harita çizimi
function drawMinimap() {
    const viewDistance = 15;
    const tileSize = 20;
    const mapSize = viewDistance * tileSize;
    const padding = 10;
    
    ctx.save();
    ctx.resetTransform();
    
    // Harita konumu (sağ alt köşe)
    const mapX = canvas.width - mapSize - padding;
    const mapY = canvas.height - mapSize - padding;
    
    // Harita arkaplanı
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = '#0f0';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    
    if (gameState.localPlayer && gameState.localPlayer.snake[0]) {
        const head = gameState.localPlayer.snake[0];
        
        // Görüş alanındaki yemleri çiz
        gameState.foods.forEach(food => {
            const dx = food.x - head.x;
            const dy = food.y - head.y;
            
            if (Math.abs(dx) <= viewDistance/2 && Math.abs(dy) <= viewDistance/2) {
                const foodX = mapX + (dx + viewDistance/2) * tileSize;
                const foodY = mapY + (dy + viewDistance/2) * tileSize;
                
                ctx.fillStyle = food.color;
                ctx.beginPath();
                ctx.arc(foodX, foodY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Görüş alanındaki diğer oyuncuları çiz
        gameState.otherPlayers.forEach(player => {
            if (player.snake && player.snake[0]) {
                const dx = player.snake[0].x - head.x;
                const dy = player.snake[0].y - head.y;
                
                if (Math.abs(dx) <= viewDistance/2 && Math.abs(dy) <= viewDistance/2) {
                    const playerX = mapX + (dx + viewDistance/2) * tileSize;
                    const playerY = mapY + (dy + viewDistance/2) * tileSize;
                    
                    ctx.fillStyle = player.color;
                    ctx.beginPath();
                    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        
        // Yerel oyuncuyu çiz
        const playerX = mapX + mapSize/2;
        const playerY = mapY + mapSize/2;
        
        ctx.fillStyle = gameState.localPlayer.color;
        ctx.beginPath();
        ctx.arc(playerX, playerY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
} 