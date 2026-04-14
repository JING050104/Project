let imageList = [];
let allData = {};
let currentAnnotations = [];
let currentIndex = 0;
let totalScore = 0;
let isPaused = false;
let isGameOver = false;
let startTime;
let totalPausedTime = 0;
let pauseStartTime;
let timerInterval;
let timeUsedSeconds = 0;
let chances = 3;

const heartsContainer = document.getElementById('hearts-container');
const MAX_CHANCES = 3;
const imgElement = document.getElementById('risk-image');
const msgElement = document.getElementById('message');
const wrapper = document.getElementById('wrapper');
const scoreDisplay = document.getElementById('score-count');
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreDisplay = document.getElementById('final-score');
const settingsToggleBtn = document.getElementById("settings-toggle-btn");
const settingsMenu = document.getElementById("settings-menu");
const homeBtn = document.getElementById("home-btn");
const pauseBtn = document.getElementById("pause-btn");
const tutorialBtn = document.getElementById("tutorial-btn");
const tutorialModal = document.getElementById("tutorial-modal");
const closeTutorial = document.getElementById("close-tutorial");

document.addEventListener("click", () => {
    settingsMenu.style.display = "none";
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

    updateHeartsUI();

    document.querySelectorAll('.feedback-marker').forEach(m => m.remove());

    imgElement.onload = () => {
        msgElement.innerText = `Level ${currentIndex + 1}`;
        msgElement.style.color = "";
        const currentImageObj = allData.images[currentIndex];
        currentAnnotations = allData.annotations.filter(ann => ann.image_id === currentImageObj.id);
    };
}

imgElement.onclick = function (e) {
    if (isPaused || isGameOver) return;

    const x = e.offsetX;
    const y = e.offsetY;

    const rect = imgElement.getBoundingClientRect();
    const markerX = x + (imgElement.offsetLeft);
    const markerY = y + (imgElement.offsetTop);

    const scaleX = imgElement.naturalWidth / imgElement.clientWidth;
    const scaleY = imgElement.naturalHeight / imgElement.clientHeight;

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


function updateHeartsUI() {
    if (!heartsContainer) return;

    let heartsHTML = '';
    for (let i = 0; i < MAX_CHANCES; i++) {
        if (i < chances) {
            heartsHTML += '<i class="fa-solid fa-heart"></i>';
        } else {
            heartsHTML += '<i class="fa-regular fa-heart"></i>';
        }
    }
    heartsContainer.innerHTML = heartsHTML;
}

function handleFailure(x, y) {
    chances--;
    updateHeartsUI();
    createFeedbackMarker(x, y, 'wrong');

    if (chances > 0) {
        if (msgElement) {
            msgElement.innerText = `Try again. ${chances} lives left.`;
            msgElement.style.color = "#f59e0b";
        }
    } else {
        imgElement.style.pointerEvents = "none";

        if (msgElement) {
            msgElement.innerText = "Game Over! No more chances.";
            msgElement.style.color = "#ef4444";
        }

        setTimeout(endGame, 1000);
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

    clearInterval(timerInterval);

    let endTime = Date.now();
    let timeUsedMS = endTime - startTime - totalPausedTime;
    let finalSeconds = Math.floor(timeUsedMS / 1000);

    let progressPercent = imageList.length > 0 ? Math.floor((currentIndex / imageList.length) * 100) : 0;
    let beatPercent = Math.min(99, progressPercent + Math.floor(Math.random() * 10));

    document.getElementById('final-score').innerText = totalScore;
    document.getElementById('final-level').innerText = currentIndex;

    const finalTimeElem = document.getElementById('final-time-display');
    if (finalTimeElem) finalTimeElem.innerText = finalSeconds + "s";

    const feedbackText = document.getElementById('game-feedback-text');
    feedbackText.innerHTML = `You reached level <b>${currentIndex}</b> <br>surpassing <b>${beatPercent}%</b> player！`;

    document.getElementById('game-over-modal').style.display = 'flex';

    const dataToSend = {
        score: totalScore,
        reached_level: currentIndex,
        gameType: 'RiskFinder',
        time_used: finalSeconds,
    };
    fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
    }).catch(err => console.error("Sync error:", err));
}

function createFeedbackMarker(x, y, type) {
    const marker = document.createElement('div');
    marker.className = `feedback-marker marker-${type}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    wrapper.appendChild(marker);
}

function confirmAndExit() {

    if (!isGameOver) {
        endGame();
    }
}

homeBtn.addEventListener("click", confirmAndExit);

pauseBtn.addEventListener("click", () => {
    isPaused = !isPaused;
    if (isPaused) {
        pauseStartTime = Date.now();
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Resume</span>';
        wrapper.style.pointerEvents = "none";
        imgElement.style.filter = "blur(15px)";
    } else {
        totalPausedTime += (Date.now() - pauseStartTime);
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause</span>';
        wrapper.style.pointerEvents = "auto";
        imgElement.style.filter = "none";
        settingsMenu.style.display = "none";
    }
});

tutorialBtn.addEventListener("click", () => {
    isPaused = true;
    pauseStartTime = Date.now();
    imgElement.style.filter = "blur(10px)";
    wrapper.style.pointerEvents = "none";

    document.getElementById("tutorial-content").innerHTML = `
        • <b>Find Risks:</b> Look for hazards and click them.<br>
        • <b>Scoring System:</b>
            <ul style="margin: 5px 0 5px 20px; list-style-type: none; padding: 0;">
                <li>1st attempt: 3 Points</li>
                <li>2nd attempt: 2 Points</li>
                <li>3rd attempt: 1 Point</li>
            </ul>
        • <b>Chances:</b> You have 3 attempts per level.<br>
        • <b>Goal:</b> Find all risks to reach the next level.`;

    tutorialModal.style.display = "flex";
    settingsMenu.style.display = "none";
});

closeTutorial.addEventListener("click", () => {
    const dontShowCheckbox = document.getElementById("dont-show-again-finder");
    if (dontShowCheckbox && dontShowCheckbox.checked) {
        sessionStorage.setItem('skipRiskFinderTutorial', 'true');
    }

    tutorialModal.style.display = "none";
    imgElement.style.filter = "none";
    wrapper.style.pointerEvents = "auto";
    isPaused = false;
    
    if (pauseStartTime) {
        totalPausedTime += (Date.now() - pauseStartTime);
    }
});

settingsToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = settingsMenu.style.display === "block";
    settingsMenu.style.display = isVisible ? "none" : "block";
});

window.addEventListener('load', () => {
    const isSkip = sessionStorage.getItem('skipRiskFinderTutorial');
    if (!isSkip) {
        tutorialBtn.click();
    }
});

initGame();