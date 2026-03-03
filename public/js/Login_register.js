/**
 * Coverage Quest - 整合身份验证逻辑脚本
 * 包含：登录、注册、两步验证、找回密码
 */

// 1. 全局状态管理
let tempEmail = ""; 
let resetEmailStorage = "";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// ---------- 2. Helper: UI 反馈消息 ----------
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

// ---------- 3. 登录逻辑 (Login) ----------
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

// ---------- 4. 注册第一步：发送验证码 ----------
registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const emailInput = registerForm.email.value; //

    btn.textContent = "Sending Code...";
    btn.disabled = true;

    try {
        // 核心路径修正
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

// ---------- 5. 注册第二步：完成账户激活 ----------
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
                username: tempEmail.split('@')[0] // 默认生成用户名
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

// ---------- 6. 找回密码：发送重置码 ----------
async function sendResetCode() {
    const email = document.getElementById("resetEmail").value;
    const btn = document.getElementById("resetSendBtn");
    
    if (!email) return alert("Enter email first.");

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
            alert("Reset code sent!");
            document.getElementById("resetStep1").style.display = "none";
            document.getElementById("resetStep2").style.display = "block";
        } else {
            alert(data.message || "Email not found.");
        }
    } catch (err) { 
        console.error("Fetch error:", err);
        alert("Network error, please try again."); 
    } finally { 
        btn.textContent = "Send Code"; 
        btn.disabled = false; 
    }
}

// ---------- 7. 找回密码：更新密码 ----------
async function verifyAndReset() {
    const code = document.getElementById("resetVerifyCode").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirm = document.getElementById("ConfirmPassword").value;

    if (newPassword !== confirm) return alert("Passwords mismatch!");

    try {
        const res = await fetch("/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmailStorage, code, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            alert("Password updated! Please login.");
            location.reload();
        } else { alert(data.message); }
    } catch (err) { alert("Reset failed."); }
}

// ---------- 8. 实时密码强度 UI 反馈 ----------
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

document.addEventListener("DOMContentLoaded", () => {
    // 获取元素
    const forgotLink = document.getElementById("forgotPasswordLink");
    const loginModal = document.getElementById("loginModal");
    const resetModal = document.getElementById("resetModal");
    const closeResetBtn = document.getElementById("closeResetBtn");

    // 1. 点击 'Forgot Password' 链接
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            loginModal.style.display = "none"; // 隐藏登录框
            resetModal.style.display = "flex"; // 显示重置密码框
        };
    }

    // 2. 点击重置框的关闭按钮
    if (closeResetBtn) {
        closeResetBtn.onclick = () => {
            resetModal.style.display = "none";
            // 可选：关掉重置框后重新打开登录框
            // loginModal.style.display = "flex"; 
        };
    }
});

// ---------- 9. Tab 切换逻辑 ----------
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // 1. 移除所有 tab 的 active 类
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // 2. 隐藏所有 form
        document.querySelectorAll('.login-card form').forEach(f => f.classList.remove('active'));

        // 3. 给当前点击的 tab 添加 active
        tab.classList.add('active');
        // 4. 显示对应的 form
        const targetId = tab.getAttribute('data-target') === 'login' ? 'loginForm' : 'registerForm';
        document.getElementById(targetId).classList.add('active');
    });
});