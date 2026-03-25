let tempEmail = "";
let resetEmailStorage = "";
let tempResetCode = "";
loginForm.addEventListener("submit", async e => {
    e.preventDefault();

    const email = e.target.email.value;
    const password = e.target.password.value;

    const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
        window.location.href = "/dashboard.html";
    } else {
        alert(data.message);
    }
});

registerForm.addEventListener("submit", async e => {
    e.preventDefault();

    const emailInput = document.getElementById("regEmail").value;
    const btn = registerForm.querySelector('button[type="submit"]');

    btn.textContent = "Sending Verification Code...";
    btn.disabled = true;

    try {
        const res = await fetch("/auth/send-reg-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailInput })
        });

        const data = await res.json();

        if (data.success) {
            tempEmail = emailInput;
            document.getElementById("codeSection").style.display = "block";
            btn.style.display = "none";
        } else {
            alert(data.message);
            btn.textContent = "Sign Up";
            btn.disabled = false;
        }
    } catch (err) {
        alert("Network error: Could not reach the server.");
        btn.textContent = "Sign Up";
        btn.disabled = false;
    }
});

document.getElementById("verifyCodeBtn").onclick = async () => {

    const codeInput = document.getElementById("regVerifyCode").value;

    if(!codeInput) return alert("Enter verification code");

    const res = await fetch("/auth/verify-code",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            email: tempEmail,
            code: codeInput
        })
    });

    const data = await res.json();

    if(data.success){

        tempCode = codeInput;

        document.getElementById("loginModal").style.display = "none";
        document.getElementById("verifyModal").style.display = "flex";
        document.getElementById("verifyStep2").style.display = "block";

    }else{

        alert("Invalid code");

    }

};

document.getElementById("finishRegisterBtn").onclick = async () => {

    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;

    if(password !== confirm) return alert("Passwords do not match");

    const res = await fetch("/auth/complete-registration",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            email: tempEmail,
            code: tempCode,
            password: password,
            username: tempEmail.split("@")[0]
        })
    });

    const data = await res.json();

    if(data.success){

        alert("Account created!");
        location.reload();

    }else{

        alert(data.message);

    }

};

async function sendResetCode() {
    const emailInput = document.getElementById("resetEmail");
    const email = emailInput.value;
    const btn = document.querySelector("#resetStep1 button"); // 假设你的按钮在 step1 里

    if (!email) return alert("Please enter your email");

    // UI 反馈
    if (btn) {
        btn.textContent = "Sending...";
        btn.disabled = true;
    }

    try {
        const res = await fetch("/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.success) {
            resetEmailStorage = email;
            // 切换 UI
            document.getElementById("resetStep1").style.display = "none";
            document.getElementById("resetStep2").style.display = "block";
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Connection failed. Please check your internet.");
    } finally {
        if (btn) {
            btn.textContent = "Send Code";
            btn.disabled = false;
        }
    }
}

async function verifyResetCode() {
    const codeInput = document.getElementById("resetVerifyCode");
    const code = codeInput.value;

    if (!code) return alert("Enter verification code");

    try {
        const res = await fetch("/auth/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: resetEmailStorage,
                code: code
            })
        });

        const data = await res.json();

        if (data.success) {
            tempResetCode = code; 
            
            document.getElementById("resetCodeSection").style.display = "none";
            document.getElementById("resetPasswordSection").style.display = "block";
        } else {
            alert(data.message || "Invalid or expired code");
        }
    } catch (err) {
        alert("Server error during verification.");
    }
}

async function verifyAndReset() {
    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("ConfirmPassword").value;

    if (!password) return alert("Please enter a new password");
    if (password !== confirm) return alert("Passwords do not match");

    try {
        const res = await fetch("/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: resetEmailStorage,
                code: tempResetCode, 
                newPassword: password
            })
        });

        const data = await res.json();

        if (data.success) {
            alert("Password updated successfully!");
            location.reload(); 
        } else {
            alert(data.message || "Failed to update password.");
        }
    } catch (err) {
        alert("Server error. Please try again later.");
    }
}