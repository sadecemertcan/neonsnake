// Canvas ve Ses Öğeleri
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
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
    if (!nickname) {
        alert('Lütfen bir kullanıcı adı girin!');
        return;
    }
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('gameCanvas').style.display = 'block';
    startGame(nickname);
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
    if (!nickname) return;
    
    console.log('Oyun başlatılıyor...');
    
    const hue = Math.floor(Math.random() * 360);
    const randomColor = `hsl(${hue}, 100%, 50%)`;
    
    // Başlangıç pozisyonunu dünya sınırları içinde ayarla
    const startPos = {
        x: Math.floor(GAME_CONFIG.WORLD_BOUNDS.MIN_X / GAME_CONFIG.GRID_SIZE) + 10,
        y: Math.floor(GAME_CONFIG.WORLD_BOUNDS.MIN_Y / GAME_CONFIG.GRID_SIZE) + 10
    };
    
    // Yılanı başlangıç pozisyonuna yerleştir
    const snake = [
        { x: startPos.x, y: startPos.y },
        { x: startPos.x - 1, y: startPos.y },
        { x: startPos.x - 2, y: startPos.y }
    ];
    
    // Oyun durumunu güncelle
    gameState = {
        ...gameState,
        localPlayer: {
            id: socket.id,
            name: nickname,
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
        name: nickname,
        color: randomColor,
        position: startPos,
        score: 0
    });

    // Oyun döngüsünü başlat
    if (!gameState.gameLoop) {
        gameState.gameLoop = requestAnimationFrame(gameLoop);
    }
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
function drawSnake(snake, color, size = GAME_CONFIG.INITIAL_SNAKE_SIZE, skin = 'DEFAULT') {
    if (!snake || snake.length === 0) return;
    
    const skinConfig = GAME_CONFIG.SNAKE_SKINS[skin];
    const time = Date.now() / 1000;
    
    ctx.save();
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.shadowColor = skinConfig.glowColor;
    
    // Yılan gövdesini çiz
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const segmentSize = size * GAME_CONFIG.GRID_SIZE;
        const progress = i / snake.length;
        
        // Desen seçimi
        switch(skinConfig.pattern) {
            case 'gradient':
                const gradient = ctx.createRadialGradient(
                    segment.x * GAME_CONFIG.GRID_SIZE, segment.y * GAME_CONFIG.GRID_SIZE, 0,
                    segment.x * GAME_CONFIG.GRID_SIZE, segment.y * GAME_CONFIG.GRID_SIZE, segmentSize
                );
                gradient.addColorStop(0, skinConfig.bodyColor);
                gradient.addColorStop(1, skinConfig.glowColor);
                ctx.fillStyle = gradient;
                break;
            
            case 'rainbow':
                const hue = (time * 50 + progress * 360) % 360;
                ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                break;
            
            case 'ghost':
                ctx.fillStyle = skinConfig.bodyColor;
                ctx.globalAlpha = 0.7 + Math.sin(time * 2 + progress * Math.PI) * 0.3;
                break;
            
            default:
                ctx.fillStyle = skinConfig.bodyColor;
        }
        
        // Segment çizimi
        ctx.beginPath();
        ctx.arc(
            segment.x * GAME_CONFIG.GRID_SIZE,
            segment.y * GAME_CONFIG.GRID_SIZE,
            segmentSize / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Baş kısmı için özel efektler
        if (i === 0) {
            const eyeSize = segmentSize * 0.2;
            const eyeOffset = segmentSize * 0.3;
            
            // Göz parlaması efekti
            const eyeGlow = Math.sin(time * 3) * 0.3 + 0.7;
            ctx.fillStyle = skinConfig.eyeColor;
            ctx.globalAlpha = eyeGlow;
            
            // Sol göz
            ctx.beginPath();
            ctx.arc(
                segment.x * GAME_CONFIG.GRID_SIZE - eyeOffset,
                segment.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
                eyeSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            // Sağ göz
            ctx.beginPath();
            ctx.arc(
                segment.x * GAME_CONFIG.GRID_SIZE + eyeOffset,
                segment.y * GAME_CONFIG.GRID_SIZE - eyeOffset,
                eyeSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
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
                drawSnake(player.snake, player.color, player.size, player.skin);
            }
        });
        
        // Yerel oyuncuyu çiz
        if (gameState.localPlayer) {
            drawSnake(
                gameState.localPlayer.snake,
                gameState.localPlayer.color,
                gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE,
                gameState.localPlayer.skin || 'DEFAULT'
            );
        }
        
        lastTime = currentTime;
    }
    
    requestAnimationFrame(gameLoop);
}

