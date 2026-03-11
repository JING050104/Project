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
        
        if (response.ok) {
            alert("Voucher activated successfully!");
            loadInventory();
        } else {
            alert("Activation failed.");
        }
    } catch (err) {
        console.error(err);
    }
}

// 渲染背包道具
async function loadInventory() {
    try {
        const res = await fetch('/api/get-inventory');
        if (!res.ok) throw new Error("Server Error");
        
        let items = await res.json();
        
        // 兼容性处理：如果后端返回的是 { rows: [...] } 格式
        if (items.rows) items = items.rows;

        const container = document.getElementById('inventory-container');
        if (!container) return;

        if (!Array.isArray(items)) {
            container.innerHTML = "<p>Data format error.</p>";
            return;
        }

        if (items.length === 0) {
            container.innerHTML = "<p class='placeholder-text'>No items in inventory.</p>";
            return;
        }

        container.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'inventory-item-inner';
            
            // Use the exact names from your SQL: id, item_name, quantity
            div.innerHTML = `
                <h4 style="color:var(--primary-blue)">${item.item_name || 'Item'}</h4>
                <p style="font-size:0.8rem">Owned: ${item.quantity ?? 0}</p>
                <button class="submit-btn" onclick="activateItem(${item.id})">Activate</button>
            `;
            container.appendChild(div);
        });
    } catch (err) { 
        console.error("Load Inventory Failed:", err);
    }
}

/**
 * 动态渲染礼券卡片
 */
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