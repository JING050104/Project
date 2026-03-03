let tempEmail = ""; 
let resetEmailStorage = "";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function showMessage(formType, text, isError = true) {
    const existing = document.querySelector(`.${formType}-message`);
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `${formType}-message`;
    msg.textContent = text;
    msg.style.cssText = `margin-top:10px; padding:8px; border-radius:4px; text-align:center; font-size:14px; border:1px solid;`;
    msg.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
    msg.style.color = isError ? '#c62828' : '#2e7d32';
    msg.style.borderColor = isError ? '#ffcdd2' : '#c8e6c9';

    const form = formType === 'login' ? loginForm : (formType === 'register' ? registerForm : document.getElementById("resetStep1"));
    form.parentNode.insertBefore(msg, form.nextSibling);
}

// ---------- Login ----------
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(loginForm).entries());

    btn.textContent = "Logging in...";
    btn.disabled = true;

    try {
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
        showMessage('login', "Server connection error.");
    } finally {
        btn.textContent = "Login";
        btn.disabled = false;
    }
});

registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const emailInput = registerForm.email.value; //

    btn.textContent = "Sending Code...";
    btn.disabled = true;

    try {
        const res = await fetch("/auth/send-reg-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailInput })
        });

        const result = await res.json();
        if (result.success) {
            tempEmail = emailInput; 
            document.getElementById("loginModal").style.display = "none";
            document.getElementById("verifyModal").style.display = "flex";
        } else {
            showMessage('register', result.message);
        }
    } catch (err) {
        showMessage('register', "Failed to contact server.");
    } finally {
        btn.textContent = "Get Verification Code";
        btn.disabled = false;
    }
});

document.getElementById("finishRegisterBtn").onclick = async () => {
    const code = document.getElementById("regVerifyCode").value;
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;

    if (password !== confirm) return alert("Passwords do not match!");
    if (password.length < 8) return alert("Password too short!");

    try {
        const res = await fetch("/auth/complete-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: tempEmail, 
                code, 
                password,
                username: tempEmail.split('@')[0]
            })
        });
        
        const data = await res.json();
        if (data.success) {
            alert("Account Activated! You can now login.");
            location.reload();
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) { alert("Verification failed."); }
};

const regPass = document.getElementById("regPassword");
if (regPass) {
    regPass.addEventListener('input', () => {
        const val = regPass.value;
        const update = (id, valid) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.toggle('valid', valid);
                el.innerText = valid ? el.innerText.replace('×', '√') : el.innerText.replace('√', '×');
            }
        };
        update("reg-req-length", val.length >= 8);
        update("reg-req-upper", /[A-Z]/.test(val));
        update("reg-req-num", /[0-9]/.test(val));
    });
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.login-card form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target') === 'login' ? 'loginForm' : 'registerForm';
        document.getElementById(targetId).classList.add('active');
    });
});