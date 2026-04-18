const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudHp = document.getElementById("hud-hp");
const hudGold = document.getElementById("hud-gold");
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");
const settingsToggleBtn = document.getElementById("settings-toggle-btn");
const settingsMenu = document.getElementById("settings-menu");
const tutorialBtn = document.getElementById("tutorial-btn");
const tutorialModal = document.getElementById("tutorial-modal");
const closeTutorial = document.getElementById("close-tutorial");

const mouse = { x: 0, y: 0 };
const canvasRect = canvas.getBoundingClientRect();
const PLACEMENT_COOLDOWN = 2000;
const cellSize = 70;

//tower
const towerSprite = new Image();
towerSprite.src = 'risk-image/Tower.png';

//map
const cleanTiles = [];
const TILE_CONFIG = {
    cleanCount: 4,
    path: 'risk-image/'
};

for (let i = 1; i <= TILE_CONFIG.cleanCount; i++) {
    const img = new Image();
    img.src = `${TILE_CONFIG.path}clean (${i}).png`;
    cleanTiles.push(img);
}

//fire
const fireReadyFrames = [];
for (let i = 1; i <= 2; i++) {
    let img = new Image();
    img.src = `risk-image/fireready (${i}).png`;
    fireReadyFrames.push(img);
}

const fireAttackFrames = [];
for (let i = 1; i <= 2; i++) {
    let img = new Image();
    img.src = `risk-image/fire (${i}).png`;
    fireAttackFrames.push(img);
}

//flood
const floodReadyFrames = [];
for (let i = 1; i <= 2; i++) {
    let img = new Image();
    img.src = `risk-image/floodready (${i}).png`;
    floodReadyFrames.push(img);
}

const floodAttackFrames = [];
for (let i = 1; i <= 2; i++) {
    let img = new Image();
    img.src = `risk-image/flood (${i}).png`;
    floodAttackFrames.push(img);
}

//thief
const thiefSprite = new Image();
thiefSprite.src = 'risk-image/StreetThief.png';

//virus
const virusSprite = new Image();
virusSprite.src = 'risk-image/virus.png';

let totalTowersPlaced = 0;
let gameMapLayout = [];
let startTime = Date.now();
let totalPausedTime = 0;
let pauseStartTime;
let timeUsedSeconds = 0;
let hasPlacedTower = false;
let lastPlacementTime = 0;
let towers = [];
let enemies = [];
let floatingTexts = [];
let bullets = [];
let frames = 0;
let selectedType = 'home';
let baseHealth = 100;
let gold = 200;
let wave = 1;
let enemiesSpawned = 0;
let totalEnemiesThisWave = 0;
let waveInProgress = true;
let isPaused = false;
let gameState = "playing";
let closestTower = null;
let minDist = Infinity;
let rewardGiven = false;
let GAME_WIDTH, GAME_HEIGHT;
let gameMode = 'vertical';
let particles = [];

function setupCanvas() {
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;

    const isPortrait = window.innerHeight > window.innerWidth;
    const TARGET_RATIO = isPortrait ? (350 / 490) : (490 / 350);

    let maxWidth = wrapper.clientWidth;
    let maxHeight = wrapper.clientHeight;

    let newWidth, newHeight;
    if (maxWidth / maxHeight > TARGET_RATIO) {
        newHeight = maxHeight;
        newWidth = maxHeight * TARGET_RATIO;
    } else {
        newWidth = maxWidth;
        newHeight = maxWidth / TARGET_RATIO;
    }

    GAME_WIDTH = isPortrait ? 350 : 490;
    GAME_HEIGHT = isPortrait ? 490 : 350;
    gameMode = isPortrait ? 'vertical' : 'horizontal';

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;

    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';

    ctx.scale(dpr, dpr);
}

/**
@param {string} towerType 
@param {string} enemyType 
 */
function canDefense(towerType, enemyType) {
    if (enemyType === 'thief') return (towerType === 'car' || towerType === 'home');
    if (enemyType === 'virus') return (towerType === 'medical');
    if (enemyType === 'flood' || enemyType === 'fire') return (towerType === 'car' || towerType === 'home');
    return false;
}

window.addEventListener('resize', setupCanvas);
setupCanvas();

