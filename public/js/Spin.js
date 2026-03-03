class SpinWheel {
    constructor(config) {
        // 1. Initialize DOM Elements using the provided config IDs
        this.modal = document.getElementById(config.modalId);
        this.openBtn = document.getElementById(config.openBtnId);
        this.closeBtn = document.getElementById(config.closeBtnId);
        this.wheel = document.getElementById(config.wheelId);
        this.spinBtn = document.getElementById(config.spinBtnId);
        this.rewardsList = document.getElementById(config.rewardsListId);

        // 2. Setup Reward Array (Matching the HTML labels counter-clockwise)
        this.rewards = config.rewards || [
            "Try Again", // 0-59 deg
            "100 pts",   // 60-119 deg
            "XP Boost",  // 120-179 deg
            "10 pts",    // 180-239 deg
            "Free Life", // 240-299 deg
            "50 pts"     // 300-359 deg
        ];

        this.isSpinning = false;
        this.init();
    }

    /**
     * Set up event listeners for the modal and spin button
     */
    init() {
        // Modal Controls
        if (this.openBtn) this.openBtn.onclick = () => this.show();
        if (this.closeBtn) this.closeBtn.onclick = () => this.hide();
        
        // Close modal when clicking outside the card
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        // Spin Action
        if (this.spinBtn) {
            this.spinBtn.onclick = () => this.startSpin();
        }
    }

    show() {
        this.modal.style.display = "flex";
    }

    hide() {
        this.modal.style.display = "none";
    }

    /**
     * Handles the rotation animation
     */
    startSpin() {
        if (this.isSpinning) return;
        this.isSpinning = true;

        // Generate random rotation (0-359)
        const randomRotation = Math.floor(Math.random() * 360);
        // Spin 5 full times (1800deg) plus the random amount for visual effect
        const totalRotation = 1800 + randomRotation;

        // Apply visual rotation to the CSS transform
        this.wheel.style.transform = `rotate(${totalRotation}deg)`;
        
        // Update button state
        this.spinBtn.disabled = true;
        this.spinBtn.textContent = "Spinning...";

        // Wait 4 seconds for the CSS transition to finish
        setTimeout(() => {
            this.processResult(randomRotation);
        }, 4000);
    }

    /**
     * Calculates the reward based on the final angle
     */
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
                if (typeof initRewards === 'function') initRewards(); 
            } else {
                alert("Error: " + (data.error || "Unknown error"));
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

        // Remove placeholder text if it exists
        if (this.rewardsList.innerHTML.includes("No rewards yet")) {
            this.rewardsList.innerHTML = "";
        }

        // Create new list item
        const li = document.createElement("li");
        li.textContent = "⭐ " + win;
        this.rewardsList.prepend(li); 
    }
}

// Export the class as a module
export default SpinWheel;