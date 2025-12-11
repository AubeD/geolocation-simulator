/**
 * ItineraryUIController 类 - 负责行程管理相关的UI功能
 */
class ItineraryUIController {
  /**
   * 构造函数
   * @param {Object} itineraryManager - 行程管理器
   * @param {Object} itineraryPlayerController - 行程播放控制器
   * @param {Object} modalController - 模态框控制器
   */
  constructor(itineraryManager, itineraryPlayerController, modalController) {
    this.itineraryManager = itineraryManager;
    this.playerController = itineraryPlayerController;
    this.modalController = modalController;

    // 模态框元素
    this.manageItinerariesModal = document.getElementById('manageItinerariesModal');
    this.itinerariesContainer = document.getElementById('itinerariesContainer');
    this.closeItinerariesModalBtn = document.getElementById('closeItinerariesModal');
    this.importItineraryBtn = document.getElementById('importItineraryButton');
    this.importItineraryInput = document.getElementById('importItineraryInput');

    // 工具栏按钮
    this.manageItinerariesBtn = document.getElementById('manageItineraries');

    // 播放控制元素
    this.playbackControls = document.getElementById('playbackControls');
    this.playbackItineraryName = document.getElementById('playbackItineraryName');
    this.playbackProgress = document.getElementById('playbackProgress');
    this.playbackProgressBar = document.getElementById('playbackProgressBar');
    this.playbackStatus = document.getElementById('playbackStatus');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.stopPlaybackBtn = document.getElementById('stopPlaybackBtn');

    // 初始化事件监听器
    this._setupEventListeners();
    
    // 注册模态框
    this._registerModals();

    // 设置播放器回调
    this._setupPlayerCallbacks();
  }

  /**
   * 注册模态框
   * @private
   */
  _registerModals() {
    if (this.manageItinerariesModal) {
      this.modalController.registerModal('manageItinerariesModal', this.manageItinerariesModal, () => {
        this.manageItinerariesModal.style.display = 'none';
      });
    }
  }

  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    // 打开行程管理模态框
    if (this.manageItinerariesBtn) {
      this.manageItinerariesBtn.addEventListener('click', () => {
        this.openItineraryManager();
      });
    }

    // 关闭模态框
    if (this.closeItinerariesModalBtn) {
      this.closeItinerariesModalBtn.addEventListener('click', () => {
        this.modalController.closeModal('manageItinerariesModal');
      });
    }

    // 导入按钮
    if (this.importItineraryBtn) {
      this.importItineraryBtn.addEventListener('click', () => {
        this.importItineraryInput.click();
      });
    }

    // 导入文件选择
    if (this.importItineraryInput) {
      this.importItineraryInput.addEventListener('change', (event) => {
        this._handleImport(event);
      });
    }

    // 播放/暂停按钮
    if (this.playPauseBtn) {
      this.playPauseBtn.addEventListener('click', () => {
        this._togglePlayPause();
      });
    }

    // 停止按钮
    if (this.stopPlaybackBtn) {
      this.stopPlaybackBtn.addEventListener('click', () => {
        this.playerController.stop();
      });
    }

