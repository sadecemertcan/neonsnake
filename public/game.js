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

// ... existing code ... 