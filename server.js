const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["*"]
    }
});

// Statik dosyaları serve et
app.use(express.static('public'));

// Oyun sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 20,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    },
    FOOD_COUNT: 200,
    FOOD_SPAWN_INTERVAL: 1000,
    FOOD_SIZE: 10
};

// Oyun durumu
const gameState = {
    players: new Map(),
    foods: new Set(),
    scores: new Map()
};

// Rastgele pozisyon oluştur
function getRandomPosition() {
    const margin = 100;
    return {
        x: Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X - margin * 2) + 
           GAME_CONFIG.WORLD_BOUNDS.MIN_X + margin,
        y: Math.random() * (GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y - margin * 2) + 
           GAME_CONFIG.WORLD_BOUNDS.MIN_Y + margin
    };
}

// Yem oluştur
function spawnFood() {
    const position = getRandomPosition();
    const food = {
        x: position.x,
        y: position.y,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };
    gameState.foods.add(food);
    io.emit('foodSpawned', Array.from(gameState.foods));
    return food;
}

// Başlangıç yemlerini oluştur
function initializeFoods() {
    gameState.foods.clear();
    for (let i = 0; i < GAME_CONFIG.FOOD_COUNT; i++) {
        spawnFood();
    }
}

// İlk yemleri oluştur
initializeFoods();

// Düzenli aralıklarla yem oluştur
setInterval(() => {
    if (gameState.foods.size < GAME_CONFIG.FOOD_COUNT) {
        spawnFood();
    }
}, GAME_CONFIG.FOOD_SPAWN_INTERVAL);

// Socket.IO bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);
    
    // Mevcut oyun durumunu gönder
    socket.emit('gameState', {
        players: Array.from(gameState.players.values()),
        foods: Array.from(gameState.foods)
    });
    
    // Oyuncu katılma
    socket.on('playerJoin', (player) => {
        console.log('Oyuncu katıldı:', player.name);
        gameState.players.set(socket.id, {
            ...player,
            id: socket.id,
            score: 0
        });
        io.emit('playerJoined', gameState.players.get(socket.id));
    });
    
    // Oyuncu hareketi
    socket.on('updatePosition', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            Object.assign(player, data);
            socket.broadcast.emit('playerMoved', player);
        }
    });
    
    // Yem yeme
    socket.on('foodEaten', (food) => {
        gameState.foods.forEach(f => {
            if (Math.abs(f.x - food.x) < GAME_CONFIG.FOOD_SIZE && 
                Math.abs(f.y - food.y) < GAME_CONFIG.FOOD_SIZE) {
                gameState.foods.delete(f);
                const player = gameState.players.get(socket.id);
                if (player) {
                    player.score += 1;
                }
                spawnFood();
                io.emit('foodSpawned', Array.from(gameState.foods));
            }
        });
    });
    
    // Bağlantı kopması
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        gameState.players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 