    // 进度条点击跳转
    if (this.playbackProgress) {
      this.playbackProgress.addEventListener('click', (e) => {
        this._handleProgressClick(e);
      });
    }
  }

  /**
   * 设置播放器回调
   * @private
   */
  _setupPlayerCallbacks() {
    this.playerController.onProgress = (data) => {
      this._updatePlaybackUI(data);
    };

    this.playerController.onComplete = () => {
      this._onPlaybackComplete();
    };

    this.playerController.onStop = () => {
      this._hidePlaybackControls();
    };
  }

  /**
   * 打开行程管理器
   */
  openItineraryManager() {
    this.modalController.openModal('manageItinerariesModal');
    this.renderItineraries();
  }

  /**
   * 渲染行程列表
   */
  renderItineraries() {
    const container = this.itinerariesContainer;
    if (!container) return;

    container.innerHTML = '';
    const itineraries = this.itineraryManager.getAll();

    if (itineraries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No saved itineraries</p>
          <p><small>Import a GeoJSON file with LineString coordinates and timestamps</small></p>
        </div>
      `;
      return;
    }

    itineraries.forEach((itinerary, index) => {
      const card = this._createItineraryCard(itinerary, index);
      container.appendChild(card);
    });
  }

  /**
   * 创建行程卡片
   * @private
   * @param {Object} itinerary - 行程对象
   * @param {number} index - 索引
   * @returns {HTMLElement}
   */
  _createItineraryCard(itinerary, index) {
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.dataset.id = itinerary.id;

    const duration = this.itineraryManager.formatDuration(itinerary.duration);
    const isCurrentlyPlaying = this.playerController.currentItinerary?.id === itinerary.id && this.playerController.isPlaying;

    card.innerHTML = `
      <div class="grid-card-buttons">
        <div class="action-group">
          <button class="play-btn ${isCurrentlyPlaying ? 'playing' : ''}" title="${isCurrentlyPlaying ? 'Playing...' : 'Play itinerary'}">
            <i class="fas ${isCurrentlyPlaying ? 'fa-spinner fa-spin' : 'fa-play'}"></i>
          </button>
          <button class="delete-btn" title="Delete itinerary"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
      <div class="grid-card-content itinerary-card-content">
        <div class="itinerary-name" contenteditable="false">${itinerary.name}</div>
        <div class="itinerary-info">
          <span><i class="fas fa-map-marker-alt"></i> ${itinerary.waypointCount} points</span>
          <span><i class="fas fa-clock"></i> ${duration}</span>
        </div>
      </div>
    `;

    // 绑定事件
    const playBtn = card.querySelector('.play-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    const nameEl = card.querySelector('.itinerary-name');

    playBtn.addEventListener('click', () => {
      if (isCurrentlyPlaying) {
        this.playerController.stop();
      } else {
        this._playItinerary(itinerary);
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this itinerary?')) {
        this.itineraryManager.delete(itinerary.id);
        this.renderItineraries();
      }
    });

    // 双击编辑名称
    nameEl.addEventListener('dblclick', () => {
      nameEl.contentEditable = 'true';
      nameEl.focus();
      // 选中全部文本
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim();
      if (newName && newName !== itinerary.name) {
        this.itineraryManager.update(itinerary.id, { name: newName });
      } else {
        nameEl.textContent = itinerary.name;
      }
    });

    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
      if (e.key === 'Escape') {
        nameEl.textContent = itinerary.name;
        nameEl.blur();
      }
    });

    return card;
  }

  /**
   * 加载行程（设置到第一个点但不自动播放）
   * @private
   * @param {Object} itinerary
   */
  _playItinerary(itinerary) {
    // 关闭模态框
    this.modalController.closeModal('manageItinerariesModal');

    // 加载行程（设置到第一个点并暂停）
    this.playerController.load(itinerary);

    // 显示播放控制（显示play图标因为是暂停状态）
    this._showPlaybackControls(itinerary, true);
  }

  /**
   * 显示播放控制
   * @private
   * @param {Object} itinerary
   * @param {boolean} startPaused - 是否以暂停状态开始
   */
  _showPlaybackControls(itinerary, startPaused = false) {
    if (!this.playbackControls) return;

    this.playbackControls.classList.add('visible');
    this.playbackItineraryName.textContent = itinerary.name;
    this.playbackStatus.textContent = `1 / ${itinerary.waypointCount}`;
    this.playbackProgressBar.style.width = '0%';
    this.playPauseBtn.innerHTML = startPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
  }

  /**
   * 隐藏播放控制
   * @private
   */
  _hidePlaybackControls() {
    if (!this.playbackControls) return;

    this.playbackControls.classList.remove('visible');
    
    // 刷新列表以更新播放状态
    if (this.manageItinerariesModal.style.display !== 'none') {
      this.renderItineraries();
    }
  }

  /**
   * 更新播放UI
   * @private
   * @param {Object} data - 进度数据
   */
  _updatePlaybackUI(data) {
    if (!this.playbackControls) return;

    this.playbackStatus.textContent = `${data.currentIndex + 1} / ${data.totalWaypoints}`;
    this.playbackProgressBar.style.width = `${data.progress * 100}%`;
  }

  /**
   * 播放完成处理
   * @private
   */
  _onPlaybackComplete() {
    if (this.playPauseBtn) {
      this.playPauseBtn.innerHTML = '<i class="fas fa-redo"></i>';
    }
    
    // 3秒后隐藏控制
    setTimeout(() => {
      if (!this.playerController.isPlaying) {
        this._hidePlaybackControls();
      }
    }, 3000);
  }

  /**
   * 切换播放/暂停
   * @private
   */
  _togglePlayPause() {
    const status = this.playerController.getStatus();

    if (!status.isPlaying && this.playerController.currentItinerary) {
      // 重新播放
      this.playerController.play(this.playerController.currentItinerary);
      this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else if (status.isPaused) {
      this.playerController.resume();
      this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      this.playerController.pause();
      this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }

  /**
   * 处理进度条点击
   * @private
   * @param {Event} e
   */
  _handleProgressClick(e) {
    const status = this.playerController.getStatus();
    if (!status.isPlaying && !status.isPaused) return;

    const rect = this.playbackProgress.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = clickX / rect.width;
    const targetIndex = Math.floor(progress * status.totalWaypoints);

    this.playerController.jumpTo(targetIndex);
  }

  /**
   * 处理导入
   * @private
   * @param {Event} event
   */
  _handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && !file.name.endsWith('.geojson')) {
      alert('Please select a JSON or GeoJSON file');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = this.itineraryManager.importFromGeoJSON(e.target.result);
      if (result) {
        this.renderItineraries();
        alert(`Itinerary imported: ${result.waypointCount} waypoints`);
      } else {
        alert('Failed to import itinerary. Please check the file format.');
      }
      event.target.value = '';
    };

    reader.onerror = () => {
      alert('Failed to read file');
      event.target.value = '';
    };

    reader.readAsText(file);
  }
}

export default ItineraryUIController;
