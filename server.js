const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Oyun durumu
const gameState = {
    players: new Map(),
    foods: new Set(),
    powerups: new Set()
};

// Yem oluşturma fonksiyonu
function spawnFood() {
    const food = {
        x: Math.floor(Math.random() * 2000 - 1000),
        y: Math.floor(Math.random() * 2000 - 1000),
        value: 1,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };
    gameState.foods.add(food);
    io.emit('foodSpawned', Array.from(gameState.foods));
}

// Başlangıçta 100 yem oluştur
for (let i = 0; i < 100; i++) {
    spawnFood();
}

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    // Oyuncuyu oyuna ekle
    socket.on('join', (username) => {
        const player = {
            id: socket.id,
            username: username,
            snake: [
                { x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000 }
            ],
            score: 0,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
        
        gameState.players.set(socket.id, player);
        
        // Yeni oyuncuya mevcut oyun durumunu gönder
        socket.emit('gameState', {
            players: Array.from(gameState.players.values()),
            foods: Array.from(gameState.foods)
        });
        
        // Diğer oyunculara yeni oyuncuyu bildir
        io.emit('playerJoined', Array.from(gameState.players.values()));
    });

    // Oyuncu pozisyonunu güncelle
    socket.on('updatePosition', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.snake = data.snake;
            player.score = data.score;
            
            // Yem yeme kontrolü
            gameState.foods.forEach(food => {
                const dx = player.snake[0].x - food.x;
                const dy = player.snake[0].y - food.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) {
                    gameState.foods.delete(food);
                    player.score += food.value;
                    spawnFood();
                    io.emit('foodEaten', { foodId: food.id, playerId: socket.id });
                }
            });
            
            // Diğer oyunculara pozisyon güncellemesini gönder
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                snake: player.snake,
                score: player.score
            });
        }
    });

    // Oyuncu ayrıldığında
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        gameState.players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 