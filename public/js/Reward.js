let vouchers = []; 
let currentPoints = 0;
let inventoryItems = [];
let allInventory = [];
window.activateItem = activateItem;
window.redeemVoucher = redeemVoucher;
const container = document.getElementById('voucher-container');
const displayPointsElement = document.getElementById('display-points');

async function initRewards() {
    try {
        const [pointsRes, vouchersRes] = await Promise.all([
            fetch('/api/get-points'),
            fetch('/api/get-vouchers') 
        ]);
        
        const pointsData = await pointsRes.json();
        const vouchersData = await vouchersRes.json();
        
        currentPoints = pointsData.points || 0;
        document.getElementById('display-points').innerText = currentPoints;
        
        vouchers = vouchersData; 
        renderAvailableVouchers(vouchers);

        await loadInventory();          
        initTabSwitch();                 
        renderInventoryByTab('ready');

    } catch (err) {
        console.error("Failed to load rewards:", err);
    }
}

function renderAvailableVouchers(voucherList) {
    const container = document.getElementById('voucher-container');
    if (!container) return;
    container.innerHTML = ''; 

    voucherList.forEach(v => {
        const card = document.createElement('div');
        card.className = 'login-card voucher-card';
        card.innerHTML = `
            <h4>${v.name}</h4>
            <p class="description">${v.description || 'No description'}</p>
            <div class="status">Cost: ${v.cost} Points</div>
            <button class="submit-btn" onclick="redeemVoucher('${v._name}', ${v.cost})">Redeem</button>
        `;
        container.appendChild(card);
    });
}

async function activateItem(inventoryId) {
    try {
        const response = await fetch('/api/activate-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inventoryId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`Activated! Your Redeem Code: ${data.redeemCode}`);
            loadInventory();
            closeVoucherModal();
        } else {
            alert(data.error || "Activation failed.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadInventory() {
    try {
        const res = await fetch('/api/get-inventory');
        if (!res.ok) throw new Error("Failed to load inventory");

        const data = await res.json();
        
        let items = data;
        if (data.rows) items = data.rows;
        if (Array.isArray(data) && Array.isArray(data[0])) items = data[0];

        inventoryItems = items; 
        
        console.log("Inventory loaded successfully:", inventoryItems);

        renderInventoryByTab('ready');

    } catch (err) {
        console.error("Load inventory failed:", err);
        const container = document.getElementById('inventory-container');
        if (container) {
            container.innerHTML = '<p style="text-align:center; color:#ef4444;">Failed to load vouchers. Please try again.</p>';
        }
    }
}

function renderInventoryByTab(tab) {
    const container = document.getElementById('inventory-container');
    if (!container) return;
    container.innerHTML = '';

    const now = new Date();

    const filtered = inventoryItems.filter(item => {
        const now = new Date();
        const status = item.status; 
        const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
        if (tab === 'ready') {
            return item.status === 'unused' && (!expiryDate || expiryDate > now);
        }
        if (tab === 'activated') {
            return item.status === 'active' && (!expiryDate || expiryDate > now);
        }
        if (tab === 'expired') {
            return item.status === 'expired' || (expiryDate && expiryDate < now);
        }
        return false;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#64748b;">No vouchers found.</p>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
    const isExpired = item.expire_date && new Date(item.expire_date) < now;
    const statusText = isExpired ? 'Expired' : (item.status === 'activated' ? 'Activated' : 'Ready');

    html += `
        <div class="voucher-card ${isExpired ? 'expired' : ''}">
            <h4>${item.item_name || 'Voucher'}</h4>
            <p class="description">${item.description || ''}</p>
            <div class="status" style="color: #4a90e2;">
                ${statusText}
                ${item.redeem_code ? `<br><span class="redeem-code">${item.redeem_code}</span>` : ''}
            </div>
            ${!isExpired && (item.status === 'unused' || item.status === 'ready') ? 
                `<button class="submit-btn" onclick="activateItem(${item.id})" style="margin-top:10px; width:100%;">Activate Now</button>` : ''}
        </div>
    `;
});

    container.innerHTML = html;
}

function initTabSwitch() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除 active
            tabs.forEach(t => t.classList.remove('active'));
            // 加 active
            tab.classList.add('active');
            
            const tabType = tab.dataset.tab;
            renderInventoryByTab(tabType);
        });
    });
}