document.addEventListener("DOMContentLoaded", async () => {
    const gameType = 'RiskDefender';
    try {
        const res = await fetch(`/api/check-can-play?gameType=${gameType}`);
        const data = await res.json();

        if (!data.canPlay) {
            alert("You already played Risk Defender today. Please come back tomorrow!");
            window.location.href = "dashboard.html"; 
        }
    } catch (e) {
        console.error("Limit check failed", e);
    }
});

function checkTutorialOnLoad() {
    const skipTutorial = sessionStorage.getItem('skipRiskTutorial');

    if (!skipTutorial) {
        setTimeout(() => {
            tutorialBtn.click();
        }, 500);
    }
}

/* ========================
   🏰 Tower Class
======================== */

window.setTowerType = function (type) {
    selectedType = type;

    document.querySelectorAll('.controls button')
        .forEach(btn => btn.classList.remove('active'));

    const id = type === 'medical'
        ? 'btn-medical'
        : `btn-${type}`;

    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
};

class Insurance {
    constructor(gridX, gridY, type) {
        this.id = Date.now() + Math.random();
        this.level = 1;
        this.x = gridX;
        this.y = gridY;
        this.type = type;
        this.selected = false;
        this.isBuffed = false;

        switch (type) {
            case 'car':
                this.sx = 0;
                this.label = "Car";
                this.cost = 40; this.health = 150; this.attackSpeed = 90; this.attackPower = 2.5; this.range = 75;
                break;
            case 'home':
                this.sx = 64;
                this.label = "Property";
                this.cost = 50; this.health = 200; this.attackSpeed = 60; this.attackPower = 1.0; this.range = 100;
                break;
            case 'medical':
                this.sx = 128;
                this.label = "Life";
                this.cost = 60; this.health = 100; this.attackSpeed = 60; this.attackPower = 2.0; this.range = 80;
                this.healTimer = 0;
                break;
        }

        this.maxHealth = this.health;
        this.timer = 0;

        this.sw = 64;
        this.sh = 128;
    }

    draw() {
        ctx.save();
        const center = cellSize / 2;

        ctx.beginPath();
        ctx.arc(this.x + center, this.y + center, this.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (this.selected) {
            ctx.strokeStyle = "#f1c40f";
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x + 2, this.y + 2, cellSize - 4, cellSize - 4);
        }

        const padding = 2;
        const actualSx = this.sx + padding;
        const actualSw = this.sw - (padding * 2);

        const drawWidth = cellSize * 0.7;
        const drawHeight = (this.sh / this.sw) * drawWidth;

        const offsetX = (cellSize - drawWidth) / 2;
        const offsetY = cellSize - drawHeight;

        ctx.drawImage(
            towerSprite,
            actualSx, 0, actualSw, this.sh,
            this.x + offsetX, this.y + offsetY, drawWidth, drawHeight
        );

        const hpBarY = this.y + cellSize - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x + cellSize * 0.1, hpBarY, cellSize * 0.8, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x + cellSize * 0.1, hpBarY, (this.health / this.maxHealth) * cellSize * 0.8, 5);

        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.fillText("Lv." + this.level, this.x + 5, this.y + 15);

        if (this.isBuffed) {
            ctx.fillStyle = "#2ecc71";
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.fillText("+", this.x + center, this.y + center);
        }
        ctx.restore();
    }

    upgrade() {
        const upgradeCost = this.cost * this.level;

        if (gold >= upgradeCost) {
            gold -= upgradeCost;
            this.level++;
            totalTowersPlaced++;

            this.maxHealth = Math.floor(this.maxHealth * 1.5);
            this.health = this.maxHealth;

            if (this.type === 'car') {
                this.attackPower += 2;
                this.attackSpeed -= 5;
            } else if (this.type === 'home') {
                this.attackPower *= 1.3;
                this.range += 10;
            } else if (this.type === 'medical') {
                this.range += 15;
                floatingTexts.push(new FloatingText("Heal UP!", this.x + 35, this.y - 10, "#2ecc71"));
            }

            floatingTexts.push(new FloatingText("Level " + this.level + "!", this.x + 35, this.y + 20, "#f1c40f"));
        } else {
            floatingTexts.push(new FloatingText("Need More Gold!", this.x, this.y, "#e74c3c"));
        }
    }

    update() {
        this.isBuffed = false;
        if (this.type === 'medical') {
            this.healTimer++;
            if (this.healTimer >= 180) {
                towers.forEach(t => {
                    if (t === this) return;
                    let dist = Math.hypot((t.x + 35) - (this.x + 35), (t.y + 35) - (this.y + 35));
                    if (dist < this.range && t.health < t.maxHealth) {
                        let currentHeal = this.level;

                        t.health = Math.min(t.maxHealth, t.health + currentHeal);

                        floatingTexts.push(new FloatingText("+" + currentHeal, t.x + 35, t.y + 20, "#2ecc71"));

                        t.isBuffed = true;
                    }
                });
                this.healTimer = 0;
            }
        }
    }
}

