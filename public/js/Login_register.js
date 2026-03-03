const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// ---------- 1. Helper: Show Messages ----------
function showMessage(formType, text, isError = true) {
    const existing = document.querySelector(`.${formType}-message`);
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `${formType}-message`;
    msg.textContent = text;
    msg.style.marginTop = '10px';
    msg.style.padding = '8px 12px';
    msg.style.borderRadius = '4px';
    msg.style.fontSize = '14px';
    msg.style.textAlign = 'center';
    msg.style.border = '1px solid';
    msg.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
    msg.style.color = isError ? '#c62828' : '#2e7d32';
    msg.style.borderColor = isError ? '#ffcdd2' : '#c8e6c9';

    const form = formType === 'login' ? loginForm : registerForm;
    form.parentNode.insertBefore(msg, form.nextSibling);
}

// ---------- 2. Password Requirements Logic ----------
const passwordInputs = ["regPassword", "newPassword"];
passwordInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            const val = el.value;
            updateReq("req-length", val.length >= 8);
            updateReq("req-upper", /[A-Z]/.test(val));
            updateReq("req-lower", /[a-z]/.test(val));
            updateReq("req-num", /[0-9]/.test(val));
            updateReq("req-special", /[!@#$%^&*(),.?":{}|<>]/.test(val));
        });
    }
});

function updateReq(id, isValid) {
    const item = document.getElementById(id);
    if (!item) return;
    if (isValid) {
        item.classList.add('valid');
        item.innerHTML = item.innerHTML.replace('✖', '✔');
    } else {
        item.classList.remove('valid');
        item.innerHTML = item.innerHTML.replace('✔', '✖');
    }
}

// ---------- 3. Login Logic ----------
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "Logging in...";
    btn.disabled = true;

    try {
        const data = Object.fromEntries(new FormData(loginForm).entries());
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.success) {
            showMessage('login', "Login successful! Redirecting...", false);
            setTimeout(() => window.location.href = "/dashboard.html", 1000);
        } else {
            showMessage('login', result.message || "Invalid credentials");
        }
    } catch (err) {
        showMessage('login', "Network error. Try again.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// ---------- 4. Register Logic (Includes Duplicate Check) ----------
registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());

        // This call MUST check the DB for existing email
        const res = await fetch("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            showMessage('register', "Success! Check email for code.", false);
            // Show verification modal instead of prompt for better UX
            document.getElementById("loginModal").style.display = "none";
            document.getElementById("verifyModal").style.display = "flex";
            tempEmail = data.email; 
        } else {
            // IF EMAIL ALREADY EXISTS, THIS WILL SHOW THE ERROR MESSAGE
            showMessage('register', result.message); 
        }
    } catch (err) {
        showMessage('register', "Network error.");
    } finally {
        btn.disabled = false;
    }
});

