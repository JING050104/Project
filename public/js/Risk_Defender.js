const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 100;

let towers = [];
let enemies = [];
let frames = 0;
let selectedType = 'home';

// --- 交互逻辑 ---
window.setTowerType = function(type) {
    selectedType = type;
    document.querySelectorAll('.controls button').forEach(btn => btn.classList.remove('active'));
    const id = type === 'medical' ? 'btn-medical' : `btn-${type}`;
    if(document.getElementById(id)) document.getElementById(id).classList.add('active');
};

// --- 保险塔类 (Tower) ---
class Insurance {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        if (type === 'home') { this.health = 800; this.color = '#e67e22'; this.label = "Property"; }
        else if (type === 'car') { this.health = 400; this.color = '#3498db'; this.label = "Car"; }
        else { this.health = 250; this.color = '#2ecc71'; this.label = "Life"; }
        this.maxHealth = this.health;
    }
    draw() {
        // 绘制保险盾牌
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 10, this.y + 10, 80, 80);
        ctx.fillStyle = 'white';
        ctx.font = "bold 14px Arial";
        ctx.fillText(this.label, this.x + 35, this.y + 55);
        // 血条
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x + 15, this.y + 80, 70, 5);
        ctx.fillStyle = 'lime';
        ctx.fillRect(this.x + 15, this.y + 80, (this.health/this.maxHealth) * 70, 5);
    }
}

// --- 风险怪类 (Attacker) ---
class Risk {
    constructor(y) {
        this.x = canvas.width;
        this.y = y;
        const types = ['fire', 'flood', 'thief', 'virus'];
        this.type = types[Math.floor(Math.random() * types.length)];
        
        // --- 核心属性差异化 ---
        if (this.type === 'virus') {
            this.speed = 1.8;  // 病毒：移动极快
            this.damage = 0.8;
            this.label = "🦠 病毒";
        } else if (this.type === 'fire') {
            this.speed = 0.8;  // 火灾：移动慢，但伤害极高
            this.damage = 1.8; 
            this.label = "🔥 火灾";
        } else if (this.type === 'flood') {
            this.speed = 0.2;  // 水灾：极其缓慢，持久折磨
            this.damage = 1.2;
            this.label = "🌊 水灾";
        } else {
            this.speed = 1.3;  // 小偷：均衡型
            this.damage = 0.3;
            this.label = "👤 小偷";
        }
    }
    update() { this.x -= this.speed; }
    draw() {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(this.x + 50, this.y + 50, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText(this.label, this.x + 25, this.y + 55);
    }
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const x = Math.floor(mouseX / cellSize) * cellSize;
    const y = Math.floor(mouseY / cellSize) * cellSize;

    console.log(`Touch: (${mouseX.toFixed(1)}, ${mouseY.toFixed(1)}) -> Grid: [${x/100}, ${y/100}]`);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
        if (!towers.some(t => t.x === x && t.y === y)) {
            towers.push(new Insurance(x, y, selectedType));
        }
    }
});

// --- 核心游戏引擎 ---
function handleLogic() {
    // 敌人生成速度随时间加快
    let spawnRate = Math.max(60, 150 - Math.floor(frames/500));
    if (frames % spawnRate === 0) enemies.push(new Risk(Math.floor(Math.random() * 5) * cellSize));

    enemies.forEach((en, i) => {
        en.update();
        en.draw();

        towers.forEach((tower, j) => {
            // 碰撞检测
            if (en.y === tower.y && en.x < tower.x + 70 && en.x + 30 > tower.x) {
                en.x += en.speed; // 停止移动
                
                // --- 核心保险相克逻辑 ---
                let finalDamage = en.damage;
                
                // 如果是正确的保险，伤害降低 80%
                if ((en.type === 'fire' || en.type === 'flood') && tower.type === 'home') finalDamage *= 0.2;
                if (en.type === 'thief' && tower.type === 'car') finalDamage *= 0.2;
                if (en.type === 'virus' && tower.type === 'medical') finalDamage *= 0.2;
                
                tower.health -= finalDamage;
            }
        });

        if (en.x < -50) { enemies.splice(i, 1); }
    });
    towers = towers.filter(t => t.health > 0);
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 绘制背景格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for(let i=0; i<900; i+=100) ctx.strokeRect(i, 0, 100, 500);
    
    towers.forEach(t => t.draw());
    handleLogic();
    frames++;
    requestAnimationFrame(animate);
}
animate();