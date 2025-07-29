import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf, ItemView } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs-extra';
import Chart from 'chart.js/auto';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	workTime: number; // 番茄工作时间（分钟）
	breakTime: number; // 休息时间（分钟）
	tags: string[]; // 可用标签列表
	tagColors: Record<string, string>; // 标签颜色映射
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	workTime: 25, // 改为1分钟方便测试
	breakTime: 5, // 改为1分钟方便测试
	tags: ['工作', '学习', '阅读', '写作'],
	dateFormat: 'YYYY-MM-DD', // 添加默认日期格式
	diaryPath: '01Inbox/daily', // 添加默认日记路径
	tagColors: {
		'工作': '#ff6b6b',
		'学习': '#4ecdc4',
		'阅读': '#45b7d1',
		'写作': '#96ceb4',
		'运动': '#feca57',
		'默认': '#95a5a6'
	}
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// 注册设置选项卡
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// 注册休息计时器视图
		this.registerView(
			'break-view',
			(leaf) => new BreakView(leaf, this)
		);

		// 注册命令以打开休息计时器
		this.addCommand({
			id: 'open-break-timer',
			name: '打开休息计时器',
			callback: () => this.activateView(),
		});

		// 添加功能区图标
		this.addRibbonIcon('clock', '休息计时器', () => {
			this.activateView();
		});
	}



	onunload() {

	}
	// 添加激活视图的方法
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType('break-view');

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({
				type: 'break-view',
				active: true,
			});
		}

		workspace.revealLeaf(leaf);
	}
	async loadSettings() {
		try {
			const savedSettings = await this.loadData();
			this.settings = {
				...DEFAULT_SETTINGS,
				...savedSettings,
				// 确保数值类型正确
				workTime: typeof savedSettings?.workTime === 'number' ? savedSettings.workTime : DEFAULT_SETTINGS.workTime,
				breakTime: typeof savedSettings?.breakTime === 'number' ? savedSettings.breakTime : DEFAULT_SETTINGS.breakTime,
				// 确保数组类型正确
				tags: Array.isArray(savedSettings?.tags) ? savedSettings.tags : DEFAULT_SETTINGS.tags,
				// 确保字符串类型正确
				dateFormat: typeof savedSettings?.dateFormat === 'string' ? savedSettings.dateFormat : DEFAULT_SETTINGS.dateFormat,
				diaryPath: typeof savedSettings?.diaryPath === 'string' ? savedSettings.diaryPath : DEFAULT_SETTINGS.diaryPath,
				// 确保对象类型正确
				tagColors: typeof savedSettings?.tagColors === 'object' ? { ...DEFAULT_SETTINGS.tagColors, ...savedSettings.tagColors } : DEFAULT_SETTINGS.tagColors,
			};
		} catch (e) {
			console.error('加载设置失败，使用默认设置:', e);
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// 确保设置已加载
		if (!this.plugin.settings) {
			this.plugin.loadSettings();
		}

		containerEl.createEl('h2', { text: '休息计时器设置' });

		// 日期格式设置
		new Setting(containerEl)
			.setName('日期格式')
			.setDesc('设置日记文件的日期格式')
			.addDropdown(dropdown => dropdown
				.addOption('YYYY-MM-DD', 'YYYY-MM-DD (例如: 2023-12-31)')
				.addOption('YYYY/MM/DD', 'YYYY/MM/DD (例如: 2023/12/31)')
				.setValue(this.plugin.settings.dateFormat || 'YYYY-MM-DD')
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));

		// 日记存储路径设置
		new Setting(containerEl)
			.setName('日记存储位置')
			.setDesc('指定日记文件的存放路径（例如：01Inbox/daily）')
			.addText(text => text
				.setPlaceholder('01Inbox/daily')
				.setValue(String(this.plugin.settings.diaryPath || ''))
				.onChange(async (value) => {
					this.plugin.settings.diaryPath = value.trim();
					await this.plugin.saveSettings();
					new Notice('日记存储路径已更新');
				}));

			// 工作时间设置
		new Setting(containerEl)
			.setName('工作时间（分钟）')
			.setDesc('设置番茄钟工作时间长度')
			.addText(text => text
				.setPlaceholder('25')
				.setValue(String(this.plugin.settings.workTime || 25))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.workTime = num;
						await this.plugin.saveSettings();
						new Notice(`工作时间已更新为 ${num} 分钟`);
					}
				}));

		// 休息时间设置
		new Setting(containerEl)
			.setName('休息时间（分钟）')
			.setDesc('设置休息时间长度')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(String(this.plugin.settings.breakTime || 5))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.breakTime = num;
						await this.plugin.saveSettings();
						new Notice(`休息时间已更新为 ${num} 分钟`);
					}
				}));

		// 标签设置
		new Setting(containerEl)
			.setName('标签设置')
			.setDesc('设置常用标签，用逗号分隔')
			.addTextArea(text => text
				.setPlaceholder('学习,工作,阅读,写作,运动')
				.setValue(Array.isArray(this.plugin.settings.tags) ? this.plugin.settings.tags.join(',') : '学习,工作')
				.onChange(async (value) => {
					const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
					this.plugin.settings.tags = tags;
					
					// 为新标签添加默认颜色
					tags.forEach(tag => {
						if (!this.plugin.settings.tagColors[tag]) {
							this.plugin.settings.tagColors[tag] = this.plugin.settings.tagColors['默认'];
						}
					});
					
					// 移除已删除标签的颜色配置
					Object.keys(this.plugin.settings.tagColors).forEach(tag => {
						if (tag !== '默认' && !tags.includes(tag)) {
							delete this.plugin.settings.tagColors[tag];
						}
					});
					
					await this.plugin.saveSettings();
					new Notice('标签设置已更新');
					
					// 刷新设置界面
					this.display();
				})
			)

		// 标签颜色设置
		const colorContainer = containerEl.createEl('div', { cls: 'tag-color-settings' });
		colorContainer.createEl('h3', { text: '标签颜色设置' });
		
		this.plugin.settings.tags.forEach(tag => {
			const color = this.plugin.settings.tagColors[tag] || this.plugin.settings.tagColors['默认'];
			new Setting(colorContainer)
				.setName(`标签: ${tag}`)
				.addColorPicker(colorPicker => colorPicker
					.setValue(color)
					.onChange(async (value) => {
						this.plugin.settings.tagColors[tag] = value;
						await this.plugin.saveSettings();
						new Notice(`${tag} 标签颜色已更新`);
					}));
		});
	}
}