/* ========================
   👾 Enemy
======================== */

class Risk {
    constructor(pos, wave) {
        this.size = 30;
        this.speed = 1.5;
        this.escaped = false;
        this.size = 30;
        this.speed = 1.5;
        this.escaped = false;
        this.isAttacking = false;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.frameInterval = 15;

        if (gameMode === 'horizontal') {
            const targetRow = Math.floor(pos / cellSize);
            this.spawnRow = targetRow;
            this.x = GAME_WIDTH;
            this.y = targetRow * cellSize + (cellSize / 2);
        } else {
            const targetCol = Math.floor(pos / cellSize);
            this.spawnCol = targetCol;
            this.x = targetCol * cellSize + (cellSize / 2);
            this.y = -30;
        }

        const types = ['fire', 'flood', 'thief', 'virus'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.health = 5 + (wave * 5);
        this.maxHealth = this.health;

        if (this.type === 'virus') {
            this.speed = 1.8;
            this.damage = 0.5;
            this.label = "🦠";
            this.currentFrames = [];
        } else if (this.type === 'fire') {
            this.speed = 0.8;
            this.damage = 1.0;
            this.label = "🔥";
            this.currentFrames = fireReadyFrames;
        } else if (this.type === 'flood') {
            this.speed = 0.6;
            this.damage = 1.0;
            this.label = "🌊";
            this.currentFrames = floodReadyFrames;
        } else if (this.type === 'thief') {
            this.speed = 1.3;
            this.damage = 0.5;
            this.label = "👤";
            this.currentFrames = [];
        }

        this.baseSpeed = this.speed;
        this.blocked = false;

        this.attackTimer = 0;
        this.attackSpeed = 100;
    }

    update() {
        if (this.isDying) { this.size -= 2; return; }

        this.frameTimer++;
        if (this.frameTimer >= this.frameInterval) {
            this.frameTimer = 0;
            if (this.type === 'thief') {
                this.frameIndex = (this.frameIndex + 1) % 2;
            } else if (this.currentFrames && this.currentFrames.length > 0) {
                this.frameIndex = (this.frameIndex + 1) % this.currentFrames.length;
            }
            else if (this.type === 'virus') {
                this.frameIndex = (this.frameIndex + 1) % 12;
            }
        }

        if (this.blocked) {
            if (!this.isAttacking) {
                if (this.type === 'fire') {
                    this.currentFrames = fireAttackFrames;
                } else if (this.type === 'flood') {
                    this.currentFrames = floodAttackFrames;
                }
                this.frameIndex = 0;
                this.isAttacking = true;
            }

            this.attackTimer++;
            if (this.attackTimer >= this.attackSpeed) {
                if (this.targetTower) {
                    this.targetTower.health -= this.damage;
                    floatingTexts.push(new FloatingText("-" + this.damage, this.targetTower.x + 35, this.targetTower.y, "red"));
                }
                this.attackTimer = 0;
            }

            return;

        } else {
            if (this.isAttacking) {
                if (this.type === 'fire') {
                    this.currentFrames = fireReadyFrames;
                } else if (this.type === 'flood') {
                    this.currentFrames = floodReadyFrames;
                }
                this.frameIndex = 0;
                this.isAttacking = false;
            }
        }

        let targetX = (gameMode === 'horizontal') ? - 35 : (this.spawnCol * cellSize + 35);
        let targetY = (gameMode === 'horizontal') ? (this.spawnRow * cellSize + 35) : (canvas.height + 35);
        let attractionTarget = null;
        let minDist = 180;

        towers.forEach(t => {
            if (this.shouldBeAttractedTo(t)) {
                let dist = Math.hypot((t.x + 35) - this.x, (t.y + 35) - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    attractionTarget = t;
                }
            }
        });

        if (attractionTarget) {
            targetX = attractionTarget.x + 35;
            targetY = attractionTarget.y + 35;
        }

        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }

        if (gameMode === 'horizontal') {
            if (this.x < 0) this.escaped = true;
        } else {
            if (this.y > canvas.height) this.escaped = true;
        }
    }

