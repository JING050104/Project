const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hudHp = document.getElementById("hud-hp");
const hudGold = document.getElementById("hud-gold");
const hudWave = document.getElementById("hud-wave");
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");
const mouse = { x: 0, y: 0 };
const canvasRect = canvas.getBoundingClientRect();
const PLACEMENT_COOLDOWN = 2000;
const cellSize = 100;

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
let bossWarningTimer = 0;
let GAME_WIDTH, GAME_HEIGHT;
let gameMode = 'vertical'; 

function setupCanvas() {
    const paddingWidth = window.innerWidth * 0.95;
    const paddingHeight = window.innerHeight * 0.8;

    if (window.innerWidth > window.innerHeight || window.innerWidth > 800) {
        gameMode = 'horizontal';
        GAME_WIDTH = Math.floor(Math.min(1200, paddingWidth) / cellSize) * cellSize;
        GAME_HEIGHT = Math.floor(Math.min(600, paddingHeight) / cellSize) * cellSize;
    } else {
        gameMode = 'vertical';
        GAME_WIDTH = Math.floor(Math.min(600, paddingWidth) / cellSize) * cellSize;
        GAME_HEIGHT = Math.floor(Math.min(1000, paddingHeight) / cellSize) * cellSize;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    const container = document.querySelector('.canvas-wrapper');
    if (container) {
        const scale = Math.min(
            paddingWidth / GAME_WIDTH, 
            paddingHeight / GAME_HEIGHT
        );
        canvas.style.width = (GAME_WIDTH * scale) + "px";
        canvas.style.height = (GAME_HEIGHT * scale) + "px";
    }
    
    console.log(`Canvas Scaled to: ${GAME_WIDTH}x${GAME_HEIGHT}, Mode: ${gameMode}`);
}

window.addEventListener('resize', setupCanvas);
setupCanvas();

/* ========================
   🏰 Tower Class
======================== */

window.setTowerType = function(type) {
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

        if (type === "home") this.cost = 50;
        else if (type === "car") this.cost = 40;
        else if (type === "medical") this.cost = 60;

        switch(type) {
            case 'home': 
                this.health = 800;
                this.color = '#e67e22';
                this.label = "Property";
                this.attackSpeed = 30; 
                this.attackPower = 1.0;
                this.range = 200;
                break;
            case 'car': 
                this.health = 400;
                this.color = '#3498db';
                this.label = "Car";
                this.attackSpeed = 90;
                this.attackPower = 3.5;
                this.range = 150;
                break;
            case 'medical': 
                this.health = 250;
                this.color = '#2ecc71';
                this.label = "Life";
                this.attackSpeed = 60;
                this.attackPower = 0;
                this.range = 120;
                this.healTimer = 0; 
                break;
        }
        this.maxHealth = this.health; 
        this.timer = 0;
    }

    draw() {
    ctx.save();
        
    if (this.level >= 4 && this.level < 7) {
        ctx.translate(this.x + 50, this.y + 50);
        ctx.rotate(frames * 0.05); 
        ctx.strokeStyle = "white";
        ctx.strokeRect(-20, -20, 40, 40);
        ctx.restore(); 
    } else if (this.level >= 7) {
        ctx.beginPath();
        ctx.arc(this.x + 50, this.y + 50, 40, 0, Math.PI * 2);
        ctx.strokeStyle = "#f1c40f";
        ctx.lineWidth = 5;
        ctx.stroke();
    }

        ctx.beginPath();
        ctx.arc(this.x + 50, this.y + 50, this.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.setLineDash([5, 5]); 
        ctx.stroke();
        ctx.setLineDash([]); 

    if (this.selected) {
        ctx.strokeStyle = "#f1c40f"; 
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x + 5, this.y + 5, 90, 90);
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x + 10, this.y + 10, 80, 80);
    ctx.shadowBlur = 0; 

    ctx.fillStyle = 'red';
    ctx.fillRect(this.x + 15, this.y + 80, 70, 5);
    ctx.fillStyle = 'lime';
    ctx.fillRect(this.x + 15, this.y + 80, (this.health / this.maxHealth) * 70, 5);

    ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText("Lv." + this.level, this.x + 10, this.y + 20);

    if (this.type === 'medical') {
    ctx.beginPath();
    let speed = 0.1 + (this.level * 0.02);
    let maxRadius = 20 + (this.level * 5);
    let pulse = Math.sin(frames * speed) * 10 + maxRadius; 
    
    ctx.arc(this.x + 50, this.y + 50, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(46, 204, 113, ${0.5 - (this.level * 0.05)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
}

    if (this.isBuffed) {
        ctx.fillStyle = "#2ecc71";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("+", this.x + 50, this.y + 40);
    }
    
    ctx.restore();
}

    upgrade() {
    let upgradeCost = this.cost;
    if (gold >= upgradeCost) {
        gold -= upgradeCost;
        this.level++;
        
        if (this.type === 'medical') {
            this.range += 10; 
            floatingTexts.push(new FloatingText("Heal +", this.x + 25, this.y + 50, "#2ecc71"));
        } else {
            this.attackPower *= 1.25; 
            this.range += 5;
        }
        this.maxHealth += 100;
        this.health = Math.min(this.health + 100, this.maxHealth);
        
        floatingTexts.push(new FloatingText("-" + upgradeCost, this.x + 25, this.y + 50, "#e74c3c"));
        floatingTexts.push(new FloatingText("Lv." + this.level, this.x + 25, this.y + 20, "#f1c40f"));
    } else {
        floatingTexts.push(new FloatingText("Insufficient Gold!", this.x + 25, this.y + 50, "#bdc3c7"));
    }
}

    update() {
    this.isBuffed = false;

    if (this.type === 'medical') {
        this.healTimer++;
        if (this.healTimer >= 60) { 
            towers.forEach(t => {
                if (t === this) return;
                let dist = Math.hypot((t.x + 50) - (this.x + 50), (t.y + 50) - (this.y + 50));
                
                if (dist < this.range && t.health < t.maxHealth) {
                    let healAmount = 2 + (this.level * 3); 
                    t.health = Math.min(t.maxHealth, t.health + healAmount);
                    t.isBuffed = true;
                    
                    floatingTexts.push(new FloatingText("+" + healAmount, t.x + 50, t.y + 20, "#2ecc71"));
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
        this.hitFlash = 0;
        this.escaped = false;
        this.size = 30;
        this.speed = 1.5;
        this.health = 5 + (wave * 5); 
        this.maxHealth = this.health;
        this.hitFlash = 0;
        this.escaped = false;

        if (gameMode === 'horizontal') {
            const targetRow = Math.floor(pos / cellSize);
            this.spawnRow = targetRow;
            this.x = canvas.width; 
            this.y = targetRow * cellSize + (cellSize / 4); 
        } else {
            const targetCol = Math.floor(pos / cellSize);
            this.spawnCol = targetCol;
            this.x = targetCol * cellSize + (cellSize / 4);
            this.y = 0; 
        }

        const types = ['fire', 'flood', 'thief', 'virus'];
        this.type = types[Math.floor(Math.random() * types.length)];

        if (this.type === 'virus') {
            this.speed = 1.8;
            this.damage = 0.8;
            this.label = "🦠";
        } else if (this.type === 'fire') {
            this.speed = 0.8;
            this.damage = 1.8;
            this.label = "🔥";
        } else if (this.type === 'flood') {
            this.speed = 0.6;
            this.damage = 1.2;
            this.label = "🌊";
        } else {
            this.speed = 1.3;
            this.damage = 0.5;
            this.label = "👤";
        }

        this.baseSpeed = this.speed;
        this.blocked = false;

        this.attackTimer = 0;
        this.attackSpeed = 30;
    }

    update() {
        if (this.isDying) { this.size -= 2; return; }
        if (this.blocked) return;

        let targetX = (gameMode === 'horizontal') ? -50 : (this.spawnCol * cellSize + 50);
        let targetY = (gameMode === 'horizontal') ? (this.spawnRow * cellSize + 50) : (canvas.height + 50);
        let attractionTarget = null;
        let minDist = 180; 

        towers.forEach(t => {
            if (this.shouldBeAttractedTo(t)) {
                let dist = Math.hypot((t.x + 50) - this.x, (t.y + 50) - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    attractionTarget = t;
                }
            }
        });

        if (attractionTarget) {
            targetX = attractionTarget.x + 50;
            targetY = attractionTarget.y + 50;
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
        if (this.type === 'thief' && (t.type === 'car' || t.type === 'home')) return true;
        if (this.type === 'virus' && t.type === 'medical') return true;
        if ((this.type === 'flood' || this.type === 'fire') && (t.type === 'car' || t.type === 'home')) return true;
        return false;
    }

    draw() {

    if (this.hitFlash > 0) {
        ctx.fillStyle = "white";
        this.hitFlash--;
    } else {
        ctx.fillStyle = '#c0392b';
    }

    ctx.fillStyle = 'black';
    ctx.fillRect(this.x + 30, this.y + 15, 40, 4); // Background
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x + 30, this.y + 15, (this.health / this.maxHealth) * 40, 4); // Health fill

    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(this.label, this.x + 40, this.y + 60);
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

        let dx = (this.target.x + 50) - this.x;
        let dy = (this.target.y + 50) - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            this.target.health -= this.damage;
            floatingTexts.push(new FloatingText("-" + this.damage.toFixed(1), this.target.x + 40, this.target.y + 40, "yellow"));
            for(let i = 0; i < 5; i++) {
                floatingTexts.push(new Particle(this.target.x, this.target.y));
            }
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
   👑 Boss 
======================== */
class Boss extends Risk {
    constructor(x, wave) {
        super(x, wave);
        this.offsetX = (Math.random() - 0.5) * 10;
        this.offsetY = (Math.random() - 0.5) * 10;
        this.health = 50 + (wave * 30); 
        this.maxHealth = this.health;
        this.speed = 0.6; 
        this.damage = 5 + Math.floor(wave / 5); 
        this.label = "👑";
    }
}

/* ========================
   ✨ Floating Text
======================== */

class FloatingText {
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.alpha = 1;
    }

    update() {
        this.y -= 0.5;
        this.alpha -= 0.02;
    }

    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = "bold 20px Arial";
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

/* ========================
   🖱 Placement / Upgrade
======================== */

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener("click", (e) => {
    if (gameState !== "playing" || isPaused) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 1. 获取点击位置并强制转换
    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;

    // --- 修复：防止边缘像素溢出导致的“点不到” ---
    // 确保坐标不会因为微小偏移变成负数或超出最大宽度
    clickX = Math.max(0, Math.min(clickX, canvas.width - 1));
    clickY = Math.max(0, Math.min(clickY, canvas.height - 1));

    // 2. 计算格子索引
    const gridX = Math.floor(clickX / cellSize);
    const gridY = Math.floor(clickY / cellSize);

    // 3. 计算对齐后的塔位置
    const towerX = gridX * cellSize;
    const towerY = gridY * cellSize;

    // 调试打印：如果还点不到，请看 F12 这里的输出
    console.log(`Real Click: ${clickX.toFixed(2)}, Grid Index: ${gridX}`);

    // 4. 检查是否已有塔 (修正：使用刚才计算出的对齐坐标 towerX, towerY)
    let clickedTower = towers.find(t => t.x === towerX && t.y === towerY);

    if (clickedTower) {
        if (clickedTower.selected) {
            clickedTower.upgrade();
        } else {
            towers.forEach(t => t.selected = false);
            clickedTower.selected = true;
            if (typeof setTowerType === "function") setTowerType(clickedTower.type); 
        }
        return; 
    }

    const now = Date.now();
    if (now - lastPlacementTime < PLACEMENT_COOLDOWN) {
        floatingTexts.push(new FloatingText("Cooling down!", mouse.x, mouse.y, "#e74c3c"));
        return;
    }

    towers.forEach(t => t.selected = false);
    
    // 再次确认占用
    const isOccupied = towers.some(t => t.x === towerX && t.y === towerY);
    if (isOccupied) return;

    // 5. 计算价格并放置
    let cost = 0;
    if (selectedType === "home") cost = 50;
    else if (selectedType === "car") cost = 40;
    else if (selectedType === "medical") cost = 60;

    if (gold >= cost) {
        gold -= cost;
        // 关键：push 进去的坐标必须是 towerX 和 towerY
        towers.push(new Insurance(towerX, towerY, selectedType)); 
        hasPlacedTower = true; 
        lastPlacementTime = now; 
        if (typeof updateHUD === "function") updateHUD();
    } else {
        floatingTexts.push(new FloatingText("Insufficient Gold!", mouse.x, mouse.y, "#bdc3c7"));
    }
});

function showGameOver() {
    if (gameState === "gameOver" || gameState === "submitted") return;
    gameState = "gameOver";

    const modal = document.getElementById("game-over-modal");
    const finalWaveTxt = document.getElementById("final-wave");
    const finalGoldTxt = document.getElementById("final-gold");
    const placementStatusTxt = document.getElementById("placement-status");
    const finalTimeDisplay = document.getElementById("final-time");

    let finalPoints = gold - 200; 
    if (finalPoints < 0) finalPoints = 0;

    if (!hasPlacedTower) {
        finalPoints = 0; 
        if (placementStatusTxt) {
            placementStatusTxt.textContent = "Warning: No towers were placed! 0 Points earned.";
            placementStatusTxt.style.color = "#e74c3c"; // 红色
        }
    } else {
        if (placementStatusTxt) {
            placementStatusTxt.textContent = "Towers successfully deployed.";
            placementStatusTxt.style.color = "#2ecc71"; // 绿色
        }
    }

    if (finalWaveTxt) finalWaveTxt.innerText = wave;
    if (finalGoldTxt) finalGoldTxt.innerText = finalPoints;
    if (finalTimeDisplay) finalTimeDisplay.innerText = timeUsedSeconds + "s";
    if (modal) modal.style.display = "flex";

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
        if (gameMode === 'horizontal') {
            let maxRows = Math.floor(canvas.height / cellSize);
            let startY = Math.floor(Math.random() * maxRows) * cellSize;
            enemies.push(new Risk(startY, wave));
        } else {
            let maxCols = Math.floor(canvas.width / cellSize);
            let startX = Math.floor(Math.random() * maxCols) * cellSize;
            enemies.push(new Risk(startX, wave));
        }
        enemiesSpawned++;
    }

    if (enemiesSpawned >= totalEnemiesThisWave && enemies.length === 0) {
        waveInProgress = false;

        if (hasPlacedTower) {
            let bonus = 30;
            gold += bonus; 
            floatingTexts.push(new FloatingText(`+${bonus} Gold!`, canvas.width / 2, canvas.height / 2, "#FFD700"));
        }

        setTimeout(() => {
            if (gameState === "playing") {
                wave++;
                enemiesSpawned = 0; 
                waveInProgress = true; 
                floatingTexts.push(new FloatingText("Wave " + wave, canvas.width / 2 - 40, 100, "white"));
            }
        }, 2000);
    }
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
        if (tower.type === 'medical') return;
        tower.timer++;

        let target = null;
        let minDist = Infinity;

        enemies.forEach(enemy => {
        let enemyCenterX = enemy.x + 15; 
        let enemyCenterY = enemy.y + 15;
        let towerCenterX = tower.x + 50;
        let towerCenterY = tower.y + 50;

        let dx = enemyCenterX - towerCenterX;
        let dy = enemyCenterY - towerCenterY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < tower.range && dist < minDist) {
            minDist = dist;
            target = enemy;
        }
    });

        if (target && tower.timer >= tower.attackSpeed) {

            bullets.push(
                new Bullet(
                    tower.x + 50,
                    tower.y + 50,
                    target,
                    tower.attackPower
                )
            );
            tower.timer = 0;

            ctx.strokeStyle = "yellow";
            ctx.beginPath();
            ctx.moveTo(tower.x + 50, tower.y + 50);
            ctx.lineTo(target.x + 50, target.y + 50);
            ctx.stroke();
        }
    });

   /* ========= Stage 2 ========= */
    for (let i = enemies.length - 1; i >= 0; i--) {
    let en = enemies[i];
    en.blocked = false; 

    towers.forEach(tower => {
        let dist = Math.hypot((en.x + 20) - (tower.x + 50), (en.y + 20) - (tower.y + 50));
        if (dist < 60) { 
        en.blocked = true;
            en.attackTimer++;
            if (en.attackTimer >= en.attackSpeed) {
                tower.health -= en.damage;
                en.attackTimer = 0;
            }
        }
    });

    en.update(); 
    en.draw();

    if (en.health <= 0 && !en.isDying) {
        en.isDying = true;
        gold += 5;
        floatingTexts.push(new FloatingText("+$5", en.x, en.y, "#FFD700"));
        for(let j = 0; j < 10; j++) particles.push(new Particle(en.x + 50, en.y + 50, '#c0392b'));
    }

    if (en.isDying) {
        en.size -= 2; 
        if (en.size <= 0) enemies.splice(i, 1);
        continue;
    }

    if (en.escaped) { 
        baseHealth -= 10; 
        floatingTexts.push(new FloatingText("-10 HP", en.x, en.y, "red"));
        enemies.splice(i, 1); 
        
        if (baseHealth <= 0) {
            baseHealth = 0;          
            gameState = "gameover";
            showGameOver();
        }
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
    hudWave.textContent = wave;
}

/* ========================
    ℹ️ Information Tooltip
======================== */
window.showInfo = function(type) {
    const tooltip = document.getElementById('shop-tooltip');
    
    const temp = new Insurance(0, 0, type);
    let details = "";

    if (type === 'medical') {
        details = `
            <strong>🏥 Medical Insurance</strong><br>
            💚 Heal: 10 HP/pulse<br>
            🎯 Range: ${temp.range}<br>
            🛡️ Tower HP: ${temp.health}
        `;
    } else {
        const icon = type === 'home' ? '🏠' : '🚗';
        const name = type === 'home' ? 'Property' : 'Car';
        const speed = (60 / temp.attackSpeed).toFixed(1);
        
        details = `
            <strong>${icon} ${name} Insurance</strong><br>
            💥 Damage: ${temp.attackPower.toFixed(1)}<br>
            ⏱ Speed: ${speed} hits/sec<br>
            🎯 Range: ${temp.range}
        `;
    }

    tooltip.innerHTML = details;
    tooltip.style.display = 'block';
};

window.hideInfo = function() {
    const tooltip = document.getElementById('shop-tooltip');
    tooltip.style.display = 'none';
};

// Make the tooltip follow the mouse cursor
document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('shop-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.pageX + 15) + 'px';
        tooltip.style.top = (e.pageY + 15) + 'px';
    }
});

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
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

let particles = [];

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

function drawGrid() {
    ctx.save(); 
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; // 浅白色半透明边框
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore(); 
}

function animate() {
    if (gameState === "submitted") return;

    if (gameState === "playing" && !isPaused) {
        timeUsedSeconds = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        const hudTime = document.getElementById("hud-time");
        if (hudTime) hudTime.innerText = timeUsedSeconds + "s";
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();      

    if (isPaused) {
        towers.forEach(t => t.draw());
        enemies.forEach(e => e.draw());
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "50px Arial";
        ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(animate);
        return; 
    }

    if (gameState === "gameOver") {
        towers.forEach(t => t.draw());
        enemies.forEach(e => e.draw());
        return; 
    }

    towers.forEach(t => t.draw());
    handleLogic(); 

    if (bossWarningTimer > 0) {
        drawBossWarning(); 
        bossWarningTimer--;
    }
    floatingTexts.forEach((text, i) => {
        text.update(); text.draw();
        if (text.alpha <= 0) floatingTexts.splice(i, 1);
    });

    frames++;
    requestAnimationFrame(animate);
}

floatingTexts.push(
    new FloatingText("Wave 1", canvas.width / 2 - 40, 100, "white")
);


pauseBtn.addEventListener("click", () => {

    isPaused = !isPaused;

    if (isPaused) {
        pauseStartTime = Date.now(); 
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        document.getElementById("wrapper").style.pointerEvents = "none";
    } else {
        if (pauseStartTime) {
            totalPausedTime += (Date.now() - pauseStartTime); 
        }
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        document.getElementById("wrapper").style.pointerEvents = "auto";
    }
});

function confirmAndExit() {
    const confirmLeave = confirm(
        "Your game progress will be lost. Are you sure?"
    );
    if (confirmLeave) {
        window.location.href = "dashboard.html";
    }
}

homeBtn.addEventListener("click", confirmAndExit);

const logoLink = document.querySelector('.logo');
if (logoLink) {
    logoLink.style.cursor = "pointer"; 
    logoLink.addEventListener("click", confirmAndExit);
}

animate();