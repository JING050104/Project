class SpinWheel {
    constructor(config) {

        this.modal = document.getElementById(config.modalId);
        this.openBtn = document.getElementById(config.openBtnId);
        this.closeBtn = document.getElementById(config.closeBtnId);
        this.wheel = document.getElementById(config.wheelId);
        this.spinBtn = document.getElementById(config.spinBtnId);
        this.rewardsList = document.getElementById(config.rewardsListId);

        this.rewards = config.rewards || [
            "Try Again", 
            "100 pts",   
            "20 pts",  
            "10 pts",  
            "5 pts", 
            "50 pts"    
        ];

        this.isSpinning = false;
        this.init();
    }

    async init() {
        if (this.openBtn) this.openBtn.onclick = () => this.show();
        if (this.closeBtn) this.closeBtn.onclick = () => this.hide();

        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        if (this.spinBtn) {
            this.spinBtn.onclick = () => this.startSpin();
        }

        try {
            const response = await fetch('/api/check-spin-status'); 
            const data = await response.json();
            
            if (data.canSpin === false || data.alreadySpun === true) {
                this.lockWheel("Tomorrow Again");
            }
            
        } catch (err) {
            console.error("Initialization check failed:", err);
        }
    }

    lockWheel(text) {
        this.isSpinning = true; 
        if (this.spinBtn) {
            this.spinBtn.disabled = true;
            this.spinBtn.textContent = text;
        }
    }

    show() {
        this.modal.style.display = "flex";
    }

    hide() {
        this.modal.style.display = "none";
    }

    startSpin() {
        if (this.isSpinning) return;
        this.isSpinning = true;

        this.wheel.style.transition = "none";
        this.wheel.style.transform = "rotate(0deg)";
        this.wheel.offsetWidth;

        this.wheel.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";

        const randomRotation = Math.floor(Math.random() * 360);
        const totalRotation = 1800 + randomRotation;

        this.wheel.style.transform = `rotate(${totalRotation}deg)`;

        this.spinBtn.disabled = true;
        this.spinBtn.textContent = "Spinning...";

        setTimeout(() => {
            this.processResult(randomRotation);
        }, 4000);
    }

    async processResult(rotation) {
        const actualAngle = rotation % 360;
        const rewardIndex = Math.floor(actualAngle / 60);
        const win = this.rewards[rewardIndex];

        if (win !== "Try Again") {
            try {
                const response = await fetch('/api/spin-reward', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reward: win })
                });

                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("text/html") || response.redirected) {
                    alert("Session expired. Please refresh and login again before spinning.");
                    window.location.href = "/index.html";
                    return;
                }

                const data = await response.json();
                if (response.ok) {
                    alert("Congratulations! Won: " + win);
                    this.updateRewardsUI(win);
                    this.spinBtn.disabled = true;
                    this.spinBtn.textContent = "Today Already Spin";
                    return; 
                } else {
                    alert("Error: " + (data.error || "Unknown error"));

                    if (data.error && data.error.includes("already spun")) {
                        this.spinBtn.disabled = true;
                        this.spinBtn.textContent = "Come back Tomorrow!";
                        this.isSpinning = true;
                        return;
                    }
                }
            } catch (err) {
                console.error("Sync error:", err);
                alert("Won: " + win + " (Sync failed. Check server console for SQL errors)");
            }
        }

        this.isSpinning = false;
        this.spinBtn.disabled = false;
        this.spinBtn.textContent = "SPIN NOW";
    }

    updateRewardsUI(win) {
        if (!this.rewardsList) return;

        if (this.rewardsList.innerHTML.includes("No rewards yet")) {
            this.rewardsList.innerHTML = "";
        }

        const li = document.createElement("li");
        li.textContent = "⭐ " + win;
        this.rewardsList.prepend(li);
    }
}

export default SpinWheel;