    shouldBeAttractedTo(t) {
        return canDefense(t.type, this.type);
    }

    draw() {
        ctx.save();
        const centerX = this.x + 35;
        const centerY = this.y + 35;

        const barWidth = 40;
        const barHeight = 4;
        const topY = this.y - 15;
        ctx.fillStyle = 'black';
        ctx.fillRect(centerX - barWidth / 2, topY, barWidth, barHeight);
        ctx.fillStyle = 'red';
        ctx.fillRect(centerX - barWidth / 2, topY, (this.health / this.maxHealth) * barWidth, barHeight);

        ctx.translate(centerX, centerY);

        if (this.type === 'thief') {
            ctx.scale(-1, 1);
            if (thiefSprite.complete && thiefSprite.naturalWidth > 0) {
                const fw = 32, fh = 32;
                let col = (this.frameIndex === 0) ? 0 : 4;
                let sy = this.isAttacking ? 3 * fh : 2 * fh;
                ctx.drawImage(thiefSprite, col * fw, sy, fw, fh, -16, -16, 32, 32);
            } else {
                this.drawFallback();
            }
        } else if (this.type === 'virus') {
            if (virusSprite.complete && virusSprite.naturalWidth > 0) {
                const fw = 40;
                const fh = 40;
                let sx;
                let sy = 0;

                if (this.isAttacking) {
                    let attackIdx = 5 + (this.frameIndex % 6);
                    sx = attackIdx * fw;
                } else {
                    let walkIdx = this.frameIndex % 4;
                    sx = walkIdx * fw;
                }

                ctx.drawImage(
                    virusSprite,
                    sx, sy, fw, fh,
                    -20, -20, 40, 40
                );
            } else {
                this.drawFallback();
            }

        } else {
            ctx.scale(-1, 1);
            if (this.currentFrames && this.currentFrames.length > 0) {
                const img = this.currentFrames[this.frameIndex];
                if (img && img.complete) {
                    ctx.drawImage(img, -16, -16, 32, 32);
                } else {
                    this.drawFallback();
                }
            } else {
                this.drawFallback();
            }
        }
        ctx.restore();
    }

    drawFallback() {
        ctx.scale(-1, 1);
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.label || "👾", 0, 0);
    }
}

class Bullet {

    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 6;
        this.hit = false;
    }

    update() {

        if (!this.target) {
            this.hit = true;
            return;
        }

        let dx = (this.target.x + 35) - this.x;
        let dy = (this.target.y + 35) - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            this.target.health -= this.damage;

            floatingTexts.push(new FloatingText("-" + this.damage.toFixed(1), this.target.x + 35, this.target.y + 35, "yellow"));
            this.hit = true;
            return;
        }

        this.x += dx / dist * this.speed;
        this.y += dy / dist * this.speed;
    }

    draw() {
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}


/* ========================
   ✨ Floating Text
======================== */

class FloatingText {
    constructor(text, x, y, color) {
        this.text = (text !== undefined && text !== null) ? String(text) : "";
        this.x = x;
        this.y = y;
        this.color = color;
        this.alpha = 1;
        this.velocity = -0.5;
    }

    update() {
        this.y += this.velocity;
        this.alpha -= 0.01;
    }

    draw() {
        if (this.alpha <= 0 || !this.text) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let fontSize = 14;

        if (this.text.includes("Wave")) {
            fontSize = 32;
        }

        ctx.font = `bold ${fontSize}px Arial`;

        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        ctx.lineWidth = 3;
        ctx.strokeStyle = "black";
        ctx.strokeText(this.text, this.x, this.y);

        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }
}

