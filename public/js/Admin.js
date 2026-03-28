let loadUsers;

document.addEventListener("DOMContentLoaded", () => {
    const userTableBody = document.getElementById("user-table-body");
    const adminNameSpan = document.getElementById("admin-name");
    const refreshBtn = document.getElementById("refresh-users");
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.onclick = () => window.location.href = "/auth/logout";
    }

    fetch("/auth/user")
        .then(res => res.json())
        .then(data => {
            if (data.success && data.user) {
                adminNameSpan.textContent = `Welcome, ${data.user.username}`;
            }
        });

    loadUsers = async function () {
        try {
            userTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading users...</td></tr>';
            const response = await fetch("/api/admin/users");
            const data = await response.json();

            if (!data.success) {
                userTableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${data.message}</td></tr>`;
                return;
            }

            userTableBody.innerHTML = "";
            data.users.forEach(user => {
                const tr = document.createElement("tr");
                const statusText = user.is_verified ? "Verified" : "Unverified";
                const statusClass = user.is_verified ? "status-active" : "status-pending";

                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td id="td-username-${user.id}">${user.username}</td>
                    <td>${user.email}</td>
                    <td id="td-role-${user.id}"><span class="badge ${user.role === 'admin' ? 'badge-admin' : ''}">${user.role}</span></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td id="td-actions-${user.id}">
                        <button class="edit-btn" title="Edit" onclick="startEdit(${user.id}, this)"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" title="Delete" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                userTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error("Load Users Error:", error);
            userTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Connection Error.</td></tr>';
        }
    };

    refreshBtn.addEventListener("click", loadUsers);
    loadUsers();
});

function startEdit(id, btn) {
    const usernameTd = document.getElementById(`td-username-${id}`);
    const roleTd = document.getElementById(`td-role-${id}`);
    const actionsTd = document.getElementById(`td-actions-${id}`);

    const currentUsername = usernameTd.innerText;
    const currentRole = roleTd.innerText.toLowerCase().trim();

    usernameTd.innerHTML = `<input type="text" id="input-username-${id}" value="${currentUsername}" style="width: 100%; padding: 5px; border: 1px solid #6a5acd;">`;

    roleTd.innerHTML = `
        <select id="input-role-${id}" style="padding: 5px; border: 1px solid #6a5acd;">
            <option value="user" ${currentRole === 'user' ? 'selected' : ''}>user</option>
            <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>admin</option>
        </select>`;

    actionsTd.innerHTML = `
        <button onclick="saveEdit(${id})" style="color: #28a745; background: none; border: none; cursor: pointer; margin-right: 10px;" title="Save"><i class="fas fa-check"></i></button>
        <button onclick="loadUsers()" style="color: #6c757d; background: none; border: none; cursor: pointer;" title="Cancel"><i class="fas fa-times"></i></button>
    `;
}

async function saveEdit(id) {
    const newUsername = document.getElementById(`input-username-${id}`).value;
    const newRole = document.getElementById(`input-role-${id}`).value;

    if (!newUsername.trim()) return alert("Username cannot be empty");

    try {
        const response = await fetch(`/api/admin/edit-user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newUsername, role: newRole })
        });

        const data = await response.json();
        if (data.success) {
            loadUsers();
        } else {
            alert("Update failed: " + data.message);
        }
    } catch (err) {
        alert("Server error.");
    }
}

async function deleteUser(id) {
    if (confirm(`Delete User ID ${id}? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/api/admin/delete-user/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                loadUsers();
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Delete failed.");
        }
    }
}

function showSection(sectionId, ev) {
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(sec => sec.classList.remove('active'));

    const target = document.getElementById(sectionId + '-section');
    if (target) {
        target.classList.add('active');
    }

    const navLinks = document.querySelectorAll('.sidebar nav a');
    navLinks.forEach(link => link.classList.remove('active'));

    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.add('active');
    }
}