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

// Oyun durumu
const gameState = {
    players: new Map(),
    foods: new Set(),
    foodArea: {
        MIN_X: -200,
        MAX_X: 200,
        MIN_Y: -200,
        MAX_Y: 200
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
    socket.on('playerJoin', (data) => {
        const player = {
            id: socket.id,
            name: data.name,
            color: data.color,
            snake: [
                { x: data.position.x, y: data.position.y },
                { x: data.position.x - 1, y: data.position.y },
                { x: data.position.x - 2, y: data.position.y }
            ],
            score: 0
        };
        
        gameState.players.set(socket.id, player);
        
        // Yeni oyuncuya mevcut durumu gönder
        socket.emit('foodSpawned', Array.from(gameState.foods));
        
        // Diğer oyunculara yeni oyuncuyu bildir
        socket.broadcast.emit('playerJoined', player);
        
        // Yeni oyuncuya diğer oyuncuları gönder
        for (const [id, otherPlayer] of gameState.players) {
            if (id !== socket.id) {
                socket.emit('playerJoined', otherPlayer);
            }
        }
        
        updateLeaderboard();
    });
    
    // Oyuncu hareketi
    socket.on('updatePosition', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.snake = data.snake;
            player.direction = data.direction;
            player.score = data.score;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                snake: player.snake,
                direction: player.direction
            });
            updateLeaderboard();
        }
    });
    
    // Yem yeme
    socket.on('foodEaten', (food) => {
        for (const f of gameState.foods) {
            if (f.x === food.x && f.y === food.y) {
                gameState.foods.delete(f);
                break;
            }
        }
        
        // 10 saniye sonra yeni yem oluştur
        setTimeout(spawnFood, 10000);
        
        // Tüm oyunculara güncel yem listesini gönder
        io.emit('foodSpawned', Array.from(gameState.foods));
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
    socket.on('killPlayer', (playerId) => {
        const killedPlayer = gameState.players.get(playerId);
        if (killedPlayer) {
            // Ölen oyuncunun yemlerini oluştur
            const snakeLength = killedPlayer.snake.length;
            const foodCount = Math.min(snakeLength, 10);
            
            for (let i = 0; i < foodCount; i++) {
                const food = {
                    x: killedPlayer.snake[i].x,
                    y: killedPlayer.snake[i].y,
                    type: 'DEAD_SNAKE',
                    points: Math.floor(snakeLength / foodCount),
                    size: 1.2
                };
                gameState.foods.add(food);
            }
            
            // Ölen oyuncuyu oyundan çıkar
            gameState.players.delete(playerId);
            io.emit('playerLeft', playerId);
            io.emit('foodSpawned', Array.from(gameState.foods));
            updateLeaderboard();
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