/* ========================
   🖱 Placement / Upgrade
======================== */

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;

    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener("click", (e) => {
    if (gameState !== "playing" || isPaused) return;

    const rect = canvas.getBoundingClientRect();

    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;

    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(clickX / cellSize);
    const gridY = Math.floor(clickY / cellSize);
    const towerX = gridX * cellSize;
    const towerY = gridY * cellSize;

    console.log(`Attempting to place at: ${gridX}, ${gridY}`);

    let clickedTower = towers.find(t => t.x === towerX && t.y === towerY);

    if (clickedTower) {
        if (clickedTower.selected) {
            if (typeof clickedTower.upgrade === "function") clickedTower.upgrade();
        } else {
            towers.forEach(t => t.selected = false);
            clickedTower.selected = true;
            if (typeof setTowerType === "function") setTowerType(clickedTower.type);
        }
        return;
    }

    const now = Date.now();
    if (now - lastPlacementTime < PLACEMENT_COOLDOWN) {
        floatingTexts.push(new FloatingText("Cooling down!", clickX, clickY, "#e74c3c"));
        return;
    }

    towers.forEach(t => t.selected = false);

    let cost = 0;
    if (selectedType === "home") cost = 50;
    else if (selectedType === "car") cost = 40;
    else if (selectedType === "medical") cost = 60;

    if (gold >= cost) {
        gold -= cost;
        towers.push(new Insurance(towerX, towerY, selectedType));

        totalTowersPlaced++;
        hasPlacedTower = true;
        lastPlacementTime = now;

        if (typeof updateHUD === "function") updateHUD();
        console.log("Tower placed successfully!");
    } else {
        floatingTexts.push(new FloatingText("Insufficient Gold!", clickX, clickY, "#bdc3c7"));
    }
});

function showGameOver() {
    if (gameState === "gameOver" || gameState === "submitting" || gameState === "submitted") return;
    gameState = "submitting";
    const modal = document.getElementById("game-over-modal");
    const finalWaveTxt = document.getElementById("final-wave");
    const finalGoldTxt = document.getElementById("final-gold");
    const placementStatusTxt = document.getElementById("placement-status");
    const finalTimeDisplay = document.getElementById("final-time");
    const feedbackText = document.getElementById('game-feedback-text');

    let finalPoints = gold;
    if (finalPoints < 0) finalPoints = 0;

    const MIN_TIME = 50;
    const MIN_WAVE = 5;
    const MIN_TOWERS = 3;
    let isCheat = false;
    let cheatMessage = "";

    if (!hasPlacedTower || totalTowersPlaced < MIN_TOWERS) {
        isCheat = true;
        cheatMessage = `Need to place at least ${MIN_TOWERS} towers.`;
    } else if (timeUsedSeconds < MIN_TIME) {
        isCheat = true;
        cheatMessage = `Game ended too early (Need ${MIN_TIME}s).`;
    } else if (wave < MIN_WAVE) {
        isCheat = true;
        cheatMessage = `You must reach at least Wave ${MIN_WAVE}.`;
    }

    if (isCheat) {
        finalPoints = 0;
        if (placementStatusTxt) {
            placementStatusTxt.textContent = cheatMessage;
            placementStatusTxt.style.color = "#e74c3c";
        }
        if (feedbackText) {
            feedbackText.innerHTML = `<span style="color:#e74c3c">Invalid Session: Survival criteria not met.</span>`;
        }
    } else {
        if (placementStatusTxt) {
            placementStatusTxt.textContent = "Towers successfully deployed.";
            placementStatusTxt.style.color = "#2ecc71";
        }
        let basePercent = Math.min(90, wave * 10);
        let beatPercent = Math.min(99, basePercent + Math.floor(Math.random() * 9) + 1);
        if (feedbackText) {
            feedbackText.innerHTML = `You reached Wave <b>${wave}</b>, surpassing <b>${beatPercent}%</b> people!`;
        }
    }

    if (finalWaveTxt) finalWaveTxt.innerText = wave;
    if (finalGoldTxt) finalGoldTxt.innerText = finalPoints;
    if (finalTimeDisplay) finalTimeDisplay.innerText = timeUsedSeconds + "s";
    if (modal) modal.style.display = "flex";

    if (finalPoints <= 0 || isCheat) {
        console.log("Invalid or below-standard scores will not be saved.");
        gameState = "submitted";
        return;
    }

    console.log("Game Over! Sending data:", { finalPoints, wave, timeUsedSeconds });

    const dataToSend = {
        score: finalPoints,
        reached_level: wave,
        gameType: 'RiskDefender',
        time_used: timeUsedSeconds
    };

    fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
    })
        .then(res => {
            gameState = "submitted";
            if (!res.ok) throw new Error('Server responded with error');
            return res.json();
        })
        .then(data => {
            console.log("SQL update success:", data.message);
            gameState = "submitted";
        })
        .catch(err => {
            console.error("SQL update failed:", err);
        });
}