// ---------- 5. Verification Logic ----------
async function verifyAccount(email, code) {
    const res = await fetch("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    });
    
    const result = await res.json();
    if (result.success) {
        alert("Account Verified! Redirecting to login...");
        window.location.reload();
    } else {
        alert("Verification failed: " + result.message);
    }
}

const loginModal = document.getElementById("loginModal");
        const resetModal = document.getElementById("resetModal");
        const verifyModal = document.getElementById("verifyModal");
        const ctaBtn = document.getElementById("ctaBtn");
        const closeBtn = document.getElementById("closeBtn");
        const closeResetBtn = document.getElementById("closeResetBtn");

        let tempEmail = ""; 
        let resetEmailStorage = ""; 

        // --- PASSWORD VALIDATION FUNCTION ---
        function validatePassword(pw) {
            const minLength = 8;
            const hasUpper = /[A-Z]/.test(pw);
            const hasLower = /[a-z]/.test(pw);
            const hasNum = /[0-9]/.test(pw);
            // Accepts any non-alphanumeric character as special
            const hasSpecial = /[^A-Za-z0-9]/.test(pw);

            if (pw.length < minLength) return "Password must be at least 8 characters long.";
            if (!hasUpper) return "Password must include at least one Capital Letter.";
            if (!hasLower) return "Password must include at least one Small Letter.";
            if (!hasNum) return "Password must include at least one numeric digit.";
            if (!hasSpecial) return "Password must include at least one special character.";
            return true;
        }

        // --- LIVE REQUIREMENT BOX LOGIC ---
        function attachLiveValidation(inputId, prefix) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.addEventListener('input', () => {
                const val = input.value;
                updateItem(`${prefix}-req-length`, val.length >= 8);
                updateItem(`${prefix}-req-upper`, /[A-Z]/.test(val));
                updateItem(`${prefix}-req-lower`, /[a-z]/.test(val));
                updateItem(`${prefix}-req-num`, /[0-9]/.test(val));
                updateItem(`${prefix}-req-special`, /[^A-Za-z0-9]/.test(val));
            });
        }

        function updateItem(id, isPassed) {
            const el = document.getElementById(id);
            if (!el) return;
            if (isPassed) {
                el.classList.add('valid');
                el.innerText = el.innerText.replace('×', '√');
            } else {
                el.classList.remove('valid');
                el.innerText = el.innerText.replace('√', '×');
            }
        }

        // Initialize Live Validation
        attachLiveValidation('regPassword', 'reg');
        attachLiveValidation('newPassword', 'res');

        // --- MODAL CONTROLS ---
        if (ctaBtn) ctaBtn.onclick = () => loginModal.style.display = "flex";
        closeBtn.onclick = () => loginModal.style.display = "none";
        closeResetBtn.onclick = () => {
            resetModal.style.display = "none";
            document.getElementById("resetStep1").style.display = "block";
            document.getElementById("resetStep2").style.display = "none";
        };

        function closeVerify() {
            verifyModal.style.display = 'none';
            loginModal.style.display = 'flex'; 
        }

        window.onclick = (e) => {
            if (e.target === loginModal) loginModal.style.display = "none";
            if (e.target === resetModal) {
                resetModal.style.display = "none";
                document.getElementById("resetStep1").style.display = "block";
                document.getElementById("resetStep2").style.display = "none";
            }
            if (e.target === verifyModal) closeVerify();
        };

        // --- UI LOGIC ---
        const tabs = document.querySelectorAll(".tab");
        const forms = document.querySelectorAll("form");

        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"));
                forms.forEach(f => f.classList.remove("active"));
                tab.classList.add("active");
                const target = tab.getAttribute("data-target");
                document.getElementById(target + "Form").classList.add("active");
            });
        });

        function toggleVisibility(inputId) {
            const input = document.getElementById(inputId);
            input.type = (input.type === "password") ? "text" : "password";
        }

        document.getElementById("forgotPasswordLink").onclick = (e) => {
            e.preventDefault();
            loginModal.style.display = "none";
            resetModal.style.display = "flex";
        };

        // --- SUBMISSION LOGIC ---

        document.getElementById("loginForm").onsubmit = async (e) => {
            e.preventDefault();
            const identifier = e.target.identifier.value; 
            const password = e.target.password.value;
            const res = await fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password })
            });
            const data = await res.json();
            if (data.success) window.location.href = "/dashboard.html";
            else alert(data.message);
        };

        document.getElementById("registerForm").onsubmit = async (e) => {
            e.preventDefault();
            const emailInput = e.target.email.value;
            const btn = e.target.querySelector('button');
            btn.textContent = "Checking...";
            btn.disabled = true;
            try {
                const res = await fetch("/auth/send-reg-code", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: emailInput })
                });
                const data = await res.json();
                if (!result.success) alert(result.message);
                if (data.success) {
                    tempEmail = emailInput; 
                    loginModal.style.display = "none";
                    verifyModal.style.display = "flex";
                } else alert(data.message);
            } catch (err) { alert("Server Error."); }
            finally { btn.textContent = "Get Verification Code"; btn.disabled = false; }
        };

        document.getElementById("finishRegisterBtn").onclick = async () => {
            const code = document.getElementById("regVerifyCode").value;
            const password = document.getElementById("regPassword").value;
            const confirm = document.getElementById("regConfirmPassword").value;

            const isValid = validatePassword(password);
            if (isValid !== true) return alert(isValid);
            if (password !== confirm) return alert("Passwords do not match!");

            try {
                const res = await fetch("/auth/complete-registration", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        email: tempEmail, 
                        code, 
                        password, 
                        username: tempEmail.split('@')[0] // 默认将邮箱前缀作为用户名
                    })
                });
                
                const data = await res.json();
                if (data.success) {
                    alert("Account Activated!");
                    location.reload();
                } else alert(data.message);
            } catch (err) { alert("Verification failed."); }
        };

        async function sendResetCode() {
            const email = document.getElementById("resetEmail").value;
            const btn = document.getElementById("resetSendBtn");
            if (!email) return alert("Please enter your email");
            btn.textContent = "Sending...";
            btn.disabled = true;
            try {
                const res = await fetch("/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                const data = await res.json(); 
                if (data.success) {
                    resetEmailStorage = email;
                    alert("Code sent to your email!");
                    document.getElementById("resetStep1").style.display = "none";
                    document.getElementById("resetStep2").style.display = "block";
                } else alert(data.message || "Email not found.");
            } catch (err) { alert("Server connection failed."); }
            finally { btn.textContent = "Send Code"; btn.disabled = false; }
        }

        async function verifyAndReset() {
            const code = document.getElementById("resetVerifyCode").value;
            const newPassword = document.getElementById("newPassword").value;
            const confirm = document.getElementById("ConfirmPassword").value;
            const btn = document.getElementById("resetFinishBtn");

            const isValid = validatePassword(newPassword);
            if (isValid !== true) return alert(isValid);
            if (newPassword !== confirm) return alert("Passwords do not match!");
            if (!code) return alert("Please enter the code");

            btn.textContent = "Updating...";
            btn.disabled = true;
            try {
                const res = await fetch("/auth/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: resetEmailStorage, code, newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    alert("Password updated successfully!");
                    location.reload();
                } else alert(data.message);
            } catch (err) { alert("Reset failed."); }
            finally { btn.textContent = "Update Password"; btn.disabled = false; }
        }
