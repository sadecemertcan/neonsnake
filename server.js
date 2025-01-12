const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"]
    }
});

// Statik dosyaları serve et
app.use(express.static('public'));

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Oyun durumu
const gameState = {
    players: new Map(),
    foods: new Set()
};

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);
    
    socket.on('playerJoin', (player) => {
        console.log('Oyuncu katıldı:', player.name);
        gameState.players.set(socket.id, player);
        io.emit('playerJoined', player);
        
        // Mevcut oyuncuları yeni oyuncuya gönder
        const currentPlayers = Array.from(gameState.players.values());
        socket.emit('currentPlayers', currentPlayers);
        
        // Mevcut yemleri gönder
        socket.emit('currentFoods', Array.from(gameState.foods));
    });
    
    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        const player = gameState.players.get(socket.id);
        if (player) {
            gameState.players.delete(socket.id);
            io.emit('playerLeft', socket.id);
        }
    });
    
    socket.on('updatePosition', (data) => {
        const player = gameState.players.get(socket.id);
        if (player) {
            player.snake = data.snake;
            player.direction = data.direction;
            player.score = data.score;
            socket.broadcast.emit('playerMoved', data);
        }
    });
    
    socket.on('foodSpawned', (food) => {
        gameState.foods.add(food);
        io.emit('foodSpawned', Array.from(gameState.foods));
    });
    
    socket.on('foodEaten', (food) => {
        gameState.foods.delete(food);
        io.emit('foodSpawned', Array.from(gameState.foods));
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log('Sunucu başlatıldı - Port:', PORT);
}); 