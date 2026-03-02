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

