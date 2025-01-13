// Canvas ve Ses Öğeleri
let canvas;
let ctx;

// Canvas'ı başlat
function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas bulunamadı!');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context oluşturulamadı!');
        return;
    }
    
    // Canvas boyutlarını ayarla
    resizeCanvas();
}

// Canvas boyutlarını ayarla
function resizeCanvas() {
    if (!canvas || !ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    if (gameState.gameStarted) {
        render(); // Canvas yeniden boyutlandığında yeniden çiz
    }
}

// Sayfa yüklendiğinde canvas'ı başlat
window.addEventListener('load', initCanvas);
window.addEventListener('resize', resizeCanvas);

// Grid çizimi
function drawGrid(context) {
    if (!context) return; // Context kontrolü ekle
    
    const gridSize = 50;
    context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    context.lineWidth = 1;

    // Yatay çizgiler
    for (let y = 0; y < canvas.height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
    }

    // Dikey çizgiler
    for (let x = 0; x < canvas.width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
    }
}

// Render fonksiyonu
function render(timestamp) {
    if (!ctx || !gameState.localPlayer) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Arkaplanı çiz
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid çiz
    drawGrid(ctx);
    
    // Yemleri çiz
    drawFoods(ctx, gameState.localPlayer.snake[0]);
    
    // Diğer yılanları çiz
    gameState.otherPlayers.forEach(player => {
        drawSnake(player.snake, player.color);
    });
    
    // Yerel oyuncunun yılanını çiz
    drawSnake(gameState.localPlayer.snake, gameState.localPlayer.color);
    
    // Skor tablosunu çiz
    drawScoreboard(ctx);
    
    // Bir sonraki kareyi çiz
    requestAnimationFrame(render);
}

// Oyun başlatma fonksiyonunu güncelle
function startGame(nickname) {
    if (gameState.gameStarted) return;
    
    console.log('Oyun başlatılıyor...');
    
    // Canvas'ı başlat
    initCanvas();
    
    // ... rest of the startGame function ...
}

// ... existing code ... 