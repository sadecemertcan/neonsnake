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
    FOOD_SPAWN_INTERVAL: 2000,
    FOOD_SPAWN_RADIUS: 500,
    NEON_GLOW: 15,
    FOOD_COUNT: 100,
    FOOD_RESPAWN_TIME: 5000,
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

// Renk seçimi için değişken
let selectedColor = null;

// Renk seçimi için event listener'ları ekle
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        // Önceki seçimi kaldır
        document.querySelector('.color-option.selected')?.classList.remove('selected');
        // Yeni seçimi işaretle
        option.classList.add('selected');
        // Seçilen rengi kaydet
        selectedColor = option.dataset.color;
    });
});

// İlk rengi varsayılan olarak seç
document.querySelector('.color-option').click();

// Oyun başlatma butonunu dinle
document.getElementById('play-button').addEventListener('click', () => {
    const nickname = document.getElementById('nickname').value.trim();
    if (!nickname) {
        alert('Lütfen bir kullanıcı adı girin!');
        return;
    }
    if (!selectedColor) {
        alert('Lütfen bir renk seçin!');
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
    
    console.log('Oyun başlatılıyor...');
    
    // Seçilen rengi kullan
    const snakeColor = selectedColor;
    
    // Rastgele başlangıç pozisyonu
    const startPos = getRandomPosition();
    
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
            name: nickname,
            color: snakeColor,
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
        color: snakeColor,
        position: gridStartPos,
        score: 0
    });

    // Yapay zeka yılanlarını başlat
    initAISnakes();

    // Yem sistemini başlat
    startFoodSpawnSystem();
    
    // Oyun döngüsünü başlat
    if (!gameState.gameLoop) {
        gameState.gameLoop = requestAnimationFrame(gameLoop);
    }
}

// Yem oluşturma fonksiyonu
function spawnFood(nearPlayer = false) {
    let pos;
    if (nearPlayer && gameState.localPlayer) {
        // Yılanın etrafında rastgele bir konum seç
        const playerHead = gameState.localPlayer.snake[0];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * GAME_CONFIG.FOOD_SPAWN_RADIUS;
        pos = {
            x: playerHead.x + Math.cos(angle) * distance,
            y: playerHead.y + Math.sin(angle) * distance
        };
    } else {
        pos = getRandomPosition();
    }

    const randomValue = Math.random();
    let foodType = 'NORMAL';
    
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
        spawnTime: Date.now()
    };
    
    gameState.foods.add(food);
    socket.emit('foodSpawned', food);
    return food;
}

