// --- Modal Control Variables ---
const resetModal = document.getElementById("resetModal");
const forgotLink = document.getElementById("forgotPasswordLink");
const closeResetBtn = document.getElementById("closeResetBtn");
let resetEmailStorage = "";

// --- 1. Open/Close Modal ---
if (forgotLink) {
    forgotLink.onclick = (e) => {
        e.preventDefault();
        resetModal.style.display = "flex";
    };
}

document.querySelectorAll('#NewPassword').forEach(input => {
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
        document.getElementById("resetStep1").style.display = "block";
        document.getElementById("resetStep2").style.display = "none";
    };
}

// --- 2. Send Reset Code ---
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
            document.getElementById("resetStep1").style.display = "none";
            document.getElementById("resetStep2").style.display = "block";
            alert("Code sent!");
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Server error.");
    }
};

// --- 3. Verify and Update ---
document.getElementById("resetFinishBtn").onclick = async () => {
    const code = document.getElementById("resetVerifyCode").value;
    const newPassword = document.getElementById("NewPassword").value;
    const confirm = document.getElementById("ConfirmPassword").value;

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

async function loadUserProfile() {
    try {
        const response = await fetch('/auth/user'); 
        const data = await response.json();

        if (data.user) {
            const u = data.user;
            document.getElementById('displayTitle').textContent = u.username;
            document.getElementById('displayEmail').textContent = u.email;
            document.getElementById('userNameHeader').textContent = u.username;
            
            document.getElementById('editUsername').value = u.username;
            document.getElementById('editEmail').value = u.email;

            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=4a90e2&color=fff`;
            document.getElementById('userAvatar').src = avatarUrl;
            document.getElementById('headerAvatar').src = avatarUrl;
        } else {
            window.location.href = "/index.html";
        }
    } catch (err) {
        console.error("Failed to load profile", err);
    }
}

function updateRequirement(id, isValid) {
    const items = document.querySelectorAll(`#${id}`);
    
    items.forEach(item => {
        if (isValid) {
            item.classList.add('valid');
            if (item.innerHTML.includes('×')) {
                item.innerHTML = item.innerHTML.replace('×', '✓');
            }
        } else {
            item.classList.remove('valid');
            if (item.innerHTML.includes('✓')) {
                item.innerHTML = item.innerHTML.replace('✓', '×');
            }
        }
    });
}

function enableInput(inputId) {
    const input = document.getElementById(inputId);
    input.readOnly = false; // Unlocks the box
    input.focus();          // Puts the cursor inside
}

document.getElementById('profileUpdateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPass = document.getElementById('NewPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    if (newPass && newPass !== confirmPass) {
        alert("New passwords do not match!");
        return;
    }

    const updateData = {
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value,
        currentPassword: document.getElementById('currPass').value,
        newPassword: newPass
    };

    try {
        const res = await fetch('/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await res.json();

        if (res.ok) {
            alert("Profile updated successfully!");
            location.reload();
        } else {
            alert("Error: " + (result.message || "Failed to update"));
        }
    } catch (err) {
        alert("Network error. Please try again.");
    }
});

function toggleVisibility(id) {
    const el = document.getElementById(id);
    if (el) {
        el.type = el.type === 'password' ? 'text' : 'password';
    }
}

function handleLogout() {
    window.location.href = "/auth/logout";
}

document.getElementById('profileUpdateForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const updatedData = {
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value
    };

    try {
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Profile updated successfully!');
            document.getElementById('editUsername').readOnly = true;
            document.getElementById('editEmail').readOnly = true;
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Database save failed:', error);
    }
});

function enableEdit(inputId) {
    const input = document.getElementById(inputId);
    const pencil = document.getElementById('pencil-' + inputId);
    const check = document.getElementById('check-' + inputId);

    input.readOnly = false;
    input.classList.add('active-field');
    input.focus();

    pencil.style.display = 'none';
    check.style.display = 'block';
}

async function confirmEdit(inputId) {
    try {
        const response = await fetch('/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [fieldName]: newValue })
        });

        if (response.status === 401) {
            alert("Login session expired! Redirecting to login...");
            window.location.href = "/index.html";
            return;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new TypeError("Oops, we didn't get JSON from the server!");
        }

        const result = await response.json();
        
    } catch (err) {
        console.error("SQA Error Log:", err);
        alert("An error occurred: " + err.message);
    }
}
window.onload = loadUserProfile;