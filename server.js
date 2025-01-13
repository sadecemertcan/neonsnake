const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 10000,
    cookie: false
});

// CORS ayarları
app.use(express.static('public'));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Oyun sabitleri
const GRID_SIZE = 20;
const WORLD_BOUNDS = {
    MIN_X: -1000,
    MAX_X: 1000,
    MIN_Y: -1000,
    MAX_Y: 1000
};

// Oyun durumu
const gameState = {
    players: new Map(),
    foods: new Set(),
    powerups: new Set(),
    foodArea: {
        MIN_X: WORLD_BOUNDS.MIN_X + 100,
        MAX_X: WORLD_BOUNDS.MAX_X - 100,
        MIN_Y: WORLD_BOUNDS.MIN_Y + 100,
        MAX_Y: WORLD_BOUNDS.MAX_Y - 100
    }
};

// Yem oluşturma fonksiyonu
function spawnFood() {
    const food = {
        x: Math.random() * (gameState.foodArea.MAX_X - gameState.foodArea.MIN_X) + gameState.foodArea.MIN_X,
        y: Math.random() * (gameState.foodArea.MAX_Y - gameState.foodArea.MIN_Y) + gameState.foodArea.MIN_Y,
        value: 1,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };
    gameState.foods.add(food);
    io.emit('foodSpawned', Array.from(gameState.foods));
    return food;
}

// Power-up oluşturma fonksiyonu
function spawnPowerup() {
    const powerup = {
        x: Math.random() * (gameState.foodArea.MAX_X - gameState.foodArea.MIN_X) + gameState.foodArea.MIN_X,
        y: Math.random() * (gameState.foodArea.MAX_Y - gameState.foodArea.MIN_Y) + gameState.foodArea.MIN_Y,
        type: Math.random() > 0.6 ? 'SHIELD' : Math.random() > 0.3 ? 'SPEED' : 'GHOST',
        spawnTime: Date.now()
    };
    gameState.powerups.add(powerup);
    io.emit('powerupSpawned', Array.from(gameState.powerups));
    return powerup;
}

// Düzenli aralıklarla power-up oluştur
setInterval(() => {
    if (gameState.powerups.size < 5) {
        spawnPowerup();
    }
}, 15000);

// Başlangıçta 500 yem oluştur
for (let i = 0; i < 500; i++) {
    spawnFood();
}

// Bağlantı yönetimi için Set
const connectedClients = new Set();

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);
    connectedClients.add(socket.id);
    console.log('Aktif oyuncu sayısı:', connectedClients.size);
    
    // Oyuncu katılma
    socket.on('join', (data) => {
        const player = {
            id: socket.id,
            name: data.name,
            snake: data.snake,
            color: data.color,
            score: 0,
            skin: data.skin || 'DEFAULT'
        };
        
        gameState.players.set(socket.id, player);
        socket.emit('gameState', {
            players: Array.from(gameState.players.values()),
            foods: Array.from(gameState.foods)
        });
        
        // Diğer oyunculara yeni oyuncuyu bildir
        socket.broadcast.emit('playerJoined', player);
    });
    
    // Oyuncu hareketi
    socket.on('updatePosition', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.snake = data.snake;
            player.score = data.score;
            player.skin = data.skin;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                snake: data.snake,
                score: data.score,
                skin: data.skin
            });
            updateLeaderboard();
        }
    });
    
    // Yem yeme
    socket.on('foodEaten', (food) => {
        let foodFound = false;
        gameState.foods.forEach(f => {
            if (f.x === food.x && f.y === food.y) {
                gameState.foods.delete(f);
                foodFound = true;
                
                // Yeni yem oluştur
                const newFood = createFood();
                gameState.foods.add(newFood);
                io.emit('foodSpawned', Array.from(gameState.foods));
            }
        });
    });
    
    // Yeni yem oluşturma
    socket.on('foodSpawned', (food) => {
        gameState.foods.add(food);
        io.emit('foodSpawned', Array.from(gameState.foods));
    });
    
    // Oyuncu ayrılma
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        connectedClients.delete(socket.id);
        console.log('Aktif oyuncu sayısı:', connectedClients.size);
        gameState.players.delete(socket.id);
        io.emit('playerLeft', socket.id);
        updateLeaderboard();
    });
    
    // Oyuncu öldürme
    socket.on('killPlayer', (targetId) => {
        const target = gameState.players.get(targetId);
        if (target) {
            // Ölen yılanın boyutuna göre yem düşür
            const foodCount = Math.ceil(target.score / 10); // Her 10 puan için 1 yem
            for (let i = 0; i < foodCount; i++) {
                const segment = target.snake[Math.floor(Math.random() * target.snake.length)];
                if (segment) {
                    const food = {
                        x: segment.x,
                        y: segment.y,
                        type: 'DEAD_SNAKE',
                        points: Math.min(50, Math.max(10, Math.floor(target.score / foodCount))),
                        size: 1.2
                    };
                    gameState.foods.add(food);
                    io.emit('foodSpawned', food);
                }
            }
            
            // Oyuncuyu oyundan çıkar
            gameState.players.delete(targetId);
            io.emit('playerLeft', targetId);
        }
    });
    
    // Power-up toplama
    socket.on('powerupCollected', (powerupData) => {
        for (const p of gameState.powerups) {
            if (p.x === powerupData.x && p.y === powerupData.y) {
                gameState.powerups.delete(p);
                socket.emit('powerupActivated', p.type);
                io.emit('powerupSpawned', Array.from(gameState.powerups));
                break;
            }
        }
    });
});

