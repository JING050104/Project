async function loadLeaderboard(gameType, element) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if (element) {
        element.classList.add('active');
    } else {
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
            
            let rankDisplay = rank;
            let rankClass = '';
            if (rank === 1) { rankDisplay = '🥇'; rankClass = 'rank-1'; }
            else if (rank === 2) { rankDisplay = '🥈'; rankClass = 'rank-2'; }
            else if (rank === 3) { rankDisplay = '🥉'; rankClass = 'rank-3'; }

            const timeBonus = (gameType === 'RiskFinder' && entry.time_left > 0) 
                ? `<div style="font-size: 11px; color: #22c55e;">⏱ Remaining: ${entry.time_left}s</div>` 
                : '';

            return `
                <tr class="fade-in">
                    <td class="${rankClass}" style="text-align:center; font-size: 20px;">${rankDisplay}</td>
                    <td>
                        <div style="font-weight: bold;">${entry.username || 'Anonymous'}</div>
                    </td>
                    <td>
                        <div class="score-cell" style="font-weight: bold; color: #2563eb;">
                            ${entry.score.toLocaleString()} pts
                        </div>
                        <small style="color:#64748b;">(${entry.reached_level} ${unit})</small>
                        ${timeBonus} 
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #ff2e2e; padding: 40px;">Error loading data.</td></tr>';
        console.error("Leaderboard Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard('RiskDefender');
});