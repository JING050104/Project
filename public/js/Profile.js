const resetModal = document.getElementById("resetModal");
const resetStep1 = document.getElementById("resetStep1");
const resetStep2 = document.getElementById("resetStep2");
const emailVerifyModal = document.getElementById("emailVerifyModal");
const forgotLink = document.getElementById("forgotPasswordLink");
const closeResetBtn = document.getElementById("closeResetBtn");
const closeEmailModal = document.getElementById("closeEmailModal");
const uploadBtn = document.getElementById('uploadBtn');
const avatarInput = document.getElementById('avatarInput');

let resetEmailStorage = "";
let originalEmail = "";
let originalUsername = "";

if (forgotLink) {
    forgotLink.onclick = (e) => {
        e.preventDefault();
        const currentUserEmail = document.getElementById('editEmail').value;

        document.getElementById("resetEmail").value = currentUserEmail;
        document.getElementById("confirmEmailDisplay").textContent = currentUserEmail;

        resetStep1.style.display = "block";
        resetStep2.style.display = "none";
        resetModal.style.display = "flex";
    };
}

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
        resetStep1.style.display = "block";
        resetStep2.style.display = "none";
    };
}

if (closeEmailModal) {
    closeEmailModal.onclick = () => {
        emailVerifyModal.style.display = "none";
    };
}

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
                s1.setAttribute('style', 'display: none !important');
                s2.setAttribute('style', 'display: block !important');

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

            const avatarUrl = (u.profile_image && u.profile_image !== "undefined" && u.profile_image !== null)
                ? u.profile_image 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=4a90e2&color=fff`;
            originalEmail = u.email;
            originalUsername = u.username;

            if (document.getElementById('editUsername')) document.getElementById('editUsername').value = u.username;
            if (document.getElementById('editEmail')) document.getElementById('editEmail').value = u.email;
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

document.getElementById('profileUpdateForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newUsername = document.getElementById('editUsername').value;
    const currentPass = document.getElementById('currPass').value;
    const newPass = document.getElementById('NewPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    const newEmail = document.getElementById('editEmail').value.trim();
    
    if (newUsername === originalUsername || newEmail === originalEmail && !document.getElementById('NewPassword').value) {
        return alert("New username/email cannot be the same as the current one.");
    }

    if (!newEmail) return alert("Email cannot be empty");

    if (newPass) {
        if (!currentPass) return alert("Please enter current password to set a new password.");
        if (newPass !== confirmPass) return alert("New passwords do not match!");
    }

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

function toggleVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(`toggle-icon-${inputId}`);

    if (input.type === "password") {
        input.type = "text";
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    } else {
        input.type = "password";
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    }
}

if (uploadBtn && avatarInput) {
    uploadBtn.onclick = () => avatarInput.click();
}

async function uploadNewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        return alert("File is too large! Maximum 2MB.");
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch('/api/update-avatar', {
            method: 'POST',
            body: formData 
        });

        const data = await res.json();
        console.log("服务器返回的路径是:", data.avatarUrl);
        if (data.success) {
            document.getElementById('userAvatar').src = data.avatarUrl;
            alert("Profile image updated successfully!");
        } else {
            alert("Upload failed: " + data.message);
        }
    } catch (err) {
        console.error("Upload error:", err);
        alert("Server error during upload.");
    }
}

function handleLogout() {
    window.location.href = "/auth/logout";
}

window.onload = loadUserProfile;