// Oyun Mantığı Güncelleme
function updateGame() {
    if (!gameState.localPlayer || !gameState.localPlayer.snake) return;

    // Yön güncellemesi
    gameState.localPlayer.direction = gameState.nextDirection;

    // Yılanın başını al
    const head = { ...gameState.localPlayer.snake[0] };

    // Yeni baş pozisyonunu hesapla
    const newHead = {
        x: head.x + gameState.localPlayer.direction.x,
        y: head.y + gameState.localPlayer.direction.y
    };

    // Dünya sınırlarını kontrol et
    if (newHead.x < GAME_CONFIG.WORLD_BOUNDS.MIN_X / GAME_CONFIG.GRID_SIZE ||
        newHead.x > GAME_CONFIG.WORLD_BOUNDS.MAX_X / GAME_CONFIG.GRID_SIZE ||
        newHead.y < GAME_CONFIG.WORLD_BOUNDS.MIN_Y / GAME_CONFIG.GRID_SIZE ||
        newHead.y > GAME_CONFIG.WORLD_BOUNDS.MAX_Y / GAME_CONFIG.GRID_SIZE) {
        gameOver();
        return;
    }

    // Yeni başı yılanın önüne ekle
    gameState.localPlayer.snake.unshift(newHead);

    // Yem kontrolü
    let foodEaten = false;
    gameState.foods.forEach(food => {
        if (Math.abs(food.x - newHead.x) < 1 && Math.abs(food.y - newHead.y) < 1) {
            // Yemi ye
            gameState.foods.delete(food);
            gameState.score += food.points || 1;
            foodEaten = true;
            
            // Skor güncellemesi
            document.getElementById('score').textContent = `SKOR: ${gameState.score}`;
            
            // Yeni yem oluştur
            spawnFood();
        }
    });

    // Eğer yem yemediyse kuyruğu kısalt
    if (!foodEaten) {
        gameState.localPlayer.snake.pop();
    }

    // Çarpışma kontrolü
    for (let i = 1; i < gameState.localPlayer.snake.length; i++) {
        const segment = gameState.localPlayer.snake[i];
        if (segment && newHead.x === segment.x && newHead.y === segment.y) {
            gameOver();
            return;
        }
    }

    // Diğer oyuncularla çarpışma kontrolü
    gameState.otherPlayers.forEach(player => {
        if (player.snake) {
            for (const segment of player.snake) {
                if (Math.abs(newHead.x - segment.x) < 1 && Math.abs(newHead.y - segment.y) < 1) {
                    gameOver();
                    return;
                }
            }
        }
    });

    // Sunucuya pozisyon güncellemesi gönder
    socket.emit('playerUpdate', {
        id: socket.id,
        snake: gameState.localPlayer.snake,
        score: gameState.score
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
            drawSnake(player.snake, player.color, player.size, player.skin);
        }
    }
    
    // Yerel oyuncuyu çiz
    if (gameState.localPlayer) {
        drawSnake(gameState.localPlayer.snake, gameState.localPlayer.color, gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE, gameState.localPlayer.skin || 'DEFAULT');
    }
    
    offscreenCtx.restore();
    
    // Offscreen canvas'ı ana canvas'a kopyala
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
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

// Mini-map ile ilgili tüm kodları kaldır
function render(timestamp) {
    if (!gameState.localPlayer) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Canvas boyutlarını güncelle
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Arkaplanı temizle
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Kamera pozisyonunu güncelle
    const cameraPos = {
        x: gameState.localPlayer.snake[0].x,
        y: gameState.localPlayer.snake[0].y
    };
    
    // Dünyayı çiz
    drawWorld(ctx, cameraPos);
    
    // Yemleri çiz
    drawFoods(ctx, cameraPos);
    
    // Diğer yılanları çiz
    drawOtherSnakes(ctx, cameraPos);
    
    // Yerel oyuncunun yılanını çiz
    drawLocalSnake(ctx, cameraPos);
    
    // Skor tablosunu çiz
    drawScoreboard(ctx);
    
    // Bir sonraki kareyi çiz
    requestAnimationFrame(render);
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
            id: player.id,
            name: player.name,
            color: player.color,
            snake: [player.position],
            score: player.score || 0
        });
        updatePlayerList();
    }
});

socket.on('playerLeft', (playerId) => {
    gameState.otherPlayers.delete(playerId);
    updatePlayerList();
});