/* ========================
   🌊 Wave System
======================== */

function handleWave() {
    if (!waveInProgress || gameState !== "playing") return;
    totalEnemiesThisWave = wave * 5;
    let currentSpawnRate = Math.max(40, 120 - (wave * 5));

    if (frames % currentSpawnRate === 0 && enemiesSpawned < totalEnemiesThisWave) {
        enemiesSpawned++;

        if (gameMode === 'horizontal') {
            let maxRows = Math.floor(GAME_HEIGHT / cellSize);
            let row = Math.floor(Math.random() * (maxRows - 2)) + 1;
            let startY = row * cellSize + cellSize / 2;
            enemies.push(new Risk(startY, wave));

        } else {
            let maxCols = Math.floor(GAME_WIDTH / cellSize);
            let col = Math.floor(Math.random() * (maxCols - 2)) + 1;
            let startX = col * cellSize + cellSize / 2;
            enemies.push(new Risk(startX, wave));
        }
    }

    if (enemiesSpawned >= totalEnemiesThisWave && enemies.length === 0) {
        waveInProgress = false;

        if (hasPlacedTower) {
            let bonus = 50;
            gold += bonus;
            floatingTexts.push(new FloatingText(`+${bonus} Gold!`, canvas.width / 2, canvas.height / 2, "#FFD700"));
        }

        setTimeout(() => {
            if (gameState === "playing") {
                wave++;
                enemiesSpawned = 0;
                waveInProgress = true;
                floatingTexts.push(
                    new FloatingText("Wave " + wave, GAME_WIDTH / 2, GAME_HEIGHT / 2, "white")
                );
            }
        }, 2000);
    }
}

/* ========================
        Map
======================== */
function initMapLayout() {
    gameMapLayout = [];
    const cols = Math.ceil(canvas.width / cellSize);
    const rows = Math.ceil(canvas.height / cellSize);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cleanIdx = Math.floor(Math.random() * cleanTiles.length);

            gameMapLayout.push({
                x: c * cellSize,
                y: r * cellSize,
                cleanIdx: cleanIdx
            });
        }
    }
}

function drawGrid() {
    if (gameMapLayout.length === 0) initMapLayout();

    gameMapLayout.forEach(cell => {
        const cImg = cleanTiles[cell.cleanIdx];

        if (cImg && cImg.complete && cImg.naturalWidth > 0) {
            ctx.drawImage(cImg, cell.x, cell.y, cellSize, cellSize);
        } else {
            ctx.fillStyle = '#2d4d2a';
            ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
        }

        ctx.save();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 1;

        ctx.strokeRect(cell.x, cell.y, cellSize, cellSize);

        ctx.restore();
    });
}

/* ========================
   🎮 Game Logic
======================== */

