let loadUsers;
let loadVouchers;
let loadAnalytics;
let sortDirection = true;

document.addEventListener("DOMContentLoaded", () => {
    const userTableBody = document.getElementById("user-table-body");
    const voucherTableBody = document.getElementById("voucher-table-body");
    const adminNameSpan = document.getElementById("admin-name");
    const refreshUsersBtn = document.getElementById("refresh-users");
    const refreshVouchersBtn = document.getElementById("refresh-vouchers");
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

    //users
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
                const statusClass = user.is_verified ? "v-status-badge status-active" : "v-status-badge status-pending";

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

    //voucher
    loadVouchers = async function () {
    try {
        const oldRows = voucherTableBody.querySelectorAll("tr:not(#add-voucher-row)");
        oldRows.forEach(row => row.remove());

        const loadingTr = document.createElement("tr");
        loadingTr.id = "v-loading-temp"; 
        loadingTr.innerHTML = '<td colspan="6" style="text-align:center;">Loading vouchers...</td>';
        voucherTableBody.appendChild(loadingTr);

        const response = await fetch("/api/admin/vouchers");
        const data = await response.json();

        const tempLoading = document.getElementById("v-loading-temp");
        if (tempLoading) tempLoading.remove();

        if (data.success && Array.isArray(data.vouchers)) {
            data.vouchers.forEach(voucher => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${voucher.id}</td>
                    <td id="td-v-name-${voucher.id}">${voucher.name}</td>
                    <td>${voucher.stock}</td>
                    <td>${voucher.cost}</td>
                    <td>${voucher.description}</td>
                    <td id="td-v-actions-${voucher.id}">
                        <button class="edit-btn" onclick="startEditVoucher(${voucher.id})"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" onclick="deleteVoucher(${voucher.id})"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                voucherTableBody.appendChild(tr);
            });
        } else {
            console.error("Expected array but got:", data.vouchers);
            const errorTr = document.createElement("tr");
            errorTr.innerHTML = `<td colspan="6" style="color:red; text-align:center;">Data Format Error</td>`;
            voucherTableBody.appendChild(errorTr);
        }
    } catch (error) {
        console.error("Load Vouchers Error:", error);
    }
};

    if (refreshUsersBtn) refreshUsersBtn.onclick = loadUsers;
    if (refreshVouchersBtn) refreshVouchersBtn.onclick = loadVouchers;

    loadAnalytics();
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
        <button onclick="saveEditUsers(${id})" style="color: #28a745; background: none; border: none; cursor: pointer; margin-right: 10px;" title="Save"><i class="fas fa-check"></i></button>
        <button onclick="loadUsers()" style="color: #6c757d; background: none; border: none; cursor: pointer;" title="Cancel"><i class="fas fa-times"></i></button>
    `;
}

async function saveEditUsers(id) {
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
            alert("User edited successfully!");
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
                alert("User deleted successfully!");
                loadUsers();
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Delete failed.");
        }
    }
}

function startEditVoucher(id) {
    const nameTd = document.getElementById(`td-v-name-${id}`);
    const stockTd = nameTd.nextElementSibling;
    const costTd = stockTd.nextElementSibling;
    const descTd = costTd.nextElementSibling;
    const actionsTd = document.getElementById(`td-v-actions-${id}`);

    const curName = nameTd.innerText;
    const curStock = stockTd.innerText;
    const curCost = costTd.innerText;
    const curDesc = descTd.innerText;

    nameTd.innerHTML = `<input type="text" id="input-vname-${id}" value="${curName}" style="width:100%">`;
    stockTd.innerHTML = `<input type="number" id="input-vstock-${id}" value="${curStock}" style="width:100%">`;
    costTd.innerHTML = `<input type="number" id="input-vcost-${id}" value="${curCost}" style="width:100%">`;
    descTd.innerHTML = `<input type="text" id="input-vdesc-${id}" value="${curDesc}" style="width:100%">`;

    actionsTd.innerHTML = `
        <button onclick="saveEditVoucherAction(${id})" style="color: #28a745; background:none; border:none; cursor:pointer; margin-right:10px;"><i class="fas fa-check"></i></button>
        <button onclick="loadVouchers()" style="color: #6c757d; background:none; border:none; cursor:pointer;"><i class="fas fa-times"></i></button>
    `;
}

async function saveEditVoucherAction(id) {
    const updatedData = {
        name: document.getElementById(`input-vname-${id}`).value,
        stock: document.getElementById(`input-vstock-${id}`).value,
        cost: document.getElementById(`input-vcost-${id}`).value,
        description: document.getElementById(`input-vdesc-${id}`).value
    };

    try {
        const response = await fetch(`/api/admin/edit-voucher/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const data = await response.json();
        if (data.success) {
            alert("Voucher edited successfully!");
            loadVouchers();
        } else {
            alert("Update failed: " + data.message);
        }
    } catch (err) {
        alert("Server error.");
    }
}

