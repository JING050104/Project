let loadUsers;
let loadVouchers;
let loadAnalytics;
let sortDirection = true;
let levelChartInstance = null;
let trendChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
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

    loadAnalytics = async function () {
        try {
            const rangeSelector = document.getElementById('analytics-range');
            const days = rangeSelector ? rangeSelector.value : 30;

            const response = await fetch(`/api/admin/analytics-data?range=${days}`);
            const data = await response.json();

            if (!data.success) {
                console.error("Failed to load analytics:", data.message);
                return;
            }

            document.getElementById('stat-total-users').innerText = data.summary.users;
            document.getElementById('stat-total-games').innerText = data.summary.gamesPlayed;
            document.getElementById('stat-voucher-stock').innerText = data.summary.vouchersLeft;

            const finderEl = document.getElementById('stat-finder-games');
            const defenderEl = document.getElementById('stat-defender-games');
            if (finderEl) finderEl.innerText = data.summary.finderGames;
            if (defenderEl) defenderEl.innerText = data.summary.defenderGames;

            const levelCtx = document.getElementById('levelChart').getContext('2d');
            if (window.levelChartInstance) window.levelChartInstance.destroy();

            const allLevels = [...new Set(data.levels.map(l => parseInt(l.reached_level)))].sort((a, b) => a - b);
            const finderLevelData = allLevels.map(lvl => {
                const entry = data.levels.find(l => parseInt(l.reached_level) === lvl && l.game_type === 'RiskFinder');
                return entry ? parseInt(entry.count) : 0;
            });

            const defenderLevelData = allLevels.map(lvl => {
                const entry = data.levels.find(l => parseInt(l.reached_level) === lvl && l.game_type === 'RiskDefender');
                return entry ? parseInt(entry.count) : 0;
            });

            window.levelChartInstance = new Chart(levelCtx, {
                type: 'bar',
                data: {
                    labels: allLevels.map(lvl => `Level ${lvl}`),
                    datasets: [
                        {
                            label: 'RiskFinder',
                            data: finderLevelData,
                            backgroundColor: '#4a90e2',
                            borderRadius: 4,
                        },
                        {
                            label: 'RiskDefender',
                            data: defenderLevelData,
                            backgroundColor: '#cc2e2e',
                            borderRadius: 4,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });

            const trendCtx = document.getElementById('trendChart').getContext('2d');
            if (window.trendChartInstance) window.trendChartInstance.destroy();

            const allDates = [...new Set(data.trends.map(t => new Date(t.date).toLocaleDateString()))];

            const finderData = allDates.map(date => {
                const entry = data.trends.find(t => new Date(t.date).toLocaleDateString() === date && t.game_type === 'RiskFinder');
                return entry ? parseInt(entry.count) : 0;
            });

            const defenderData = allDates.map(date => {
                const entry = data.trends.find(t => new Date(t.date).toLocaleDateString() === date && t.game_type === 'RiskDefender');
                return entry ? parseInt(entry.count) : 0;
            });

            window.trendChartInstance = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: allDates,
                    datasets: [
                        {
                            label: 'RiskFinder',
                            data: finderData,
                            borderColor: '#4a90e2',
                            backgroundColor: 'rgba(74, 144, 226, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'RiskDefender',
                            data: defenderData,
                            borderColor: '#cc2e2e',
                            backgroundColor: 'rgba(204, 46, 46, 0.1)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });

        } catch (err) {
            console.error("Analytics Load Error:", err);
        }
    };

    //users
    loadUsers = async function () {
        try {
            const userTableBody = document.getElementById("user-table-body");
            if (!userTableBody) return;

            userTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading users...</td></tr>';

            const response = await fetch("/api/admin/users");
            const data = await response.json();

            userTableBody.innerHTML = "";

            if (data.success && Array.isArray(data.users)) {
                if (data.users.length === 0) {
                    userTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No users found.</td></tr>';
                    return;
                }

                data.users.forEach(user => {
                    const row = document.createElement("tr");
                    const statusText = user.is_verified ? "Verified" : "Pending";
                    const statusClass = user.is_verified ? "status-verified" : "status-pending";

                    row.innerHTML = `
                    <td>${user.id}</td>
                    <td id="td-username-${user.id}">${user.username}</td>
                    <td>${user.email}</td>
                    <td id="td-role-${user.id}"><span class="badge">${user.role}</span></td>
                    <td style="font-weight:bold; color:#27ae60;">${user.total_points}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td id="td-actions-${user.id}">
                        <button class="edit-btn" onclick="viewHistory(${user.id}, '${user.username}')" title="History">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="edit-btn" onclick="startEdit(${user.id}, this)" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteUser(${user.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                    userTableBody.appendChild(row);
                });
            }
        } catch (err) {
            console.error("Load Users Error:", err);
            const userTableBody = document.getElementById("user-table-body");
            if (userTableBody) {
                userTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Failed to connect to server.</td></tr>`;
            }
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

async function handleExcelUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const fileName = file.name;
    const extension = fileName.split('.').pop().toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls') {
        alert("Please upload a valid Excel file (.xlsx or .xls)");
        return;
    }

    const formData = new FormData();
    formData.append("excelFile", file);

    try {
        const btn = document.getElementById('add-voucher-list-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        btn.disabled = true;

        const response = await fetch("/api/admin/upload-vouchers-excel", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert(`Successfully imported ${data.count} vouchers!`);
            loadVouchers();
        } else {
            alert("Upload failed: " + data.message);
        }
    } catch (err) {
        console.error("Upload error:", err);
        alert("Server error during upload.");
    } finally {
        const btn = document.getElementById('add-voucher-list-btn');
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Upload Excel';
        btn.disabled = false;
        input.value = "";
    }
}

document.getElementById('download-template').onclick = function (e) {
    e.preventDefault();

    const headers = [["Name", "Stock", "Cost", "Description"]];

    const sampleData = [
        ["Welcome Gift", 100, 50, "Special voucher for new users"],
        ["Holiday Sale", 200, 150, "Valid until end of the month"]
    ];

    const content = headers.concat(sampleData);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(content);

    ws['!cols'] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Voucher_Import_Template.xlsx");
};

function showSection(sectionId, ev) {
    const sections = document.querySelectorAll('.admin-content, .admin-section');
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

    switch (sectionId.toLowerCase()) {
        case 'users':
            if (typeof loadUsers === 'function') loadUsers();
            break;
        case 'vouchers':
            if (typeof loadVouchers === 'function') loadVouchers();
            break;
        case 'analytics':
            if (typeof loadAnalytics === 'function') loadAnalytics();
            break;
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

async function viewHistory(userId, username) {
    console.log("History button clicked！User ID:", userId);
    const modal = document.getElementById("history-modal");
    const tableBody = document.getElementById("history-table-body");
    document.getElementById("history-user-title").innerText = `Point History: ${username}`;

    if (modal) {
        modal.style.display = "flex";
        document.getElementById("history-user-title").innerText = `Point History: ${username}`;
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
    }

    try {
        const res = await fetch(`/api/admin/user-history/${userId}`);
        const data = await res.json();
        console.log("🔥 NEW VERSION USER HISTORY API");
        tableBody.innerHTML = "";
        if (!data.success || !Array.isArray(data.history) || data.history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No records found.</td></tr>';
            return;
        }

        data.history.forEach(item => {
            const tr = document.createElement("tr");
            const val = parseFloat(item.points_change) || 0;
            const color = val >= 0 ? "#27ae60" : "#e74c3c";
            const displayAmount = val > 0 ? `+${val}` : val;

            tr.innerHTML = `
        <td>${new Date(item.created_at).toLocaleString()}</td>
        <td>${item.activity_type}</td>
        <td style="color:${color}; font-weight:bold;">${displayAmount}</td>
        <td>${item.description || '-'}</td>
    `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>';
    }
}

function closeHistoryModal() {
    document.getElementById("history-modal").style.display = "none";
}

document.getElementById('toggle-sidebar-btn').addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
});