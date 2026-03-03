// 1. GLOBAL STATE
let imageList = [];
let allData = {}; 
let currentAnnotations = []; 
let currentIndex = 0;
let chances = 3;
let totalScore = 0;
let timeLeft = 60; // 秒数
let isPaused = false;
let countdown;

// 2. DOM ELEMENTS
const imgElement = document.getElementById('risk-image');
const msgElement = document.getElementById('message');
const riskCountDisplay = document.getElementById('risk-count');
const wrapper = document.getElementById('wrapper');
const scoreDisplay = document.getElementById('score-count'); 

// NEW: Elements for the Game Over Modal
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreDisplay = document.getElementById('final-score');

// 3. CONFIGURATION
const timerDisplay = document.getElementById("timer");
const timerBox = document.getElementById("timer-box");
const timeFill = document.getElementById("time-fill");
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");
const pauseIcon = document.getElementById("pause-icon");

function startTimer() {
    countdown = setInterval(() => {

        if (!isPaused) {
            timeLeft--;
            timerDisplay.textContent = timeLeft;

            timeFill.style.width = (timeLeft / 60) * 100 + "%";

            if (timeLeft <= 10) {
                timerBox.classList.add("timer-warning");
                timeFill.style.background = "#ff2e2e";
            }

            if (timeLeft <= 0) {
                clearInterval(countdown);
                endGameByTime();
            }
        }

    }, 1000);
}

startTimer();

homeBtn.addEventListener("click", () => {

    const confirmLeave = confirm(
        "Your game progress will be lost. Are you sure?"
    );

    if (confirmLeave) {
        window.location.href = "dashboard.html";
    }

});

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

function endGameByTime() {
    document.getElementById("final-score").textContent =
        document.getElementById("score-count").textContent;

    document.getElementById("game-over-modal").style.display = "flex";
}

document.body.classList.add("flash-red");
setTimeout(() => {
    document.body.classList.remove("flash-red");
}, 200);

const BASE_PATH = '/image/valid'; 

async function initGame() {
    try {
        const jsonPath = `${BASE_PATH}/_annotations.coco.json`;
        const response = await fetch(jsonPath);
        if (!response.ok) throw new Error("JSON data not found");
        allData = await response.json();
        imageList = allData.images.map(img => `${BASE_PATH}/${img.file_name}`);
        if (imageList.length > 0) loadLevel();
    } catch (err) {
        msgElement.innerText = "Connection Error.";
    }
}

function loadLevel() {
    chances = 3; 
    imgElement.src = imageList[currentIndex];
    imgElement.style.pointerEvents = "auto";
    imgElement.style.opacity = "1";
    riskCountDisplay.innerText = chances; 
    
    document.querySelectorAll('.feedback-marker').forEach(m => m.remove());

    imgElement.onload = () => {
        msgElement.innerText = ``;
        msgElement.style.color = "";
        const currentImageObj = allData.images[currentIndex];
        currentAnnotations = allData.annotations.filter(ann => ann.image_id === currentImageObj.id);
    };
}

imgElement.onclick = function(e) {
    const rect = imgElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const scaleX = imgElement.naturalWidth / rect.width;
    const scaleY = imgElement.naturalHeight / rect.height;
    const clickX = x * scaleX;
    const clickY = y * scaleY;

    let found = false;
    currentAnnotations.forEach(ann => {
        const [bx, by, bw, bh] = ann.bbox; 
        if (clickX >= bx && clickX <= bx + bw && clickY >= by && clickY <= by + bh) {
            found = true;
        }
    });

    if (found) {
        handleSuccess(x, y);
    } else {
        handleFailure(x, y);
    }
};

function handleSuccess(x, y) {
    imgElement.style.pointerEvents = "none";
    let pointsEarned = chances; 
    totalScore += pointsEarned;

    msgElement.innerText = `Perfect! You get ${pointsEarned} Points!`;
    msgElement.style.color = "#22c55e";
    
    if(scoreDisplay) scoreDisplay.innerText = totalScore;

    createFeedbackMarker(x, y, 'correct');
    setTimeout(goToNextLevel, 1200);
}

function handleFailure(x, y) {
    chances--;
    riskCountDisplay.innerText = chances;
    createFeedbackMarker(x, y, 'wrong');
    
    if (chances > 0) {
        msgElement.innerText = `Try again. You still have ${chances} chances left.`;
        msgElement.style.color = "#f59e0b";
    } else {
        imgElement.style.pointerEvents = "none";
        msgElement.innerText = "Out Of Chances! Moving to next image...";
        msgElement.style.color = "#ef4444";
        
        setTimeout(goToNextLevel, 1500); 
    }
}

function goToNextLevel() {
    currentIndex++;
    if (currentIndex < imageList.length) {
        loadLevel();
    } else {
        endGame();
    }
}

function endGame() {
    document.getElementById('final-score').innerText = totalScore;
    document.getElementById('game-over-modal').style.display = 'flex';

    // 2. 将分数发送到数据库 (注意：不需要传 userId，后端会自动识别)
    fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: totalScore })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Database response:", data.message);
    })
    .catch(err => console.error("Sync error:", err));
}

function createFeedbackMarker(x, y, type) {
    const marker = document.createElement('div');
    marker.className = `feedback-marker marker-${type}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    wrapper.appendChild(marker);
}

async function redeemVoucher(voucherName, cost) {
    if (!confirm(`Spend ${cost} points for ${voucherName}?`)) return;

    try {
        const response = await fetch('/api/redeem-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voucherName, cost }) //
        });

        const result = await response.json();

        if (response.ok) {
            alert("Redemption Successful!");
            initRewards(); 
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (err) {
        console.error("Redeem request failed:", err);
    }
}

initGame();