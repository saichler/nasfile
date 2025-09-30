// Professional Dual Pane File Manager - REST API Based
class FileManagerAPI {
    constructor() {
        this.baseUrl = '';
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Check for error response format
            if (data.isError) {
                throw new Error(data.msg || 'Operation failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async listFiles(path) {
        console.log('API listFiles called with path:', path);

        // For root directory
        if (path === '/' || path === '') {
            const requestBody = {
                path: '',
                name: '',
                isDirectory: true
            };
            console.log('Root directory request body:', requestBody);

            return this.request('/files/0/Files', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
        }

        // For any other path, treat the entire path as the target directory
        // Extract parent path and directory name
        const pathParts = path.split('/').filter(p => p);
        const name = pathParts[pathParts.length - 1];
        const parentPath = pathParts.length > 1 ? '/' + pathParts.slice(0, -1).join('/') : '';

        const requestBody = {
            path: parentPath,
            name: name,
            isDirectory: true
        };
        console.log('Non-root directory request body:', requestBody);

        return this.request('/files/0/Files', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
    }

    async createFolder(path, name) {
        return this.request('/files/folder', {
            method: 'POST',
            body: JSON.stringify({ path, name })
        });
    }

    async deleteFiles(paths) {
        // Process each path individually
        const results = [];
        const errors = [];

        for (const path of paths) {
            const pathParts = path.split('/');
            const fileName = pathParts.pop();
            const dirPath = pathParts.join('/');

            try {
                const result = await this.request('/files/0/Actions', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'delete',
                        source: {
                            path: dirPath,
                            name: fileName
                        }
                    })
                });
                results.push(result);
            } catch (error) {
                errors.push({ path, error: error.message });
            }
        }

        if (errors.length > 0) {
            const errorMsg = errors.map(e => `${e.path}: ${e.error}`).join(', ');
            throw new Error(errorMsg);
        }

        return results;
    }

    async renameFile(oldPath, newName) {
        const pathParts = oldPath.split('/');
        const oldName = pathParts.pop();
        const dirPath = pathParts.join('/');

        return this.request('/files/0/Actions', {
            method: 'POST',
            body: JSON.stringify({
                action: 'rename',
                source: {
                    path: dirPath,
                    name: oldName
                },
                target: {
                    path: dirPath,
                    name: newName
                }
            })
        });
    }

    async copyFiles(sources, destination) {
        const results = [];
        const errors = [];

        for (const sourcePath of sources) {
            const pathParts = sourcePath.split('/');
            const fileName = pathParts.pop();
            const sourceDirPath = pathParts.join('/');

            try {
                const result = await this.request('/files/0/Actions', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'copy',
                        source: {
                            path: sourceDirPath,
                            name: fileName
                        },
                        target: {
                            path: destination,
                            name: fileName,
                            isDirectory: true
                        }
                    })
                });
                results.push(result);
            } catch (error) {
                errors.push({ file: fileName, error: error.message });
            }
        }

        if (errors.length > 0) {
            const errorMsg = errors.map(e => `${e.file}: ${e.error}`).join(', ');
            throw new Error(errorMsg);
        }

        return results;
    }

    async moveFiles(sources, destination) {
        const results = [];
        const errors = [];

        for (const sourcePath of sources) {
            const pathParts = sourcePath.split('/');
            const fileName = pathParts.pop();
            const sourceDirPath = pathParts.join('/');

            try {
                const result = await this.request('/files/0/Actions', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'cut',
                        source: {
                            path: sourceDirPath,
                            name: fileName
                        },
                        target: {
                            path: destination,
                            name: fileName,
                            isDirectory: true
                        }
                    })
                });
                results.push(result);
            } catch (error) {
                errors.push({ file: fileName, error: error.message });
            }
        }

        if (errors.length > 0) {
            const errorMsg = errors.map(e => `${e.file}: ${e.error}`).join(', ');
            throw new Error(errorMsg);
        }

        return results;
    }

    async getFileInfo(path) {
        return this.request(`/files/info?path=${encodeURIComponent(path)}`);
    }

    async getDiskSpace(path) {
        return this.request(`/files/space?path=${encodeURIComponent(path)}`);
    }
}

