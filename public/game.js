// Oyun durumu
const gameState = {
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set(),
    gameStarted: false
};

// Canvas ve context ayarları
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

// Oyun yapılandırması
const GAME_CONFIG = {
    GRID_SIZE: 20,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    },
    RENDER_DISTANCE: 50,
    INITIAL_SNAKE_SIZE: 1,
    SNAKE_GROWTH_RATE: 0.005,
    MIN_CAMERA_ZOOM: 1.2,
    CAMERA_SMOOTH_FACTOR: 0.05
};

// Canvas boyutlarını ayarla
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Sayfa yüklendiğinde ve boyut değiştiğinde canvas'ı ayarla
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// Oyun başlatma fonksiyonu
function startGame() {
    const nickname = document.getElementById('nickname').value.trim();
    if (!nickname) {
        alert('Lütfen bir kullanıcı adı girin!');
        return;
    }

    // Canvas'ı görünür yap ve boyutlandır
    canvas.style.display = 'block';
    resizeCanvas();

    // Menüyü gizle ve diğer elementleri göster
    document.getElementById('menu').style.display = 'none';
    document.getElementById('minimap').style.display = 'block';
    document.getElementById('playerList').style.display = 'block';

    // Oyun durumunu başlat
    gameState.gameStarted = true;
    
    // Oyuncuyu sunucuya bildir
    socket.emit('join', {
        nickname: nickname,
        skin: skins[currentSkinIndex]
    });

    // Oyun döngüsünü başlat
    requestAnimationFrame(gameLoop);
}

// Oyun döngüsü
function gameLoop(timestamp) {
    if (!gameState.gameStarted) return;

    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Oyun alanını çiz
    drawWorld();
    
    // Yemleri çiz
    drawFoods();
    
    // Yılanları çiz
    if (gameState.localPlayer) {
        drawSnake(ctx, gameState.localPlayer.snake, gameState.localPlayer.color, gameState.localPlayer.size, gameState.localPlayer.skin);
    }
    
    gameState.otherPlayers.forEach(player => {
        drawSnake(ctx, player.snake, player.color, player.size, player.skin);
    });
    
    // Mini haritayı güncelle
    updateMinimap();
    
    // Oyuncu listesini güncelle
    updatePlayerList();
    
    // Bir sonraki kareyi çiz
    requestAnimationFrame(gameLoop);
}

// Oyun dünyasını çiz
function drawWorld() {
    // Grid çizimi
    drawGrid();
    
    // Dünya sınırlarını çiz
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MIN_Y,
        GAME_CONFIG.WORLD_BOUNDS.MAX_X - GAME_CONFIG.WORLD_BOUNDS.MIN_X,
        GAME_CONFIG.WORLD_BOUNDS.MAX_Y - GAME_CONFIG.WORLD_BOUNDS.MIN_Y
    );
}

// Grid çizimi
function drawGrid() {
    const gridSize = GAME_CONFIG.GRID_SIZE * 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Dikey çizgiler
    for (let x = GAME_CONFIG.WORLD_BOUNDS.MIN_X; x <= GAME_CONFIG.WORLD_BOUNDS.MAX_X; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, GAME_CONFIG.WORLD_BOUNDS.MIN_Y);
        ctx.lineTo(x, GAME_CONFIG.WORLD_BOUNDS.MAX_Y);
        ctx.stroke();
    }
    
    // Yatay çizgiler
    for (let y = GAME_CONFIG.WORLD_BOUNDS.MIN_Y; y <= GAME_CONFIG.WORLD_BOUNDS.MAX_Y; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(GAME_CONFIG.WORLD_BOUNDS.MIN_X, y);
        ctx.lineTo(GAME_CONFIG.WORLD_BOUNDS.MAX_X, y);
        ctx.stroke();
    }
}

// Yemleri çiz
function drawFoods() {
    gameState.foods.forEach(food => {
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(
            food.x * GAME_CONFIG.GRID_SIZE,
            food.y * GAME_CONFIG.GRID_SIZE,
            GAME_CONFIG.GRID_SIZE / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
}

// Yılan çizimi
function drawSnake(ctx, snake, color, size = 1, skin = 'DEFAULT') {
    if (!snake || snake.length === 0) return;
    
    ctx.fillStyle = color;
    snake.forEach(segment => {
        ctx.beginPath();
        ctx.arc(
            segment.x * GAME_CONFIG.GRID_SIZE,
            segment.y * GAME_CONFIG.GRID_SIZE,
            (GAME_CONFIG.GRID_SIZE / 2) * size,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
} 