async function addVoucher() {
    const name = document.getElementById("new-vname").value;
    const stock = document.getElementById("new-vstock").value;
    const cost = document.getElementById("new-vcost").value;
    const description = document.getElementById("new-vdesc").value;

    if (!name || isNaN(stock) || isNaN(cost)) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch("/api/admin/add-voucher", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                stock: parseInt(stock),
                cost: parseInt(cost),
                description: description.trim()
            })
        });

        const data = await response.json();
        if (data.success) {
            alert("New voucher added!");
            ["new-vname", "new-vstock", "new-vcost", "new-vdesc"].forEach(id => document.getElementById(id).value = "");
            loadVouchers();
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) {
        alert("Server error.");
    }
}

async function deleteVoucher(id) {
    if (!confirm(`Are you sure you want to delete Voucher ID: ${id}?`)) return;

    try {
        const response = await fetch(`/api/admin/delete-voucher/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            alert("Voucher deleted successfully!")
            loadVouchers();
        } else {
            alert("Delete failed: " + data.message);
        }
    } catch (err) {
        alert("Server error while deleting.");
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

    if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'vouchers') {
        loadVouchers();
    } else if (sectionId === 'analytics') {
        loadAnalytics();
    } else {
        return;
    }
}

function sortTable(tableBodyId, columnIndex) {
    const tableBody = document.getElementById(tableBodyId);
    const rows = Array.from(tableBody.querySelectorAll("tr"));

    if (rows.length === 0 || rows[0].cells.length < 2) return;

    const sortedRows = rows.sort((a, b) => {
        let aText = a.cells[columnIndex].innerText.trim();
        let bText = b.cells[columnIndex].innerText.trim();

        const aNum = parseFloat(aText);
        const bNum = parseFloat(bText);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDirection ? aNum - bNum : bNum - aNum;
        } else {
            if (sortDirection) {
                return aText.localeCompare(bText, 'zh-CN', { numeric: true });
            } else {
                return bText.localeCompare(aText, 'zh-CN', { numeric: true });
            }
        }
    });

    sortDirection = !sortDirection;

    tableBody.innerHTML = "";
    sortedRows.forEach(row => tableBody.appendChild(row));

    updateSortIcons(tableBodyId, columnIndex, !sortDirection);
}

function updateSortIcons(tableBodyId, columnIndex, isAscending) {
    const table = document.getElementById(tableBodyId).closest('table');
    const headers = table.querySelectorAll('thead th');

    headers.forEach((th, index) => {
        const icon = th.querySelector('i.fas');
        if (!icon) return;

        if (index === columnIndex) {
            icon.className = isAscending ? 'fas fa-sort-up' : 'fas fa-sort-down';
            icon.style.color = '#6a5acd';
        } else {
            icon.className = 'fas fa-sort';
            icon.style.color = '#ccc';
        }
    });
}