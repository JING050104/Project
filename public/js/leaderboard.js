

async function loadLeaderboard(gameType, element) {
    // 切换 Tab 样式
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if (element) {
        element.classList.add('active');
    } else {
        // 初始加载时匹配对应的按钮
        const defaultBtn = Array.from(tabs).find(b => b.textContent.replace(' ', '') === gameType);
        if (defaultBtn) defaultBtn.classList.add('active');
    }

    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px;">Loading scores...</td></tr>';

    try {
        const response = await fetch(`/api/leaderboard?gameType=${gameType}`);
        const data = await response.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 40px;">No scores yet. Be the first!</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((entry, index) => {
            const rank = index + 1;
            const unit = gameType === 'RiskDefender' ? 'Waves' : 'Photos';
                return `
                    <tr>
                        <td>${rankEmoji}</td>
                        <td>${entry.username}</td>
                        <td>
                            <strong>${entry.score.toLocaleString()} pts</strong> 
                            <small style="color:#888; margin-left:10px;">(${entry.reached_level} ${unit})</small>
                        </td>
                    </tr>
                `;
            let rankDisplay = rank;
            let rankClass = '';

            if (rank === 1) { rankDisplay = '🥇'; rankClass = 'rank-1'; }
            else if (rank === 2) { rankDisplay = '🥈'; rankClass = 'rank-2'; }
            else if (rank === 3) { rankDisplay = '🥉'; rankClass = 'rank-3'; }

            return `
                <tr class="fade-in">
                    <td class="${rankClass}">${rankDisplay}</td>
                    <td>${entry.username || 'Anonymous'}</td>
                    <td class="score-cell">${entry.score.toLocaleString()}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #ff2e2e; padding: 40px;">Error loading data.</td></tr>';
        console.error("Leaderboard Error:", err);
    }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard('RiskDefender');
});