function handleLogic() {

    if (gameState !== "playing") return;
    towers.forEach(t => t.update());
    handleWave();

    /* ========= Stage 1 ========= */

    towers.forEach(tower => {
        tower.timer++;

        let target = null;
        let minDist = Infinity;

        enemies.forEach(enemy => {
            if (enemy.isDying) return;

            let canAttack = false;
            if (enemy.type === 'thief' && (tower.type === 'car' || tower.type === 'home')) canAttack = true;
            if (enemy.type === 'virus' && tower.type === 'medical') canAttack = true;
            if ((enemy.type === 'flood' || enemy.type === 'fire') && (tower.type === 'car' || tower.type === 'home')) canAttack = true;

            if (!canAttack) return;

            let enemyCenterX = enemy.x + 15;
            let enemyCenterY = enemy.y + 15;
            let towerCenterX = tower.x + 35;
            let towerCenterY = tower.y + 35;

            let dx = enemyCenterX - towerCenterX;
            let dy = enemyCenterY - towerCenterY;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < tower.range && dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        });

        if (target && tower.timer >= tower.attackSpeed) {
            bullets.push(new Bullet(tower.x + 35, tower.y + 35, target, tower.attackPower));
            tower.timer = 0;

            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
            ctx.beginPath();
            ctx.moveTo(tower.x + 35, tower.y + 35);
            ctx.lineTo(target.x + 35, target.y + 35);
            ctx.stroke();
            ctx.restore();
        }
    });

    /* ========= Stage 2 ========= */
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        en.blocked = false;
        en.targetTower = null;

        towers.forEach(tower => {
            const buffer = 5;
            if (en.x + 35 >= tower.x - buffer &&
                en.x + 35 <= tower.x + cellSize + buffer &&
                en.y + 35 >= tower.y - buffer &&
                en.y + 35 <= tower.y + cellSize + buffer) {

                let shouldStop = false;
                if (en.type === 'thief' && (tower.type === 'car' || tower.type === 'home')) shouldStop = true;
                if (en.type === 'virus' && tower.type === 'medical') shouldStop = true;
                if ((en.type === 'flood' || en.type === 'fire') && (tower.type === 'car' || tower.type === 'home')) shouldStop = true;

                if (shouldStop) {
                    en.blocked = true;
                    en.targetTower = tower;
                }
            }
        });

        en.update();

        let forceEscape = false;
        if (gameMode === 'horizontal') {
            if (en.x < -50 || en.y > GAME_HEIGHT) forceEscape = true;
        } else {
            if (en.y > GAME_HEIGHT + 50 || en.x > GAME_WIDTH) forceEscape = true;
        }

        if (forceEscape || en.escaped) {
            baseHealth -= 10;
            if (hudHp) hudHp.innerText = baseHealth;
            floatingTexts.push(new FloatingText("-10 HP", en.x + 35, en.y + 35, "red"));

            if (en.type === 'thief') {
                const moneyLost = 20;
                gold = Math.max(0, gold - moneyLost);
                floatingTexts.push(new FloatingText(`-$${moneyLost}`, en.x + 35, en.y + 10, "#e74c3c"));
                if (hudGold) hudGold.innerText = gold;
            }

            enemies.splice(i, 1);

            if (baseHealth <= 0) {
                baseHealth = 0;
                gameState = "gameover";
                showGameOver();
            }
            continue;
        }

        if (en.health <= 0 && !en.isDying) {
            en.isDying = true;
            gold += 10;
            floatingTexts.push(new FloatingText("+$5", en.x + 35, en.y + 35, "#FFD700"));
            for (let j = 0; j < 10; j++) {
                particles.push(new Particle(en.x + 35, en.y + 35, '#c0392b'));
            }
        }

        if (en.isDying) {
            en.size -= 2;
            if (en.size <= 0) enemies.splice(i, 1);
            continue;
        }
    }

    /* ========= Stage 3 ========= */
    bullets.forEach((b, i) => {

        b.update();
        b.draw();

        if (b.hit || !b.target || b.target.health <= 0) {
            bullets.splice(i, 1);
        }
    });

    /* ========= HUD ========= */

    towers = towers.filter(t => t.health > 0);
    hudHp.textContent = baseHealth;
    hudGold.textContent = gold;
}

/* ========================
   ✨ Particle System
======================== */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.alpha = 1;
        this.size = Math.random() * 4 + 2;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.03;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = "bold 28px Arial";
        ctx.textAlign = "center";
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
        ctx.globalAlpha = 1;
    }
}

/* ========================
   🎬 Animation
======================== */

function drawHoverEffect() {
    const gridX = Math.floor(mouse.x / cellSize) * cellSize;
    const gridY = Math.floor(mouse.y / cellSize) * cellSize;

    if (gridX >= 0 && gridX < canvas.width && gridY >= 0 && gridY < canvas.height) {
        ctx.save();
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 3;
        ctx.strokeRect(gridX + 5, gridY + 5, cellSize - 10, cellSize - 10);
        ctx.fillStyle = "rgba(74, 144, 226, 0.2)";
        ctx.fillRect(gridX + 5, gridY + 5, cellSize - 10, cellSize - 10);
        ctx.restore();
    }
}