// File Pane Class
class FilePane {
    constructor(paneId, api) {
        this.paneId = paneId;
        this.api = api;
        this.element = document.getElementById(paneId);
        this.currentPath = '/';
        this.files = [];
        this.selectedFiles = new Set();
        this.sortColumn = 'name';
        this.sortDirection = 'asc';
        this.isActive = false;

        this.initElements();
        this.initEventListeners();
        this.loadFiles();
    }

    initElements() {
        this.pathInput = this.element.querySelector('.path-input');
        console.log(`${this.paneId} pathInput element found:`, this.pathInput);
        this.fileList = this.element.querySelector(`#${this.paneId === 'leftPane' ? 'left' : 'right'}FileList`);
        this.loader = this.element.querySelector('.loading-spinner');
        this.itemCount = this.element.querySelector('.item-count');
        this.selectedInfo = this.element.querySelector('.selected-info');
        this.spaceInfo = this.element.querySelector('.space-info span');
    }

    initEventListeners() {
        // Path navigation
        const homeBtn = this.element.querySelector(`#${this.paneId === 'leftPane' ? 'left' : 'right'}HomeBtn`);
        const upBtn = this.element.querySelector(`#${this.paneId === 'leftPane' ? 'left' : 'right'}UpBtn`);
        const goBtn = this.element.querySelector(`#${this.paneId === 'leftPane' ? 'left' : 'right'}GoBtn`);

        if (homeBtn) homeBtn.addEventListener('click', () => this.navigateTo('/'));
        if (upBtn) upBtn.addEventListener('click', () => this.navigateUp());
        if (goBtn) goBtn.addEventListener('click', () => this.navigateTo(this.pathInput.value));

        // Path input
        console.log('Setting up keydown listener for path input:', this.pathInput);
        this.pathInput.addEventListener('keydown', (e) => {
            console.log('Key pressed in path input:', e.key, 'Value:', this.pathInput.value);
            if (e.key === 'Enter') {
                console.log('Enter key detected, navigating to:', this.pathInput.value);
                e.preventDefault();
                this.navigateTo(this.pathInput.value);
            }
        });

        // Sorting
        this.element.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                this.setSorting(column);
            });
        });

        // File selection
        this.fileList.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                this.handleFileClick(row, e);
            }
        });

        this.fileList.addEventListener('dblclick', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                this.handleFileDoubleClick(row);
            }
        });

        // Context menu
        this.fileList.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const row = e.target.closest('tr');
            if (row) {
                this.handleContextMenu(row, e);
            }
        });

        // Drag and drop
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.element.classList.add('drag-over');
        });

        this.element.addEventListener('dragleave', () => {
            this.element.classList.remove('drag-over');
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            this.element.classList.remove('drag-over');
            this.handleDrop(e);
        });

        // Activate pane on click
        this.element.addEventListener('click', () => {
            fileManager.setActivePane(this);
        });
    }

    async loadFiles() {
        this.showLoader(true);
        try {
            console.log('loadFiles: Getting file list for path:', this.currentPath);
            // Get file list
            const response = await this.api.listFiles(this.currentPath);
            console.log('loadFiles: API response received:', response);
            this.files = Array.isArray(response) ? response : response.fiels || [];
            console.log('loadFiles: Processed files array:', this.files);

            // Update disk space from response
            if (response.totalSpace !== undefined && response.freeSpace !== undefined) {
                this.updateDiskSpaceFromValues(response.totalSpace, response.freeSpace);
            }

            // Sort and render
            this.sortFiles();
            this.renderFiles();
            console.log('loadFiles: Files rendered successfully');

            // Update UI
            this.pathInput.value = this.currentPath;
            this.updateItemCount();
        } catch (error) {
            console.error('Failed to load files:', error);
            // Re-throw the error so navigateTo can handle it
            throw error;
        } finally {
            this.showLoader(false);
        }
    }

    getDemoFiles() {
        const demoFiles = [
            { name: '..', type: 'parent', size: '0', modified: '1704412800', isDirectory: true },
            { name: 'Documents', path: '/Documents', size: '4096', modified: '1704412800', isDirectory: true },
            { name: 'Downloads', path: '/Downloads', size: '4096', modified: '1704326400', isDirectory: true },
            { name: 'Pictures', path: '/Pictures', size: '4096', modified: '1704240000', isDirectory: true },
            { name: 'Videos', path: '/Videos', size: '4096', modified: '1704153600', isDirectory: true },
            { name: 'Music', path: '/Music', size: '4096', modified: '1704067200', isDirectory: true },
            { name: 'readme.txt', path: '/readme.txt', size: '2048', modified: '1703980800', isDirectory: false },
            { name: 'document.pdf', path: '/document.pdf', size: '524288', modified: '1703894400', isDirectory: false },
            { name: 'spreadsheet.xlsx', path: '/spreadsheet.xlsx', size: '102400', modified: '1703808000', isDirectory: false },
            { name: 'presentation.pptx', path: '/presentation.pptx', size: '2097152', modified: '1703721600', isDirectory: false },
            { name: 'image.jpg', path: '/image.jpg', size: '1048576', modified: '1703635200', isDirectory: false },
            { name: 'video.mp4', path: '/video.mp4', size: '104857600', modified: '1703548800', isDirectory: false },
        ];

        if (this.currentPath !== '/') {
            return demoFiles;
        } else {
            return demoFiles.slice(1); // Remove parent directory for root
        }
    }

    renderFiles() {
        this.fileList.innerHTML = '';

        // Add parent directory if not at root
        if (this.currentPath !== '/') {
            const parentRow = this.createFileRow({
                name: '..',
                type: 'parent',
                size: 0,
                modified: new Date()
            });
            this.fileList.appendChild(parentRow);
        }

        // Render files
        this.files.forEach(file => {
            const row = this.createFileRow(file);
            this.fileList.appendChild(row);
        });

        // Restore selection
        this.restoreSelection();
    }

    createFileRow(file) {
        const row = document.createElement('tr');
        row.dataset.name = file.name;
        row.dataset.type = file.isDirectory ? 'folder' : 'file';
        row.dataset.path = this.getFilePath(file.name);

        // Convert Unix timestamp to Date if needed
        const modifiedDate = typeof file.modified === 'string' ?
            new Date(parseInt(file.modified) * 1000) :
            new Date(file.modified);

        row.innerHTML = `
            <td class="file-icon">
                <i class="fas fa-${this.getFileIcon(file)}"></i>
            </td>
            <td class="file-name">${this.escapeHtml(file.name)}</td>
            <td class="file-size">${file.isDirectory || file.type === 'parent' ? '' : this.formatSize(parseInt(file.size))}</td>
            <td class="file-modified">${this.formatDate(modifiedDate)}</td>
            <td class="file-type">${this.getFileType(file)}</td>
        `;

        // Make row draggable
        if (file.type !== 'parent' && !file.isParent) {
            row.draggable = true;
            row.addEventListener('dragstart', (e) => this.handleDragStart(e, file));
            row.addEventListener('dragend', () => this.handleDragEnd());
        }

        return row;
    }

    handleFileClick(row, event) {
        const fileName = row.dataset.name;

        if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            if (this.selectedFiles.has(fileName)) {
                this.selectedFiles.delete(fileName);
                row.classList.remove('selected');
            } else {
                this.selectedFiles.add(fileName);
                row.classList.add('selected');
            }
        } else if (event.shiftKey && this.selectedFiles.size > 0) {
            // Range selection
            const rows = Array.from(this.fileList.querySelectorAll('tr'));
            const lastSelected = Array.from(this.selectedFiles).pop();
            const lastIndex = rows.findIndex(r => r.dataset.name === lastSelected);
            const currentIndex = rows.indexOf(row);

            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);

            for (let i = start; i <= end; i++) {
                const r = rows[i];
                if (r.dataset.type !== 'parent') {
                    this.selectedFiles.add(r.dataset.name);
                    r.classList.add('selected');
                }
            }
        } else {
            // Single selection
            this.clearSelection();
            if (row.dataset.type !== 'parent') {
                this.selectedFiles.add(fileName);
                row.classList.add('selected');
            }
        }

        this.updateSelectedInfo();
        fileManager.updateToolbarButtons();
    }

    handleFileDoubleClick(row) {
        const fileName = row.dataset.name;
        const fileType = row.dataset.type;

        if (fileType === 'folder') {
            if (fileName === '..') {
                this.navigateUp();
            } else {
                this.navigateTo(this.getFilePath(fileName));
            }
        }
    }

    handleContextMenu(row, event) {
        if (!row.classList.contains('selected')) {
            this.clearSelection();
            this.selectedFiles.add(row.dataset.name);
            row.classList.add('selected');
        }

        fileManager.showContextMenu(event.clientX, event.clientY);
    }

    handleDragStart(event, file) {
        const selectedPaths = this.getSelectedPaths();
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData('text/plain', JSON.stringify({
            files: selectedPaths,
            source: this.currentPath
        }));

        // Create drag ghost
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = `${selectedPaths.length} item(s)`;
        document.body.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => ghost.remove(), 0);
    }

    handleDragEnd() {
        // Clean up
    }

    handleDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.source !== this.currentPath) {
            fileManager.handleFileDrop(data.files, this.currentPath, event.shiftKey);
        }
    }

    async navigateTo(path) {
        // Normalize path
        const normalizedPath = this.normalizePath(path);
        console.log('Navigating to:', normalizedPath);

        // Store previous path for error recovery
        const previousPath = this.currentPath;
        const previousPathInput = this.pathInput.value;

        try {
            this.currentPath = normalizedPath;
            this.pathInput.value = normalizedPath;
            this.clearSelection();
            console.log('Calling loadFiles for path:', this.currentPath);
            await this.loadFiles();
            console.log('Navigation successful to:', this.currentPath);
        } catch (error) {
            console.error('Navigation failed:', error);
            // Restore previous path on error
            this.currentPath = previousPath;
            this.pathInput.value = previousPathInput;
            fileManager.showStatus(`Cannot navigate to "${normalizedPath}": ${error.message}`, 'error');
        }
    }

    normalizePath(path) {
        if (!path) return '/';

        // Remove extra spaces and normalize separators
        path = path.trim().replace(/\\/g, '/');

        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        // Remove double slashes
        path = path.replace(/\/+/g, '/');

        // Remove trailing slash unless it's root
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        return path;
    }

    navigateUp() {
        if (this.currentPath !== '/') {
            const parts = this.currentPath.split('/').filter(p => p);
            parts.pop();
            const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
            this.navigateTo(parentPath);
        }
    }

    setSorting(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Update header styles
        this.element.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            if (header.dataset.sort === column) {
                header.classList.add(`sorted-${this.sortDirection}`);
            }
        });

        this.sortFiles();
        this.renderFiles();
    }

    sortFiles() {
        this.files.sort((a, b) => {
            // Folders first
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;

            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            if (this.sortColumn === 'size') {
                aVal = a.isDirectory ? -1 : parseInt(aVal || 0);
                bVal = b.isDirectory ? -1 : parseInt(bVal || 0);
            } else if (this.sortColumn === 'modified') {
                aVal = typeof a.modified === 'string' ? parseInt(a.modified) : a.modified;
                bVal = typeof b.modified === 'string' ? parseInt(b.modified) : b.modified;
            }

            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    clearSelection() {
        this.selectedFiles.clear();
        this.fileList.querySelectorAll('.selected').forEach(row => {
            row.classList.remove('selected');
        });
        this.updateSelectedInfo();
    }

    restoreSelection() {
        this.fileList.querySelectorAll('tr').forEach(row => {
            if (this.selectedFiles.has(row.dataset.name)) {
                row.classList.add('selected');
            }
        });
    }

    getSelectedPaths() {
        return Array.from(this.selectedFiles).map(name => this.getFilePath(name));
    }

    getFilePath(fileName) {
        if (this.currentPath === '/') {
            return `/${fileName}`;
        }
        return `${this.currentPath}/${fileName}`;
    }

    updateItemCount() {
        const folderCount = this.files.filter(f => f.isDirectory).length;
        const fileCount = this.files.filter(f => !f.isDirectory).length;
        this.itemCount.textContent = `${folderCount} folders, ${fileCount} files`;
    }

    updateSelectedInfo() {
        const count = this.selectedFiles.size;
        if (count > 0) {
            let totalSize = 0;
            this.selectedFiles.forEach(name => {
                const file = this.files.find(f => f.name === name);
                if (file && !file.isDirectory) {
                    totalSize += parseInt(file.size || 0);
                }
            });
            this.selectedInfo.textContent = `${count} selected (${this.formatSize(totalSize)})`;
        } else {
            this.selectedInfo.textContent = '';
        }
    }

    updateDiskSpaceFromValues(totalSpace, freeSpace) {
        const total = this.formatBytes(totalSpace);
        const free = this.formatBytes(freeSpace);
        this.spaceInfo.textContent = `${free} free of ${total}`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    showLoader(show) {
        this.loader.classList.toggle('show', show);
    }

    showError(message) {
        fileManager.showStatus(message, 'error');
    }

    setActive(active) {
        this.isActive = active;
        this.element.classList.toggle('active', active);
    }

    refresh() {
        this.loadFiles();
    }

    // Utility functions
    getFileIcon(file) {
        if (file.type === 'parent') return 'level-up-alt';
        if (file.isDirectory) return 'folder folder-icon';

        const ext = file.name.split('.').pop().toLowerCase();
        const iconMap = {
            pdf: 'file-pdf',
            doc: 'file-word', docx: 'file-word',
            xls: 'file-excel', xlsx: 'file-excel',
            ppt: 'file-powerpoint', pptx: 'file-powerpoint',
            jpg: 'file-image', jpeg: 'file-image', png: 'file-image', gif: 'file-image',
            mp3: 'file-audio', wav: 'file-audio',
            mp4: 'file-video', avi: 'file-video',
            zip: 'file-archive', rar: 'file-archive', '7z': 'file-archive',
            txt: 'file-alt', md: 'file-alt',
            js: 'file-code', html: 'file-code', css: 'file-code', py: 'file-code',
        };
        return iconMap[ext] || 'file file-icon-default';
    }

    getFileType(file) {
        if (file.isDirectory) return 'Folder';
        if (file.type === 'parent') return '';

        const ext = file.name.split('.').pop().toUpperCase();
        return `${ext} File`;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 1) {
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Main File Manager Class
class FileManager {
    constructor() {
        this.api = new FileManagerAPI();
        this.leftPane = null;
        this.rightPane = null;
        this.activePane = null;
        this.clipboard = {
            operation: null, // 'copy' or 'cut'
            files: []
        };

        this.init();
    }

    init() {
        // Initialize panes
        this.leftPane = new FilePane('leftPane', this.api);
        this.rightPane = new FilePane('rightPane', this.api);

        // Set initial active pane
        this.setActivePane(this.leftPane);

        // Initialize toolbar buttons
        this.initToolbar();

        // Initialize modals
        this.initModals();

        // Initialize keyboard shortcuts
        this.initKeyboardShortcuts();

        // Initialize pane separator
        this.initPaneSeparator();

        // Hide context menu on click outside
        document.addEventListener('click', () => {
            document.getElementById('contextMenu').classList.remove('show');
        });
    }

    initToolbar() {
        // Copy button
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copySelected();
        });

        // Cut button
        document.getElementById('cutBtn').addEventListener('click', () => {
            this.cutSelected();
        });

        // Paste button
        document.getElementById('pasteBtn').addEventListener('click', () => {
            this.pasteFiles();
        });

        // New folder button
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            this.showNewFolderModal();
        });

        // Delete button
        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteSelected();
        });

        // Rename button
        document.getElementById('renameBtn').addEventListener('click', () => {
            this.renameSelected();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshAll();
        });
    }

    initModals() {
        // Close buttons
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.closest('button').dataset.close;
                this.closeModal(modalId);
            });
        });

        // New folder modal
        document.getElementById('createFolderBtn').addEventListener('click', () => {
            this.createFolder();
        });

        document.getElementById('newFolderName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createFolder();
            }
        });

        // Rename modal
        document.getElementById('confirmRenameBtn').addEventListener('click', () => {
            this.confirmRename();
        });

        document.getElementById('renameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmRename();
            }
        });

        // Delete modal
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDelete();
        });

        // Context menu
        document.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleContextAction(action);
            });
        });
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't interfere with copy/paste in input fields
            const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

            // Ctrl/Cmd + C: Copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !isInputField) {
                e.preventDefault();
                this.copySelected();
            }

            // Ctrl/Cmd + X: Cut
            if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !isInputField) {
                e.preventDefault();
                this.cutSelected();
            }

            // Ctrl/Cmd + V: Paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInputField) {
                e.preventDefault();
                this.pasteFiles();
            }

            // Delete key
            if (e.key === 'Delete' && !isInputField) {
                e.preventDefault();
                this.deleteSelected();
            }

            // F2: Rename
            if (e.key === 'F2') {
                e.preventDefault();
                this.renameSelected();
            }

            // F5: Refresh
            if (e.key === 'F5') {
                e.preventDefault();
                this.refreshAll();
            }

            // Tab: Switch panes
            if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                this.switchPane();
            }

            // Enter: Open folder
            if (e.key === 'Enter') {
                e.preventDefault();
                this.openSelected();
            }
        });
    }

    initPaneSeparator() {
        const separator = document.getElementById('paneSeparator');
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;

        separator.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startLeftWidth = this.leftPane.element.offsetWidth;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const diff = e.clientX - startX;
            const newLeftWidth = startLeftWidth + diff;
            const containerWidth = document.querySelector('.dual-pane-container').offsetWidth;

            // Set minimum and maximum widths
            if (newLeftWidth >= 300 && newLeftWidth <= containerWidth - 300) {
                this.leftPane.element.style.flex = `0 0 ${newLeftWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
        });
    }

    setActivePane(pane) {
        if (this.activePane) {
            this.activePane.setActive(false);
        }
        this.activePane = pane;
        this.activePane.setActive(true);
        this.updateToolbarButtons();
    }

    switchPane() {
        const newPane = this.activePane === this.leftPane ? this.rightPane : this.leftPane;
        this.setActivePane(newPane);
    }

    updateToolbarButtons() {
        const hasSelection = this.activePane && this.activePane.selectedFiles.size > 0;
        const hasClipboard = this.clipboard.files.length > 0;

        document.getElementById('copyBtn').disabled = !hasSelection;
        document.getElementById('cutBtn').disabled = !hasSelection;
        document.getElementById('pasteBtn').disabled = !hasClipboard;
        document.getElementById('deleteBtn').disabled = !hasSelection;
        document.getElementById('renameBtn').disabled = !hasSelection || this.activePane.selectedFiles.size !== 1;
    }

    copySelected() {
        if (!this.activePane || this.activePane.selectedFiles.size === 0) return;

        this.clipboard = {
            operation: 'copy',
            files: this.activePane.getSelectedPaths()
        };

        this.updateClipboardStatus();
        this.showStatus(`${this.clipboard.files.length} item(s) copied to clipboard`);
        this.updateToolbarButtons();
    }

    cutSelected() {
        if (!this.activePane || this.activePane.selectedFiles.size === 0) return;

        this.clipboard = {
            operation: 'cut',
            files: this.activePane.getSelectedPaths()
        };

        // Mark files as cut
        this.activePane.fileList.querySelectorAll('.selected').forEach(row => {
            row.classList.add('cut');
        });

        this.updateClipboardStatus();
        this.showStatus(`${this.clipboard.files.length} item(s) cut to clipboard`);
        this.updateToolbarButtons();
    }

    async pasteFiles() {
        if (!this.activePane || this.clipboard.files.length === 0) return;

        const destination = this.activePane.currentPath;
        const destDisplay = destination === '/' ? 'root' : destination;
        this.showProgressModal(`Pasting files to ${destDisplay}...`);

        try {
            if (this.clipboard.operation === 'copy') {
                await this.api.copyFiles(this.clipboard.files, destination);
                this.showStatus(`${this.clipboard.files.length} item(s) copied to ${destDisplay}`);
            } else {
                await this.api.moveFiles(this.clipboard.files, destination);
                this.showStatus(`${this.clipboard.files.length} item(s) moved to ${destDisplay}`);
                this.clipboard = { operation: null, files: [] };
                this.updateClipboardStatus();
            }

            this.refreshAll();
        } catch (error) {
            const errorMsg = error.message || 'Paste operation failed';
            this.showStatus(`Paste failed: ${errorMsg}`, 'error');
            console.error('Paste error:', error);
        } finally {
            this.hideProgressModal();
            this.updateToolbarButtons();
        }
    }

    async deleteSelected() {
        if (!this.activePane || this.activePane.selectedFiles.size === 0) return;

        const paths = this.activePane.getSelectedPaths();
        const count = paths.length;

        let message;
        if (count === 1) {
            message = `Are you sure you want to delete:\n\n${paths[0]}`;
        } else if (count <= 5) {
            // Show all paths for small selections
            message = `Are you sure you want to delete the following ${count} items:\n\n${paths.join('\n')}`;
        } else {
            // Show first few paths and count for large selections
            const displayPaths = paths.slice(0, 3);
            message = `Are you sure you want to delete the following ${count} items:\n\n${displayPaths.join('\n')}\n... and ${count - 3} more items`;
        }

        document.getElementById('deleteMessage').textContent = message;
        this.showModal('deleteModal');
    }

    async confirmDelete() {
        const paths = this.activePane.getSelectedPaths();
        this.closeModal('deleteModal');
        this.showProgressModal('Deleting files...');

        try {
            await this.api.deleteFiles(paths);
            this.showStatus(`${paths.length} item(s) deleted successfully`);
            this.activePane.clearSelection();
            this.refreshAll();
        } catch (error) {
            const errorMsg = error.message || 'Delete operation failed';
            this.showStatus(`Delete failed: ${errorMsg}`, 'error');
            console.error('Delete error:', error);
        } finally {
            this.hideProgressModal();
            this.updateToolbarButtons();
        }
    }

    renameSelected() {
        if (!this.activePane || this.activePane.selectedFiles.size !== 1) return;

        const fileName = Array.from(this.activePane.selectedFiles)[0];
        document.getElementById('renameInput').value = fileName;
        this.showModal('renameModal');

        setTimeout(() => {
            const input = document.getElementById('renameInput');
            input.select();
            input.focus();
        }, 100);
    }

    async confirmRename() {
        const oldName = Array.from(this.activePane.selectedFiles)[0];
        const newName = document.getElementById('renameInput').value;

        if (!newName || newName === oldName) {
            this.closeModal('renameModal');
            return;
        }

        const oldPath = this.activePane.getFilePath(oldName);
        this.closeModal('renameModal');

        try {
            await this.api.renameFile(oldPath, newName);
            this.showStatus('File renamed successfully');
            this.activePane.clearSelection();
            this.refreshAll();
        } catch (error) {
            const errorMsg = error.message || 'Rename operation failed';
            this.showStatus(`Rename failed: ${errorMsg}`, 'error');
            console.error('Rename error:', error);
        }
    }

    showNewFolderModal() {
        if (!this.activePane) return;

        document.getElementById('newFolderName').value = 'New Folder';
        this.showModal('newFolderModal');

        setTimeout(() => {
            const input = document.getElementById('newFolderName');
            input.select();
            input.focus();
        }, 100);
    }

    async createFolder() {
        const name = document.getElementById('newFolderName').value;
        if (!name) return;

        this.closeModal('newFolderModal');
        this.showProgressModal('Creating folder...');

        try {
            const currentPath = this.activePane.currentPath;
            const pathParts = currentPath === '/' ? [] : currentPath.split('/').filter(p => p);
            const dirPath = pathParts.length > 0 ? '/' + pathParts.join('/') : '';

            await this.api.request('/files/0/Actions', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'newFolder',
                    source: {
                        path: dirPath,
                        name: name
                    }
                })
            });
            this.showStatus('Folder created successfully');
            this.activePane.refresh();
        } catch (error) {
            const errorMsg = error.message || 'Failed to create folder';
            this.showStatus(`Create folder failed: ${errorMsg}`, 'error');
            console.error('Create folder error:', error);
        } finally {
            this.hideProgressModal();
        }
    }

    openSelected() {
        if (!this.activePane || this.activePane.selectedFiles.size !== 1) return;

        const fileName = Array.from(this.activePane.selectedFiles)[0];
        const file = this.activePane.files.find(f => f.name === fileName);

        if (file && file.isDirectory) {
            if (fileName === '..') {
                this.activePane.navigateUp();
            } else {
                this.activePane.navigateTo(this.activePane.getFilePath(fileName));
            }
        }
    }

    refreshAll() {
        this.leftPane.refresh();
        this.rightPane.refresh();
        this.showStatus('Refreshed');
    }

    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('show');

        // Disable paste if no clipboard
        const pasteItem = menu.querySelector('[data-action="paste"]');
        if (pasteItem) {
            pasteItem.style.opacity = this.clipboard.files.length > 0 ? '1' : '0.5';
            pasteItem.style.pointerEvents = this.clipboard.files.length > 0 ? '' : 'none';
        }
    }

    handleContextAction(action) {
        document.getElementById('contextMenu').classList.remove('show');

        switch (action) {
            case 'open':
                this.openSelected();
                break;
            case 'copy':
                this.copySelected();
                break;
            case 'cut':
                this.cutSelected();
                break;
            case 'paste':
                this.pasteFiles();
                break;
            case 'rename':
                this.renameSelected();
                break;
            case 'delete':
                this.deleteSelected();
                break;
            case 'properties':
                this.showProperties();
                break;
        }
    }

    async handleFileDrop(files, destination, move = false) {
        this.showProgressModal(move ? 'Moving files...' : 'Copying files...');

        try {
            if (move) {
                await this.api.moveFiles(files, destination);
                this.showStatus(`${files.length} item(s) moved successfully`);
            } else {
                await this.api.copyFiles(files, destination);
                this.showStatus(`${files.length} item(s) copied successfully`);
            }

            this.refreshAll();
        } catch (error) {
            const errorMsg = error.message || 'Operation failed';
            this.showStatus(`Operation failed: ${errorMsg}`, 'error');
            console.error('Drop error:', error);
        } finally {
            this.hideProgressModal();
        }
    }

    showProperties() {
        // TODO: Implement file properties dialog
        this.showStatus('Properties not implemented yet');
    }

    updateClipboardStatus() {
        const status = document.getElementById('clipboardStatus');
        if (this.clipboard.files.length > 0) {
            status.textContent = `Clipboard: ${this.clipboard.files.length} item(s) (${this.clipboard.operation})`;
        } else {
            status.textContent = 'Clipboard: Empty';
        }
    }

    showStatus(message, type = 'info') {
        console.log('showStatus called with message:', message, 'type:', type);

        if (type === 'error') {
            // Show error in modal popup
            document.getElementById('errorMessage').textContent = message;
            this.showModal('errorModal');
        } else {
            // Show info messages in status bar
            const statusMessage = document.getElementById('statusMessage');
            console.log('statusMessage element:', statusMessage);
            statusMessage.textContent = message;
            statusMessage.className = type;
            console.log('Status updated to:', statusMessage.textContent, 'class:', statusMessage.className);
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showProgressModal(title) {
        document.getElementById('progressTitle').textContent = title;
        document.getElementById('progressFill').style.width = '50%';
        this.showModal('progressModal');
    }

    hideProgressModal() {
        this.closeModal('progressModal');
    }
}

// Initialize file manager when DOM is ready
let fileManager;
document.addEventListener('DOMContentLoaded', () => {
    fileManager = new FileManager();
});