
let currentPoints = 0;

const vouchers = [
    { id: 1, name: "RM5 KFC Voucher", cost: 10 },
    { id: 2, name: "RM10 GrabFood", cost: 20 },
    { id: 3, name: "10% Insurance Discount", cost: 50 }
];

const container = document.getElementById('voucher-container');
const displayPointsElement = document.getElementById('display-points');

async function initRewards() {
    try {
        const response = await fetch('/api/get-points');
        const data = await response.json();
        const displayPointsElement = document.getElementById('display-points');
        
        if (displayPointsElement) {
            displayPointsElement.innerText = data.points || 0;
            currentPoints = data.points || 0;
        }
        renderVouchers();
        loadInventory();
    } catch (err) {
        console.error("Failed to load rewards:", err);
    }
}

// 渲染背包道具
async function loadInventory() {
    try {
        const res = await fetch('/api/get-inventory');
        const items = await res.json();
        const container = document.getElementById('inventory-container');
        if (!container) return;

        container.innerHTML = items.length ? '' : "<p class='placeholder-text'>Empty.</p>";
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'inventory-item-inner';
            div.innerHTML = `
                <h4 style="color:var(--primary-blue)">${item.item_name}</h4>
                <p style="font-size:0.8rem">Owned: ${item.quantity}</p>
                <button class="submit-btn" style="padding:5px; margin-top:5px" onclick="activateItem('${item.item_name}')">Activate</button>
            `;
            container.appendChild(div);
        });
    } catch (err) { console.error(err); }
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

function updateFeatured() {
    const featured = document.getElementById('featured-voucher-content');
    if (vouchers.length > 0 && featured) {
        const topV = vouchers[0]; 
        featured.innerHTML = `
            <div class="inventory-item-inner" style="margin-top: 20px; text-align: center; flex-direction: column;">
                <p style="font-weight: bold; color: var(--primary-blue);">${topV.name}</p>
                <p style="font-size: 0.85rem; color: #64748b; margin: 5px 0 15px;">Cost: ${topV.cost} Pts</p>
                <button class="submit-btn" style="width: 100%;" onclick="redeemVoucher('${topV.name}', ${topV.cost})">
                    Quick Redeem
                </button>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', initRewards);