// Skor tablosunu güncelle
function updateLeaderboard() {
    const leaderboard = Array.from(gameState.players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    io.emit('leaderboardUpdate', leaderboard);
}

// Yeni yem oluşturma fonksiyonu
function createFood() {
    const SAFE_MARGIN = 100; // Kenarlardan güvenli mesafe
    const foodTypes = ['NORMAL', 'AI', 'DEAD_SNAKE'];
    const weights = [0.85, 0.1, 0.05]; // Yem tiplerinin oluşma olasılıkları
    
    // Rastgele yem tipi seç
    let randomValue = Math.random();
    let selectedType = foodTypes[0];
    let cumulativeWeight = 0;
    
    for (let i = 0; i < foodTypes.length; i++) {
        cumulativeWeight += weights[i];
        if (randomValue <= cumulativeWeight) {
            selectedType = foodTypes[i];
            break;
        }
    }
    
    // Yem özelliklerini belirle
    let points = 1;
    let size = 0.8;
    
    switch (selectedType) {
        case 'AI':
            points = 3;
            size = 1;
            break;
        case 'DEAD_SNAKE':
            points = Math.floor(Math.random() * 16) + 5; // 5-20 arası
            size = 1.2;
            break;
    }
    
    // Yem pozisyonunu belirle
    const x = Math.floor((Math.random() * (gameState.foodArea.MAX_X - gameState.foodArea.MIN_X - 2 * SAFE_MARGIN) + 
                         gameState.foodArea.MIN_X + SAFE_MARGIN) / GRID_SIZE);
    const y = Math.floor((Math.random() * (gameState.foodArea.MAX_Y - gameState.foodArea.MIN_Y - 2 * SAFE_MARGIN) + 
                         gameState.foodArea.MIN_Y + SAFE_MARGIN) / GRID_SIZE);
    
    return {
        x,
        y,
        type: selectedType,
        points,
        size
    };
}

// Başlangıç yemlerini oluştur
const INITIAL_FOOD_COUNT = 25;
for (let i = 0; i < INITIAL_FOOD_COUNT; i++) {
    const food = createFood();
    gameState.foods.add(food);
}

// Sunucuyu başlat
const port = process.env.PORT || 3001;
http.listen(port, () => {
    console.log('Sunucu ' + port + ' portunda çalışıyor');
    console.log('Bağlantı adresleri:');
    const interfaces = require('os').networkInterfaces();
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            let address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                console.log('http://' + address.address + ':' + port);
            }
        }
    }
}); 