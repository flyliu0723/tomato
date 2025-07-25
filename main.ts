import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, TFile, TFolder } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	workTime: number; // 番茄工作时间（分钟）
	breakTime: number; // 休息时间（分钟）
	tags: string[]; // 可用标签列表
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	workTime: 25,
	breakTime: 5,
	tags: ['工作', '学习', '阅读', '写作'],
	dateFormat: 'YYYY-MM-DD', // 添加默认日期格式
	diaryPath: '01Inbox/daily' // 添加默认日记路径
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

	// 添加打开设置选项卡的方法
	openSettingsTab() {
		this.app.setting.open();
		this.app.setting.openTabById('break-timer-settings');
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
	id: string = 'break-timer-settings';

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

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
			.setDesc('指定日记文件的存放路径')
			.addTextInput(text => text
				.setPlaceholder('例如：01Inbox/daily')
				.setValue(this.plugin.settings.diaryPath)
				.onChange(async (value) => {
					this.plugin.settings.diaryPath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('浏览')
				.onClick(async () => {
					try {
						const result = await this.app.fileManager.showFolderPicker({
							startPath: this.plugin.settings.diaryPath || '/'
						});
						if (result) {
							this.plugin.settings.diaryPath = result.path;
							await this.plugin.saveSettings();
							this.display(); // 刷新设置界面
						}
					} catch (error) {
						console.error('文件夹选择错误:', error);
						new Notice('选择文件夹失败: ' + (error instanceof Error ? error.message : String(error)));
					}
				}));

		// 工作时间设置
		new Setting(containerEl)
			.setName('工作时间（分钟）')
			.setDesc('设置番茄钟工作时间长度')
			.addTextInput(text => text
				.setPlaceholder('输入工作时间')
				.setValue(this.plugin.settings.workTime.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.workTime = num;
						await this.plugin.saveSettings();
					}
				}));

		// 休息时间设置
		new Setting(containerEl)
			.setName('休息时间（分钟）')
			.setDesc('设置休息时间长度')
			.addTextInput(text => text
				.setPlaceholder('输入休息时间')
				.setValue(this.plugin.settings.breakTime.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.breakTime = num;
						await this.plugin.saveSettings();
					}
				}));

		// 标签设置
		new Setting(containerEl)
			.setName('标签设置')
			.setDesc('设置常用标签，用逗号分隔')
			.addTextArea(text => text
				.setPlaceholder('输入标签，用逗号分隔')
				.setValue(this.plugin.settings.tags.join(','))
				.onChange(async (value) => {
					this.plugin.settings.tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
					await this.plugin.saveSettings();
				}));
	}
}

class BreakView extends ItemView {
	private plugin: MyPlugin;
	private timerInterval: number | null = null;
	private timeLeft: number;
	private isRunning: boolean = false;
	private currentTag: string = '';
	private isFocusMode: boolean = true; // 是否处于专注模式
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
		if (this.isFocusMode) {
			this.openLogDialog(); // 专注模式完成时打开记录对话框
		}
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

	private getFormattedDate(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');

		switch (this.plugin.settings.dateFormat) {
			case 'YYYY/MM/DD':
				return `${year}/${month}/${day}`;
			case 'YYYY-MM-DD':
			default:
				return `${year}-${month}-${day}`;
		}
	}

