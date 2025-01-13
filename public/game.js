// Oyun yapılandırması
const GAME_CONFIG = {
    SNAKE_SPEED: 5,
    GRID_SIZE: 20,
    FOOD_SIZE: 10,
    SNAKE_SIZE: 10,
    WORLD_SIZE: 2000
};

// Global değişkenler
let socket;
let canvas;
let ctx;
let gameState = {
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set()
};

// DOM yüklendikten sonra çalışacak kod
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

// Oyunu başlat
function initializeGame() {
    // Canvas ve context ayarları
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas elementi bulunamadı');
        return;
    }
    
    ctx = canvas.getContext('2d');
    
    // Canvas boyutlarını ayarla
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Socket.io bağlantısı
    socket = io();

    // Socket event listeners
    socket.on('connect', () => {
        console.log('Sunucuya bağlandı');
        setupGameEvents();
    });

    // Oyun başlatma butonu event listener'ı
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput && usernameInput.value.trim()) {
                const username = usernameInput.value.trim();
                const loginScreen = document.getElementById('loginScreen');
                const gameScreen = document.getElementById('gameScreen');
                
                if (loginScreen && gameScreen) {
                    loginScreen.style.display = 'none';
                    gameScreen.style.display = 'block';
                    startGame(username);
                }
            }
        });
    }
}

// Oyun olaylarını ayarla
function setupGameEvents() {
    if (!socket) return;

    // Oyun durumu güncelleme
    socket.on('gameState', (state) => {
        if (state.players) {
            state.players.forEach(player => {
                if (player.id === socket.id) {
                    gameState.localPlayer = player;
                } else {
                    gameState.otherPlayers.set(player.id, player);
                }
            });
        }
        if (state.foods) {
            gameState.foods = new Set(state.foods);
        }
        updateScoreboard(state.players);
    });

    // Yeni oyuncu katıldı
    socket.on('playerJoined', (players) => {
        players.forEach(player => {
            if (player.id !== socket.id) {
                gameState.otherPlayers.set(player.id, player);
            }
        });
        updateScoreboard(players);
    });

    // Oyuncu ayrıldı
    socket.on('playerLeft', (playerId) => {
        gameState.otherPlayers.delete(playerId);
    });

    // Oyuncu hareket etti
    socket.on('playerMoved', (data) => {
        const player = gameState.otherPlayers.get(data.id);
        if (player) {
            player.snake = data.snake;
            player.score = data.score;
        }
    });

    // Yem yendi
    socket.on('foodEaten', (data) => {
        if (data.playerId === socket.id) {
            gameState.localPlayer.score += 1;
        }
    });

    // Yeni yem oluştu
    socket.on('foodSpawned', (foods) => {
        gameState.foods = new Set(foods);
    });
}

// Skor tablosunu güncelle
function updateScoreboard(players) {
    const scoreBoard = document.getElementById('scoreBoard');
    if (!scoreBoard) return;

    const sortedPlayers = Array.from(players)
        .sort((a, b) => b.score - a.score);

    let html = '<h3 style="color: #0ff; margin-bottom: 10px;">Skor Tablosu</h3>';
    sortedPlayers.forEach(player => {
        html += `<div class="score-item">${player.username}: ${player.score}</div>`;
    });
    scoreBoard.innerHTML = html;
}

// Oyunu başlat
function startGame(username) {
    if (!socket || !canvas || !ctx) {
        console.error('Oyun başlatılamıyor: Gerekli bileşenler eksik');
        return;
    }

    // Sunucuya katılma bildirimi gönder
    socket.emit('join', username);

    // Oyun döngüsünü başlat
    requestAnimationFrame(gameLoop);

    // Klavye kontrollerini etkinleştir
    window.addEventListener('keydown', handleKeyPress);
}

// Klavye kontrollerini yönet
function handleKeyPress(event) {
    if (!gameState.localPlayer) return;

    let dx = 0;
    let dy = 0;

    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            dy = -1;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            dy = 1;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            dx = -1;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            dx = 1;
            break;
    }

    if (dx !== 0 || dy !== 0) {
        const head = gameState.localPlayer.snake[0];
        const newHead = {
            x: head.x + dx * GAME_CONFIG.SNAKE_SPEED,
            y: head.y + dy * GAME_CONFIG.SNAKE_SPEED
        };

        // Sınırları kontrol et
        newHead.x = Math.max(-GAME_CONFIG.WORLD_SIZE/2, Math.min(GAME_CONFIG.WORLD_SIZE/2, newHead.x));
        newHead.y = Math.max(-GAME_CONFIG.WORLD_SIZE/2, Math.min(GAME_CONFIG.WORLD_SIZE/2, newHead.y));

        gameState.localPlayer.snake = [newHead];
        
        // Sunucuya pozisyon güncelleme gönder
        socket.emit('updatePosition', {
            snake: gameState.localPlayer.snake,
            score: gameState.localPlayer.score
        });
    }
}

// Oyun döngüsü
function gameLoop() {
    if (!gameState.localPlayer) return;

    // Ekranı temizle
    ctx.fillStyle = '#001800';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Kamera pozisyonunu ayarla
    const cameraX = -gameState.localPlayer.snake[0].x + canvas.width/2;
    const cameraY = -gameState.localPlayer.snake[0].y + canvas.height/2;

    ctx.save();
    ctx.translate(cameraX, cameraY);

    // Oyun alanı sınırlarını çiz
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(-GAME_CONFIG.WORLD_SIZE/2, -GAME_CONFIG.WORLD_SIZE/2, 
                  GAME_CONFIG.WORLD_SIZE, GAME_CONFIG.WORLD_SIZE);

    // Yemleri çiz
    gameState.foods.forEach(food => {
        ctx.beginPath();
        ctx.arc(food.x, food.y, GAME_CONFIG.FOOD_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = food.color;
        ctx.fill();
    });

    // Yılanları çiz
    function drawSnake(player) {
        ctx.fillStyle = player.color;
        player.snake.forEach(segment => {
            ctx.beginPath();
            ctx.arc(segment.x, segment.y, GAME_CONFIG.SNAKE_SIZE, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Diğer oyuncuları çiz
    gameState.otherPlayers.forEach(player => drawSnake(player));

    // Yerel oyuncuyu çiz
    drawSnake(gameState.localPlayer);

    ctx.restore();

    requestAnimationFrame(gameLoop);
} 