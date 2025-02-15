class AdminPanel {
    constructor() {
        this.loginForm = document.getElementById('adminLoginForm');
        this.loginSection = document.getElementById('loginSection');
        this.adminPanel = document.getElementById('adminPanel');
        this.addQuestionForm = document.getElementById('addQuestionForm');
        this.questionsList = document.getElementById('questionsList');
        this.adminSettingsForm = document.getElementById('adminSettingsForm');
        this.gameSettingsForm = document.getElementById('gameSettingsForm');
        
        // 添加批量删除相关的元素引用
        this.selectAllCheckbox = document.getElementById('selectAllQuestions');
        this.batchDeleteBtn = document.getElementById('batchDeleteBtn');
        
        this.init();
        this.initPanels();
        
        // 添加排行榜刷新定时器
        this.startLeaderboardRefresh();

        // 添加历史记录监听
        this.setupHistoryListener();

        // 添加实时更新监听
        this.addQuestionForm.addEventListener('submit', (e) => {
            this.handleAddQuestion(e).then(() => this.updateGridSizeOptions());
        });

        // 绑定批量删除相关事件
        this.selectAllCheckbox?.addEventListener('change', () => this.handleSelectAll());
        this.batchDeleteBtn?.addEventListener('click', () => this.handleBatchDelete());
    }

    init() {
        // 修改登录检查逻辑
        const isAdmin = sessionStorage.getItem('isAdmin');
        const lastActivity = sessionStorage.getItem('adminLastActivity');
        const currentTime = Date.now();
        const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟超时

        // 检查是否登录以及会话是否过期
        if (isAdmin === 'true' && lastActivity && (currentTime - parseInt(lastActivity)) < SESSION_TIMEOUT) {
            this.showAdminPanel();
            // 更新最后活动时间
            sessionStorage.setItem('adminLastActivity', currentTime.toString());
        } else {
            // 清除所有管理员相关的状态
            this.clearAdminSession();
            this.showLoginForm();
        }

        // 绑定事件
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.addQuestionForm.addEventListener('submit', (e) => this.handleAddQuestion(e));
        this.adminSettingsForm.addEventListener('submit', (e) => this.handleUpdateAdmin(e));
        this.gameSettingsForm.addEventListener('submit', (e) => this.handleUpdateGameSettings(e));
        
        // 加载题目列表
        this.loadQuestions();
        this.loadGameSettings();
        
        // 初始载排行榜
        this.refreshLeaderboard();
    }

    initPanels() {
        // 只隐藏管理员设置面板
        document.getElementById('adminSettings-panel').classList.add('hidden');
    }

    setupHistoryListener() {
        // 监听浏览器的后退事件
        window.addEventListener('popstate', () => {
            this.clearAdminSession();
            window.location.href = '../index.html';
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clearAdminSession();
            }
        });
    }

    clearAdminSession() {
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminLastActivity');
        localStorage.removeItem('isAdmin');
    }

    showLoginForm() {
        this.loginSection.classList.remove('hidden');
        this.adminPanel.classList.add('hidden');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            await API.adminLogin(username, password);
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminLastActivity', Date.now().toString());
            this.showAdminPanel();
        } catch (error) {
            alert('登录失败，请检查用户名和密码');
        }
    }

    showAdminPanel() {
        this.loginSection.classList.add('hidden');
        this.adminPanel.classList.remove('hidden');
        this.loadQuestions();
        
        // 添加这行，防止后退到登录页面
        history.pushState(null, '', window.location.href);
    }

    async loadQuestions() {
        try {
            const questions = await API.getQuestions();
            this.renderQuestions(questions);
        } catch (error) {
            console.error('Failed to load questions:', error);
        }
    }

    async handleAddQuestion(e) {
        e.preventDefault();
        const input = document.getElementById('newQuestion');
        const question = input.value.trim();

        if (!question) return;

        try {
            await API.addQuestion(question);
            input.value = '';
            this.loadQuestions();
        } catch (error) {
            alert('添加题目失败，请重试');
        }
    }

    renderQuestions(questions) {
        this.questionsList.innerHTML = questions.map(q => `
            <div class="flex items-center justify-between border-b pb-2">
                <div class="flex items-center gap-2">
                    <input type="checkbox" 
                        class="question-checkbox rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        data-question-id="${q.id}">
                    <span>${q.question}</span>
                </div>
                <button
                    onclick="adminPanel.handleDeleteQuestion(${q.id})"
                    class="text-red-600 hover:text-red-700"
                >
                    删除
                </button>
            </div>
        `).join('');

        // 添加复选框变化事件监听
        this.questionsList.querySelectorAll('.question-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateBatchDeleteButton());
        });

        // 重置全选复选框和批量删除按钮状态
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.checked = false;
        }
        this.updateBatchDeleteButton();
    }

    async handleDeleteQuestion(id) {
        if (!confirm('确定要删除这个题目吗？')) return;

        try {
            await API.deleteQuestion(id);
            await this.loadQuestions();
            await this.updateGridSizeOptions(); // 删除后更新选项
        } catch (error) {
            alert('删除题目失败，请重试');
        }
    }

    async handleUpdateAdmin(e) {
        e.preventDefault();
        const newUsername = document.getElementById('newUsername').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        if (!newUsername || !newPassword || !confirmPassword) {
            alert('所有字段都不能为空');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        try {
            await API.updateAdminCredentials(newUsername, newPassword);
            alert('管理员信息更新成功，请使用新的用户名和密码新登录');
            handleLogout();
        } catch (error) {
            alert('更新管理员信息失败');
        }
    }

    async handleUpdateGameSettings(e) {
        e.preventDefault();
        const gridSize = document.getElementById('gridSize').value;
        const requiredQuestions = gridSize * gridSize;

        try {
            // 先检查题目数量是否足够
            const questions = await API.getQuestions();
            const uniqueQuestions = Array.from(new Set(questions.map(q => q.question)));
            
            if (uniqueQuestions.length < requiredQuestions) {
                alert(`题目数量不足！当前有 ${uniqueQuestions.length} 个不重复题目，` +
                      `${gridSize}x${gridSize} 的格子需要 ${requiredQuestions} 个不重复题目。\n\n` +
                      `请先添加更多题目，或减小格子大小。`);
                return;
            }

            await API.updateGameSettings(gridSize);
            alert('游戏设置更新成功');
        } catch (error) {
            alert('更新游戏设置失败');
        }
    }

    async loadGameSettings() {
        try {
            const settings = await API.getGameSettings();
            let gridSize = settings ? settings.gridSize : 5;
            
            // 更新选择器值
            const gridSizeSelector = document.getElementById('gridSize');
            gridSizeSelector.value = gridSize.toString();

            // 更新选项可用性
            await this.updateGridSizeOptions();
        } catch (error) {
            console.error('Failed to load game settings:', error);
        }
    }

    // 开始定时刷新排行榜
    startLeaderboardRefresh() {
        // 每30秒��新一次排行榜
        this.leaderboardInterval = setInterval(() => {
            this.refreshLeaderboard();
        }, 30000);
    }

    // 刷新排行榜
    async refreshLeaderboard() {
        try {
            const leaderboard = await API.getLeaderboard();
            this.renderLeaderboard(leaderboard);
        } catch (error) {
            console.error('Failed to refresh leaderboard:', error);
        }
    }

    // 修改渲染排行榜的方法
    renderLeaderboard(leaderboard) {
        const leaderboardElement = document.getElementById('adminLeaderboard');
        if (!leaderboardElement) return;

        leaderboardElement.innerHTML = leaderboard.map((team, index) => {
            const completionDate = new Date(team.timestamp);
            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${index + 1}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${team.teamName}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${team.leaderName || '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${this.formatTime(team.score)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${completionDate.toLocaleString()}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 格式化时间
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}时${minutes}分${remainingSeconds}秒`;
    }

    // 在组件销毁时清理定时器
    cleanup() {
        if (this.leaderboardInterval) {
            clearInterval(this.leaderboardInterval);
        }
    }

    async handleReset() {
        const confirmed = confirm(
            '警告：这清除所有数据，包括：\n' +
            '- 所有游戏进度\n' +
            '- 所有排行榜记录\n' +
            '- 所有题目\n\n' +
            '此操作不可撤销！是否确定继续？'
        );

        if (!confirmed) return;

        const doubleConfirmed = confirm(
            '最后确认：\n' +
            '您确定要重置所有数据吗？'
        );

        if (!doubleConfirmed) return;

        try {
            await API.resetAllData();
            alert('所有数据已重置');
            window.location.reload(); // 刷新页面以显示重置后的状态
        } catch (error) {
            console.error('Failed to reset data:', error);
            alert('重置失败，请重试');
        }
    }

    // 添加新方法：更新格子大小选项
    async updateGridSizeOptions() {
        try {
            const questions = await API.getQuestions();
            const uniqueQuestions = Array.from(new Set(questions.map(q => q.question))).length;
            const maxPossibleSize = Math.floor(Math.sqrt(uniqueQuestions));
            
            const gridSizeSelector = document.getElementById('gridSize');
            
            // 更新选项可用性
            Array.from(gridSizeSelector.options).forEach(option => {
                const size = parseInt(option.value);
                option.disabled = size * size > uniqueQuestions;
                if (option.disabled) {
                    option.textContent = `${size} x ${size} (需要 ${size * size} 个题目)`;
                } else {
                    option.textContent = `${size} x ${size}`;
                }
            });

            // 更新提示信息
            const infoText = document.createElement('p');
            infoText.className = 'mt-2 text-sm text-gray-500';
            infoText.textContent = `当前有 ${uniqueQuestions} 个不重复题目，可支持最大 ${maxPossibleSize}x${maxPossibleSize} 的格子`;
            
            const existingInfo = gridSizeSelector.parentElement.querySelector('p:last-child');
            if (existingInfo) {
                existingInfo.replaceWith(infoText);
            } else {
                gridSizeSelector.parentElement.appendChild(infoText);
            }
        } catch (error) {
            console.error('Failed to update grid size options:', error);
        }
    }

    // 处理全选
    handleSelectAll() {
        const isChecked = this.selectAllCheckbox.checked;
        this.questionsList.querySelectorAll('.question-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        this.updateBatchDeleteButton();
    }

    // 更新批量删除按钮状态
    updateBatchDeleteButton() {
        const checkedCount = this.questionsList.querySelectorAll('.question-checkbox:checked').length;
        this.batchDeleteBtn.disabled = checkedCount === 0;
    }

    // 处理批量删除
    async handleBatchDelete() {
        const checkedBoxes = this.questionsList.querySelectorAll('.question-checkbox:checked');
        if (checkedBoxes.length === 0) return;

        const confirmMessage = checkedBoxes.length === 1 
            ? '确定要删除选中的题目吗？' 
            : `确定要删除选中的 ${checkedBoxes.length} 个题目吗？`;

        if (!confirm(confirmMessage)) return;

        try {
            const questionIds = Array.from(checkedBoxes).map(cb => 
                parseInt(cb.getAttribute('data-question-id'))
            );

            // 逐个删除选中的题目
            for (const id of questionIds) {
                await API.deleteQuestion(id);
            }

            await this.loadQuestions();
            await this.updateGridSizeOptions();
            alert('选中的题目已删除');
        } catch (error) {
            console.error('批量删除失败:', error);
            alert('删除失败，请重试');
        }
    }
}

// 修改登出函数
function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        // 清理定时器
        if (window.adminPanel) {
            window.adminPanel.cleanup();
        }
        // 清除所有管理员相关的状态
        window.adminPanel.clearAdminSession();
        window.location.href = '../index.html';
    }
}

// 初始化管理员面板
window.adminPanel = new AdminPanel();

// 添加全局折叠面板控制函数
function togglePanel(panelId) {
    const panel = document.getElementById(`${panelId}-panel`);
    const arrow = document.getElementById(`${panelId}-arrow`);
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        arrow.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        arrow.classList.remove('rotate-180');
    }
} 