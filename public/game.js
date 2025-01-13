// Oyun yapılandırması ve değişkenler
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
    FOOD_SPAWN_INTERVAL: 3000,
    NEON_GLOW: 15,
    FOOD_COUNT: 25,
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

// Global değişkenler
let socket;
let canvas;
let ctx;
let gameState = {
    gameStarted: false,
    localPlayer: null,
    otherPlayers: new Map(),
    foods: new Set(),
    powerups: new Set()
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
    
    // İlk boyutlandırma
    resizeCanvas();
    
    // Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
    window.addEventListener('resize', resizeCanvas);
    
    // Socket.io bağlantısı
    socket = io({
        transports: ['websocket'],
        upgrade: false
    });

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

    socket.on('gameState', (state) => {
        if (state.players) {
            updateScoreboard(state.players);
        }
        // ... diğer state güncellemeleri
    });

    socket.on('playerJoined', (players) => {
        if (players) {
            updateScoreboard(players);
        }
    });

    // ... diğer socket olayları
}

// Skor tablosunu güncelle
function updateScoreboard(players) {
    const scoreBoard = document.getElementById('scoreBoard');
    if (!scoreBoard) return;

    const sortedPlayers = Array.from(Object.values(players))
        .sort((a, b) => b.score - a.score);

    let html = '<h3 style="color: #0ff; margin-bottom: 10px;">Skor Tablosu</h3>';
    sortedPlayers.forEach(player => {
        html += `<div class="score-item">${player.username}: ${player.score}</div>`;
    });
    scoreBoard.innerHTML = html;
}

// ... rest of the existing code ... 