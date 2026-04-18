const resetModal = document.getElementById("resetModal");
const resetStep1 = document.getElementById("resetStep1");
const resetStep2 = document.getElementById("resetStep2");
const emailVerifyModal = document.getElementById("emailVerifyModal");
const forgotLink = document.getElementById("forgotPasswordLink");
const closeResetBtn = document.getElementById("closeResetBtn");
const closeEmailModal = document.getElementById("closeEmailModal");
const avatarInput = document.getElementById('avatarInput');

let resetEmailStorage = "";
let originalEmail = "";
let originalUsername = "";

// --- 1. 页面加载：获取用户信息 ---
async function loadUserProfile() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();

        if (data.user) {
            const u = data.user;
            originalEmail = u.email;
            originalUsername = u.username;

            if (document.getElementById('editUsername')) document.getElementById('editUsername').value = u.username;
            if (document.getElementById('editEmail')) document.getElementById('editEmail').value = u.email;
            
            const avatarUrl = (u.profile_image && u.profile_image !== "undefined")
                ? u.profile_image
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=4a90e2&color=fff`;
            
            const avatarEl = document.getElementById('userAvatar');
            if (avatarEl) avatarEl.src = avatarUrl;
        } else {
            window.location.href = "/index.html";
        }
    } catch (err) {
        console.error("Load user profile error:", err);
    }
}

// --- 2. 修改用户名逻辑 ---
const updateUsernameBtn = document.getElementById('updateUsernameBtn');
if (updateUsernameBtn) {
    updateUsernameBtn.onclick = async () => {
        const newUsername = document.getElementById('editUsername').value.trim();
        
        if (!newUsername) return alert("Username cannot be empty");
        if (newUsername === originalUsername) return alert("New username is same as current.");

        // 调用统一更新函数，只传 username
        await submitFinalUpdate({ username: newUsername });
    };
}

// --- 3. 修改邮箱逻辑 (带验证码弹窗) ---
const updateEmailBtn = document.getElementById('updateEmailBtn');
if (updateEmailBtn) {
    updateEmailBtn.onclick = async () => {
        const newEmail = document.getElementById('editEmail').value.trim();

        if (!newEmail) return alert("Email cannot be empty");
        if (newEmail === originalEmail) return alert("New email is same as current.");

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
    };
}

// 邮箱验证码弹窗里的“确认”按钮
document.getElementById("confirmEmailChangeBtn").onclick = async () => {
    const code = document.getElementById("emailChangeCode").value;
    const newEmail = document.getElementById('editEmail').value;
    if (!code) return alert("Please enter the 6-digit code.");

    await submitFinalUpdate({
        email: newEmail,
        emailCode: code
    });
};

// --- 4. 修改密码逻辑 ---
// 找到右侧区域的按钮（如果你在HTML里给它加了 id="updatePasswordBtn" 更好）
const updatePasswordBtn = document.querySelector('.profile-section-right .submit-btn') || document.getElementById('updatePasswordBtn');
if (updatePasswordBtn) {
    updatePasswordBtn.onclick = async () => {
        const currentPass = document.getElementById('currPass').value;
        const newPass = document.getElementById('NewPassword').value;
        const confirmPass = document.getElementById('regConfirmPassword').value;

        if (!currentPass || !newPass) return alert("Please fill in both current and new passwords.");
        if (newPass !== confirmPass) return alert("New passwords do not match!");

        // 调用统一更新函数，只传密码相关字段
        await submitFinalUpdate({
            currentPassword: currentPass,
            newPassword: newPass
        });
    };
}

// --- 5. 核心：统一提交函数 ---
async function submitFinalUpdate(updateData) {
    try {
        const response = await fetch('/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            alert("Updated successfully!");
            location.reload();
        } else {
            alert('Error: ' + (result.message || "Update failed"));
        }
    } catch (error) {
        console.error('Update failed:', error);
        alert("Server error, please try again.");
    }
}

// --- 6. 其他辅助功能（密码可见性、忘记密码模态框等） ---

// 忘记密码链接点击
if (forgotLink) {
    forgotLink.onclick = (e) => {
        e.preventDefault();
        const currentEmail = document.getElementById('editEmail').value;
        document.getElementById("resetEmail").value = currentEmail;
        document.getElementById("confirmEmailDisplay").textContent = currentEmail;
        resetStep1.style.display = "block";
        resetStep2.style.display = "none";
        resetModal.style.display = "flex";
    };
}

// 忘记密码发送验证码
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
            
            // 确保 ID 存在并切换显示
            const s1 = document.getElementById("resetStep1");
            const s2 = document.getElementById("resetStep2");
            
            if (s1 && s2) {
                // 使用 setAttribute 确保覆盖 CSS 中的 !important 或其他限制
                s1.style.setProperty('display', 'none', 'important');
                s2.style.setProperty('display', 'block', 'important');
                
                if (document.getElementById("confirmEmailDisplay")) {
                    document.getElementById("confirmEmailDisplay").textContent = email;
                }
            }
            alert("Code sent!");
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error("Step transition error:", err);
        alert("Server error.");
    }
};

// 忘记密码完成重置
document.getElementById("resetFinishBtn").onclick = async () => {
    const code = document.getElementById("regVerifyCode").value; 
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

// 密码强度实时检测
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

function updateRequirement(id, isValid) {
    const items = document.querySelectorAll(`#${id}`);
    items.forEach(item => {
        item.classList.toggle('valid', isValid);
        item.innerHTML = isValid ? item.innerHTML.replace('×', '✓') : item.innerHTML.replace('✓', '×');
    });
}

function toggleVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(`toggle-icon-${inputId}`);
    if (input.type === "password") {
        input.type = "text";
        icon?.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
        input.type = "password";
        icon?.classList.replace('fa-eye', 'fa-eye-slash');
    }
}

// 头像上传
async function uploadNewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
        const res = await fetch('/api/update-avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            document.getElementById('userAvatar').src = data.avatarUrl;
            alert("Avatar updated!");
        }
    } catch (err) { alert("Upload error."); }
}

// 关闭弹窗
if (closeResetBtn) closeResetBtn.onclick = () => resetModal.style.display = "none";
if (closeEmailModal) closeEmailModal.onclick = () => emailVerifyModal.style.display = "none";

function handleLogout() { window.location.href = "/auth/logout"; }

window.onload = loadUserProfile;