	private async saveLogEntry(timeRange: string, tag: string, notes: string) {
		try {
			const dateString = this.getFormattedDate();
			let fileName = `${dateString}.md`;

			// 应用日记存储路径，处理Windows路径分隔符
			let fullPath = fileName;
			if (this.plugin.settings.diaryPath) {
				// 标准化路径分隔符
				const normalizedPath = this.plugin.settings.diaryPath.replace(/\\/g, '/');
				fullPath = normalizedPath.endsWith('/') ? `${normalizedPath}${fileName}` : `${normalizedPath}/${fileName}`;
			}

			// 确保路径使用正斜杠
			fullPath = fullPath.replace(/\\/g, '/');

			// 检查目录是否存在，如果不存在则创建
			const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
			if (dirPath && !this.app.vault.getAbstractFileByPath(dirPath)) {
				// 创建多级目录
				await this.createDirectoryRecursive(dirPath);
			}

			let file = this.app.vault.getAbstractFileByPath(fullPath) as TFile;
			if (!file) {
				// 如果文件不存在，创建新文件
				file = await this.app.vault.create(fullPath, `# ${dateString}

`);
			}

			const logEntry = `- ${timeRange}, ${tag || '无'}, ${notes || '无'}
`;

			// 追加内容到文件
			const content = await this.app.vault.read(file);
			await this.app.vault.modify(file, content + logEntry);

			new Notice(`${this.isFocusMode ? '专注' : '休息'}记录已保存到每日日记`);
		} catch (error) {
			console.error('保存记录失败:', error);
			new Notice(`保存记录失败: ${error.message || '未知错误'}`);
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
				</div>
				<div class="tab-content active" id="timer-content">
					<div class="timer-circle">
						<div class="timer-text">${this.isFocusMode ? '专注时间' : '休息时间'}</div>
						<div class="timer-value">${this.formatTime(this.timeLeft)}</div>
					</div>
					<div class="tag-selection">
						<label for="tag-select">选择标签: </label>
						<select id="tag-select">
							<option value="">-- 选择标签 --</option>
							${tagOptions}
						</select>
					</div>
					<div class="timer-controls">
						<button class="start-btn">${this.isRunning ? '暂停' : this.isFocusMode ? '开始专注' : '开始休息'}</button>
						<button class="skip-btn">跳过</button>
						<button class="config-btn">设置</button>
						<button class="log-btn">记录</button>
					</div>
				</div>
				<div class="tab-content" id="logs-content">
					<div class="logs-header">
						<div class="date-navigation">
							<button class="date-btn prev-date">← 昨天</button>
							<button class="date-btn today-date">今天</button>
							<button class="date-btn next-date">明天 →</button>
							<span class="current-date">${this.getFormattedDate()}</span>
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
									<th>操作</th>
								</tr>
							</thead>
							<tbody id="logs-table-body">
								<!-- 日志内容将通过JavaScript动态加载 -->
							</tbody>
						</table>
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

		this.isRunning = true;
		this.initializeTimerValues(); // 启动时重新初始化时间
		this.isProcessingCompletion = false; // 重置处理标志
		this.updateStartButtonText();

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
							this.openLogDialog(); // 打开记录对话框
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

	private async openLogDialog() {
		// 创建记录弹窗
		const dialog = new Modal(this.app);
		const { contentEl } = dialog;
		contentEl.style.padding = '20px';
		contentEl.style.maxWidth = '500px';
		contentEl.style.margin = '0 auto';

		// 计算完整番茄钟的开始和结束时间
		const now = new Date();
		const duration = this.isFocusMode ? this.focusTime : this.breakTime;
		const endTime = new Date(now.getTime() + duration * 1000);

		// 格式化时间为 HH:MM:SS
		const formatTimeForLog = (date: Date) => {
			return date.toTimeString().slice(0, 8);
		};

		const startTimeStr = formatTimeForLog(now);
		const endTimeStr = formatTimeForLog(endTime);

		contentEl.createEl('h3', { text: `${this.isFocusMode ? '专注' : '休息'}记录` });

		// 时间范围显示
		const timeRangeDiv = contentEl.createEl('div', { cls: 'time-range' });
		timeRangeDiv.createEl('p', { text: `开始时间: ${startTimeStr}` });
		timeRangeDiv.createEl('p', { text: `结束时间: ${endTimeStr}` });

		// 标签选择
		const tagDiv = contentEl.createEl('div', { cls: 'tag-selection' });
		tagDiv.createEl('label', { text: '标签: ', attrs: { for: 'log-tag' } });
		const tagSelect = tagDiv.createEl('select', { id: 'log-tag' });
		tagSelect.createEl('option', { value: '', text: '-- 选择标签 --' });
		this.plugin.settings.tags.forEach(tag => {
			tagSelect.createEl('option', { value: tag, text: tag });
		});

		// 备注输入
		const notesDiv = contentEl.createEl('div', { cls: 'notes-input' });
		notesDiv.createEl('label', { text: '备注: ', attrs: { for: 'log-notes' } });
		const notesTextarea = notesDiv.createEl('textarea', { id: 'log-notes', cls: 'log-notes' });
		notesTextarea.style.width = '100%';
		notesTextarea.style.minHeight = '100px';
		notesTextarea.style.marginTop = '8px';

		// 按钮区域
		const buttonsDiv = contentEl.createEl('div', { cls: 'dialog-buttons' });
		buttonsDiv.style.display = 'flex';
		buttonsDiv.style.justifyContent = 'flex-end';
		buttonsDiv.style.gap = '8px';
		buttonsDiv.style.marginTop = '16px';

		// 取消按钮
		const cancelBtn = buttonsDiv.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => dialog.close());

		// 保存按钮
		const saveBtn = buttonsDiv.createEl('button', { text: '保存' });
		saveBtn.style.backgroundColor = 'var(--interactive-accent)';
		saveBtn.style.color = 'white';
		saveBtn.style.border = 'none';
		saveBtn.style.padding = '8px 16px';
		saveBtn.style.borderRadius = '4px';

		saveBtn.addEventListener('click', async () => {
			const tag = tagSelect.value;
			const notes = notesTextarea.value;
			const timeRange = `${startTimeStr} - ${endTimeStr}`;
			await this.saveLogEntry(startTimeStr, endTimeStr, tag, notes);
			dialog.close();
		});

		dialog.open();
	}

	private async saveLogEntry(startTime: string, endTime: string, tag: string, notes: string) {
		try {
			const now = new Date();
			const year = now.getFullYear().toString();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFormattedDate();
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
			// 修复表格格式，确保表头前后有空行
			const tableHeader = "\n## 番茄钟记录\n\n| 开始时间 | 结束时间 | 标签 | 备注 |\n|----------|----------|------|------|\n";

			if (!file) {
				// 创建新文件并添加表格表头
				file = await this.app.vault.create(fullPath, `# ${dateString}

${tableHeader}`);
			} else {
				// 检查文件中是否已有表格
				const content = await this.app.vault.read(file);
				if (!content.includes('## 番茄钟记录')) {
					// 如果没有表格，添加表头
					await this.app.vault.modify(file, content + `
${tableHeader}`);
				}
			}

			// 添加表格行
			const logEntry = `| ${startTime} | ${endTime} | ${tag || '无'} | ${notes || '无'} |\n`;
			const content = await this.app.vault.read(file);

			// 查找表格位置并添加新行
			if (content.includes('| 开始时间 | 结束时间 | 标签 | 备注 |')) {
				const lines = content.split('\n');
				const headerIndex = lines.findIndex(line => line.includes('| 开始时间 | 结束时间 | 标签 | 备注 |'));
				// 找到表头后的第一行数据位置
				let insertIndex = headerIndex + 2; // 表头行 + 分隔符行

				// 如果表头后没有数据行，直接添加在分隔符行后
				// 否则添加在最后一行数据之后
				while (insertIndex < lines.length && lines[insertIndex].trim().startsWith('|')) {
					insertIndex++;
				}

				lines.splice(insertIndex, 0, logEntry.trim());
				await this.app.vault.modify(file, lines.join('\n'));
			} else {
				// 如果没有找到表格，直接追加（作为备份方案）
				await this.app.vault.modify(file, content + `\n${logEntry}`);
			}

			new Notice(`${this.isFocusMode ? '专注' : '休息'}记录已保存到每日日记`);
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
		const logBtn = this.contentEl.querySelector('.log-btn');
		const tagSelect = this.contentEl.querySelector('#tag-select') as HTMLSelectElement;
		// 添加标签页切换事件
		const tabs = this.contentEl.querySelectorAll('.tab');
		const tabContents = this.contentEl.querySelectorAll('.tab-content');

		// 添加空值检查
		if (!startBtn || !skipBtn || !configBtn || !logBtn || !tagSelect) {
			console.error('休息计时器界面元素缺失');
			new Notice('无法初始化控件: 界面元素不完整');
			return;
		}

		startBtn.addEventListener('click', () => this.toggleTimer());
		skipBtn.addEventListener('click', () => this.skipBreak());
		configBtn.addEventListener('click', () => this.openConfig());
		logBtn.addEventListener('click', () => this.openLogDialog()); // 修改为打开记录弹窗
		tagSelect.addEventListener('change', (e) => {
			this.currentTag = (e.target as HTMLSelectElement).value;
		});

		// 标签页切换事件
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
					}
				});
			});
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
			const now = new Date();
			const year = now.getFullYear().toString();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFormattedDate();
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
			if (!file) return;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const tableStartIndex = lines.findIndex(line => line.includes('## 番茄钟记录'));
			if (tableStartIndex === -1) return;

			// 查找表格数据行
			let tableLineIndex = -1;
			for (let i = tableStartIndex; i < lines.length; i++) {
				if (lines[i].includes('| 开始时间 | 结束时间 | 标签 | 备注 |')) {
					// 表头找到，从下两行开始查找数据
					for (let j = i + 2; j < lines.length; j++) {
						if (lines[j].includes(startTime) && lines[j].includes(endTime) && lines[j].includes(tag)) {
							tableLineIndex = j;
							break;
						}
					}
					break;
				}
			}

			if (tableLineIndex !== -1) {
				// 更新备注内容
				const columns = lines[tableLineIndex].split('|').map(col => col.trim());
				if (columns.length >= 5) {
					columns[3] = newNotes;
					lines[tableLineIndex] = `| ${columns[0]} | ${columns[1]} | ${columns[2]} | ${columns[3]} |`;
					await this.app.vault.modify(file, lines.join('\n'));
					new Notice('备注已更新');
				}
			}
		} catch (error) {
			console.error('更新备注失败:', error);
			new Notice(`更新备注失败: ${error.message || '未知错误'}`);
		}
	};




	private updateDateDisplay() {
		const dateElement = this.contentEl.querySelector('.current-date');
		if (dateElement) {
			dateElement.textContent = this.getFormattedDate();
		}
	}

	private async loadLogEntries() {
		try {
			const now = new Date();
			const year = now.getFullYear().toString();
			const month = (now.getMonth() + 1).toString().padStart(2, '0');
			const dateString = this.getFormattedDate();
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
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="5">暂无记录</td></tr>';
				return;
			}

			const content = await this.app.vault.read(file);
			const tableStart = content.indexOf('## 番茄钟记录');
			if (tableStart === -1) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="5">暂无记录</td></tr>';
				return;
			}

			// 提取表格内容
			const tableContent = content.substring(tableStart);
			const tableLines = tableContent.split('\n').filter(line => line.trim().startsWith('|'));
			if (tableLines.length < 3) {
				this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="5">暂无记录</td></tr>';
				return;
			}

			// 解析表格数据并生成行
			const tableBody = this.contentEl.querySelector('#logs-table-body')!;
			tableBody.innerHTML = '';

			// 跳过表头和分隔符行
			for (let i = 2; i < tableLines.length; i++) {
				const line = tableLines[i].trim();
				if (!line) continue;

				// 解析表格行数据
				const columns = line.split('|').map(col => col.trim()).filter(col => col);
				if (columns.length >= 4) {
					const row = document.createElement('tr');
					row.innerHTML = `
						<td>${columns[0]}</td>
						<td>${columns[1]}</td>
						<td>${columns[2]}</td>
						<td>${columns[3]}</td>
						<td><button class="edit-btn" data-index="${i}">编辑</button></td>
					`;
					tableBody.appendChild(row);
				}
			}

			// 添加编辑按钮事件
			this.contentEl.querySelectorAll('.edit-btn').forEach(btn => {
				btn.addEventListener('click', (e) => this.openEditDialog(e));
			});

		} catch (error) {
			console.error('加载记录失败:', error);
			this.contentEl.querySelector('#logs-table-body')!.innerHTML = '<tr><td colspan="5">加载记录失败</td></tr>';
		}

		// 计算汇总统计
		this.calculateSummary(lines);
	}


	private calculateSummary(lines: string[]) {
		let totalMinutes = 0;
		let sessionCount = 0;

		// 查找表格位置
		const headerIndex = lines.findIndex(line => line.includes('| 开始时间 | 结束时间 | 标签 | 备注 |'));
		if (headerIndex === -1) return;

		// 解析数据行   
		for (let i = headerIndex + 2; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line.startsWith('|')) break;

			const columns = line.split('|').map(col => col.trim()).filter(col => col);
			if (columns.length >= 2) {
				sessionCount++;
				const startTime = columns[0];
				const endTime = columns[1];
				totalMinutes += this.calculateTimeDifference(startTime, endTime);
			}
		}

		// 更新汇总显示
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		this.contentEl.querySelector('#total-focus-time')!.textContent = `${hours}h ${minutes}m`;
		this.contentEl.querySelector('#session-count')!.textContent = sessionCount.toString();
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
}
