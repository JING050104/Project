// --- Modal Control Variables ---
const resetModal = document.getElementById("resetModal");
const resetStep1 = document.getElementById("resetStep1");
const resetStep2 = document.getElementById("resetStep2");
const emailVerifyModal = document.getElementById("emailVerifyModal"); 
const forgotLink = document.getElementById("forgotPasswordLink");
const closeResetBtn = document.getElementById("closeResetBtn");
const closeEmailModal = document.getElementById("closeEmailModal");

let resetEmailStorage = "";
let originalEmail = ""; 

// --- 1. Open/Close Modal ---
if (forgotLink) {
    forgotLink.onclick = (e) => {
        e.preventDefault();
        const currentUserEmail = document.getElementById('editEmail').value;
        
        document.getElementById("resetEmail").value = currentUserEmail;
        document.getElementById("confirmEmailDisplay").textContent = currentUserEmail;

        // 确保打开时只显示 Step 1
        resetStep1.style.display = "block";
        resetStep2.style.display = "none";
        resetModal.style.display = "flex";
    };
}

// 密码强度检查监听
document.querySelectorAll('#NewPassword, #ModalNewPassword').forEach(input => {
    input.addEventListener('input', (e) => {
        const val = e.target.value;
        updateRequirement("reg-req-length", val.length >= 8);
        updateRequirement("reg-req-upper", /[A-Z]/.test(val));
        updateRequirement("reg-req-lower", /[a-z]/.test(val));
        updateRequirement("reg-req-num", /[0-9]/.test(val));
        updateRequirement("reg-req-special", /[!@#$%^&*(),.?":{}|<>]/.test(val));
    });
});

if (closeResetBtn) {
    closeResetBtn.onclick = () => {
        resetModal.style.display = "none";
        // 关闭时重置状态
        resetStep1.style.display = "block";
        resetStep2.style.display = "none";
    };
}

if (closeEmailModal) {
    closeEmailModal.onclick = () => {
        emailVerifyModal.style.display = "none";
    };
}

// --- 2. Send Reset Code (Step 1 -> Step 2) ---
document.getElementById("resetSendBtn").onclick = async () => {
    const email = document.getElementById("resetEmail").value;
    if (!email) return alert("Please enter your email");

    try {
        const res = await fetch("/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (data.success) {
            resetEmailStorage = email;

            const s1 = document.getElementById("resetStep1");
            const s2 = document.getElementById("resetStep2");

            if (s1 && s2) {
                s1.style.display = "none";
                s1.classList.add("step-hidden");

                s2.style.display = "block"; 
                s2.style.setProperty("display", "block", "important"); // 强制覆盖 CSS
                s2.classList.remove("step-hidden");
                s2.classList.remove("hidden"); 

                console.log("状态切换成功: Step 1 隐藏, Step 2 显示");
                alert("Code sent!");
            } else {
                console.error("错误: 找不到 ID 为 resetStep1 或 resetStep2 的元素");
                alert("页面结构错误，请检查 HTML ID");
            }
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error("发送验证码出错:", err);
        alert("Server error.");
    }
};

// --- 3. Verify and Update (Step 2) ---
document.getElementById("resetFinishBtn").onclick = async () => {
    const code = document.getElementById("resetVerifyCode").value;
    const newPassword = document.getElementById("ModalNewPassword").value;
    const confirm = document.getElementById("ModalConfirmPassword").value;

    if (!code) return alert("Please enter the verification code.");
    if (newPassword !== confirm) return alert("Passwords do not match!");

    try {
        const res = await fetch("/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmailStorage, code, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            alert("Password updated!");
            location.reload();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Failed to reset password.");
    }
};

// --- 4. Profile Logic ---
function updateRequirement(id, isValid) {
    const items = document.querySelectorAll(`#${id}`);
    items.forEach(item => {
        if (isValid) {
            item.classList.add('valid');
            if (item.innerHTML.includes('×')) item.innerHTML = item.innerHTML.replace('×', '✓');
        } else {
            item.classList.remove('valid');
            if (item.innerHTML.includes('✓')) item.innerHTML = item.innerHTML.replace('✓', '×');
        }
    });
}

function enableInput(inputId) {
    const input = document.getElementById(inputId);
    input.readOnly = false;
    input.focus();
}

async function loadUserProfile() {
    try {
        const response = await fetch('/auth/user'); 
        const data = await response.json();

        if (data.user) {
            const u = data.user;
            originalEmail = u.email;

            if (document.getElementById('editUsername')) document.getElementById('editUsername').value = u.username;
            if (document.getElementById('editEmail')) document.getElementById('editEmail').value = u.email;
            
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=4a90e2&color=fff`;
            if (document.getElementById('userAvatar')) document.getElementById('userAvatar').src = avatarUrl;

            if (document.getElementById("confirmEmailDisplay")) document.getElementById("confirmEmailDisplay").textContent = u.email;
            if (document.getElementById("resetEmail")) document.getElementById("resetEmail").value = u.email;
        } else {
            window.location.href = "/index.html";
        }
    } catch (err) {
        console.error("Load user profile error:", err);
    }
}

// 统一的 Profile Update 逻辑
document.getElementById('profileUpdateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newUsername = document.getElementById('editUsername').value;
    const newEmail = document.getElementById('editEmail').value;
    const currentPass = document.getElementById('currPass').value;
    const newPass = document.getElementById('NewPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (newPass) {
        if (!currentPass) return alert("Please enter current password to set a new password.");
        if (newPass !== confirmPass) return alert("New passwords do not match!");
    }

    // 如果修改了 Email，走验证流程
    if (newEmail !== originalEmail) {
        try {
            const res = await fetch("/auth/send-update-email-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newEmail: newEmail })
            });
            const data = await res.json();

            if (data.success) {
                document.getElementById("newEmailDisplay").textContent = newEmail;
                emailVerifyModal.style.display = "flex";
            } else {
                alert(data.message || "Failed to send verification code.");
            }
        } catch (err) {
            alert("Server error while sending code.");
        }
    } else {
        // 没改 Email，直接更新资料
        submitFinalUpdate({
            username: newUsername,
            email: newEmail,
            currentPassword: currentPass,
            newPassword: newPass
        });
    }
});

document.getElementById("confirmEmailChangeBtn").onclick = async () => {
    const code = document.getElementById("emailChangeCode").value;
    if (!code) return alert("Please enter the 6-digit code.");

    submitFinalUpdate({
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value,
        currentPassword: document.getElementById('currPass').value,
        newPassword: document.getElementById('NewPassword').value,
        emailCode: code
    });
};

async function submitFinalUpdate(updateData) {
    try {
        const response = await fetch('/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();
        if (response.ok) {
            alert("Profile updated successfully!");
            location.reload(); 
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Update failed:', error);
        alert("Server error, please try again.");
    }
}

function toggleVisibility(id) {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function handleLogout() {
    window.location.href = "/auth/logout";
}

window.onload = loadUserProfile;