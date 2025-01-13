// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 20,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    },
    FOOD_AREA: {
        MIN_X: -900,
        MAX_X: 900,
        MIN_Y: -900,
        MAX_Y: 900
    },
    RENDER_DISTANCE: 50,
    MIN_CAMERA_ZOOM: 1.2,
    CAMERA_SMOOTH_FACTOR: 0.05,
    SNAKE_GROWTH_RATE: 0.005,
    INITIAL_SNAKE_SIZE: 1,
    FOOD_COUNT: 25,
    FOOD_TYPES: {
        NORMAL: {
            SIZE: 0.8,
            POINTS: 1,
            COLOR: "#00ff00",
            PULSE_SPEED: 0.002,
            PULSE_SCALE: 0.2
        },
        DEAD_SNAKE: {
            SIZE: 1.2,
            MIN_POINTS: 5,
            MAX_POINTS: 20,
            COLOR: "#ffff00",
            PULSE_SPEED: 0.004,
            PULSE_SCALE: 0.3
        },
        AI: {
            SIZE: 1,
            POINTS: 3,
            COLOR: "#00ffff",
            SPEED: 0.2,
            PULSE_SPEED: 0.003,
            PULSE_SCALE: 0.25
        }
    }
};

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
const socket = io('https://neonsnake.onrender.com', {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    withCredentials: true,
    forceNew: true, // Her bağlantı için yeni socket oluştur
    multiplex: false // Multiplexing'i kapat
});

