/* ==========================================
   1. GLOBAL VARIABLES & SELECTORS
   ========================================== */
let tempEmail = "";
let tempCode = "";
let flowType = "";

const loginModal = document.getElementById("loginModal");
const verifyModal = document.getElementById("verifyModal");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const ctaBtn = document.getElementById("ctaBtn");
const closeBtn = document.getElementById("closeBtn");


/* ==========================================
   2. UI CONTROLS
   ========================================== */
ctaBtn.onclick = () => loginModal.style.display = "flex";
closeBtn.onclick = () => loginModal.style.display = "none";

function toggleVisibility(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}


/* ==========================================
   3. LOGIN LOGIC
   ========================================== */
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm).entries());

    const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
        window.location.href = "/dashboard.html";
    } else {
        alert(result.message);
    }
});


/* ==========================================
   4. REGISTER - SEND CODE
   ========================================== */
registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("regEmail").value;

    const res = await fetch("/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email,
            type: "register"
        })
    });

    const data = await res.json();
    if (data.success) {
        flowType = "register";
        tempEmail = email;
        document.getElementById("codeSection").style.display = "block";
    } else {
        alert(data.message);
    }
});


/* ==========================================
   5. VERIFY CODE
   ========================================== */
document.getElementById("verifyCodeBtn").onclick = async () => {
    const codeInput = document.getElementById("regVerifyCode").value;
    if (!codeInput) return alert("Enter verification code");

    const res = await fetch("/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: tempEmail,
            code: codeInput
        })
    });

    const data = await res.json();
    if (data.success) {
        tempCode = codeInput;
        loginModal.style.display = "none";
        verifyModal.style.display = "flex";
    } else {
        alert("Invalid code");
    }
};


/* ==========================================
   6. FORGOT PASSWORD - INITIAL STEP
   ========================================== */
document.getElementById("forgotPasswordLink").onclick = async e => {
    e.preventDefault();
    const email = prompt("Enter your email"); 
    if (!email) return;

    const res = await fetch("/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "reset" })
    });

    const data = await res.json();
    if (data.success) {
        flowType = "reset";
        tempEmail = email;
        // 关键：重置也借用注册的验证码输入框显示出来
        document.getElementById("codeSection").style.display = "block";
        alert("Code sent to email. Please enter it in the verification box.");
    } else {
        alert(data.message);
    }
};


/* ==========================================
   7. FINISH PROCESS (REGISTER / RESET)
   ========================================== */
document.getElementById("finishRegisterBtn").onclick = async () => {
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;

    if (password !== confirm) return alert("Passwords do not match");

    let url = "/auth/complete-registration";
    let payload = {
        email: tempEmail,
        code: tempCode,
        password,
        username: tempEmail.split("@")[0]
    };

    if (flowType === "reset") {
        url = "/auth/reset-password";
        payload = {
            email: tempEmail,
            code: tempCode,
            newPassword: password
        };
    }

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
        alert("Success");
        location.reload();
    } else {
        alert(data.message);
    }
};