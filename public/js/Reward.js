let vouchers = []; 
let currentPoints = 0;
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
            <h4>${v.item_name}</h4>
            <p class="description">${v.description || 'No description'}</p>
            <div class="status">Cost: ${v.points_required} Points</div>
            <button class="submit-btn" onclick="redeemVoucher('${v.item_name}', ${v.points_required})">Redeem</button>
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

let allInventory = [];

async function loadInventory() {
    try {
        const res = await fetch('/api/get-inventory');
        if (!res.ok) throw new Error("Failed to load inventory");

        const data = await res.json();
        // 處理可能的資料結構差異
        let items = Array.isArray(data) ? data : (data.rows || []);

        allInventory = items;  // 存起來供 tab 切換使用

        // 初次載入顯示 "Ready to Use"
        renderInventoryByTab('ready');

    } catch (err) {
        console.error("Load inventory failed:", err);
        document.getElementById('inventory-container').innerHTML = 
            '<p style="text-align:center; color:#ef4444;">Failed to load vouchers</p>';
    }
}

function renderInventoryByTab(tabType) {
    const container = document.getElementById('inventory-container');
    if (!container) return;

    let filtered = [];

    const now = new Date();

    if (tabType === 'ready') {
        filtered = allInventory.filter(item => 
            item.status === 'unused' && 
            (!item.expire_date || new Date(item.expire_date) > now)
        );
    } else if (tabType === 'activated') {
        filtered = allInventory.filter(item => 
            item.status === 'activated' || item.status === 'used'
        );
    } else if (tabType === 'expired') {
        filtered = allInventory.filter(item => 
            item.expire_date && new Date(item.expire_date) < now
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:30px;">No vouchers in this category</p>';
        return;
    }

    // 渲染卡片（可根據你的原本 voucher 卡片樣式調整）
    let html = '';
    filtered.forEach(item => {
        const isExpired = item.expire_date && new Date(item.expire_date) < now;
        const statusText = isExpired ? 'Expired' : (item.status === 'activated' ? 'Activated' : 'Ready');

        html += `
            <div class="voucher-card" style="border:1px solid #e2e8f0; border-radius:8px; padding:15px; margin-bottom:12px; ${isExpired ? 'opacity:0.6;' : ''}">
                <h4>${item.item_name || item.voucher_name || 'Voucher'}</h4>
                <p style="color:#64748b; font-size:0.9rem;">${item.description || ''}</p>
                <div style="margin-top:10px; font-weight:bold; color:#2563eb;">
                    ${statusText}
                    ${item.redeem_code ? `<br><small>Redeem Code: ${item.redeem_code}</small>` : ''}
                </div>
                ${!isExpired && item.status === 'unused' ? 
                    `<button onclick="activateItem(${item.id})" style="margin-top:10px;">Activate</button>` : ''}
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