socket.on('playerUpdate', (data) => {
    const player = gameState.otherPlayers.get(data.id);
    if (player) {
        player.snake = data.snake;
        player.score = data.score;
        player.name = data.name; // İsim güncellemesini ekle
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
    
    // Canvas boyutları değiştiğinde yeniden çiz
    if (gameState.gameStarted) {
        render(performance.now());
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Kamera pozisyonu
const camera = {
    x: 0,
    y: 0,
    scale: GAME_CONFIG.CAMERA_ZOOM,
    targetScale: GAME_CONFIG.CAMERA_ZOOM,
    
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

// Nesnenin görüş alanında olup olmadığını kontrol et
function isInViewArea(object) {
    if (!gameState.localPlayer || !gameState.localPlayer.snake[0]) return false;
    
    const head = gameState.localPlayer.snake[0];
    const distance = Math.sqrt(
        Math.pow((object.x - head.x) * GAME_CONFIG.GRID_SIZE, 2) +
        Math.pow((object.y - head.y) * GAME_CONFIG.GRID_SIZE, 2)
    );
    
    return distance <= GAME_CONFIG.RENDER_DISTANCE * GAME_CONFIG.GRID_SIZE;
}

// Dünya sınırlarını çiz
function drawWorldBorders() {
    ctx.save();
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.shadowColor = '#ff0000';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    
    // Sınır çizgilerini çiz
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MAX_X, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MAX_X, GAME_CONFIG.WORLD_BOUNDS.MAX_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, GAME_CONFIG.WORLD_BOUNDS.MAX_Y);
    ctx.closePath();
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

function drawScoreboard(ctx) {
    const padding = 20;
    const lineHeight = 25;
    const maxPlayers = 10;
    
    // Tüm oyuncuları bir diziye al ve skora göre sırala
    const allPlayers = Array.from(gameState.otherPlayers.values())
        .concat(gameState.localPlayer)
        .filter(player => player && player.name) // null olmayan ve ismi olan oyuncuları filtrele
        .sort((a, b) => b.score - a.score)
        .slice(0, maxPlayers);

    // Skor tablosu arkaplanı
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
        canvas.width - 200 - padding,
        padding,
        200,
        (allPlayers.length + 1) * lineHeight + padding
    );

    // Başlık
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(
        'Skor Tablosu',
        canvas.width - 180 - padding,
        padding + lineHeight
    );

    // Oyuncuları listele
    ctx.font = '14px Arial';
    allPlayers.forEach((player, index) => {
        const y = padding + (index + 2) * lineHeight;
        const isLocalPlayer = player.id === gameState.localPlayer.id;
        
        // Oyuncu rengi
        ctx.fillStyle = isLocalPlayer ? '#0f0' : '#fff';
        
        // Oyuncu adı ve skoru
        ctx.fillText(
            `${index + 1}. ${player.name}: ${player.score}`,
            canvas.width - 180 - padding,
            y
        );
    });

    ctx.restore();
}

function drawFoods(ctx, cameraPos) {
    gameState.foods.forEach(food => {
        const screenPos = worldToScreen(food.x, food.y, cameraPos);
        
        // Ekran dışındaysa çizme
        if (isOffscreen(screenPos.x, screenPos.y)) return;
        
        // Yem çizimi
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        
        // Yem parıltısı
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, GAME_CONFIG.FOOD_SIZE * 2);
        gradient.addColorStop(0, food.color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, GAME_CONFIG.FOOD_SIZE * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Yem merkezi
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(0, 0, GAME_CONFIG.FOOD_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// Grid çizimi
function drawGrid(ctx, cameraPos) {
    const gridSize = GAME_CONFIG.GRID_SIZE * 10;
    const startX = Math.floor(cameraPos.x / gridSize) * gridSize - canvas.width / 2;
    const startY = Math.floor(cameraPos.y / gridSize) * gridSize - canvas.height / 2;
    const endX = startX + canvas.width + gridSize;
    const endY = startY + canvas.height + gridSize;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1;

    // Dikey çizgiler
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }

    // Yatay çizgiler
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }

    ctx.stroke();
}

// Oyun alanını çiz
function drawWorld(ctx, cameraPos) {
    // Arkaplanı çiz
    drawBackground();
    
    // Grid çizimi
    drawGrid(ctx, cameraPos);
    
    // Dünya sınırlarını çiz
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MIN_Y,
        GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y
    );
}

// Dünya koordinatlarını ekran koordinatlarına çevir
function worldToScreen(worldX, worldY, cameraPos) {
    return {
        x: (worldX * GAME_CONFIG.GRID_SIZE) - (cameraPos.x * GAME_CONFIG.GRID_SIZE),
        y: (worldY * GAME_CONFIG.GRID_SIZE) - (cameraPos.y * GAME_CONFIG.GRID_SIZE)
    };
}

// Ekran dışında mı kontrol et
function isOffscreen(x, y) {
    const margin = 100; // Ekran kenarlarında biraz tolerans
    return (
        x < -margin ||
        x > canvas.width + margin ||
        y < -margin ||
        y > canvas.height + margin
    );
}

// Ekran koordinatlarını dünya koordinatlarına çevir
function screenToWorld(screenX, screenY, cameraPos) {
    return {
        x: (screenX + (cameraPos.x * GAME_CONFIG.GRID_SIZE)) / GAME_CONFIG.GRID_SIZE,
        y: (screenY + (cameraPos.y * GAME_CONFIG.GRID_SIZE)) / GAME_CONFIG.GRID_SIZE
    };
}

// Diğer yılanları çiz
function drawOtherSnakes(ctx, cameraPos) {
    if (!gameState.otherPlayers) return;
    
    gameState.otherPlayers.forEach(player => {
        if (!player.snake || player.snake.length === 0) return;
        
        // İlk segmenti kontrol et
        const head = player.snake[0];
        if (!head) return;
        
        // Ekran dışındaysa çizme
        const screenPos = worldToScreen(head.x, head.y, cameraPos);
        if (isOffscreen(screenPos.x, screenPos.y)) return;
        
        // Yılanı çiz
        drawSnake(ctx, player.snake, player.color);
    });
}

// Yerel yılanı çiz
function drawLocalSnake(ctx, cameraPos) {
    if (!gameState.localPlayer || !gameState.localPlayer.snake) return;
    drawSnake(ctx, gameState.localPlayer.snake, gameState.localPlayer.color);
}

// Yılan çizim fonksiyonu
function drawSnake(ctx, snake, color) {
    if (!snake || snake.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = GAME_CONFIG.SNAKE_SIZE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Gölge efekti
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.shadowColor = color;

    ctx.beginPath();
    
    // İlk noktayı ayarla
    const firstPos = snake[0];
    ctx.moveTo(firstPos.x * GAME_CONFIG.GRID_SIZE, firstPos.y * GAME_CONFIG.GRID_SIZE);

    // Diğer noktaları bağla
    for (let i = 1; i < snake.length; i++) {
        const pos = snake[i];
        ctx.lineTo(pos.x * GAME_CONFIG.GRID_SIZE, pos.y * GAME_CONFIG.GRID_SIZE);
    }

    ctx.stroke();
    ctx.restore();
}

// Render fonksiyonu
function render(timestamp) {
    if (!gameState.localPlayer) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Canvas boyutlarını güncelle
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Arkaplanı temizle
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Kamera pozisyonunu güncelle
    const cameraPos = {
        x: gameState.localPlayer.snake[0].x,
        y: gameState.localPlayer.snake[0].y
    };
    
    // Dünyayı çiz
    drawWorld(ctx, cameraPos);
    
    // Yemleri çiz
    drawFoods(ctx, cameraPos);
    
    // Diğer yılanları çiz
    drawOtherSnakes(ctx, cameraPos);
    
    // Yerel oyuncunun yılanını çiz
    drawLocalSnake(ctx, cameraPos);
    
    // Skor tablosunu çiz
    drawScoreboard(ctx);
    
    // Bir sonraki kareyi çiz
    requestAnimationFrame(render);
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
            id: player.id,
            name: player.name,
            color: player.color,
            snake: [player.position],
            score: player.score || 0
        });
        updatePlayerList();
    }
});

socket.on('playerLeft', (playerId) => {
    gameState.otherPlayers.delete(playerId);
    updatePlayerList();
});

socket.on('playerUpdate', (data) => {
    const player = gameState.otherPlayers.get(data.id);
    if (player) {
        player.snake = data.snake;
        player.score = data.score;
        player.name = data.name; // İsim güncellemesini ekle
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
    
    // Canvas boyutları değiştiğinde yeniden çiz
    if (gameState.gameStarted) {
        render(performance.now());
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Kamera pozisyonu
const camera = {
    x: 0,
    y: 0,
    scale: GAME_CONFIG.CAMERA_ZOOM,
    targetScale: GAME_CONFIG.CAMERA_ZOOM,
    
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

// Nesnenin görüş alanında olup olmadığını kontrol et
function isInViewArea(object) {
    if (!gameState.localPlayer || !gameState.localPlayer.snake[0]) return false;
    
    const head = gameState.localPlayer.snake[0];
    const distance = Math.sqrt(
        Math.pow((object.x - head.x) * GAME_CONFIG.GRID_SIZE, 2) +
        Math.pow((object.y - head.y) * GAME_CONFIG.GRID_SIZE, 2)
    );
    
    return distance <= GAME_CONFIG.RENDER_DISTANCE * GAME_CONFIG.GRID_SIZE;
}

// Dünya sınırlarını çiz
function drawWorldBorders() {
    ctx.save();
    ctx.shadowBlur = GAME_CONFIG.NEON_GLOW;
    ctx.shadowColor = '#ff0000';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    
    // Sınır çizgilerini çiz
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MAX_X, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MAX_X, GAME_CONFIG.WORLD_BOUNDS.MAX_Y);
    ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, GAME_CONFIG.WORLD_BOUNDS.MAX_Y);
    ctx.closePath();
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

function drawScoreboard(ctx) {
    const padding = 20;
    const lineHeight = 25;
    const maxPlayers = 10;
    
    // Tüm oyuncuları bir diziye al ve skora göre sırala
    const allPlayers = Array.from(gameState.otherPlayers.values())
        .concat(gameState.localPlayer)
        .filter(player => player && player.name) // null olmayan ve ismi olan oyuncuları filtrele
        .sort((a, b) => b.score - a.score)
        .slice(0, maxPlayers);

    // Skor tablosu arkaplanı
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
        canvas.width - 200 - padding,
        padding,
        200,
        (allPlayers.length + 1) * lineHeight + padding
    );

    // Başlık
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(
        'Skor Tablosu',
        canvas.width - 180 - padding,
        padding + lineHeight
    );

    // Oyuncuları listele
    ctx.font = '14px Arial';
    allPlayers.forEach((player, index) => {
        const y = padding + (index + 2) * lineHeight;
        const isLocalPlayer = player.id === gameState.localPlayer.id;
        
        // Oyuncu rengi
        ctx.fillStyle = isLocalPlayer ? '#0f0' : '#fff';
        
        // Oyuncu adı ve skoru
        ctx.fillText(
            `${index + 1}. ${player.name}: ${player.score}`,
            canvas.width - 180 - padding,
            y
        );
    });

    ctx.restore();
}

function drawFoods(ctx, cameraPos) {
    gameState.foods.forEach(food => {
        const screenPos = worldToScreen(food.x, food.y, cameraPos);
        
        // Ekran dışındaysa çizme
        if (isOffscreen(screenPos.x, screenPos.y)) return;
        
        // Yem çizimi
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        
        // Yem parıltısı
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, GAME_CONFIG.FOOD_SIZE * 2);
        gradient.addColorStop(0, food.color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, GAME_CONFIG.FOOD_SIZE * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Yem merkezi
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(0, 0, GAME_CONFIG.FOOD_SIZE, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// Grid çizimi
function drawGrid(ctx, cameraPos) {
    const gridSize = GAME_CONFIG.GRID_SIZE * 10;
    const startX = Math.floor(cameraPos.x / gridSize) * gridSize - canvas.width / 2;
    const startY = Math.floor(cameraPos.y / gridSize) * gridSize - canvas.height / 2;
    const endX = startX + canvas.width + gridSize;
    const endY = startY + canvas.height + gridSize;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.lineWidth = 1;

    // Dikey çizgiler
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }

    // Yatay çizgiler
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }

    ctx.stroke();
}

// Oyun alanını çiz
function drawWorld(ctx, cameraPos) {
    // Arkaplanı çiz
    drawBackground();
    
    // Grid çizimi
    drawGrid(ctx, cameraPos);
    
    // Dünya sınırlarını çiz
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MIN_Y,
        GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y
    );
}

// Dünya koordinatlarını ekran koordinatlarına çevir
function worldToScreen(worldX, worldY, cameraPos) {
    return {
        x: (worldX * GAME_CONFIG.GRID_SIZE) - (cameraPos.x * GAME_CONFIG.GRID_SIZE),
        y: (worldY * GAME_CONFIG.GRID_SIZE) - (cameraPos.y * GAME_CONFIG.GRID_SIZE)
    };
}

// Ekran dışında mı kontrol et
function isOffscreen(x, y) {
    const margin = 100; // Ekran kenarlarında biraz tolerans
    return (
        x < -margin ||
        x > canvas.width + margin ||
        y < -margin ||
        y > canvas.height + margin
    );
}

// Ekran koordinatlarını dünya koordinatlarına çevir
function screenToWorld(screenX, screenY, cameraPos) {
    return {
        x: (screenX + (cameraPos.x * GAME_CONFIG.GRID_SIZE)) / GAME_CONFIG.GRID_SIZE,
        y: (screenY + (cameraPos.y * GAME_CONFIG.GRID_SIZE)) / GAME_CONFIG.GRID_SIZE
    };
} 