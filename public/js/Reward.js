let vouchers = []; 
let currentPoints = 0;
let inventoryItems = [];
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
        renderInventoryByTab('inactive');
        await loadPointHistory();

    } catch (err) {
        console.error("Failed to load rewards:", err);
    }
}

function renderAvailableVouchers(voucherList) {
    const container = document.getElementById('voucher-container');
    const template = document.getElementById('voucher-item-template');
    if (!container || !template) return;

    container.innerHTML = '';
    const now = new Date();

    voucherList.forEach(v => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.v-name').innerText = v.name;
        clone.querySelector('.v-desc').innerText = v.description || 'No description';
        clone.querySelector('.v-status-badge').innerText = `${v.cost} Points`;

        const isOwned = inventoryItems.some(item => {
            const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
            return item.item_name === v.name && 
                   (item.status === 'inactive' || item.status === 'active') && (!expiryDate || expiryDate > now);
        });
        const canAfford = currentPoints >= v.cost;

        const redeemBtn = clone.querySelector('.v-redeem-btn');
        const ownedBtn = clone.querySelector('.v-owned-btn');
        const lowPointsBtn = clone.querySelector('.v-low-points-btn');

        if (isOwned) {
            ownedBtn.style.display = 'block';
            redeemBtn.style.display = 'none';
        } else if (!canAfford) {
            lowPointsBtn.style.display = 'block';
            redeemBtn.style.display = 'none';
        } else {
            redeemBtn.style.display = 'block';
            redeemBtn.onclick = () => redeemVoucher(v.name, v.cost);
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

        renderInventoryByTab('inactive');

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
    const template = document.getElementById('voucher-item-template'); 
    if (!container || !template) return;

    container.innerHTML = '';
    const now = new Date();

    const filtered = inventoryItems.filter(item => {
        const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
        if (tab === 'inactive') return item.status === 'inactive' && (!expiryDate || expiryDate > now);
        if (tab === 'activated') return (item.status === 'active' || item.status === 'activated') && (!expiryDate || expiryDate > now);
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
    const codeText = clone.querySelector('.code-text');       
    const copyBtn = clone.querySelector('.v-copy-btn');       
    const expiryContainer = clone.querySelector('.v-expiry-container');
    const expiryDateEl = clone.querySelector('.v-expiry-date');

    const redeemBtn = clone.querySelector('.v-redeem-btn');
    const ownedBtn = clone.querySelector('.v-owned-btn');
    const lowPointsBtn = clone.querySelector('.v-low-points-btn');

    const now = new Date();
    const expiryDate = item.expired_at ? new Date(item.expired_at) : null;
    const isExpired = item.status === 'expired' || (expiryDate && expiryDate < now);

    clone.querySelector('.v-name').innerText = item.item_name || 'Voucher';
    clone.querySelector('.v-desc').innerText = item.description || '';

    if (ownedBtn) ownedBtn.remove();
    if (lowPointsBtn) lowPointsBtn.remove();

    if (isExpired) {
        if (redeemBtn) redeemBtn.remove();
        card.classList.add('expired');
        statusBadge.innerText = 'Expired';
        statusBadge.className = 'v-status-badge status-expired'; 
        if (codeWrapper) codeWrapper.style.display = 'none';
    } else {
        if (item.status === 'active' || item.status === 'activated') {
            if (redeemBtn) redeemBtn.remove(); 
            
            statusBadge.innerText = 'Active';
            statusBadge.className = 'v-status-badge status-active';
            
            if (item.redeem_code) {
                if (codeWrapper) codeWrapper.style.display = 'flex'; 
                if (codeText) codeText.innerText = item.redeem_code;
                if (copyBtn) {
                    copyBtn.onclick = (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(item.redeem_code).then(() => {
                            const originalClass = copyBtn.className;
                            copyBtn.className = "fa-solid fa-check"; 
                            copyBtn.style.color = "#2ecc71";
                            setTimeout(() => {
                                copyBtn.className = originalClass;
                                copyBtn.style.color = "";
                            }, 2000);
                        });
                    };
                }
            }
        } else {
            statusBadge.innerText = 'Inactive'; 
            statusBadge.className = 'v-status-badge status-inactive';
            if (codeWrapper) codeWrapper.style.display = 'none';

            if (redeemBtn) {
                redeemBtn.style.display = 'block';
                redeemBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Activate Now';
                redeemBtn.onclick = () => activateItem(item.id);
            }
        }
    }

    if (expiryDate && !isExpired && (item.status === 'active' || item.status === 'activated')) {
        const dateString = expiryDate.toLocaleDateString() + ' ' + expiryDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (expiryDateEl) {
            expiryDateEl.innerText = dateString;
            expiryContainer.style.display = 'block';
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
        statusBadge.innerText = 'Inactive';
        statusBadge.className = 'modal-badge status-inactive';
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

async function loadPointHistory() {
    const container = document.getElementById('point-history-container');
    const template = document.getElementById('history-item-template');
    if (!container || !template) return;

    try {
        const res = await fetch('/api/get-point-history');
        const history = await res.json();

        container.innerHTML = '';

        if (!history || history.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">No transaction history found.</p>';
            return;
        }

        history.forEach(item => {
            const clone = template.content.cloneNode(true);
            
            clone.querySelector('.h-desc').innerText = item.description;
            
            const date = new Date(item.created_at);
            clone.querySelector('.h-date').innerText = date.toLocaleString();

            const changeEl = clone.querySelector('.h-change');
            const val = item.points_change;

            if (val > 0) {
                changeEl.innerText = `+${val}`;
                changeEl.classList.add('point-plus');
            } else {
                changeEl.innerText = `${val}`; 
                changeEl.classList.add('point-minus');
            }

            container.appendChild(clone);
        });
    } catch (err) {
        console.error("Failed to load history:", err);
        container.innerHTML = '<p style="text-align:center; color:#ef4444;">Error loading history.</p>';
    }
}

async function redeemVoucher(voucherName, cost) {
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