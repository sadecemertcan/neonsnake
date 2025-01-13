// Canvas ve context tanımlamaları
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Sabitleri
const GAME_CONFIG = {
    GRID_SIZE: 20,
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
    SNAKE_SIZE: 1,
    RENDER_DISTANCE: 50,
    WORLD_BOUNDS: {
        MIN_X: -1000,
        MAX_X: 1000,
        MIN_Y: -1000,
        MAX_Y: 1000
    }
};

let lastTime = 0;

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

// Event Listeners
document.getElementById('play-button').addEventListener('click', () => {
    const nicknameInput = document.getElementById('nickname');
    const nickname = nicknameInput.value.trim();
    
    if (!nickname) {
        alert('Lütfen bir kullanıcı adı girin!');
        return;
    }

    // Oyun arayüzünü göster
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // Canvas'ı hazırla
    resizeCanvas();
    
    // Oyunu başlat
    startGame(nickname);
});

// Canvas boyutunu ayarla
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
}

// Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
window.addEventListener('resize', resizeCanvas);

// ... existing code ... 

function startGame(nickname) {
    if (gameState.gameStarted) return;
    
    // Oyun durumunu sıfırla
    gameState = {
        localPlayer: {
            id: socket.id,
            name: nickname,
            snake: [{x: 0, y: 0}],
            direction: {x: 1, y: 0},
            score: 0,
            color: '#' + Math.floor(Math.random()*16777215).toString(16)
        },
        otherPlayers: new Map(),
        foods: new Set(),
        direction: {x: 1, y: 0},
        nextDirection: {x: 1, y: 0},
        score: 0,
        gameLoop: null,
        gameStarted: true,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };

    // Sunucuya oyuncuyu bildir
    socket.emit('playerJoined', {
        id: socket.id,
        name: nickname,
        snake: gameState.localPlayer.snake,
        color: gameState.localPlayer.color
    });

    // Oyun döngüsünü başlat
    if (!gameState.gameLoop) {
        gameState.gameLoop = setInterval(() => {
            updateGame();
            render(performance.now());
        }, 1000 / 60);
    }

    // Kontrolleri etkinleştir
    setupControls();
}

// Kontrolleri ayarla
function setupControls() {
    if (gameState.isMobile) {
        // Mobil kontroller
        document.getElementById('controls').style.display = 'block';
        setupMobileControls();
    } else {
        // Klavye kontrolleri
        document.getElementById('controls').style.display = 'none';
        setupKeyboardControls();
    }
}

// Klavye kontrollerini ayarla
function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        switch(event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (gameState.direction.y !== 1) {
                    gameState.nextDirection = {x: 0, y: -1};
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (gameState.direction.y !== -1) {
                    gameState.nextDirection = {x: 0, y: 1};
                }
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (gameState.direction.x !== 1) {
                    gameState.nextDirection = {x: -1, y: 0};
                }
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (gameState.direction.x !== -1) {
                    gameState.nextDirection = {x: 1, y: 0};
                }
                break;
        }
    });
}

// Mobil kontrolleri ayarla
function setupMobileControls() {
    const controls = ['up', 'down', 'left', 'right'];
    controls.forEach(direction => {
        document.getElementById(direction).addEventListener('touchstart', (event) => {
            event.preventDefault();
            switch(direction) {
                case 'up':
                    if (gameState.direction.y !== 1) {
                        gameState.nextDirection = {x: 0, y: -1};
                    }
                    break;
                case 'down':
                    if (gameState.direction.y !== -1) {
                        gameState.nextDirection = {x: 0, y: 1};
                    }
                    break;
                case 'left':
                    if (gameState.direction.x !== 1) {
                        gameState.nextDirection = {x: -1, y: 0};
                    }
                    break;
                case 'right':
                    if (gameState.direction.x !== -1) {
                        gameState.nextDirection = {x: 1, y: 0};
                    }
                    break;
            }
        });
    });
} 