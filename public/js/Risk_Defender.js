const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = 500;
const GAME_HEIGHT = 700;
const cellSize = 100;
const hudHp = document.getElementById("hud-hp");
const hudGold = document.getElementById("hud-gold");
const hudWave = document.getElementById("hud-wave");
const timerDisplay = document.getElementById("timer");
const timeFill = document.getElementById("time-fill");
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");
const mouse = { x: 0, y: 0 };
const canvasRect = canvas.getBoundingClientRect();
const path = [
    {x: 100, y: 0},
    {x: 100, y: 300},
    {x: 400, y: 300},
    {x: 400, y: 600}
];

let timeLeft = 60;
let countdown;
let towers = [];
let enemies = [];
let floatingTexts = [];
let bullets = [];
let frames = 0;
let selectedType = 'home';
let baseHealth = 100;
let gold = 200;
let wave = 1;
let enemiesPerWave = 10;
let enemiesSpawned = 0;
let waveInProgress = true;
let isPaused = false;
let gameState = "playing";
let closestTower = null;
let minDist = Infinity;

function setupCanvas() {
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}

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
    constructor(x, y, type) {
        this.id = Date.now() + Math.random();
        this.level = 1; //
        this.x = x;
        this.y = y;
        this.type = type;
        this.selected = false; 

        switch(type) {
            case 'home': 
                this.health = 800;
                this.color = '#e67e22';
                this.label = "Property";
                this.attackSpeed = 30; 
                this.attackPower = 1.0;
                this.range = 150;
                break;
            case 'car': 
                this.health = 400;
                this.color = '#3498db';
                this.label = "Car";
                this.attackSpeed = 90;
                this.attackPower = 3.5;
                this.range = 120;
                break;
            case 'medical': 
                this.health = 250;
                this.color = '#2ecc71';
                this.label = "Life";
                this.attackSpeed = 60;
                this.attackPower = 0;
                this.healRate = 0.1; 
                this.range = 100;
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
        let pulse = Math.sin(frames * 0.1) * 10 + 20; 
        ctx.arc(this.x + 50, this.y + 50, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(46, 204, 113, 0.3)";
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
    let upgradeCost = 60 + (this.level * 20); 
    if (gold >= upgradeCost) {
        gold -= upgradeCost;
        this.level++;
        
        this.attackPower *= 1.25; 
        this.range += 5;
        this.maxHealth += 100;
        this.health = Math.min(this.health + 100, this.maxHealth);
        
        floatingTexts.push(new FloatingText("-" + upgradeCost, this.x + 25, this.y + 50, "#e74c3c"));
        floatingTexts.push(new FloatingText("Lv." + this.level, this.x + 25, this.y + 20, "#f1c40f"));
    } else {
        floatingTexts.push(new FloatingText("No Gold!", this.x + 25, this.y + 50, "#bdc3c7"));
    }
}

    update() {
    this.isBuffed = false;

    if (this.type === 'medical') {
        this.healTimer++;
        
        if (this.healTimer >= 60) {
            towers.forEach(t => {
                let dist = Math.hypot(
                (t.x + 50) - (this.x + 50),
                (t.y + 50) - (this.y + 50)
            );
            if (dist < this.range && t !== this) {
                    if (t.health < t.maxHealth) {
                        t.health = Math.min(t.maxHealth, t.health + 10); // 每次恢复 10 点血
                        t.isBuffed = true;
                    }
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
    constructor(x,wave) {
        this.pathIndex = 0; 
        this.x = x;
        this.y = -100;
        this.size = 30;
        this.speed = 1.5;
        this.health = 5 + (wave * 5); 
        this.maxHealth = this.health;
        this.hitFlash = 0;
        this.escaped = false;

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

        let target = path[this.pathIndex + 1];
        if (target) {
            let dx = target.x - this.x;
            let dy = target.y - this.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.speed) {
                this.pathIndex++;
            } else {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }
        } else {
            this.escaped = true;  
        }
    }


    draw() {

    if (this.hitFlash > 0) {
        ctx.fillStyle = "white";
        this.hitFlash--;
    } else {
        ctx.fillStyle = '#c0392b';
    }

    ctx.beginPath();
    ctx.arc(this.x + 50, this.y + 50, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillText(this.label, this.x + 40, this.y + 55);
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
    constructor(y) {
        super(y);
        this.health = 40;
        this.speed = 0.7;
        this.damage = 3;
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

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize) * cellSize;
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize) * cellSize;

    let clickedTower = towers.find(t => t.x === x && t.y === y);

    if (clickedTower) {
        if (clickedTower.selected) {
            clickedTower.upgrade();
            console.log(`升级了塔: ${clickedTower.type}，当前等级: ${clickedTower.level}`);
        } else {
            towers.forEach(t => t.selected = false);
            clickedTower.selected = true;
            setTowerType(clickedTower.type); 
        }
        return; 
    }

    towers.forEach(t => t.selected = false);

    const isOccupied = towers.some(t => t.x === x && t.y === y);
    if (isOccupied) return;

    let cost = 0;
if (selectedType === "home") cost = 20;       // 修改为 20
else if (selectedType === "car") cost = 30;   // 修改为 30
else if (selectedType === "medical") cost = 80; // 修改为 80

if (gold >= cost) {
    gold -= cost;
    towers.push(new Insurance(x, y, selectedType));
} else {
    floatingTexts.push(new FloatingText("Insufficient Gold!", mouse.x, mouse.y, "#bdc3c7"));
}
});

/* ========================
   🌊 Wave System
======================== */

function handleWave() {

    if (!waveInProgress) return;

    let spawnRate = 150;
    if (frames % spawnRate === 0 && enemiesSpawned < enemiesPerWave) {
        if (wave % 5 === 0 && enemiesSpawned === enemiesPerWave - 1) {
            enemies.push(new Boss(Math.floor(Math.random() * 5) * cellSize));
        } else {
            enemies.push(new Risk(Math.floor(Math.random() * 5) * cellSize, wave));
        }
        enemiesSpawned++;
    }
    if (enemiesSpawned >= enemiesPerWave && enemies.length === 0) {

        waveInProgress = false;

        setTimeout(() => {
            wave++;
            enemiesPerWave += 2;
            enemiesSpawned = 0;
            waveInProgress = true;

            floatingTexts.push(
                new FloatingText(
                    "Wave " + wave,
                    canvas.width / 2 - 40,
                    100,
                    "white"
                )
            );

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

        tower.timer++;

        let target = null;
        let minDist = Infinity;

        enemies.forEach(enemy => {

            let dx = (enemy.x + 50) - (tower.x + 50);
            let dy = (enemy.y + 50) - (tower.y + 50);
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
            let dx = (en.x + 50) - (tower.x + 50);
            let dy = (en.y + 50) - (tower.y + 50);
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 50) { 
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

        if (en.escaped) {
            baseHealth -= 10;

            floatingTexts.push(
                new FloatingText("-10 HP", en.x, en.y, "red")
            );

            enemies.splice(i, 1);

            if (baseHealth <= 0) {
                baseHealth = 0;
                gameState = "gameOver";
            }

            return;
        }

        if (en.health <= 0 && !en.isDying && !en.escaped) {
            en.isDying = true;
            gold += 20;
            floatingTexts.push(new FloatingText("+$20", en.x, en.y, "#FFD700"));
            
            for(let j = 0; j < 10; j++) {
                particles.push(new Particle(en.x + 50, en.y + 50, '#c0392b'));
            }
        }

        if (en.isDying) {
            en.size -= 2; 
            if (en.size <= 0) {
                enemies.splice(i, 1); 
            }
            return; 
        }

        if (en.y > canvas.height) { 
            baseHealth -= 10; 
            enemies.splice(i, 1); 
            
            if (baseHealth <= 0) {
                baseHealth = 0;          
                gameState = "gameOver";
            }
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();      
    drawHoverEffect();

    if (gameState === "gameOver") {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
        return;
    }

    if (isPaused) {
        towers.forEach(t => t.draw());
        enemies.forEach(e => e.draw());

        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "white";
        ctx.font = "50px Arial";
        ctx.fillText("PAUSED", canvas.width / 2 - 100, canvas.height / 2);

        requestAnimationFrame(animate);
        return;   // 🛑 不执行 handleLogic
    }

    towers.forEach(t => t.draw());

    handleLogic();

    floatingTexts.forEach((text, i) => {
        text.update();
        text.draw();
        if (text.alpha <= 0) floatingTexts.splice(i, 1);
    });

    particles.forEach((p, i) => {
        p.update();
        p.draw();
        if (p.alpha <= 0) particles.splice(i, 1);
    });

    frames++;
    requestAnimationFrame(animate);
}

floatingTexts.push(
    new FloatingText("Wave 1", canvas.width / 2 - 40, 100, "white")
);

function startTimer() {

    countdown = setInterval(() => {

        if (gameState !== "playing" || isPaused) return;

        timeLeft--;

        timerDisplay.textContent = timeLeft;
        timeFill.style.width = (timeLeft / 60) * 100 + "%";

        if (timeLeft <= 0) {
            gameState = "gameOver";
            clearInterval(countdown);
        }

    }, 1000);
}

pauseBtn.addEventListener("click", () => {

    isPaused = !isPaused;

    if (isPaused) {
        pauseBtn.textContent = "▶";
        document.getElementById("wrapper").style.pointerEvents = "none";
    } else {
        pauseBtn.textContent = "⏸";
        document.getElementById("wrapper").style.pointerEvents = "auto";
    }

});

homeBtn.addEventListener("click", () => {

    const confirmLeave = confirm(
        "Your game progress will be lost. Are you sure?"
    );

    if (confirmLeave) {
        window.location.href = "dashboard.html";
    }

});

startTimer();
animate();