function openVoucherModal(item) {
    console.log("=== openVoucherModal called ===");
    console.log("Full item:", item);
    console.log("expired_at raw:", item.expired_at);

    const desc = document.getElementById('modal-description');
    const codeContainer = document.getElementById('redeem-code-container');
    const codeText = document.getElementById('redeem-code-text');
    const btn = document.getElementById('modal-action-btn');
    const statusBadge = document.getElementById('modal-status');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.innerText = item.item_name || 'Voucher';

    // === 加強版過期判斷（處理帶時區的時間）===
    let isExpired = false;

    if (item.expired_at) {
        // 方法1：直接用 new Date()（大多數情況有效）
        let expiredDate = new Date(item.expired_at);

        // 方法2：如果上面解析失敗，嘗試移除時區後再解析
        if (isNaN(expiredDate.getTime())) {
            const cleanTime = item.expired_at.toString().split('+')[0].split('.')[0]; // 去掉時區和小數點
            expiredDate = new Date(cleanTime);
        }

        const now = new Date();
        isExpired = !isNaN(expiredDate.getTime()) && now > expiredDate;

        console.log("Parsed expiredDate:", expiredDate);
        console.log("Current time:", now);
        console.log("Is expired?", isExpired);
    }

    if (isExpired) {
        statusBadge.innerText = 'Expired';
        statusBadge.className = 'modal-badge status-expired';
        desc.innerText = 'This voucher has expired and can no longer be used.';
        desc.style.display = 'block';
        codeContainer.style.display = 'none';
        btn.style.display = 'none';

    } else if (item.status === 'active') {
        statusBadge.innerText = 'Activated';
        statusBadge.className = 'modal-badge status-active';
        desc.style.display = 'none';
        btn.style.display = 'none';

        codeContainer.style.display = 'block';
        codeText.innerText = item.redeem_code || 'N/A';

    } else {
        statusBadge.innerText = 'Ready to Use';
        statusBadge.className = 'modal-badge status-unused';
        desc.style.display = 'block';
        desc.innerText = item.description || 'Activate this voucher to reveal your unique redemption code.';
        btn.style.display = 'block';
        codeContainer.style.display = 'none';

        btn.onclick = () => activateItem(item.id);
    }

    document.getElementById('voucher-detail-modal').style.display = 'flex';
}

function closeVoucherModal() {
    document.getElementById('voucher-detail-modal').style.display = 'none';
}

function renderVouchers() {
    if (!container) return;
    
    container.innerHTML = '';
    vouchers.forEach(v => {
        const canAfford = currentPoints >= v.cost;
        const card = document.createElement('div');
        card.className = 'dash-card';
        
        card.innerHTML = `
            <span class="level-badge">${v.cost} Points</span>
            <h3 style="margin: 15px 0;">${v.name}</h3>
            <button class="submit-btn" 
                ${canAfford ? '' : 'disabled style="background: #cbd5e1; cursor: not-allowed;"'}
                onclick="redeemVoucher('${v.name}', ${v.cost})">
                ${canAfford ? 'Redeem Now' : 'Redeem Now'}
            </button>
        `;
        container.appendChild(card);
    });
}
/**
 * @param {string} voucherName 礼券名称
 * @param {number} cost 消耗积分
 */

async function redeemVoucher(voucherName, cost) {
    const inventoryRes = await fetch('/api/get-inventory');
    const inventoryData = await inventoryRes.json();
    
    let items = (Array.isArray(inventoryData) && Array.isArray(inventoryData[0])) ? inventoryData[0] : inventoryData;
    if (items && items.rows) items = items.rows;

    const hasVoucher = items.some(item => item.item_name === voucherName);
    if (hasVoucher) {
        alert(`You already have a ${voucherName} in your inventory! Use it before redeeming another.`);
        return;
    }
    if (!confirm(`Are you sure you want to spend ${cost} points for ${voucherName}?`)) return;

    try {
        const response = await fetch('/api/redeem-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voucherName: voucherName, cost: cost })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Success! You have redeemed ${voucherName}.`);
            initRewards(); 
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (err) {
        console.error("Redeem request failed:", err);
        alert("Server connection error. Please try again later.");
    }
}

document.addEventListener('DOMContentLoaded', initRewards);