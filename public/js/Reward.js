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
        await loadInventory();  
        renderAvailableVouchers(vouchers);
        initTabSwitch();                 
        renderInventoryByTab('ready');

    } catch (err) {
        console.error("Failed to load rewards:", err);
    }
}

function renderAvailableVouchers(voucherList) {
    const container = document.getElementById('voucher-container');
    const template = document.getElementById('voucher-template'); // 使用你提供的 template
    if (!container || !template) return;

    container.innerHTML = ''; 

    voucherList.forEach(v => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.v-name').innerText = v.name;
        clone.querySelector('.v-desc').innerText = v.description || 'No description';
        
        const statusBadge = clone.querySelector('.v-status-badge');
        statusBadge.innerText = `${v.cost} Points`;
        statusBadge.className = 'v-status-badge status-unused'; // 借用你之前的蓝色样式

        const isOwned = inventoryItems.some(item => 
            item.item_name === v.name && (item.status === 'unused' || item.status === 'active')
        );

        const btnWrapper = clone.querySelector('.v-button-wrapper');

        if (isOwned) {
            btnWrapper.innerHTML = `
                <button class="submit-btn" disabled 
                    style="background: #cbd5e1; cursor: not-allowed; margin-top:10px; width:100%;">
                    Already Owned
                </button>`;
        } else {
            btnWrapper.innerHTML = `
                <button class="submit-btn" onclick="redeemVoucher('${v.name}', ${v.cost})" 
                    style="margin-top:10px; width:100%;">
                    Redeem Now
                </button>`;
        }

        container.appendChild(clone);
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
    const template = document.getElementById('voucher-template');
    if (!container || !template) return;

    container.innerHTML = '';
    const now = new Date();

    const filtered = inventoryItems.filter(item => {
        const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
        if (tab === 'ready') return item.status === 'unused' && (!expiryDate || expiryDate > now);
        if (tab === 'activated') return item.status === 'active' && (!expiryDate || expiryDate > now);
        if (tab === 'expired') return item.status === 'expired' || (expiryDate && expiryDate < now);
        return false;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#64748b;">No vouchers found.</p>`;
        return;
    }

    filtered.forEach(item => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.voucher-card');
        const statusBadge = clone.querySelector('.v-status-badge');
        const codeWrapper = clone.querySelector('.v-code-wrapper');
        const btnWrapper = clone.querySelector('.v-button-wrapper');

        const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
        const isExpired = item.status === 'expired' || (expiryDate && expiryDate < now);

        clone.querySelector('.v-name').innerText = item.item_name || 'Voucher';
        clone.querySelector('.v-desc').innerText = item.description || '';

        if (isExpired) {
            card.classList.add('expired');
            statusBadge.innerText = 'Expired';
            statusBadge.className = 'v-status-badge status-expired'; 
            codeWrapper.innerHTML = ''; 
        } else {
            if (item.status === 'active' || item.status === 'activated') {
                statusBadge.innerText = 'Active';
                statusBadge.className = 'v-status-badge status-active';
                
                if (item.redeem_code) {
                    codeWrapper.innerHTML = `<span class="redeem-code">${item.redeem_code}</span>`;
                }
            } else {
                statusBadge.innerText = 'Ready'; 
                statusBadge.className = 'v-status-badge status-unused';
                
                btnWrapper.innerHTML = `<button class="submit-btn" onclick="activateItem(${item.id})" style="margin-top:10px; width:100%;">Activate Now</button>`;
            }
        }

        container.appendChild(clone);
    });
}

function initTabSwitch() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
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

    let isExpired = false;

    if (item.expired_at) {
        let expiredDate = new Date(item.expired_at);

        if (isNaN(expiredDate.getTime())) {
            const cleanTime = item.expired_at.toString().split('+')[0].split('.')[0];
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
    // 1. 基础确认
    if (!confirm(`Are you sure you want to spend ${cost} points for ${voucherName}?`)) return;

    try {
        const response = await fetch('/api/redeem-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voucherName, cost })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Success! You have redeemed ${voucherName}.`);
            await initRewards(); 
        } else {
            alert(result.error || "Redemption failed.");
        }
    } catch (err) {
        console.error("Redeem request failed:", err);
        alert("Server connection error. Please try again later.");
    }
}

document.addEventListener('DOMContentLoaded', initRewards);