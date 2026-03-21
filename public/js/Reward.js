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
        
        renderVouchers();
        loadInventory();
    } catch (err) {
        console.error("Failed to load rewards:", err);
    }
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
        if (!res.ok) throw new Error("Server Error");
        let data = await res.json();
        let items = (Array.isArray(data) && Array.isArray(data[0])) ? data[0] : data;
        if (items && items.rows) items = items.rows;

        const container = document.getElementById('inventory-container');
        if (!container) return;

        if (!Array.isArray(items) || items.length === 0) {
            container.innerHTML = "<p class='placeholder-text'>No items in inventory.</p>";
            return;
        }

        container.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.onclick = () => openVoucherModal(item);
            div.className = 'inventory-item-inner';
            div.innerHTML = `
                <h4 style="color:var(--primary-blue)">${item.item_name || 'Item'}</h4>
                <p style="font-size:0.8rem">Quantity: ${item.quantity ?? 0}</p> 
                <div style="margin-top: 10px; font-size: 0.7rem; color: var(--primary-blue); font-weight: bold;">
                    View Details
                </div>
            `;
            container.appendChild(div);
        });
    } catch (err) { 
        console.error("Load Inventory Failed:", err);
    }
}

function openVoucherModal(item) {
    console.log("=== openVoucherModal called ===");
    console.log("Full item object:", item);
    console.log("expired_at raw value:", item.expired_at);
    console.log("Type of expired_at:", typeof item.expired_at);

    if (item.expired_at) {
        const parsed = new Date(item.expired_at);
        console.log("Parsed date:", parsed);
        console.log("Is valid date?", !isNaN(parsed.getTime()));
        console.log("Is expired?", new Date() > parsed);
    }
    
    const desc = document.getElementById('modal-description');
    const codeContainer = document.getElementById('redeem-code-container');
    const codeText = document.getElementById('redeem-code-text');
    const btn = document.getElementById('modal-action-btn');
    const statusBadge = document.getElementById('modal-status');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.innerText = item.item_name || 'Voucher';

    // === 加強版過期判斷 ===
    let isExpired = false;
    if (item.expired_at) {
        const expiredTime = new Date(item.expired_at);
        const now = new Date();
        
        // 處理後端可能傳來的字串時間
        if (!isNaN(expiredTime.getTime())) {
            isExpired = now > expiredTime;
        }
    }

    if (isExpired) {
        // 已過期
        statusBadge.innerText = 'Expired';
        statusBadge.className = 'modal-badge status-expired';
        desc.innerText = 'This voucher has expired and can no longer be used.';
        desc.style.display = 'block';
        codeContainer.style.display = 'none';
        btn.style.display = 'none';

    } else if (item.status === 'active') {
        // 已激活且未過期
        statusBadge.innerText = 'Activated';
        statusBadge.className = 'modal-badge status-active';
        desc.style.display = 'none';
        btn.style.display = 'none';

        codeContainer.style.display = 'block';
        codeText.innerText = item.redeem_code || 'N/A';

    } else {
        // 未激活
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