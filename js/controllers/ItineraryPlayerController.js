/**
 * ItineraryPlayerController 类 - 负责行程播放逻辑
 */
class ItineraryPlayerController {
  /**
   * 构造函数
   * @param {Object} mapController - 地图控制器
   */
  constructor(mapController) {
    this.mapController = mapController;
    this.currentItinerary = null;
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.timeoutId = null;
    this.startTime = null;
    this.pausedAt = null;
    
    // 回调函数
    this.onProgress = null;
    this.onComplete = null;
    this.onStop = null;
  }

  /**
   * 加载行程但不开始播放（设置到第一个点并暂停）
   * @param {Object} itinerary - 行程对象
   */
  load(itinerary) {
    if (this.isPlaying) {
      this.stop();
    }

    this.currentItinerary = itinerary;
    this.currentIndex = 0;
    this.isPlaying = true;
    this.isPaused = true;
    this.startTime = null;

    console.log(`Loaded itinerary: ${itinerary.name}, ${itinerary.waypointCount} waypoints (paused)`);
    
    // 设置到第一个点但不开始播放
    const coords = itinerary.coordinates[0];
    const lng = coords[0];
    const lat = coords[1];
    const accuracy = itinerary.accuracies ? itinerary.accuracies[0] : 10;

    this.mapController.marker.setLatLng([lat, lng]);
    this.mapController.map.setView([lat, lng], this.mapController.map.getZoom());
    this.mapController.updateGeolocation(lat, lng, accuracy);

    // 触发进度回调
    if (this.onProgress) {
      this.onProgress({
        currentIndex: 0,
        totalWaypoints: itinerary.coordinates.length,
        currentCoords: { lat, lng },
        progress: 1 / itinerary.coordinates.length
      });
    }
  }

  /**
   * 播放行程
   * @param {Object} itinerary - 行程对象
   */
  play(itinerary) {
    if (this.isPlaying) {
      this.stop();
    }

    this.currentItinerary = itinerary;
    this.currentIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = Date.now();

    console.log(`Starting itinerary playback: ${itinerary.name}, ${itinerary.waypointCount} waypoints`);
    
    // 开始播放第一个点
    this._playCurrentWaypoint();
  }

  /**
   * 暂停播放
   */
  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausedAt = Date.now();
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    console.log('Itinerary playback paused');
  }

  /**
   * 恢复播放
   */
  resume() {
    if (!this.isPlaying || !this.isPaused) return;

    this.isPaused = false;
    
    const itinerary = this.currentItinerary;
    const nextIndex = this.currentIndex + 1;
    
    // 如果startTime为null，说明是从load()状态开始，直接开始播放
    if (!this.startTime) {
      this.startTime = Date.now();
      
      if (nextIndex < itinerary.coordinates.length) {
        const currentTimestamp = itinerary.timestamps[this.currentIndex];
        const nextTimestamp = itinerary.timestamps[nextIndex];
        const delay = nextTimestamp - currentTimestamp;
        
        this.timeoutId = setTimeout(() => {
          this.currentIndex++;
          this._playCurrentWaypoint();
        }, delay);
      }
      
      console.log('Itinerary playback started');
      return;
    }
    
    // 计算剩余等待时间
    if (nextIndex < itinerary.coordinates.length) {
      const currentTimestamp = itinerary.timestamps[this.currentIndex];
      const nextTimestamp = itinerary.timestamps[nextIndex];
      const totalDelay = nextTimestamp - currentTimestamp;
      
      // 计算已经等待的时间
      const elapsedSincePause = this.pausedAt - this.startTime;
      const remainingDelay = Math.max(0, totalDelay - elapsedSincePause);
      
      this.timeoutId = setTimeout(() => {
        this.currentIndex++;
        this._playCurrentWaypoint();
      }, remainingDelay);
    }

    console.log('Itinerary playback resumed');
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentItinerary = null;
    this.currentIndex = 0;
    this.startTime = null;
    this.pausedAt = null;

    if (wasPlaying && this.onStop) {
      this.onStop();
    }

    console.log('Itinerary playback stopped');
  }

  /**
   * 跳转到指定位置
   * @param {number} index - 目标索引
   */
  jumpTo(index) {
    if (!this.currentItinerary) return;
    
    if (index < 0 || index >= this.currentItinerary.coordinates.length) return;

    // 清除当前定时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.currentIndex = index;
    this._playCurrentWaypoint();
  }

  /**
   * 播放当前路点
   * @private
   */
  _playCurrentWaypoint() {
    const itinerary = this.currentItinerary;
    if (!itinerary || !this.isPlaying) return;

    const coords = itinerary.coordinates[this.currentIndex];
    // GeoJSON坐标是 [lng, lat]，需要转换为 [lat, lng]
    const lng = coords[0];
    const lat = coords[1];
    const accuracy = itinerary.accuracies ? itinerary.accuracies[this.currentIndex] : 10;

    // 更新地图位置
    this.mapController.marker.setLatLng([lat, lng]);
    this.mapController.updateGeolocation(lat, lng, accuracy);

    // 触发进度回调
    if (this.onProgress) {
      this.onProgress({
        currentIndex: this.currentIndex,
        totalWaypoints: itinerary.coordinates.length,
        currentCoords: { lat, lng },
        progress: (this.currentIndex + 1) / itinerary.coordinates.length
      });
    }

    // 检查是否到达终点
    if (this.currentIndex >= itinerary.coordinates.length - 1) {
      this._onPlaybackComplete();
      return;
    }

    // 计算到下一个点的延迟时间
    const currentTimestamp = itinerary.timestamps[this.currentIndex];
    const nextTimestamp = itinerary.timestamps[this.currentIndex + 1];
    const delay = nextTimestamp - currentTimestamp;

    // 设置定时器移动到下一个点
    this.timeoutId = setTimeout(() => {
      this.currentIndex++;
      this._playCurrentWaypoint();
    }, delay);
  }

  /**
   * 播放完成处理
   * @private
   */
  _onPlaybackComplete() {
    console.log('Itinerary playback complete');
    
    this.isPlaying = false;
    this.timeoutId = null;

    if (this.onComplete) {
      this.onComplete();
    }
  }

  /**
   * 获取当前状态
   * @returns {Object}
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      totalWaypoints: this.currentItinerary?.coordinates.length || 0,
      itineraryName: this.currentItinerary?.name || null
    };
  }
}

export default ItineraryPlayerController;