// Bağlantı durumu kontrolü
socket.on('connect', () => {
    console.log('Sunucuya bağlandı');
    document.getElementById('connectionStatus').style.display = 'none';
    
    // Bağlantı kurulduğunda direkt oyunu başlat
    if (!gameState.gameStarted) {
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
function startGame(nickname) {
    if (gameState.gameStarted) return;
    
    console.log('Oyun başlatılıyor...');
    
    // Her seferinde farklı bir renk seç
    const hue = Math.floor(Math.random() * 360);
    const randomColor = `hsl(${hue}, 100%, 50%)`;
    
    // Rastgele başlangıç pozisyonu
    const startPos = getRandomPosition();
    
    // Grid boyutuna göre pozisyonu ayarla
    const gridStartPos = {
        x: Math.floor(startPos.x / GAME_CONFIG.GRID_SIZE),
        y: Math.floor(startPos.y / GAME_CONFIG.GRID_SIZE)
    };
    
    // Yılanı başlangıç pozisyonuna yerleştir
    const snake = [
        { x: gridStartPos.x, y: gridStartPos.y },
        { x: gridStartPos.x - 1, y: gridStartPos.y },
        { x: gridStartPos.x - 2, y: gridStartPos.y }
    ];
    
    // Oyun durumunu sıfırla
    gameState = {
        ...gameState,
        localPlayer: {
            id: socket.id,
            name: nickname || 'Anonim',
            color: randomColor,
            snake: snake,
            direction: { x: 1, y: 0 },
            score: 0,
            skin: skinsList[currentSkinIndex]
        },
        otherPlayers: new Map(),
        foods: new Set(),
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        gameStarted: true
    };
    
    // Oyuna katıl
    socket.emit('join', {
        name: nickname,
        color: randomColor,
        snake: snake,
        skin: skinsList[currentSkinIndex]
    });
    
    // Oyun arayüzünü göster
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameCanvas').style.display = 'block';
    
    // Oyun döngüsünü başlat
    gameLoop();
}

// Yem oluşturma fonksiyonu
function spawnFood() {
    const pos = getRandomPosition();
    const randomValue = Math.random();
    let foodType = 'NORMAL';
    
    // %85 normal yem, %10 AI yem, %5 büyük yem
    if (randomValue > 0.95) {
        foodType = 'DEAD_SNAKE';
    } else if (randomValue > 0.85) {
        foodType = 'AI';
    }
    
    const foodConfig = GAME_CONFIG.FOOD_TYPES[foodType];
    
    const food = {
        x: Math.floor(pos.x / GAME_CONFIG.GRID_SIZE),
        y: Math.floor(pos.y / GAME_CONFIG.GRID_SIZE),
        type: foodType,
        points: foodConfig.POINTS,
        size: foodConfig.SIZE,
        color: foodConfig.COLOR,
        spawnTime: Date.now() // Animasyon için zaman damgası
    };
    
    gameState.foods.add(food);
    socket.emit('foodSpawned', food);
    return food;
}

// Yem çizimi
function drawFood(food) {
    const foodConfig = GAME_CONFIG.FOOD_TYPES[food.type || 'NORMAL'];
    const time = Date.now() / 1000;
    
    // Nabız efekti için boyut hesaplama
    const pulseEffect = Math.sin(time * foodConfig.PULSE_SPEED) * foodConfig.PULSE_SCALE;
    const baseSize = (food.size || foodConfig.SIZE) * GAME_CONFIG.GRID_SIZE;
    const size = baseSize * (1 + pulseEffect);
    
    ctx.save();
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.shadowColor = foodConfig.COLOR;
    ctx.fillStyle = foodConfig.COLOR;
    
    // Ana yem çizimi
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size / 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // Parlama efekti
    ctx.globalAlpha = 0.5 + Math.sin(time * foodConfig.PULSE_SPEED * 2) * 0.2;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size * 0.7,
        0,
        Math.PI * 2
    );
    ctx.fill();
    
    // İç halka
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(
        food.x * GAME_CONFIG.GRID_SIZE,
        food.y * GAME_CONFIG.GRID_SIZE,
        size * 0.3,
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
function drawSnake(ctx, snake, color, size = 1, skin = skins.DEFAULT) {
    if (!snake || snake.length === 0) return;

    ctx.save();
    
    // Yılan başını çiz
    const head = snake[0];
    const headX = head.x * GAME_CONFIG.GRID_SIZE;
    const headY = head.y * GAME_CONFIG.GRID_SIZE;
    const radius = (GAME_CONFIG.GRID_SIZE / 2) * size;

    // Görünüm efektlerini uygula
    if (skin.gradient) {
        const gradient = ctx.createLinearGradient(
            headX - radius, 
            headY - radius,
            headX + radius,
            headY + radius
        );
        gradient.addColorStop(0, skin.colors[0]);
        gradient.addColorStop(1, skin.colors[1]);
        ctx.fillStyle = gradient;
    } else if (skin.rainbow) {
        const hue = (Date.now() / 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    } else {
        ctx.fillStyle = skin.colors[0];
    }

    // Gölge efekti
    if (skin.glow) {
        ctx.shadowColor = skin.glowColor || color;
        ctx.shadowBlur = 20;
    }

    // Yılan gövdesini çiz
    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];
        const x = segment.x * GAME_CONFIG.GRID_SIZE;
        const y = segment.y * GAME_CONFIG.GRID_SIZE;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Segment bağlantılarını çiz
        if (i < snake.length - 1) {
            const nextSegment = snake[i + 1];
            const nextX = nextSegment.x * GAME_CONFIG.GRID_SIZE;
            const nextY = nextSegment.y * GAME_CONFIG.GRID_SIZE;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nextX, nextY);
            ctx.lineWidth = radius * 2;
            ctx.stroke();
        }
    }

    // Göz efekti
    if (skin.eyes) {
        const eyeRadius = radius * 0.2;
        const eyeOffset = radius * 0.3;
        
        // Sol göz
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(headX - eyeOffset, headY - eyeOffset, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Sağ göz
        ctx.beginPath();
        ctx.arc(headX + eyeOffset, headY - eyeOffset, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Göz bebekleri
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(headX - eyeOffset, headY - eyeOffset, eyeRadius * 0.5, 0, Math.PI * 2);
        ctx.arc(headX + eyeOffset, headY - eyeOffset, eyeRadius * 0.5, 0, Math.PI * 2);
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
        
        // Kamerayı güncelle
        camera.followPlayer();
        
        // Arkaplanı çiz
        drawBackground();
        
        // Dünya sınırlarını çiz
        drawWorldBorders();
        
        // Yemleri çiz
        gameState.foods.forEach(food => {
            if (isInViewArea(food)) {
                drawFood(food);
            }
        });
        
        // Diğer oyuncuları çiz
        gameState.otherPlayers.forEach(player => {
            if (isInViewArea(player.snake[0])) {
                drawSnake(ctx, player.snake, player.color, player.size, player.skin);
            }
        });
        
        // Yerel oyuncuyu çiz
        if (gameState.localPlayer) {
            drawSnake(ctx, gameState.localPlayer.snake, gameState.localPlayer.color, gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE, gameState.localPlayer.skin || 'DEFAULT');
        }
        
        // Mini haritayı çiz
        drawMinimap();
        
        lastTime = currentTime;
    }
    
    requestAnimationFrame(gameLoop);
}

// Oyun Mantığı Güncelleme
function updateGame() {
    if (!gameState.localPlayer || !gameState.gameStarted) return;
    
    // Yılanın yeni başını hesapla
    const head = gameState.localPlayer.snake[0];
    const nextHead = {
        x: head.x + gameState.direction.x,
        y: head.y + gameState.direction.y
    };
    
    // Sınır kontrolü
    if (nextHead.x < GAME_CONFIG.WORLD_BOUNDS.MIN_X / GAME_CONFIG.GRID_SIZE || 
        nextHead.x > GAME_CONFIG.WORLD_BOUNDS.MAX_X / GAME_CONFIG.GRID_SIZE || 
        nextHead.y < GAME_CONFIG.WORLD_BOUNDS.MIN_Y / GAME_CONFIG.GRID_SIZE || 
        nextHead.y > GAME_CONFIG.WORLD_BOUNDS.MAX_Y / GAME_CONFIG.GRID_SIZE) {
        gameOver();
        return;
    }
    
    // Yılanı güncelle
    gameState.localPlayer.snake.unshift(nextHead);
    gameState.localPlayer.snake.pop();
    
    // Sunucuya pozisyon güncellemesi gönder
    socket.emit('updatePosition', {
        snake: gameState.localPlayer.snake,
        score: gameState.localPlayer.score,
        skin: gameState.localPlayer.skin
    });
}

// Yem düşürme fonksiyonu
function dropFood(snake) {
    const foodCount = Math.min(snake.length, 10);
    const SAFE_MARGIN = 50;
    
    for (let i = 0; i < foodCount; i++) {
        // Ölen yılanın boyutuna göre yem değeri hesapla
        const points = Math.floor(
            GAME_CONFIG.FOOD_TYPES.DEAD_SNAKE.MIN_POINTS + 
            (snake.length / 10) * (GAME_CONFIG.FOOD_TYPES.DEAD_SNAKE.MAX_POINTS - GAME_CONFIG.FOOD_TYPES.DEAD_SNAKE.MIN_POINTS)
        );
        
        const food = {
            x: (Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X - 2 * SAFE_MARGIN) + 
               GAME_CONFIG.WORLD_BOUNDS.MIN_X + SAFE_MARGIN) / GAME_CONFIG.GRID_SIZE,
            y: (Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y - 2 * SAFE_MARGIN) + 
               GAME_CONFIG.WORLD_BOUNDS.MIN_Y + SAFE_MARGIN) / GAME_CONFIG.GRID_SIZE,
            type: 'DEAD_SNAKE',
            points: points,
            size: GAME_CONFIG.FOOD_TYPES.DEAD_SNAKE.SIZE
        };

        if (food.x * GAME_CONFIG.GRID_SIZE >= GAME_CONFIG.WORLD_BOUNDS.MIN_X &&
            food.x * GAME_CONFIG.GRID_SIZE <= GAME_CONFIG.WORLD_BOUNDS.MAX_X &&
            food.y * GAME_CONFIG.GRID_SIZE >= GAME_CONFIG.WORLD_BOUNDS.MIN_Y &&
            food.y * GAME_CONFIG.GRID_SIZE <= GAME_CONFIG.WORLD_BOUNDS.MAX_Y) {
            socket.emit('foodSpawned', food);
        }
    }
}

// Sunucudan gelen yem olaylarını dinle
socket.on('foodSpawned', (food) => {
    // Yem konumunun sınırlar içinde olduğunu kontrol et
    if (food.x * GAME_CONFIG.GRID_SIZE >= GAME_CONFIG.WORLD_BOUNDS.MIN_X &&
        food.x * GAME_CONFIG.GRID_SIZE <= GAME_CONFIG.WORLD_BOUNDS.MAX_X &&
        food.y * GAME_CONFIG.GRID_SIZE >= GAME_CONFIG.WORLD_BOUNDS.MIN_Y &&
        food.y * GAME_CONFIG.GRID_SIZE <= GAME_CONFIG.WORLD_BOUNDS.MAX_Y) {
        gameState.foods.add(food);
    }
});

// Çizim İşlemleri
function draw() {
    if (!gameState.gameStarted) return;
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Kamera transformasyonu
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    
    // Oyun alanı sınırlarını çiz
    drawWorldBorders(ctx);
    
    // Yemleri çiz
    gameState.foods.forEach(food => {
        if (isInViewArea(food)) {
            drawFood(ctx, food);
        }
    });
    
    // Diğer oyuncuları çiz
    gameState.otherPlayers.forEach(player => {
        if (player.snake && player.snake.length > 0 && isInViewArea(player.snake[0])) {
            drawSnake(ctx, player.snake, player.color, player.size || GAME_CONFIG.INITIAL_SNAKE_SIZE, player.skin);
        }
    });
    
    // Yerel oyuncuyu çiz
    if (gameState.localPlayer) {
        drawSnake(
            ctx,
            gameState.localPlayer.snake,
            gameState.localPlayer.color,
            gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE,
            gameState.localPlayer.skin
        );
    }
    
    ctx.restore();
    
    // Mini haritayı güncelle
    updateMinimap();
}

// Arkaplan renk paleti
const COLOR_PALETTES = [
    ['#1a0033', '#000066', '#003300'],
    ['#330033', '#660066', '#990099'],
    ['#003366', '#006699', '#0099cc'],
    ['#660000', '#990000', '#cc0000'],
    ['#006633', '#009933', '#00cc33']
];

let currentPaletteIndex = 0;
let lastPaletteChangeTime = Date.now();
const PALETTE_CHANGE_INTERVAL = 5000; // Her 5 saniyede bir renk değiştir

// Arkaplan çizimi
function drawBackground() {
    ctx.save();
    ctx.resetTransform();
    
    const currentTime = Date.now();
    if (currentTime - lastPaletteChangeTime > PALETTE_CHANGE_INTERVAL) {
        currentPaletteIndex = (currentPaletteIndex + 1) % COLOR_PALETTES.length;
        lastPaletteChangeTime = currentTime;
    }
    
    // Geçerli ve bir sonraki palet
    const currentPalette = COLOR_PALETTES[currentPaletteIndex];
    const nextPaletteIndex = (currentPaletteIndex + 1) % COLOR_PALETTES.length;
    const nextPalette = COLOR_PALETTES[nextPaletteIndex];
    
    // Geçiş için interpolasyon faktörü (0-1 arası)
    const transitionProgress = (currentTime - lastPaletteChangeTime) / PALETTE_CHANGE_INTERVAL;
    
    // Renkleri karıştır
    const interpolatedColors = currentPalette.map((color, i) => {
        const rgb1 = hexToRgb(color);
        const rgb2 = hexToRgb(nextPalette[i]);
        return interpolateColors(rgb1, rgb2, transitionProgress);
    });
    
    // Gradyan oluştur
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    interpolatedColors.forEach((color, i) => {
        gradient.addColorStop(i / (interpolatedColors.length - 1), color);
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.restore();
}

// Hex renk kodunu RGB'ye çevir
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// İki renk arasında interpolasyon yap
function interpolateColors(color1, color2, factor) {
    if (!color1 || !color2) return 'rgb(0,0,0)';
    
    const r = Math.round(color1.r + (color2.r - color1.r) * factor);
    const g = Math.round(color1.g + (color2.g - color1.g) * factor);
    const b = Math.round(color1.b + (color2.b - color1.b) * factor);
    
    return `rgb(${r},${g},${b})`;
}

// Mini haritayı güncelle
function updateMinimap() {
    const minimap = document.getElementById('minimap');
    const minimapCtx = minimap.getContext('2d');
    const minimapSize = 150;
    
    // Mini harita boyutunu ayarla
    minimap.width = minimapSize;
    minimap.height = minimapSize;
    
    // Mini haritayı temizle
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    minimapCtx.fillRect(0, 0, minimapSize, minimapSize);
    
    // Dünya sınırlarını çiz
    const worldScale = minimapSize / (GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X);
    
    minimapCtx.strokeStyle = '#ff0000';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, minimapSize, minimapSize);
    
    // Yem alanını çiz
    const foodAreaMinX = (GAME_CONFIG.FOOD_AREA.MIN_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
    const foodAreaMinY = (GAME_CONFIG.FOOD_AREA.MIN_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
    const foodAreaWidth = (GAME_CONFIG.FOOD_AREA.MAX_X - GAME_CONFIG.FOOD_AREA.MIN_X) * worldScale;
    const foodAreaHeight = (GAME_CONFIG.FOOD_AREA.MAX_Y - GAME_CONFIG.FOOD_AREA.MIN_Y) * worldScale;
    
    minimapCtx.strokeStyle = '#00ff00';
    minimapCtx.strokeRect(foodAreaMinX, foodAreaMinY, foodAreaWidth, foodAreaHeight);
    
    // Yemleri çiz
    gameState.foods.forEach(food => {
        const foodX = (food.x * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
        const foodY = (food.y * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
        
        if (food.type === 'DEAD_SNAKE') {
            minimapCtx.fillStyle = GAME_CONFIG.FOOD_TYPES.DEAD_SNAKE.COLOR;
            minimapCtx.fillRect(foodX - 2, foodY - 2, 4, 4);
        } else if (food.type === 'AI') {
            minimapCtx.fillStyle = GAME_CONFIG.FOOD_TYPES.AI.COLOR;
            minimapCtx.fillRect(foodX - 1.5, foodY - 1.5, 3, 3);
        } else {
            minimapCtx.fillStyle = GAME_CONFIG.FOOD_TYPES.NORMAL.COLOR;
            minimapCtx.fillRect(foodX - 1, foodY - 1, 2, 2);
        }
    });
    
    // Diğer oyuncuları çiz
    gameState.otherPlayers.forEach(player => {
        if (player.snake && player.snake.length > 0) {
            minimapCtx.fillStyle = player.color;
            const head = player.snake[0];
            const headX = (head.x * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
            const headY = (head.y * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
            minimapCtx.fillRect(headX - 2, headY - 2, 4, 4);
            
            // Yılan izini çiz
            minimapCtx.strokeStyle = player.color;
            minimapCtx.lineWidth = 1;
            minimapCtx.beginPath();
            player.snake.forEach((segment, index) => {
                const x = (segment.x * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
                const y = (segment.y * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
                if (index === 0) {
                    minimapCtx.moveTo(x, y);
                } else {
                    minimapCtx.lineTo(x, y);
                }
            });
            minimapCtx.stroke();
        }
    });
    
    // Yerel oyuncuyu çiz
    if (gameState.localPlayer && gameState.localPlayer.snake.length > 0) {
        minimapCtx.fillStyle = gameState.localPlayer.color;
        const head = gameState.localPlayer.snake[0];
        const headX = (head.x * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
        const headY = (head.y * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
        minimapCtx.fillRect(headX - 3, headY - 3, 6, 6);
        
        // Yerel oyuncunun izini çiz
        minimapCtx.strokeStyle = gameState.localPlayer.color;
        minimapCtx.lineWidth = 2;
        minimapCtx.beginPath();
        gameState.localPlayer.snake.forEach((segment, index) => {
            const x = (segment.x * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_X) * worldScale;
            const y = (segment.y * GAME_CONFIG.GRID_SIZE - GAME_CONFIG.WORLD_BOUNDS.MIN_Y) * worldScale;
            if (index === 0) {
                minimapCtx.moveTo(x, y);
            } else {
                minimapCtx.lineTo(x, y);
            }
        });
        minimapCtx.stroke();
        
        // Görüş alanını çiz
        minimapCtx.strokeStyle = '#ffffff';
        minimapCtx.lineWidth = 1;
        minimapCtx.setLineDash([2, 2]);
        const viewDistance = GAME_CONFIG.RENDER_DISTANCE * GAME_CONFIG.GRID_SIZE * worldScale;
        minimapCtx.strokeRect(
            headX - viewDistance,
            headY - viewDistance,
            viewDistance * 2,
            viewDistance * 2
        );
        minimapCtx.setLineDash([]);
        
        // Aktif power-up'ları göster
        let powerupY = minimapSize - 20;
        activePowerups.forEach((powerup, id) => {
            const timeLeft = (powerup.startTime + powerup.duration - Date.now()) / 1000;
            if (timeLeft > 0) {
                minimapCtx.fillStyle = GAME_CONFIG.POWERUPS[powerup.type].color;
                minimapCtx.fillRect(5, powerupY, 10, 10);
                minimapCtx.fillStyle = '#fff';
                minimapCtx.font = '10px Arial';
                minimapCtx.fillText(`${Math.ceil(timeLeft)}s`, 20, powerupY + 8);
                powerupY -= 15;
            }
        });
    }
}

// Grid çizimi
function drawGrid() {
    const gridSize = GAME_CONFIG.GRID_SIZE * 10;
    const startX = Math.floor(GAME_CONFIG.WORLD_BOUNDS.MIN_X / gridSize) * gridSize;
    const startY = Math.floor(GAME_CONFIG.WORLD_BOUNDS.MIN_Y / gridSize) * gridSize;
    const endX = GAME_CONFIG.WORLD_BOUNDS.MAX_X;
    const endY = GAME_CONFIG.WORLD_BOUNDS.MAX_Y;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Dikey çizgiler
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
        ctx.lineTo(x, endY);
    }
    
    // Yatay çizgiler
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, y);
        ctx.lineTo(endX, y);
    }
    
    ctx.stroke();
}

// Oyuncu Listesini Güncelle
function updatePlayerList() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '<h3>Oyuncular</h3>';
    
    if (gameState.localPlayer) {
        const div = document.createElement('div');
        div.style.color = gameState.localPlayer.color;
        div.textContent = `${gameState.localPlayer.name} (Sen)`;
        playerList.appendChild(div);
    }
    
    for (const [id, player] of gameState.otherPlayers) {
        const div = document.createElement('div');
        div.style.color = player.color;
        div.textContent = player.name;
        playerList.appendChild(div);
    }
    
    document.getElementById('players').textContent = 
        `OYUNCULAR: ${gameState.otherPlayers.size + (gameState.localPlayer ? 1 : 0)}`;
}

// Oyun Bitişi
function gameOver() {
    gameState.gameStarted = false;
    if (gameState.gameLoop) {
        clearTimeout(gameState.gameLoop);
        gameState.gameLoop = null;
    }
    
    // Yılanın ölümünden sonra kısa bir gecikme ile anasayfaya yönlendir
    setTimeout(() => {
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('menu-container').style.display = 'block';
        document.getElementById('gameCanvas').style.display = 'none';
        document.getElementById('nickname').value = '';
        
        // Oyun durumunu sıfırla
        gameState = {
            localPlayer: null,
            otherPlayers: new Map(),
            foods: new Set(),
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            score: 0,
            gameLoop: null,
            gameStarted: false,
            isMobile: gameState.isMobile
        };
    }, 1000); // 1 saniye gecikme
}

// Socket.IO Event Handlers
socket.on('playerJoined', (player) => {
    if (player.id !== socket.id) {
        gameState.otherPlayers.set(player.id, {
            ...player,
            skin: player.skin || skins.DEFAULT
        });
        updatePlayerList();
    }
});

socket.on('playerLeft', (playerId) => {
    gameState.otherPlayers.delete(playerId);
    updatePlayerList();
});

socket.on('playerMoved', (data) => {
    const player = gameState.otherPlayers.get(data.id);
    if (player) {
        player.snake = data.snake;
        player.score = data.score;
        player.skin = data.skin;
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
    scale: 1,
    targetScale: 1,
    
    followPlayer: function() {
        if (!gameState.localPlayer || !gameState.localPlayer.snake[0]) return;
        
        const head = gameState.localPlayer.snake[0];
        const targetX = -head.x * GAME_CONFIG.GRID_SIZE * this.scale + canvas.width / 2;
        const targetY = -head.y * GAME_CONFIG.GRID_SIZE * this.scale + canvas.height / 2;
        
        // Yumuşak kamera hareketi
        this.x += (targetX - this.x) * GAME_CONFIG.CAMERA_SMOOTH_FACTOR;
        this.y += (targetY - this.y) * GAME_CONFIG.CAMERA_SMOOTH_FACTOR;
        
        // Yumuşak zoom değişimi
        this.scale += (this.targetScale - this.scale) * GAME_CONFIG.CAMERA_SMOOTH_FACTOR;
        
        ctx.setTransform(this.scale, 0, 0, this.scale, this.x, this.y);
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

// Görüş alanı kontrolü
function isInViewArea(position) {
    if (!gameState.localPlayer || !position) return false;
    
    const head = gameState.localPlayer.snake[0];
    const renderDistance = GAME_CONFIG.RENDER_DISTANCE * GAME_CONFIG.GRID_SIZE;
    
    return Math.abs(position.x * GAME_CONFIG.GRID_SIZE - head.x * GAME_CONFIG.GRID_SIZE) <= renderDistance &&
           Math.abs(position.y * GAME_CONFIG.GRID_SIZE - head.y * GAME_CONFIG.GRID_SIZE) <= renderDistance;
}

// Dünya sınırlarını çiz
function drawWorldBorders(ctx) {
    ctx.save();
    
    // Sınır çizgisi stili
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]); // Kesikli çizgi
    
    // Dünya sınırlarını çiz
    ctx.beginPath();
    ctx.rect(
        GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MIN_Y,
        GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y
    );
    ctx.stroke();
    
    // Yem alanı sınırlarını çiz
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.rect(
        GAME_CONFIG.FOOD_AREA.MIN_X,
        GAME_CONFIG.FOOD_AREA.MIN_Y,
        GAME_CONFIG.FOOD_AREA.MAX_X - GAME_CONFIG.FOOD_AREA.MIN_X,
        GAME_CONFIG.FOOD_AREA.MAX_Y - GAME_CONFIG.FOOD_AREA.MIN_Y
    );
    ctx.stroke();
    
    ctx.restore();
}

// Socket.IO Event Handlers ekle
socket.on('killPlayer', (playerId) => {
    const player = gameState.otherPlayers.get(playerId);
    if (player) {
        dropFood(player.snake);
        gameState.otherPlayers.delete(playerId);
        updatePlayerList();
    }
});

// Çarpışma kontrolü güncelleme
function checkCollision(snake1, snake2, size1, size2) {
    if (!snake1 || !snake2 || snake1.length === 0 || snake2.length === 0) return false;
    
    const head1 = snake1[0];
    const collisionDistance = (size1 + size2) / 2;
    
    for (let i = 0; i < snake2.length; i++) {
        const segment = snake2[i];
        const distance = Math.sqrt(
            Math.pow(head1.x - segment.x, 2) +
            Math.pow(head1.y - segment.y, 2)
        );
        
        if (distance < collisionDistance) {
            // Baş başa çarpışma kontrolü
            if (i === 0) {
                // Büyük olan yılan kazanır
                return size1 > size2 ? 'win' : 'lose';
            }
            // Gövdeye çarpışma
            return 'lose';
        }
    }
    
    return false;
}

// Power-up yönetimi
let activePowerups = new Map();

function spawnPowerup() {
    const pos = getRandomPosition();
    const powerupTypes = Object.keys(GAME_CONFIG.POWERUPS);
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    const powerup = {
        x: pos.x / GAME_CONFIG.GRID_SIZE,
        y: pos.y / GAME_CONFIG.GRID_SIZE,
        type: type,
        config: GAME_CONFIG.POWERUPS[type],
        spawnTime: Date.now()
    };
    
    socket.emit('powerupSpawned', powerup);
    return powerup;
}

function applyPowerup(type) {
    const config = GAME_CONFIG.POWERUPS[type];
    const powerupId = Date.now();
    
    activePowerups.set(powerupId, {
        type: type,
        startTime: Date.now(),
        duration: config.duration
    });
    
    // Power-up efektlerini uygula
    switch(config.effect) {
        case 'invulnerable':
            gameState.localPlayer.isInvulnerable = true;
            break;
        case 'speed_boost':
            gameState.localPlayer.speedMultiplier = 1.5;
            break;
        case 'ghost_mode':
            gameState.localPlayer.skin = 'GHOST';
            break;
    }
    
    // Power-up süresini takip et
    setTimeout(() => {
        removePowerup(powerupId);
    }, config.duration);
}

function removePowerup(powerupId) {
    const powerup = activePowerups.get(powerupId);
    if (!powerup) return;
    
    // Power-up efektlerini kaldır
    switch(GAME_CONFIG.POWERUPS[powerup.type].effect) {
        case 'invulnerable':
            gameState.localPlayer.isInvulnerable = false;
            break;
        case 'speed_boost':
            gameState.localPlayer.speedMultiplier = 1;
            break;
        case 'ghost_mode':
            gameState.localPlayer.skin = 'DEFAULT';
            break;
    }
    
    activePowerups.delete(powerupId);
}

// Yılan görünümleri
const skins = {
    DEFAULT: {
        name: "Klasik",
        colors: ["#00ff00"],
        eyes: true,
        glow: true,
        glowColor: "#00ff00"
    },
    NEON: {
        name: "Neon",
        colors: ["#ff00ff", "#00ffff"],
        gradient: true,
        eyes: true,
        glow: true,
        glowColor: "#ff00ff"
    },
    RAINBOW: {
        name: "Gökkuşağı",
        colors: ["#ff0000"],
        rainbow: true,
        eyes: true,
        glow: true
    },
    GHOST: {
        name: "Hayalet",
        colors: ["rgba(255, 255, 255, 0.7)"],
        eyes: true,
        glow: true,
        glowColor: "#ffffff"
    },
    GOLDEN: {
        name: "Altın",
        colors: ["#ffd700", "#ffa500"],
        gradient: true,
        eyes: true,
        glow: true,
        glowColor: "#ffd700"
    }
};

let currentSkinIndex = 0;
const skinsList = Object.values(skins);

// Görünüm seçim ekranı elementleri
const skinSelector = document.getElementById('skinSelector');
const skinCanvas = document.getElementById('skinPreview');
const skinCtx = skinCanvas.getContext('2d');
const prevSkinBtn = document.getElementById('prevSkin');
const nextSkinBtn = document.getElementById('nextSkin');
const selectSkinBtn = document.getElementById('selectSkin');
const skinNameDisplay = document.getElementById('skinName');

// Görünüm seçim ekranını başlat
function initSkinSelector() {
    // Canvas boyutunu ayarla
    skinCanvas.width = 200;
    skinCanvas.height = 200;
    
    // Butonlara tıklama olaylarını ekle
    document.getElementById('skinButton').addEventListener('click', () => {
        skinSelector.style.display = 'flex';
        drawSkinPreview();
    });
    
    prevSkinBtn.addEventListener('click', () => {
        currentSkinIndex = (currentSkinIndex - 1 + skinsList.length) % skinsList.length;
        drawSkinPreview();
    });
    
    nextSkinBtn.addEventListener('click', () => {
        currentSkinIndex = (currentSkinIndex + 1) % skinsList.length;
        drawSkinPreview();
    });
    
    selectSkinBtn.addEventListener('click', () => {
        if (gameState.localPlayer) {
            gameState.localPlayer.skin = skinsList[currentSkinIndex];
        }
        skinSelector.style.display = 'none';
    });
    
    // Escape tuşuna basıldığında görünüm seçiciyi kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && skinSelector.style.display === 'flex') {
            skinSelector.style.display = 'none';
        }
    });
}

// Görünüm önizlemesini çiz
function drawSkinPreview() {
    const skin = skinsList[currentSkinIndex];
    skinNameDisplay.textContent = skin.name;
    
    // Canvas'ı temizle
    skinCtx.clearRect(0, 0, skinCanvas.width, skinCanvas.height);
    
    // Örnek bir yılan çiz
    const previewSnake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 }
    ];
    
    // Yılanı ortala
    skinCtx.save();
    skinCtx.translate(skinCanvas.width / 2 - 100, skinCanvas.height / 2 - 100);
    drawSnake(skinCtx, previewSnake, skin.colors[0], 2, skin);
    skinCtx.restore();
}

// Oyun başladığında görünüm seçiciyi başlat
window.addEventListener('load', initSkinSelector); 