const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 100;

const hudHp = document.getElementById("hud-hp");
const hudGold = document.getElementById("hud-gold");
const hudWave = document.getElementById("hud-wave");

const timerDisplay = document.getElementById("timer");
const timeFill = document.getElementById("time-fill");
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");

let timeLeft = 60;
let countdown;

let towers = [];
let enemies = [];
let floatingTexts = [];

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
        this.x = x;
        this.y = y;
        this.type = type;

        if (type === 'home') {
            this.health = 800;
            this.color = '#e67e22';
            this.label = "Property";
        }
        else if (type === 'car') {
            this.health = 400;
            this.color = '#3498db';
            this.label = "Car";
        }
        else {
            this.health = 250;
            this.color = '#2ecc71';
            this.label = "Life";
        }

        this.maxHealth = this.health;
        this.attackPower = 1.2;
        this.range = 120;
        this.attackSpeed = 60;
        this.timer = 0;
    }

    draw() {
        // range
        ctx.beginPath();
        ctx.arc(this.x + 50, this.y + 50, this.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.stroke();

        // tower body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 10, this.y + 10, 80, 80);

        ctx.fillStyle = 'white';
        ctx.font = "bold 14px Arial";
        ctx.fillText(this.label, this.x + 30, this.y + 55);

        // health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x + 15, this.y + 80, 70, 5);

        ctx.fillStyle = 'lime';
        ctx.fillRect(
            this.x + 15,
            this.y + 80,
            (this.health / this.maxHealth) * 70,
            5
        );
    }
}

/* ========================
   👾 Enemy
======================== */

class Risk {
    constructor(y) {
        this.health = 5;
        this.x = canvas.width;
        this.y = y;

        const types = ['fire', 'flood', 'thief', 'virus'];
        this.type = types[Math.floor(Math.random() * types.length)];

        if (this.type === 'virus') {
            this.speed = 1.8;
            this.damage = 0.8;
            this.label = "🦠";
        }
        else if (this.type === 'fire') {
            this.speed = 0.8;
            this.damage = 1.8;
            this.label = "🔥";
        }
        else if (this.type === 'flood') {
            this.speed = 0.6;
            this.damage = 1.2;
            this.label = "🌊";
        }
        else {
            this.speed = 1.3;
            this.damage = 0.5;
            this.label = "👤";
        }
    }

    update() {
        this.x -= this.speed;
    }

    draw() {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(this.x + 50, this.y + 50, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.fillText(this.label, this.x + 40, this.y + 55);
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

canvas.addEventListener("click", (e) => {

    if (gameState !== "playing" || isPaused) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize) * cellSize;
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize) * cellSize;

    let existingTower = towers.find(t => t.x === x && t.y === y);

    if (existingTower) {
        let upgradeCost = 60 + existingTower.maxHealth / 50;

        if (gold >= upgradeCost) {
            gold -= upgradeCost;
            existingTower.attackPower += 0.5;
            existingTower.range += 10;
            existingTower.maxHealth += 100;
            existingTower.health += 100;
        }

        return; // ⭐ very important
    }

    let cost = 0;
    if (selectedType === "home") cost = 100;
    if (selectedType === "car") cost = 80;
    if (selectedType === "medical") cost = 60;

    if (gold >= cost) {
        gold -= cost;
        towers.push(new Insurance(x, y, selectedType));
    }
});

/* ========================
   🌊 Wave System
======================== */

function handleWave() {

    if (!waveInProgress) return;

    let spawnRate = 100;

    if (frames % spawnRate === 0 && enemiesSpawned < enemiesPerWave) {

        if (wave % 5 === 0 && enemiesSpawned === enemiesPerWave - 1) {
            enemies.push(new Boss(Math.floor(Math.random() * 5) * cellSize));
        } else {
            enemies.push(new Risk(Math.floor(Math.random() * 5) * cellSize));
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

    handleWave();

    towers.forEach(tower => {
        tower.timer++;

        enemies.forEach(enemy => {
            let dx = enemy.x - tower.x;
            let dy = enemy.y - tower.y;
            let dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < tower.range && tower.timer >= tower.attackSpeed) {
                enemy.health -= tower.attackPower;
                tower.timer = 0;
            }
        });
    });

    enemies.forEach((en, i) => {

        en.update();
        en.draw();

        if (en.health <= 0) {
            gold += 20;
            enemies.splice(i, 1);

            floatingTexts.push(
                new FloatingText("+20", en.x, en.y, "#f1c40f")
            );

            return;
        }

        if (en.x < -50) {
            baseHealth -= 10;
            enemies.splice(i, 1);

            if (baseHealth <= 0) {
                gameState = "gameOver";
            }
        }
    });

    towers = towers.filter(t => t.health > 0);

    hudHp.textContent = baseHealth;
    hudGold.textContent = gold;
    hudWave.textContent = wave;
}

/* ========================
   🎬 Animation
======================== */

function animate() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === "gameOver") {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
        return;
    }

    // ⭐ 重点：暂停逻辑
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

    frames++;
    requestAnimationFrame(animate);
}

floatingTexts.push(
    new FloatingText("Wave 1", canvas.width / 2 - 40, 100, "white")
);

function startTimer() {

    countdown = setInterval(() => {

        if (gameState !== "playing") return;

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

    pauseBtn.textContent = isPaused ? "▶" : "⏸";

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