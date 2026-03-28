async function loadLeaderboard(gameType, element) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));

    if (element) {
        element.classList.add('active');
    } else {
        const defaultBtn = Array.from(tabs).find(b => b.getAttribute('onclick')?.includes(gameType));
        if (defaultBtn) defaultBtn.classList.add('active');
    }

    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="5">Loading scores...</td></tr>';

    try {
        const response = await fetch(`/api/leaderboard?gameType=${gameType}`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No scores yet. Be the first!</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((entry, index) => {
            const rank = index + 1;
            const unit = gameType === 'RiskDefender' ? 'Waves' : 'Photos';

            let rankDisplay = rank;
            let rowClass = 'fade-in';
            if (rank === 1) { rankDisplay = '🥇'; rowClass += ' top-1'; }
            else if (rank === 2) { rankDisplay = '🥈'; rowClass += ' top-2'; }
            else if (rank === 3) { rankDisplay = '🥉'; rowClass += ' top-3'; }

            const timeValue = (entry.time_used != null) ? `${entry.time_used}s` : '-';

            return `
                <tr class="${rowClass}">
                    <td class="rank-cell">${rankDisplay}</td>
                    <td><div class="player-name">${entry.username || 'Anonymous'}</div></td>
                    <td>
                        <span class="unit-label">${unit}</span>
                        <span class="level-badge">${entry.reached_level || 0}</span>
                    </td>
                    <td class="time-cell">${timeValue}</td>
                    <td>
                        <div class="score-container">
                            ${(entry.score || 0).toLocaleString()} 
                            <span class="score-unit">pts</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: #ff2e2e;">Error loading data.</td></tr>';
        console.error("Leaderboard Error:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard('RiskFinder');
});