function animate() {
    if (gameState === "submitted") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);


    if (gameState === "playing" && !isPaused) {
        timeUsedSeconds = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        const hudTime = document.getElementById("hud-time");
        if (hudTime) hudTime.innerText = timeUsedSeconds + "s";
    }

    drawGrid();

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    if (isPaused) {
        towers.forEach(t => t.draw());
        enemies.forEach(e => e.draw());
        requestAnimationFrame(animate);
        return;
    }

    if (gameState === "gameOver") {
        towers.forEach(t => t.draw());
        enemies.forEach(e => e.draw());
        return;
    }

    handleLogic();
    towers.forEach(t => t.draw());
    enemies.forEach(e => e.draw());
    bullets.forEach(b => b.draw());
    floatingTexts.forEach((text, i) => {
        text.update(); text.draw();
        if (text.alpha <= 0) floatingTexts.splice(i, 1);
    });

    frames++;
    requestAnimationFrame(animate);
}

pauseBtn.addEventListener("click", () => {
    isPaused = !isPaused;

    if (isPaused) {
        pauseStartTime = Date.now();
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Resume</span>';

        canvas.style.filter = "blur(10px)";
        canvas.style.pointerEvents = "none";
    } else {
        if (pauseStartTime) totalPausedTime += (Date.now() - pauseStartTime);
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause Game</span>';
        settingsMenu.style.display = "none";

        canvas.style.filter = "none";
        canvas.style.pointerEvents = "auto";
    }
});

function confirmAndExit() {
    if (gameState === "playing") {
        isPaused = true;
        timeUsedSeconds = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        showGameOver();
    }
}

homeBtn.addEventListener("click", confirmAndExit);

settingsToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = settingsMenu.style.display === "block";
    settingsMenu.style.display = isVisible ? "none" : "block";
});

document.addEventListener("click", () => {
    settingsMenu.style.display = "none";
});

settingsMenu.addEventListener("click", (e) => {
    e.stopPropagation();
});

tutorialBtn.addEventListener("click", () => {
    isPaused = true;
    pauseStartTime = Date.now();

    const imgStyle = "width:30px; height:30px; vertical-align:middle; margin:0 5px; border-radius:4px;";

    document.getElementById("tutorial-content").innerHTML = `
        <div style="line-height: 1.6;">
            • <b>Build Towers:</b> Click an insurance type then click the map.<br>
            • <b>Upgrade:</b> Click an existing tower to level it up.<br>
            • <b>Points:</b> You need to place at least <b>3 towers</b> to earn points.<br><br>
            
            <b>Counter Relationships:</b><br>
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; margin-top: 5px;">

                <img src="risk-image/fireready (1).png" style="${imgStyle}"> 
                <b>Fire</b> is countered by <b>Home</b><br>
                
                <img src="risk-image/floodready (1).png" style="${imgStyle}"> 
                <b>Flood</b> is countered by <b>Car/Home</b>

                <img src="risk-image/StreetThief.png" style="${imgStyle} object-fit:none; object-position: 0px -64px;"> 
                <b>Thief</b> is countered by <b>Car/Home</b><br>
                
                <img src="risk-image/virus.png" style="${imgStyle} object-fit:none; object-position: 0px 0px;"> 
                <b>Virus</b> is countered by <b>Medical</b><br>
                
            </div>
            <br>
            • <b>Goal:</b> Survive as many waves as possible.
            </div>`;
    tutorialModal.style.display = "flex";
});

closeTutorial.addEventListener("click", () => {
    const dontShowCheckbox = document.getElementById("dont-show-again");
    if (dontShowCheckbox && dontShowCheckbox.checked) {
        sessionStorage.setItem('skipRiskTutorial', 'true');
    }

    isPaused = false;
    tutorialModal.style.display = "none";

    if (pauseStartTime) totalPausedTime += (Date.now() - pauseStartTime);
});

floatingTexts.push(
    new FloatingText("Wave " + wave, GAME_WIDTH / 2, GAME_HEIGHT / 2, "white")
);

animate();

window.addEventListener('load', () => {
    const isSkip = sessionStorage.getItem('skipRiskTutorial');
    if (!isSkip) {
        tutorialBtn.click();
    }
});