// Düzenli yem oluşturma sistemini ekle
function startFoodSpawnSystem() {
    // Başlangıç yemlerini oluştur
    for (let i = 0; i < GAME_CONFIG.FOOD_COUNT; i++) {
        spawnFood();
    }

    // Düzenli aralıklarla yem oluştur
    setInterval(() => {
        if (gameState.gameStarted && gameState.localPlayer) {
            spawnFood(true); // Yılanın etrafında yem oluştur
        }
    }, GAME_CONFIG.FOOD_SPAWN_INTERVAL);
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
    if (!gameState.localPlayer || !gameState.localPlayer.snake || gameState.localPlayer.snake.length === 0) return;

    const head = { ...gameState.localPlayer.snake[0] };
    const speed = GAME_CONFIG.SNAKE_SPEED;
    
    // Yönü normalize et
    const length = Math.sqrt(
        gameState.nextDirection.x * gameState.nextDirection.x +
        gameState.nextDirection.y * gameState.nextDirection.y
    );
    
    if (length === 0) return;
    
    const newX = head.x + (gameState.nextDirection.x / length) * speed;
    const newY = head.y + (gameState.nextDirection.y / length) * speed;
    
    // Dünya sınırlarını kontrol et
    if (newX <= GAME_CONFIG.WORLD_BOUNDS.MIN_X / GAME_CONFIG.GRID_SIZE || 
        newX >= GAME_CONFIG.WORLD_BOUNDS.MAX_X / GAME_CONFIG.GRID_SIZE ||
        newY <= GAME_CONFIG.WORLD_BOUNDS.MIN_Y / GAME_CONFIG.GRID_SIZE ||
        newY >= GAME_CONFIG.WORLD_BOUNDS.MAX_Y / GAME_CONFIG.GRID_SIZE) {
        gameOver();
        return;
    }

    const nextHead = { x: newX, y: newY };
    
    // Diğer yılanlarla çarpışma kontrolü
    let collision = false;
    gameState.otherPlayers.forEach(otherPlayer => {
        if (otherPlayer.snake && otherPlayer.snake.length > 0) {
            // Diğer yılanın her parçasıyla çarpışma kontrolü
            otherPlayer.snake.forEach((segment, index) => {
                const distance = Math.sqrt(
                    Math.pow(nextHead.x - segment.x, 2) +
                    Math.pow(nextHead.y - segment.y, 2)
                );
                
                // Çarpışma mesafesi yılan boyutlarına göre ayarlanır
                const collisionDistance = (gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE) / 2 +
                                       (otherPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE) / 2;
                
                if (distance < collisionDistance) {
                    // Eğer diğer yılanın başına çarptıysak, diğer yılan ölür
                    if (index === 0) {
                        socket.emit('killPlayer', otherPlayer.id);
                        // Ölen yılandan yemler düşür
                        dropFood(otherPlayer.snake);
                    } else {
                        // Eğer diğer yılanın gövdesine çarptıysak, biz ölürüz
                        collision = true;
                    }
                }
            });
        }
    });
    
    if (collision) {
        // Öldüğümüzde yemler düşür
        dropFood(gameState.localPlayer.snake);
        gameOver();
        return;
    }
    
    // Yılanı güncelle
    gameState.localPlayer.snake.unshift(nextHead);
    
    // Yem yeme kontrolü
    let foodEaten = false;
    gameState.foods.forEach(food => {
        const distance = Math.sqrt(
            Math.pow(nextHead.x - food.x, 2) +
            Math.pow(nextHead.y - food.y, 2)
        );
        
        const foodConfig = GAME_CONFIG.FOOD_TYPES[food.type || 'NORMAL'];
        const foodSize = (food.size || foodConfig.SIZE) * 2;
        
        if (distance < foodSize) {
            foodEaten = true;
            socket.emit('foodEaten', { x: food.x, y: food.y });
            gameState.foods.delete(food);
            
            // Yem tipine göre puan ve büyüme
            const points = food.points || foodConfig.POINTS;
            const growthAmount = points * GAME_CONFIG.SNAKE_GROWTH_RATE;
            
            gameState.localPlayer.score += points;
            gameState.localPlayer.size = (gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE) + growthAmount;
            
            // Yılanın uzunluğunu yemin puanının sekizde biri kadar artır
            for (let i = 0; i < Math.floor(points / 8); i++) {
                const tail = gameState.localPlayer.snake[gameState.localPlayer.snake.length - 1];
                gameState.localPlayer.snake.push({ ...tail });
            }
            
            // Kamera hedef zoom değerini yumuşak şekilde güncelle
            camera.targetScale = Math.max(
                GAME_CONFIG.MIN_CAMERA_ZOOM,
                camera.scale - (growthAmount / 8)
            );
        }
    });

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
        size: gameState.localPlayer.size || GAME_CONFIG.INITIAL_SNAKE_SIZE,
        color: gameState.localPlayer.color
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
    
    // Grid çiz
    drawGrid(ctx);
    
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

function drawGrid(ctx) {
    const gridSize = 50;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Yatay çizgiler
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Dikey çizgiler
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

function drawWorld(ctx, cameraPos) {
    // Dünyayı çizmek için gerekli kodları buraya ekle
}

function drawLocalSnake(ctx, cameraPos) {
    // Yerel oyuncunun yılanını çizmek için gerekli kodları buraya ekle
}

function drawOtherSnakes(ctx, cameraPos) {
    // Diğer yılanları çizmek için gerekli kodları buraya ekle
}

function drawWorld(ctx, cameraPos) {
    // Dünyayı çizmek için gerekli kodları buraya ekle
}

function drawLocalSnake(ctx, cameraPos) {
    // Yerel oyuncunun yılanını çizmek için gerekli kodları buraya ekle
}

function drawOtherSnakes(ctx, cameraPos) {
    // Diğer yılanları çizmek için gerekli kodları buraya ekle
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