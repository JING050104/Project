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
        
        const result = await response.json(); 
        const { topTen, userStats } = result;

        if (!topTen || topTen.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No scores yet. Be the first!</td></tr>';
            return;
        }

        let rowsHtml = topTen.map((entry, index) => {
            return renderRowTemplate(entry, index + 1, gameType, false);
        }).join('');

        if (userStats && parseInt(userStats.rank) > 10) {
            rowsHtml += `
                <tr class="rank-separator">
                    <td colspan="5" style="text-align: center; font-size: 12px; color: #888; padding: 10px 0; background: rgba(0,0,0,0.02);">
                        ••• Your Current Position •••
                    </td>
                </tr>`;
            rowsHtml += renderRowTemplate(userStats, userStats.rank, gameType, true);
        }

        tbody.innerHTML = rowsHtml;

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: #ff2e2e;">Error loading data.</td></tr>';
        console.error("Leaderboard Error:", err);
    }
}

function renderRowTemplate(entry, rank, gameType, isCurrentUser) {
    const unit = gameType === 'RiskDefender' ? 'Waves' : 'Photos';
    const avatarUrl = entry.profile_image
        ? entry.profile_image
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.username || 'U')}&background=4a90e2&color=fff`;

    let rankDisplay = rank;
    let rowClass = 'fade-in';
    
    if (isCurrentUser) rowClass += ' current-user-row';

    if (rank === 1) { rankDisplay = '🥇'; rowClass += ' top-1'; }
    else if (rank === 2) { rankDisplay = '🥈'; rowClass += ' top-2'; }
    else if (rank === 3) { rankDisplay = '🥉'; rowClass += ' top-3'; }

    const timeValue = (entry.time_used != null) ? `${entry.time_used}s` : '-';

    return `
        <tr class="${rowClass}">
            <td class="rank-cell">${rankDisplay}</td>
            <td style="text-align: left;">
                <div class="player-info-wrapper" style="display: flex; align-items: center; gap: 10px; justify-content: flex-start; padding-left: 15%;">
                    <img src="${avatarUrl}" class="lb-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;">
                    <div class="player-name">
                        ${entry.username || 'Anonymous'} 
                        ${isCurrentUser ? '<span style="color: #4a90e2; font-size: 0.85em; margin-left:5px;">(You)</span>' : ''}
                    </div>
                </div>
            </td>
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
}

document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard('RiskFinder');
});