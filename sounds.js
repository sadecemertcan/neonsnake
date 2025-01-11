// Ses elementleri
const eatSound = document.getElementById('eatSound');
const gameOverSound = document.getElementById('gameOverSound');
const levelUpSound = document.getElementById('levelUpSound');
const hitSound = document.getElementById('hitSound');
const bgMusic = document.getElementById('bgMusic');
const soundToggle = document.getElementById('soundToggle');
const portalSound = document.getElementById('portalSound');
const powerUpSound = document.getElementById('powerUpSound');

// Ses durumu localStorage'dan al
let isSoundOn = localStorage.getItem('snakeSoundOn') !== 'false';
let lastEatTime = 0;
let baseVolume = 0.3;
updateSoundButton();

// Ses seviyelerini ayarla
bgMusic.volume = baseVolume;
eatSound.volume = 0.5;
gameOverSound.volume = 0.6;
levelUpSound.volume = 0.6;
hitSound.volume = 0.5;
portalSound.volume = 0.4;
powerUpSound.volume = 0.5;

// Müzik bittiğinde tekrar başlat
bgMusic.addEventListener('ended', function() {
    if (isSoundOn) {
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
});

// Ses düğmesi durumunu güncelle
function updateSoundButton() {
    soundToggle.textContent = isSoundOn ? '🔊 Ses' : '🔈 Ses';
    soundToggle.classList.toggle('active', isSoundOn);
}

// Ses açma/kapama kontrolü
soundToggle.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    localStorage.setItem('snakeSoundOn', isSoundOn);
    updateSoundButton();
    
    if (isSoundOn) {
        if (isGameRunning && !isPaused) {
            bgMusic.play();
        }
    } else {
        bgMusic.pause();
    }
});

// Ses fonksiyonları
const SoundManager = {
    playEat() {
        if (isSoundOn) {
            const now = Date.now();
            // En az 100ms geçmişse yeni sesi çal
            if (now - lastEatTime > 100) {
                // Önceki sesi durdur
                eatSound.pause();
                eatSound.currentTime = 0;
                
                // Yeni sesi çal ve 1 saniye sonra durdur
                eatSound.play();
                setTimeout(() => {
                    eatSound.pause();
                    eatSound.currentTime = 0;
                }, 1000);
                lastEatTime = now;
            }
        }
    },
    
    playGameOver() {
        if (isSoundOn) {
            bgMusic.pause();
            // Oyun bittiğinde müziği başa sar
            bgMusic.currentTime = 0;
        }
    },
    
    playLevelUp() {
        if (isSoundOn) {
            levelUpSound.currentTime = 0;
            levelUpSound.play();
        }
    },
    
    playHit() {
        if (isSoundOn) {
            hitSound.currentTime = 0;
            hitSound.play();
        }
    },
    
    playPortal() {
        if (isSoundOn) {
            portalSound.currentTime = 0;
            portalSound.play();
        }
    },
    
    playPowerUp() {
        if (isSoundOn) {
            powerUpSound.currentTime = 0;
            powerUpSound.play();
        }
    },
    
    startBgMusic() {
        if (isSoundOn) {
            bgMusic.currentTime = 0;
            bgMusic.play();
        }
    },
    
    pauseBgMusic() {
        bgMusic.pause();
    },
    
    resumeBgMusic() {
        if (isSoundOn) {
            bgMusic.play();
        }
    },
    
    increaseBgMusicVolume() {
        // Her seviyede %20 artır ama maksimum 1.0
        baseVolume = Math.min(1.0, baseVolume * 1.2);
        bgMusic.volume = baseVolume;
    }
}; 