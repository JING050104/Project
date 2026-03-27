let loadUsers;

document.addEventListener("DOMContentLoaded", () => {
    const userTableBody = document.getElementById("user-table-body");
    const adminNameSpan = document.getElementById("admin-name");
    const refreshBtn = document.getElementById("refresh-users");

    fetch("/auth/user")
        .then(res => res.json())
        .then(data => {
            if (data.success && data.user) {
                adminNameSpan.textContent = `Welcome, ${data.user.username}`;
            }
        });

    loadUsers = async function() {
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
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'badge-admin' : ''}">${user.role}</span></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="edit-btn" onclick="editUser(${user.id}, this)"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                userTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error("Load Users Error:", error);
            userTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Failed to connect to server.</td></tr>';
        }
    }

    refreshBtn.addEventListener("click", loadUsers);
    loadUsers();
});

function editUser(id) { 
    alert("Edit user: " + id); 
}

async function deleteUser(id) {
    const confirmed = confirm(`Are you sure you want to delete user ID: ${id}?`);
    
    if (confirmed) {
        try {
            const response = await fetch(`/api/admin/delete-user/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                if (typeof loadUsers === "function") {
                    loadUsers(); 
                } else {
                    location.reload();
                }
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            console.error("Delete Fetch Error:", err);
            alert("Server connection loss. Please try later!");
        }
    }
}

function editUser(id, btn) { 
    const modal = document.getElementById("editModal");
    
    const row = btn.closest("tr"); 
    
    const currentUsername = row.cells[1].innerText;
    const currentRole = row.cells[3].innerText.toLowerCase().trim();

    document.getElementById("edit-user-id").value = id;
    document.getElementById("edit-username").value = currentUsername;
    document.getElementById("edit-role").value = currentRole; 

    modal.style.display = "flex";
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
}

document.getElementById("editForm").onsubmit = async (e) => {
    e.preventDefault();
    
    const id = document.getElementById("edit-user-id").value;
    const username = document.getElementById("edit-username").value;
    const role = document.getElementById("edit-role").value; // 获取下拉框的值

    try {
        const response = await fetch(`/api/admin/edit-user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role })
        });

        const data = await response.json();
        if (data.success) {
            alert("User updated successfully!");
            closeModal();
            loadUsers();
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) {
        alert("Server error.");
    }
};