class BreakView extends ItemView {
	private plugin: MyPlugin;
	private timerInterval: number | null = null;
	private timeLeft: number;
	private isRunning: boolean = false;
	private currentTag: string = '';
	private isFocusMode: boolean = true; // 是否处于专注模式
	private currentStatsPeriod: string = 'daily'; // 当前统计周期
	private currentStatsDate: Date = new Date(); // 当前统计日期
	private isProcessingCompletion: boolean = false; // 防止重复处理完成事件
	private focusTime: number = 0; // 专注时间
	private breakTime: number = 0; // 休息时间
	private originalTitle: string;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.focusTime = plugin.settings.workTime * 60;
		this.breakTime = plugin.settings.breakTime * 60;
		this.timeLeft = this.focusTime;
		this.originalTitle = document.title;
	};

	// 添加缺失的时间格式化方法
	private formatTime(seconds: number): string {
		seconds = Math.max(0, Math.floor(seconds)); // 确保时间不为负且为整数","},{"old_str":"if (this.isFocusMode) { this.openLogDialog(); } // 仅在专注模式完成时记录","new_str":"// 记录番茄钟完成事件
		// if (this.isFocusMode) {
		// 	this.openLogDialog(); // 专注模式完成时打开记录对话框
		// }
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	// 实现ItemView要求的getViewType方法
	getViewType(): string {
		return 'break-view';
	}

	// 实现ItemView要求的getDisplayText方法
	getDisplayText(): string {
		return '休息计时器';
	}

	private initializeTimerValues() {
		// 区分专注和休息时间
		if (this.isFocusMode) {
			// 使用默认值作为回退，并验证数值有效性
			let focusTime = Number(this.plugin?.settings?.workTime);
			if (isNaN(focusTime) || focusTime <= 0) {
				focusTime = DEFAULT_SETTINGS.workTime || 25; // 默认25分钟专注
				console.warn('专注时间设置无效，使用默认值:', focusTime);
			}
			focusTime = Math.max(1, focusTime); // 确保至少1分钟
			this.focusTime = focusTime;
			this.timeLeft = focusTime * 60;
		} else {
			// 使用默认值作为回退，并验证数值有效性
			let breakTime = Number(this.plugin?.settings?.breakTime);
			if (isNaN(breakTime) || breakTime <= 0) {
				breakTime = DEFAULT_SETTINGS.breakTime || 5; // 默认5分钟休息
				console.warn('休息时间设置无效，使用默认值:', breakTime);
			}
			breakTime = Math.max(1, breakTime); // 确保至少1分钟
			this.breakTime = breakTime;
			this.timeLeft = breakTime * 60;
		}
	}

	private getFormattedDate(date?: Date): string {
		const targetDate = date || new Date();
		const year = targetDate.getFullYear();
		const month = String(targetDate.getMonth() + 1).padStart(2, '0');
		const day = String(targetDate.getDate()).padStart(2, '0');

		// 获取今天是星期几
		const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
		const weekday = weekdays[targetDate.getDay()];

		// 判断是否是今天、昨天、明天
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const compareDate = new Date(targetDate);
		compareDate.setHours(0, 0, 0, 0);
		
		const diffTime = compareDate.getTime() - today.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		
		let dateLabel = '';
		if (diffDays === 0) {
			dateLabel = '今天';
		} else if (diffDays === -1) {
			dateLabel = '昨天';
		} else if (diffDays === 1) {
			dateLabel = '明天';
		} else if (diffDays < -1) {
			dateLabel = `${Math.abs(diffDays)}天前`;
		} else {
			dateLabel = `${diffDays}天后`;
		}

		switch (this.plugin.settings.dateFormat) {
			case 'YYYY/MM/DD':
				return `${year}/${month}/${day} ${weekday} (${dateLabel})`;
			case 'YYYY-MM-DD':
			default:
				return `${year}-${month}-${day} ${weekday} (${dateLabel})`;
		}
	}

	private getFileNameDate(date?: Date): string {
		const targetDate = date || new Date();
		const year = targetDate.getFullYear();
		const month = String(targetDate.getMonth() + 1).padStart(2, '0');
		const day = String(targetDate.getDate()).padStart(2, '0');

		switch (this.plugin.settings.dateFormat) {
			case 'YYYY/MM/DD':
				return `${year}/${month}/${day}`;
			case 'YYYY-MM-DD':
			default:
				return `${year}-${month}-${day}`;
		}
	}


	// 递归创建目录
	private async createDirectoryRecursive(path: string) {
		const parts = path.split('/').filter(part => part);
		let currentPath = '';

		for (const part of parts) {
			currentPath += currentPath ? `/${part}` : part;
			const dir = this.app.vault.getAbstractFileByPath(currentPath);
			if (!dir) {
				await this.app.vault.createFolder(currentPath);
			} else if (!(dir instanceof TFolder)) {
				throw new Error(`路径 "${currentPath}" 存在但不是目录`);
			}
		}
	}

	async onOpen() {
		try {
			const container = this.contentEl;
			container.empty();
			container.classList.add('break-container');

			// 确保设置已加载
			if (!this.plugin.settings) {
				await this.plugin.loadSettings();
			}

			// 在设置加载后初始化计时器值
			this.initializeTimerValues();

			// 获取标签列表，使用默认值作为回退
			const tags = this.plugin.settings.tags || DEFAULT_SETTINGS.tags;
			const tagOptions = tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

			// 添加标签页结构
			container.innerHTML = `
				<div class="tab-container">
					<div class="tab active" data-tab="timer">番茄钟</div>
					<div class="tab" data-tab="logs">记录页面</div>
					<div class="tab" data-tab="stats">统计</div>
				</div>
				<div class="tab-content active" id="timer-content">
					<div class="timer-circle">
						<div class="timer-text">${this.isFocusMode ? '专注时间' : '休息时间'}</div>
						<div class="timer-value">${this.formatTime(this.timeLeft)}</div>
					</div>
					<div class="tag-selection">
					<label for="tag-select">选择标签: </label>
					<select id="tag-select" ${this.isRunning ? 'disabled' : ''}>
						<option value="">-- 选择标签 --</option>
						${tagOptions}
					</select>
					${this.isRunning ? '<small style="color: var(--text-muted);">(番茄钟进行中不可更改标签)</small>' : ''}
				</div>
					<div class="timer-controls">
						<button class="start-btn">${this.isRunning ? '暂停' : this.isFocusMode ? '开始专注' : '开始休息'}</button>
						<button class="skip-btn">跳过</button>
						<button class="config-btn">设置</button>
					</div>
				</div>
				<div class="tab-content" id="logs-content">
					<div class="logs-header">
					<div class="date-navigation">
					<button class="date-btn prev-date">← 前一天</button>
					<button class="date-btn today-date">今天</button>
					<button class="date-btn next-date">下一天 →</button>
					<span class="current-date">${this.getFormattedDate(this.currentDate)}</span>
				</div>
						<div class="summary-stats">
							<div class="stat-item">
								<span class="stat-label">专注总时长:</span>
								<span class="stat-value" id="total-focus-time">0h 0m</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">会话数量:</span>
								<span class="stat-value" id="session-count">0</span>
							</div>
						</div>
					</div>
					<div class="logs-container">
						<table class="logs-table">
								<thead>
									<tr>
										<th>开始时间</th>
										<th>结束时间</th>
										<th>标签</th>
										<th>备注</th>
										<th>时长</th>
										<th>操作</th>
									</tr>
								</thead>
								<tbody id="logs-table-body">
									<!-- 日志内容将通过JavaScript动态加载 -->
								</tbody>
						</table>
					</div>
				</div>
				<div class="tab-content" id="stats-content">
					<div class="stats-header">
						<h3>专注时间统计</h3>
						<div class="stats-date-navigation">
							<button class="stats-date-btn prev-period">← 上一周期</button>
							<button class="stats-date-btn today-period">当前周期</button>
							<button class="stats-date-btn next-period">下一周期 →</button>
							<span class="current-period">${this.getFormattedDate(this.currentDate)}</span>
						</div>
					</div>
					<div class="stats-tab-container">
						<div class="stats-tab active" data-stats-tab="daily">日</div>
						<div class="stats-tab" data-stats-tab="weekly">周</div>
						<div class="stats-tab" data-stats-tab="yearly">年</div>
					</div>
					<div class="stats-content active" id="daily-stats">
						<div class="daily-summary">
							<div class="stat-card">
								<div class="stat-title">总专注时间</div>
								<div class="stat-value" id="daily-total-time">0h 0m</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">总会话数</div>
								<div class="stat-value" id="daily-session-count">0</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">平均会话时长</div>
								<div class="stat-value" id="daily-avg-session">0m</div>
							</div>
						</div>
						<div class="chart-container">
							<canvas id="daily-chart"></canvas>
						</div>
					</div>
					<div class="stats-content" id="weekly-stats">
						<div class="weekly-summary">
							<div class="stat-card">
								<div class="stat-title">总专注时间</div>
								<div class="stat-value" id="weekly-total-time">0h 0m</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">总会话数</div>
								<div class="stat-value" id="weekly-session-count">0</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">日均专注时间</div>
								<div class="stat-value" id="weekly-daily-avg">0h 0m</div>
							</div>
						</div>
						<div class="chart-container">
							<canvas id="weekly-chart"></canvas>
						</div>
					</div>
					<div class="stats-content" id="yearly-stats">
						<div class="yearly-summary">
							<div class="stat-card">
								<div class="stat-title">总专注时间</div>
								<div class="stat-value" id="yearly-total-time">0h 0m</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">总会话数</div>
								<div class="stat-value" id="yearly-session-count">0</div>
							</div>
							<div class="stat-card">
								<div class="stat-title">月均专注时间</div>
								<div class="stat-value" id="yearly-monthly-avg">0h 0m</div>
							</div>
						</div>
						<div class="chart-container">
							<canvas id="yearly-chart"></canvas>
						</div>
					</div>
				</div>
			`;

			this.setupEventListeners();
			this.loadLogEntries(); // 加载日志数据

			this.currentDate = new Date();
			this.updateDateDisplay();

			// 日期导航按钮事件
			this.contentEl.querySelector('.prev-date')?.addEventListener('click', () => {
				this.currentDate.setDate(this.currentDate.getDate() - 1);
				this.updateDateDisplay();
				this.loadLogEntries();
			});

			this.contentEl.querySelector('.today-date')?.addEventListener('click', () => {
				this.currentDate = new Date();
				this.updateDateDisplay();
				this.loadLogEntries();
			});

			this.contentEl.querySelector('.next-date')?.addEventListener('click', () => {
				this.currentDate.setDate(this.currentDate.getDate() + 1);
				this.updateDateDisplay();
				this.loadLogEntries();
			});
		} catch (error) {
			console.error('Error initializing BreakView:', error);
			new Notice(`休息计时器加载失败: ${error.message || '未知错误'}`);
			// 添加错误情况下的备用内容
			this.contentEl.innerHTML = `
				<div class="error-container">
					<h3>加载失败</h3>
					<p>无法加载休息计时器界面。</p>
					<p>错误信息: ${error.message || '未知错误'}</p>
					<button class="reload-btn">重新加载</button>
				</div>
			`;
			this.contentEl.querySelector('.reload-btn')?.addEventListener('click', () => this.onOpen());
		}
	}

	private toggleTimer() {
		if (this.isRunning) {
			this.pauseTimer();
		} else {
			this.startTimer();
		}
	}

	private startTimer() {
		// 清除任何现有计时器防止多重间隔
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
		}

		// 检查标签选择
		const tagSelect = this.contentEl.querySelector('#tag-select') as HTMLSelectElement;
		if (this.isFocusMode && !tagSelect.value) {
			new Notice('请先选择一个标签再开始番茄钟');
			return;
		}

		// 设置当前标签（番茄钟开始后不可更改）
		this.currentTag = tagSelect.value;

		this.isRunning = true;
		this.initializeTimerValues(); // 启动时重新初始化时间
		this.isProcessingCompletion = false; // 重置处理标志
		this.updateStartButtonText();

		// 禁用标签选择
		if (tagSelect) {
			tagSelect.disabled = true;
		}

		this.timerInterval = window.setInterval(() => {
			if (!this.isRunning || this.isProcessingCompletion) return; // 计时器已停止或正在处理完成，退出回调
			this.timeLeft = Math.max(0, this.timeLeft - 1);
			this.updateTimerDisplay();
			if (!this.isRunning || this.isProcessingCompletion) return; // 二次状态检查

			if (this.timeLeft === 0 && !this.isProcessingCompletion) {
				this.isProcessingCompletion = true; // 设置处理标志
				this.clearTimer(); // 清除计时器
				
				if (this.isFocusMode) {
					new Notice('专注时间结束！');
					// 自动记录完整的番茄钟
					this.autoSavePomodoroLog();
					// 番茄钟结束后自动切换到休息模式
					this.isFocusMode = false;
					this.initializeTimerValues();
					this.updateTimerDisplay();
					this.updateStartButtonText();
				} else {
					new Notice('休息时间结束！');
					// 休息时间结束后自动切换回专注模式
					this.isFocusMode = true;
					this.initializeTimerValues();
					this.updateTimerDisplay();
					this.updateStartButtonText();
				}
				
				// 重新启用标签选择
				const tagSelect = this.contentEl.querySelector('#tag-select') as HTMLSelectElement;
				if (tagSelect) {
					tagSelect.disabled = false;
				}
				
				return;
			}
		}, 1000)
	}


	private clearTimer() {
		this.isRunning = false;
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private pauseTimer() {
		this.clearTimer();
		this.isRunning = false;
		this.updateStartButtonText();
		new Notice('已暂停番茄钟');
	}

	private skipBreak() {
		this.clearTimer();
		if (this.isFocusMode) {
			// 跳过专注，进入休息
			this.isFocusMode = false;
		} else {
			// 跳过休息，进入专注
			this.isFocusMode = true;
		}
		this.initializeTimerValues();
		this.updateTimerDisplay();
		this.updateStartButtonText();
		this.isRunning = false; // 跳过不自动开始
		new Notice(`${this.isFocusMode ? '已跳过休息，准备开始专注' : '已跳过专注，准备开始休息'}`);
	}

	private updateStartButtonText() {
		const startBtn = this.contentEl.querySelector('.start-btn');
		if (startBtn) {
			startBtn.textContent = this.isRunning ? '暂停' : (this.isFocusMode ? '开始专注' : '开始休息');
		}
	}

	private updateTimerDisplay() {
		const timerValue = this.contentEl.querySelector('.timer-value');
		const timerText = this.contentEl.querySelector('.timer-text');
		if (timerValue) {
			timerValue.textContent = this.formatTime(this.timeLeft);
		}
		if (timerText) {
			timerText.textContent = this.isFocusMode ? '专注时间' : '休息时间';
		}
	}

	// 移除手动记录对话框，改为自动记录
	private async autoSavePomodoroLog() {
		// 计算完整番茄钟的开始和结束时间
		const now = new Date();
		const durationMinutes = this.isFocusMode ? this.plugin.settings.workTime : this.plugin.settings.breakTime;
		const durationSeconds = durationMinutes * 60;
		const startTime = new Date(now.getTime() - durationSeconds * 1000);
		
		// 格式化时间为 HH:MM:SS
		const formatTimeForLog = (date: Date) => {
			return date.toTimeString().slice(0, 8);
		};
		
		const startTimeStr = formatTimeForLog(startTime);
		const endTimeStr = formatTimeForLog(now);
		
		// 使用番茄钟开始时选择的标签
		const tag = this.currentTag || '未选择标签';
		const notes = '自动记录的完整番茄钟'; // 默认备注
		
		await this.saveLogEntry(startTimeStr, endTimeStr, tag, notes, durationMinutes);
		new Notice(`番茄钟记录已保存：${tag} (${durationMinutes}分钟)`);
	}

	private async saveLogEntry(startTime: string, endTime: string, tag: string, notes: string, durationMinutes?: number) {
		try {
			const now = new Date();
			const targetDate = this.currentDate || now;
			const year = targetDate.getFullYear().toString();
			const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFileNameDate(targetDate);
			let fileName = `${dateString}.md`;

			// 应用日记存储路径，添加年/月层级
			let fullPath = fileName;
			if (this.plugin.settings.diaryPath) {
				const normalizedPath = this.plugin.settings.diaryPath.replace(/\\/g, '/');
				// 构建年/月层级路径
				fullPath = normalizedPath.endsWith('/')
					? `${normalizedPath}${year}/${month}/${fileName}`
					: `${normalizedPath}/${year}/${month}/${fileName}`;
			}

			fullPath = fullPath.replace(/\\/g, '/');

			// 确保目录存在
			const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
			if (dirPath && !this.app.vault.getAbstractFileByPath(dirPath)) {
				await this.createDirectoryRecursive(dirPath);
			}

			let file = this.app.vault.getAbstractFileByPath(fullPath) as TFile;
			// 更新表格标题，明确是番茄钟记录
			const tableHeader = "\n## 番茄钟记录\n\n| 开始时间 | 结束时间 | 标签 | 备注 | 时长 |\n|----------|----------|------|------|------|\n";

			if (!file) {
				// 创建新文件并添加表格表头
				file = await this.app.vault.create(fullPath, `# ${dateString}

${tableHeader}`);
			} else {
				// 检查文件中是否已有表格
				const content = await this.app.vault.read(file);
				if (!content.includes('## 番茄钟记录')) {
					// 如果没有表格，添加表头
					const newLine = content.endsWith('\n') ? '' : '\n';
					await this.app.vault.modify(file, content + newLine + tableHeader);
				}
			}

			// 使用提供的durationMinutes或计算默认值
			const finalDurationMinutes = durationMinutes || this.plugin.settings.workTime;
			const logEntry = `| ${startTime} | ${endTime} | ${tag} | ${notes} | ${finalDurationMinutes}分钟 |`;
			const content = await this.app.vault.read(file);

			// 查找表格位置并添加新行
			if (content.includes('| 开始时间 | 结束时间 | 标签 | 备注 | 时长 |')) {
				const lines = content.split('\n');
				const headerIndex = lines.findIndex(line => line.includes('| 开始时间 | 结束时间 | 标签 | 备注 | 时长 |'));
				let insertIndex = headerIndex + 2;

				// 检查是否已有相同标签的番茄钟记录，避免重复
				let hasDuplicate = false;
				for (let i = insertIndex; i < lines.length; i++) {
					const line = lines[i].trim();
					if (line.startsWith('|') && line.includes(`| ${startTime} | ${endTime} | ${tag} |`)) {
						hasDuplicate = true;
						break;
					}
				}

				if (!hasDuplicate) {
					lines.splice(insertIndex, 0, logEntry);
					await this.app.vault.modify(file, lines.join('\n'));
				}
			} else {
				// 如果没有找到表格，直接追加
				const newLine = content.endsWith('\n') ? '' : '\n';
				await this.app.vault.modify(file, content + newLine + logEntry);
			}

			new Notice(`番茄钟记录已保存：${tag} (${durationMinutes}分钟)`);
		} catch (error) {
			console.error('保存记录失败:', error);
			new Notice(`保存记录失败: ${error.message || '未知错误'}`);
		}
	}

	private setupEventListeners() {
		// 使用contentEl查询元素，确保在正确的容器中查找
		const startBtn = this.contentEl.querySelector('.start-btn');
		const skipBtn = this.contentEl.querySelector('.skip-btn');
		const configBtn = this.contentEl.querySelector('.config-btn');
		
		const tagSelect = this.contentEl.querySelector('#tag-select') as HTMLSelectElement;
		// 添加标签页切换事件
		const tabs = this.contentEl.querySelectorAll('.tab');
		const tabContents = this.contentEl.querySelectorAll('.tab-content');

		// 添加空值检查
		if (!startBtn || !skipBtn || !configBtn || !tagSelect) {
			console.error('休息计时器界面元素缺失');
			new Notice('无法初始化控件: 界面元素不完整');
			return;
		}

		startBtn.addEventListener('click', () => this.toggleTimer());
		skipBtn.addEventListener('click', () => this.skipBreak());
		// configBtn.addEventListener('click', () => this.openConfig());

		tagSelect.addEventListener('change', (e) => {
			this.currentTag = (e.target as HTMLSelectElement).value;
		});

		// 主标签页切换事件
		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabId = tab.dataset.tab;
				if (!tabId) return;

				// 更新标签激活状态
				tabs.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');

				// 更新内容区域显示
				tabContents.forEach(content => {
					content.classList.remove('active');
					if (content.id === `${tabId}-content`) {
						content.classList.add('active');
						
						// 当切换到记录页面时，刷新记录内容
						if (tabId === 'logs') {
							this.loadLogEntries();
						}
						// 当切换到统计页面时，加载统计数据
						else if (tabId === 'stats') {
							this.loadStatistics();
						}
					}
				});
			});
		});

		// 统计子标签页切换事件
		const statsTabs = this.contentEl.querySelectorAll('.stats-tab');
		const statsContents = this.contentEl.querySelectorAll('.stats-content');

		statsTabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabId = tab.dataset.statsTab;
				if (!tabId) return;

				// 更新标签激活状态
				statsTabs.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');

				// 更新内容区域显示
				statsContents.forEach(content => {
					content.classList.remove('active');
					if (content.id === `${tabId}-stats`) {
						content.classList.add('active');
						// 加载对应时间段的统计数据
						this.loadPeriodStatistics(tabId);
					}
				});
			});
		});

		// 统计日期导航事件
		this.contentEl.querySelector('.prev-period')?.addEventListener('click', () => {
			this.navigateStatisticsPeriod(-1);
		});

		this.contentEl.querySelector('.today-period')?.addEventListener('click', () => {
			this.resetStatisticsPeriod();
		});

		this.contentEl.querySelector('.next-period')?.addEventListener('click', () => {
			this.navigateStatisticsPeriod(1);
		});
	}


	// 打开编辑备注对话框
	private async openEditDialog(event: MouseEvent) {
		const button = event.target as HTMLButtonElement;
		const index = button.dataset.index;
		if (!index) return;

		// 获取当前行数据
		const row = button.closest('tr')!;
		const startTime = row.children[0].textContent!;
		const endTime = row.children[1].textContent!;
		const tag = row.children[2].textContent!;
		const notes = row.children[3].textContent!;

		// 创建编辑弹窗
		const dialog = new Modal(this.app);
		const { contentEl } = dialog;
		contentEl.style.padding = '20px';
		contentEl.style.maxWidth = '500px';

		contentEl.createEl('h3', { text: '编辑备注' });

		const notesDiv = contentEl.createEl('div', { cls: 'notes-input' });
		notesDiv.createEl('label', { text: '备注: ', attrs: { for: 'edit-notes' } });
		const notesTextarea = notesDiv.createEl('textarea', { id: 'edit-notes', cls: 'log-notes' });
		notesTextarea.style.width = '100%';
		notesTextarea.style.minHeight = '100px';
		notesTextarea.value = notes;

		const buttonsDiv = contentEl.createEl('div', { cls: 'dialog-buttons' });
		buttonsDiv.style.display = 'flex';
		buttonsDiv.style.justifyContent = 'flex-end';
		buttonsDiv.style.gap = '8px';
		buttonsDiv.style.marginTop = '16px';

		const cancelBtn = buttonsDiv.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => dialog.close());

		const saveBtn = buttonsDiv.createEl('button', { text: '保存' });
		saveBtn.style.backgroundColor = 'var(--interactive-accent)';
		saveBtn.style.color = 'white';
		saveBtn.style.border = 'none';
		saveBtn.style.padding = '8px 16px';
		saveBtn.style.borderRadius = '4px';

		saveBtn.addEventListener('click', async () => {
			// 保存编辑后的备注
			await this.updateLogEntry(startTime, endTime, tag, notesTextarea.value);
			row.children[3].textContent = notesTextarea.value;
			dialog.close();
		});

		dialog.open();
	}

	// 更新日志记录中的备注
	private async updateLogEntry(startTime: string, endTime: string, tag: string, newNotes: string) {
		try {
			const targetDate = this.currentDate || new Date();
			const year = targetDate.getFullYear().toString();
			const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFormattedDate(targetDate);
			let fileName = `${dateString}.md`;

			// 构建日志文件路径
			let fullPath = fileName;
			if (this.plugin.settings.diaryPath) {
				const normalizedPath = this.plugin.settings.diaryPath.replace(/\\/g, '/');
				fullPath = normalizedPath.endsWith('/')
					? `${normalizedPath}${year}/${month}/${fileName}`
					: `${normalizedPath}/${year}/${month}/${fileName}`;
			}

			fullPath = fullPath.replace(/\\/g, '/');
			const file = this.app.vault.getAbstractFileByPath(fullPath) as TFile;
			if (!file) {
				console.error('日记文件不存在:', fullPath);
				new Notice('无法更新: 日记文件不存在');
				return;
			}

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const tableStartIndex = lines.findIndex(line => line.includes('## 番茄钟记录'));
			if (tableStartIndex === -1) return;

			// 查找表格数据行
			let tableLineIndex = -1;
			// 找到表头后，从下一行开始查找
			for (let i = tableStartIndex + 2; i < lines.length; i++) {
				const line = lines[i].trim();
				if (line.startsWith('|')) {
					const columns = line.split('|').map(col => col.trim()).filter(col => col);
					if (columns.length >= 5 && columns[0] === startTime && columns[1] === endTime && columns[2] === tag) {
						tableLineIndex = i;
						break;
					}
				}
			}

			if (tableLineIndex !== -1) {
				// 解析原始表格行，正确处理管道符分隔
				const originalLine = lines[tableLineIndex];
				const columns = originalLine.split('|').map(col => col.trim()).filter(col => col.length > 0);
				
				if (columns.length >= 5) { // 确保有5列数据：开始时间、结束时间、标签、备注、时长
					// 重建表格行，保持格式一致
					const newLine = `| ${columns[0]} | ${columns[1]} | ${columns[2]} | ${newNotes} | ${columns[4]} |`;
					lines[tableLineIndex] = newLine;
					await this.app.vault.modify(file, lines.join('\n'));
					new Notice('备注已更新到日记文件');
				} else {
					console.error('表格格式异常:', columns);
					new Notice('更新失败: 表格格式异常');
				}
			} else {
				console.error('未找到匹配的记录行:', { startTime, endTime, tag });
				new Notice('更新失败: 未找到对应的番茄钟记录');
				return;
			}
		} catch (error) {
			console.error('更新备注失败:', error);
			new Notice(`更新备注失败: ${error.message || '未知错误'}`);
		}
	};




	private updateDateDisplay() {
		const dateElement = this.contentEl.querySelector('.current-date');
		if (dateElement) {
			dateElement.textContent = this.getFormattedDate(this.currentDate);
		}
	}

	private async loadLogEntries() {
		try {
			const targetDate = this.currentDate || new Date();
			const year = targetDate.getFullYear().toString();
			const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFileNameDate(targetDate);
			let fileName = `${dateString}.md`;

			// 构建日志文件路径
			let fullPath = fileName;
			if (this.plugin.settings.diaryPath) {
				const normalizedPath = this.plugin.settings.diaryPath.replace(/\\/g, '/');
				fullPath = normalizedPath.endsWith('/')
					? `${normalizedPath}${year}/${month}/${fileName}`
					: `${normalizedPath}/${year}/${month}/${fileName}`;
			}

			fullPath = fullPath.replace(/\\/g, '/');
			const file = this.app.vault.getAbstractFileByPath(fullPath) as TFile;

			// 重置统计数据为0
			const totalTimeElement = this.contentEl.querySelector('#total-focus-time');
			const sessionCountElement = this.contentEl.querySelector('#session-count');
			if (totalTimeElement) totalTimeElement.textContent = '0h 0m';
			if (sessionCountElement) sessionCountElement.textContent = '0';

			if (!file) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">当日无番茄钟记录</td></tr>';
				return;
			}

			const content = await this.app.vault.read(file);
			const tableStart = content.indexOf('## 番茄钟记录');
			if (tableStart === -1) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">当日无番茄钟记录</td></tr>';
				return;
			}

			// 提取表格内容
			const tableContent = content.substring(tableStart);
			const tableLines = tableContent.split('\n').filter(line => line.trim().startsWith('|'));
			if (tableLines.length < 3) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">当日无番茄钟记录</td></tr>';
				return;
			}

			// 解析表格数据并生成行
			const tableBody = this.contentEl.querySelector('#logs-table-body')!;
			tableBody.innerHTML = '';

			let hasValidRecords = false;
			// 跳过表头和分隔符行（前两行是表头和分隔符）
			for (let i = 2; i < tableLines.length; i++) {
				const line = tableLines[i].trim();
				if (!line) continue;

				// 解析表格行数据
				const columns = line.split('|').map(col => col.trim()).filter(col => col);
				if (columns.length >= 5) { // 现在有5列：开始时间、结束时间、标签、备注、时长
					hasValidRecords = true;
					const tag = columns[2];
					const color = this.plugin.settings.tagColors[tag] || this.plugin.settings.tagColors['默认'];
					
					const row = document.createElement('tr');
					row.setAttribute('data-tag', tag);
					row.style.setProperty('--tag-color', color);
					
					row.innerHTML = `
						<td>${columns[0]}</td>
						<td>${columns[1]}</td>
						<td><span class="tag-badge" data-tag="${tag}" style="background-color: ${color}">${columns[2]}</span></td>
						<td>${columns[3]}</td>
						<td>${columns[4]}</td>
						<td><button class="edit-btn" data-index="${i}">编辑</button></td>
					`;
					tableBody.appendChild(row);
				}
			}

			if (!hasValidRecords) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">当日无番茄钟记录</td></tr>';
			}

			// 添加编辑按钮事件
			this.contentEl.querySelectorAll('.edit-btn').forEach(btn => {
				btn.addEventListener('click', (e) => this.openEditDialog(e));
			});
			
			// 计算汇总统计
			console.log('正在计算汇总统计，记录行数:', tableLines.length);
			this.calculateSummary(tableLines);
		} catch (error) {
			console.error('加载记录失败:', error);
			this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">加载记录失败</td></tr>';
		}


	}


	private calculateSummary(lines: string[]) {
		let totalMinutes = 0;
		let sessionCount = 0;

		console.log('开始计算汇总统计，总行数:', lines.length);

		// 查找表格位置 - 使用更灵活的匹配方式，忽略多余空格
		const headerIndex = lines.findIndex(line => {
			const trimmedLine = line.replace(/\s+/g, ' ').trim();
			return trimmedLine.includes('| 开始时间') && 
				   trimmedLine.includes('结束时间') && 
				   trimmedLine.includes('标签') && 
				   trimmedLine.includes('备注') && 
				   trimmedLine.includes('时长');
		});
		console.log('表格头部索引:', headerIndex);
		
		if (headerIndex === -1) {
			// 没有记录时显示0
			const totalTimeElement = this.contentEl.querySelector('#total-focus-time');
			const sessionCountElement = this.contentEl.querySelector('#session-count');

			if (totalTimeElement) {
				totalTimeElement.textContent = `0h 0m`;
			}
			if (sessionCountElement) {
				sessionCountElement.textContent = '0';
			}
			console.log('未找到表格头部，显示0');
			return;
		}

		// 解析数据行   
		for (let i = headerIndex + 2; i < lines.length; i++) {
			const line = lines[i].trim();
			console.log('处理行:', i, line);
			
			if (!line.startsWith('|')) {
				console.log('跳过非表格行');
				continue; // 跳过非表格行
			}

			const columns = line.split('|').map(col => col.trim()).filter(col => col);
			console.log('列数:', columns.length, '列内容:', columns);
			
			if (columns.length >= 5) {
				// 检查是否是数据行（排除表头分隔符）
				if (columns[0] === '开始时间' || columns[0] === '---' || columns[0].includes('---')) {
					console.log('跳过表头或分隔符行');
					continue;
				}
				
				sessionCount++;
				console.log('有效记录，会话数:', sessionCount);
				
				// 从时长列获取分钟数
				const durationText = columns[4];
				console.log('时长文本:', durationText);
				
				const durationMatch = durationText.match(/(\d+)分钟/);
				if (durationMatch) {
					const minutes = parseInt(durationMatch[1]);
					totalMinutes += minutes;
					console.log('解析到时长:', minutes, '总时长:', totalMinutes);
				} else {
					// 如果无法解析时长，使用计算时间差的方式
					const startTime = columns[0];
					const endTime = columns[1];
					const calculatedMinutes = this.calculateTimeDifference(startTime, endTime);
					totalMinutes += calculatedMinutes;
					console.log('计算时长:', calculatedMinutes, '总时长:', totalMinutes);
				}
			} else {
				console.log('列数不足，跳过');
			}
		}

		console.log('最终统计 - 总时长:', totalMinutes, '会话数:', sessionCount);

		// 更新显示
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		const totalTimeElement = this.contentEl.querySelector('#total-focus-time');
		const sessionCountElement = this.contentEl.querySelector('#session-count');

		if (totalTimeElement) {
			totalTimeElement.textContent = `${hours}h ${minutes}m`;
			console.log('更新总时长显示:', `${hours}h ${minutes}m`);
		}
		if (sessionCountElement) {
			sessionCountElement.textContent = sessionCount.toString();
			console.log('更新会话数显示:', sessionCount);
		}
	}

	private calculateTimeDifference(start: string, end: string): number {
		const [startHours, startMinutes, startSeconds] = start.split(':').map(Number);
		const [endHours, endMinutes, endSeconds] = end.split(':').map(Number);

		const startDate = new Date();
		startDate.setHours(startHours, startMinutes, startSeconds);
		const endDate = new Date();
		endDate.setHours(endHours, endMinutes, endSeconds);

		// 处理跨天情况
		if (endDate < startDate) {
			endDate.setDate(endDate.getDate() + 1);
		}

		return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
	}

	// 统计相关方法
	private loadStatistics() {
		// 初始化统计周期
		this.currentStatsPeriod = 'daily';
		this.updatePeriodDisplay();
		this.loadPeriodStatistics('daily');
	}

	private loadPeriodStatistics(period: string) {
		this.currentStatsPeriod = period;
		
		switch (period) {
			case 'daily':
				this.loadDailyStatistics();
				break;
			case 'weekly':
				this.loadWeeklyStatistics();
				break;
			case 'yearly':
				this.loadYearlyStatistics();
				break;
		}
	}

	private async loadDailyStatistics() {
		try {
			// 使用当前日期加载日统计
			const logData = await this.loadPeriodLogData();
			console.log('日统计数据:', logData);
			
			if (logData.length === 0 || logData.every(day => day.entries.length === 0)) {
				console.log('没有找到任何日志数据');
				// 显示空数据提示
				this.contentEl.querySelector('#daily-total-time')!.textContent = '0h 0m';
				this.contentEl.querySelector('#daily-session-count')!.textContent = '0';
				this.contentEl.querySelector('#daily-avg-session')!.textContent = '0m';
				
				// 渲染空图表
				this.renderDailyChart(Array.from({length: 24}, (_, i) => ({ hour: i, minutes: 0 })));
				return;
			}
			
			const stats = this.calculateDailyStats(logData);
			
			// 更新日统计UI
			this.contentEl.querySelector('#daily-total-time')!.textContent = `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`;
			this.contentEl.querySelector('#daily-session-count')!.textContent = stats.sessionCount.toString();
			this.contentEl.querySelector('#daily-avg-session')!.textContent = stats.sessionCount > 0 ? `${Math.round(stats.totalMinutes / stats.sessionCount)}m` : '0m';
			
			// 渲染日统计图表
			this.renderDailyChart(stats.hourlyData);
		} catch (error) {
			console.error('加载日统计失败:', error);
			// 显示错误提示
			this.contentEl.querySelector('#daily-total-time')!.textContent = '错误';
			this.contentEl.querySelector('#daily-session-count')!.textContent = '-';
			this.contentEl.querySelector('#daily-avg-session')!.textContent = '-';
		}
	}

	private async loadWeeklyStatistics() {
		try {
			// 加载一周的日志数据
			const logData = await this.loadPeriodLogData();
			console.log('周统计数据:', logData);
			
			if (logData.length === 0 || logData.every(day => day.entries.length === 0)) {
				console.log('没有找到任何日志数据');
				// 显示空数据提示
				this.contentEl.querySelector('#weekly-total-time')!.textContent = '0h 0m';
				this.contentEl.querySelector('#weekly-session-count')!.textContent = '0';
				this.contentEl.querySelector('#weekly-daily-avg')!.textContent = '0h 0m';
				
				// 渲染空图表
				const today = new Date();
				const startOfWeek = new Date(today);
				startOfWeek.setDate(today.getDate() - today.getDay());
				const emptyData = Array.from({length: 7}, (_, i) => {
					const date = new Date(startOfWeek);
					date.setDate(startOfWeek.getDate() + i);
					return { date: this.getFormattedDate(date), minutes: 0 };
				});
				this.renderWeeklyChart(emptyData);
				return;
			}
			
			const stats = this.calculateWeeklyStats(logData);
			
			// 更新周统计UI
			this.contentEl.querySelector('#weekly-total-time')!.textContent = `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`;
			this.contentEl.querySelector('#weekly-session-count')!.textContent = stats.sessionCount.toString();
			this.contentEl.querySelector('#weekly-daily-avg')!.textContent = `${Math.floor(stats.dailyAvgMinutes / 60)}h ${stats.dailyAvgMinutes % 60}m`;
			
			// 渲染周统计图表
			this.renderWeeklyChart(stats.dailyData);
		} catch (error) {
			console.error('加载周统计失败:', error);
			// 显示错误提示
			this.contentEl.querySelector('#weekly-total-time')!.textContent = '错误';
			this.contentEl.querySelector('#weekly-session-count')!.textContent = '-';
			this.contentEl.querySelector('#weekly-daily-avg')!.textContent = '-';
		}
	}

	private async loadYearlyStatistics() {
		try {
			// 加载一年的日志数据
			const logData = await this.loadPeriodLogData();
			console.log('年统计数据:', logData);
			
			if (logData.length === 0 || logData.every(day => day.entries.length === 0)) {
				console.log('没有找到任何日志数据');
				// 显示空数据提示
				this.contentEl.querySelector('#yearly-total-time')!.textContent = '0h 0m';
				this.contentEl.querySelector('#yearly-session-count')!.textContent = '0';
				this.contentEl.querySelector('#yearly-monthly-avg')!.textContent = '0h 0m';
				
				// 渲染空图表
				const emptyData = Array.from({length: 12}, (_, i) => ({
					month: i + 1,
					monthName: new Date(0, i).toLocaleString('default', { month: 'short' }),
					minutes: 0
				}));
				this.renderYearlyChart(emptyData);
				return;
			}
			
			const stats = this.calculateYearlyStats(logData);
			
			// 更新年统计UI
			this.contentEl.querySelector('#yearly-total-time')!.textContent = `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`;
			this.contentEl.querySelector('#yearly-session-count')!.textContent = stats.sessionCount.toString();
			this.contentEl.querySelector('#yearly-monthly-avg')!.textContent = `${Math.floor(stats.monthlyAvgMinutes / 60)}h ${stats.monthlyAvgMinutes % 60}m`;
			
			// 渲染年统计图表
			this.renderYearlyChart(stats.monthlyData);
		} catch (error) {
			console.error('加载年统计失败:', error);
			// 显示错误提示
			this.contentEl.querySelector('#yearly-total-time')!.textContent = '错误';
			this.contentEl.querySelector('#yearly-session-count')!.textContent = '-';
			this.contentEl.querySelector('#yearly-monthly-avg')!.textContent = '-';
		}
	}

	private async loadPeriodLogData(): Promise<Array<{date: Date, entries: Array<{startTime: string, endTime: string, tag: string, duration: number}>}>> {
		const result: Array<{date: Date, entries: Array<{startTime: string, endTime: string, tag: string, duration: number}>}> = [];
		const now = new Date();
		let datesToLoad: Date[] = [];

		// 根据当前统计周期确定需要加载的日期范围
		switch (this.currentStatsPeriod) {
			case 'daily':
				datesToLoad = [new Date(now)];
				break;
			case 'weekly':
				// 获取本周所有日期（从周日到周六）
				const startOfWeek = new Date(now);
				startOfWeek.setDate(now.getDate() - now.getDay());
				for (let i = 0; i < 7; i++) {
					const date = new Date(startOfWeek);
					date.setDate(startOfWeek.getDate() + i);
					datesToLoad.push(date);
				}
				break;
			case 'yearly':
				// 获取今年每个月的第一天
				for (let month = 0; month < 12; month++) {
					const date = new Date(now.getFullYear(), month, 1);
					if (!isNaN(date.getTime())) {
						datesToLoad.push(date);
					}
				}
				break;
		}

		// 加载每个日期的日志文件
		console.log('需要加载的日期:', datesToLoad.map(d => this.getFormattedDate(d)));
		console.log('日记路径:', this.plugin.settings.diaryPath);

		for (const date of datesToLoad) {
			try {
				const dateString = this.getFormattedDate(date);
				let fullPath = `${dateString}.md`;

				// 应用日记存储路径，添加年/月层级
				if (this.plugin.settings.diaryPath) {
					const normalizedPath = this.plugin.settings.diaryPath.replace(/\\/g, '/');
					const year = date.getFullYear().toString();
					const month = (date.getMonth() + 1).toString().padStart(2, '0');
					fullPath = normalizedPath.endsWith('/') 
						? `${normalizedPath}${year}/${month}/${dateString}.md`
						: `${normalizedPath}/${year}/${month}/${dateString}.md`;
				}

				fullPath = fullPath.replace(/\\/g, '/');
				
				console.log(`检查文件: ${fullPath}`);
				
				// 检查文件是否存在
				const file = this.app.vault.getAbstractFileByPath(fullPath) as TFile;
				if (file) {
					console.log(`找到文件: ${fullPath}`);
					const content = await this.app.vault.read(file);
					const entries = this.parseLogFile(content);
					console.log(`文件 ${fullPath} 解析结果: ${entries.length} 条记录`);
					result.push({ date: new Date(date), entries });
				} else {
					console.log(`文件不存在: ${fullPath}`);
				}
			} catch (error) {
				console.error(`加载日志文件失败: ${error}`);
			}
		}

		console.log('最终加载结果:', result);
		return result;
	}

	private getFormattedDate(date?: Date): string {
		const targetDate = date || new Date();
		return targetDate.toISOString().split('T')[0];
	}

	private parseLogFile(content: string): Array<{startTime: string, endTime: string, tag: string, duration: number}> {
		const entries: Array<{startTime: string, endTime: string, tag: string, duration: number}> = [];
		const lines = content.split('\n');

		console.log('开始解析日志内容，总行数:', lines.length);
		if (content.trim()) {
			console.log('日志内容预览:', content.substring(0, Math.min(200, content.length)));
		}

		// 查找番茄钟记录表格
		const tableStartIndex = lines.findIndex(line => line.includes('## 番茄钟记录'));
		if (tableStartIndex === -1) {
			console.log('未找到番茄钟记录表格');
			return entries;
		}

		console.log('找到表格起始行:', tableStartIndex);

		// 查找表格数据行（跳过表头和分隔符）
		let validEntries = 0;
		for (let i = tableStartIndex + 2; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line || !line.startsWith('|')) continue;

			const columns = line.split('|').map(col => col.trim()).filter(col => col);
			console.log(`第${i+1}行解析:`, {columns});

			// 确保有5列数据：开始时间、结束时间、标签、备注、时长
			if (columns.length >= 5 && columns[0] !== '开始时间' && !columns[0].includes('---')) {
				const startTime = columns[0];
				const endTime = columns[1];
				const tag = columns[2];
				const durationText = columns[4];

				// 从时长列获取分钟数
				const durationMatch = durationText.match(/(\d+)分钟/);
				let duration = 0;
				if (durationMatch) {
					duration = parseInt(durationMatch[1]);
				} else {
					// 如果无法解析时长，使用计算时间差的方式
					duration = this.calculateTimeDifference(startTime, endTime);
				}

				console.log('添加记录:', { startTime, endTime, tag, duration });
				entries.push({ startTime, endTime, tag, duration });
				validEntries++;
			}
		}

		console.log(`解析完成，共${lines.length}行，有效记录${validEntries}条`);
		return entries;
	}

	private calculateDailyStats(logData: Array<{date: Date, entries: Array<{startTime: string, endTime: string, tag: string, duration: number}>}>): any {
		let totalMinutes = 0;
		let sessionCount = 0;
		// 初始化24小时数据数组
		const hourlyData = Array.from({length: 24}, () => ({ hour: 0, minutes: 0 }));

		// 处理当天的所有条目
		logData.forEach(day => {
			day.entries.forEach(entry => {
				totalMinutes += entry.duration;
				sessionCount++;

				// 解析开始时间的小时部分
				const startHour = parseInt(entry.startTime.split(':')[0]);
				if (!isNaN(startHour) && startHour >= 0 && startHour < 24) {
					hourlyData[startHour].hour = startHour;
					hourlyData[startHour].minutes += entry.duration;
				}
			});
		});

		return {
			totalMinutes,
			sessionCount,
			hourlyData
		};
	}

	private calculateWeeklyStats(logData: Array<{date: Date, entries: Array<{startTime: string, endTime: string, tag: string, duration: number}>}>): any {
		let totalMinutes = 0;
		let sessionCount = 0;
		const dailyData: Array<{date: string, minutes: number}> = [];

		// 按日期聚合数据
		logData.forEach(day => {
			const dayMinutes = day.entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);
			const dateStr = this.getFormattedDate(day.date);

			if (dayMinutes > 0) {
				dailyData.push({ date: dateStr, minutes: dayMinutes });
				totalMinutes += dayMinutes;
				sessionCount += day.entries.length;
			} else {
				// 确保即使某天没有数据也显示在图表中
				dailyData.push({ date: dateStr, minutes: 0 });
			}
		});

		// 计算日均分钟数（排除没有数据的天数）
		const activeDays = dailyData.filter(day => day.minutes > 0).length;
		const dailyAvgMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;

		return {
			totalMinutes,
			sessionCount,
			dailyAvgMinutes,
			dailyData
		};
	}

	private calculateYearlyStats(logData: Array<{date: Date, entries: Array<{startTime: string, endTime: string, tag: string, duration: number}>}>): any {
		let totalMinutes = 0;
		let sessionCount = 0;
		// 初始化12个月数据数组
		const monthlyData = Array.from({length: 12}, (_, i) => ({
			month: i + 1,
			monthName: new Date(0, i).toLocaleString('default', { month: 'short' }),
			minutes: 0
		}));

		// 按月份聚合数据
		logData.forEach(month => {
			const monthIndex = month.date.getMonth();
			const monthMinutes = month.entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);

			monthlyData[monthIndex].minutes = monthMinutes;
			totalMinutes += monthMinutes;
			sessionCount += month.entries.length;
		});

		// 计算月均分钟数（排除没有数据的月份）
		const activeMonths = monthlyData.filter(month => month.minutes > 0).length;
		const monthlyAvgMinutes = activeMonths > 0 ? Math.round(totalMinutes / activeMonths) : 0;

		return {
			totalMinutes,
			sessionCount,
			monthlyAvgMinutes,
			monthlyData
		};
	}

	private renderDailyChart(data: Array<{hour: number, minutes: number}>) {
		const ctx = this.contentEl.querySelector('#daily-chart') as HTMLCanvasElement;
		if (!ctx) return;

		// 销毁现有图表
		if ((ctx as any).chart) {
			(ctx as any).chart.destroy();
		}

		// 确保显示完整24小时，从0点到23点
		const fullData = Array.from({length: 24}, (_, hour) => {
			const existing = data.find(item => item.hour === hour);
			return {
				hour: hour,
				minutes: existing ? existing.minutes : 0
			};
		});

		// 准备图表数据
		const labels = fullData.map(item => `${item.hour.toString().padStart(2, '0')}:00`);
		const chartData = fullData.map(item => item.minutes);

		// 创建新图表
		(ctx as any).chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: '专注分钟',
					data: chartData,
					backgroundColor: 'rgba(255, 107, 107, 0.7)',
					borderColor: 'rgba(255, 107, 107, 1)',
					borderWidth: 1,
					barPercentage: 0.8
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: '分钟'
						}
					},
					x: {
						grid: {
							display: false
						},
						title: {
							display: true,
							text: '小时'
						},
						ticks: {
							maxRotation: 45,
							minRotation: 0,
							font: {
								size: 10
							}
						}
					}
				},
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: '今日专注时间分布',
						font: {
							size: 16
						}
					}
				}
			}
		});

		// 调整canvas高度以适应24小时标签
		ctx.style.height = '400px';
	}

	private renderWeeklyChart(data: Array<{date: string, minutes: number}>) {
		const ctx = this.contentEl.querySelector('#weekly-chart') as HTMLCanvasElement;
		if (!ctx) return;

		// 销毁现有图表
		if ((ctx as any).chart) {
			(ctx as any).chart.destroy();
		}

		// 准备图表数据
		const labels = data.map(item => item.date.split('-').slice(1).join('/')); // 格式化为 MM/DD
		const chartData = data.map(item => item.minutes);

		// 创建新图表
		(ctx as any).chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: '专注分钟',
					data: chartData,
					backgroundColor: 'rgba(78, 205, 196, 0.7)',
					borderColor: 'rgba(78, 205, 196, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: '分钟'
						}
					},
					x: {
						grid: {
							display: false
						},
						title: {
							display: true,
							text: '日期'
						}
					}
				},
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: '本周专注时间分布',
						font: {
							size: 16
						}
					}
				}
			}
		});
	}

	private renderYearlyChart(data: Array<{monthName: string, minutes: number}>) {
		const ctx = this.contentEl.querySelector('#yearly-chart') as HTMLCanvasElement;
		if (!ctx) return;

		// 销毁现有图表
		if ((ctx as any).chart) {
			(ctx as any).chart.destroy();
		}

		// 准备图表数据
		const labels = data.map(item => item.monthName);
		const chartData = data.map(item => item.minutes);

		// 创建新图表
		(ctx as any).chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: '专注分钟',
					data: chartData,
					backgroundColor: 'rgba(255, 195, 0, 0.7)',
					borderColor: 'rgba(255, 195, 0, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: '分钟'
						}
					},
					x: {
						grid: {
							display: false
						},
						title: {
							display: true,
							text: '月份'
						}
					}
				},
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: '今年专注时间分布',
						font: {
							size: 16
						}
					}
				}
			}
		});
	}

	private updatePeriodDisplay() {
		// 更新周期显示文本
		const periodElement = this.contentEl.querySelector('.current-period');
		if (periodElement) {
			periodElement.textContent = this.getFormattedPeriod();
		}
	}

	private getFormattedPeriod(): string {
		// 根据当前统计周期格式化显示文本
		const now = new Date();
		
		switch (this.currentStatsPeriod) {
			case 'daily':
				return this.getFormattedDate(now);
			case 'weekly':
				const startOfWeek = new Date(now);
				startOfWeek.setDate(now.getDate() - now.getDay());
				const endOfWeek = new Date(startOfWeek);
				endOfWeek.setDate(startOfWeek.getDate() + 6);
				return `${this.getFormattedDate(startOfWeek)} - ${this.getFormattedDate(endOfWeek)}`;
			case 'yearly':
				return now.getFullYear().toString();
			default:
				return this.getFormattedDate(now);
		}
	}

	private navigateStatisticsPeriod(direction: number) {
		const newDate = new Date(this.currentStatsDate);

		// 根据当前统计周期调整日期
		switch (this.currentStatsPeriod) {
			case 'daily':
				newDate.setDate(newDate.getDate() + direction);
				break;
			case 'weekly':
				newDate.setDate(newDate.getDate() + (direction * 7));
				break;
			case 'yearly':
				newDate.setFullYear(newDate.getFullYear() + direction);
				break;
		}

		this.currentStatsDate = newDate;
		this.updatePeriodDisplay();
		this.loadPeriodStatistics(this.currentStatsPeriod);
	}

	private resetStatisticsPeriod() {
		// 重置统计周期为当前日期
		this.currentStatsDate = new Date();
		this.updatePeriodDisplay();
		this.loadPeriodStatistics(this.currentStatsPeriod);
	}
}
