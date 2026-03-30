// 1. GLOBAL STATE
let imageList = [];
let allData = {};
let currentAnnotations = [];
let currentIndex = 0;
let chances = 3;
let totalScore = 0;
let isPaused = false;
let isGameOver = false;
let startTime;
let totalPausedTime = 0;
let pauseStartTime;
let timerInterval;
let timeUsedSeconds = 0;

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
const pauseBtn = document.getElementById("pause-btn");
const homeBtn = document.getElementById("home-btn");
const pauseIcon = document.getElementById("pause-icon");

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

pauseBtn.addEventListener("click", () => {
    isPaused = !isPaused;

    if (isPaused) {
        pauseStartTime = Date.now();
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        wrapper.style.pointerEvents = "none";
        imgElement.style.filter = "blur(15px)";
        msgElement.innerText = "GAME PAUSED";
    } else {
        totalPausedTime += (Date.now() - pauseStartTime);

        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        wrapper.style.pointerEvents = "auto";
        imgElement.style.filter = "none";
        msgElement.innerText = "";
    }
});

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
        if (imageList.length > 0) {
            startTime = Date.now();
            startRealTimeTimer();
            loadLevel();
        }
    } catch (err) {
        msgElement.innerText = "Connection Error.";
    }
}

function startRealTimeTimer() {
    const timeDisplay = document.getElementById('time-spent');
    timerInterval = setInterval(() => {
        if (!isPaused && !isGameOver) {
            let currentTime = Date.now();
            let elapsed = Math.floor((currentTime - startTime - totalPausedTime) / 1000);
            timeUsedSeconds = elapsed;

            if (timeDisplay) {
                timeDisplay.innerText = timeUsedSeconds + "s";
            }
        }
    }, 1000);
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

imgElement.onclick = function (e) {
    if (isPaused || isGameOver) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const imgRect = imgElement.getBoundingClientRect();

    const markerX = e.clientX - wrapperRect.left;
    const markerY = e.clientY - wrapperRect.top;

    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;

    if (x < 0 || y < 0 || x > imgRect.width || y > imgRect.height) return;

    const scaleX = imgElement.naturalWidth / imgRect.width;
    const scaleY = imgElement.naturalHeight / imgRect.height;
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
        handleSuccess(markerX, markerY); 
    } else {
        handleFailure(markerX, markerY);
    }
};

function handleSuccess(x, y) {
    imgElement.style.pointerEvents = "none";
    let pointsEarned = chances;
    totalScore += pointsEarned;

    msgElement.innerText = `Perfect! You get ${pointsEarned} Points!`;
    msgElement.style.color = "#22c55e";

    if (scoreDisplay) scoreDisplay.innerText = totalScore;

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
    if (isGameOver) return;
    isGameOver = true;
    let endTime = Date.now();
    let timeUsedMS = endTime - startTime - totalPausedTime;
    let timeUsedSeconds = Math.floor(timeUsedMS / 1000);

    document.getElementById('final-score').innerText = totalScore;
    const finalTimeElem = document.getElementById('final-time-display');
    if (finalTimeElem) {
        finalTimeElem.innerText = timeUsedSeconds + "s";
    }
    document.getElementById('game-over-modal').style.display = 'flex';

    const dataToSend = {
        score: totalScore,
        reached_level: currentIndex,
        gameType: 'RiskFinder',
        time_used: timeUsedSeconds,
    };

    console.log("Saving final score...", dataToSend);

    fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
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