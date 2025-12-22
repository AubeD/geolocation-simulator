/**
 * ItineraryManager 类 - 负责行程的保存、加载、导入导出等功能
 */
class ItineraryManager {
  constructor() {
    this.savedItineraries = [];
    
    // 加载已保存的行程
    this.loadSavedItineraries();
  }

  /**
   * 加载保存的行程
   */
  loadSavedItineraries() {
    try {
      const savedItineraries = localStorage.getItem('_savedItineraries');
      if (savedItineraries) {
        this.savedItineraries = JSON.parse(savedItineraries);
      }
    } catch (error) {
      console.error('Failed to load saved itineraries:', error);
      this.savedItineraries = [];
    }
  }
  
  /**
   * 将行程数据保存到存储中
   * @private
   * @param {string} message - 日志消息
   */
  _saveToStorage(message = 'Itineraries updated') {
    try {
      localStorage.setItem('_savedItineraries', JSON.stringify(this.savedItineraries));
      console.log(message);
    } catch (error) {
      console.error('Failed to save itineraries:', error);
    }
  }

  /**
   * 生成唯一ID
   * @private
   * @returns {string}
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 从GeoJSON导入行程
   * @param {string} jsonData - GeoJSON字符串
   * @returns {Object|null} - 导入的行程对象，失败返回null
   */
  importFromGeoJSON(jsonData) {
    try {
      const geoJson = JSON.parse(jsonData);
      
      // 验证GeoJSON结构
      if (geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
        console.error('Invalid GeoJSON: must be a FeatureCollection');
        return null;
      }

      const feature = geoJson.features[0];
      if (!feature || feature.type !== 'Feature') {
        console.error('Invalid GeoJSON: no valid Feature found');
        return null;
      }

      if (!feature.geometry || feature.geometry.type !== 'LineString') {
        console.error('Invalid GeoJSON: geometry must be LineString');
        return null;
      }

      const coordinates = feature.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        console.error('Invalid GeoJSON: coordinates must have at least 2 points');
        return null;
      }

      const properties = feature.properties || {};
      const timestamps = properties.timestamps;
      const accuracies = properties.accuracies;
      
      if (!Array.isArray(timestamps) || timestamps.length !== coordinates.length) {
        console.error('Invalid GeoJSON: timestamps must match coordinates length');
        return null;
      }

      // Validate accuracies if present
      if (accuracies && (!Array.isArray(accuracies) || accuracies.length !== coordinates.length)) {
        console.error('Invalid GeoJSON: accuracies must match coordinates length');
        return null;
      }

      // 创建行程对象
      const itinerary = {
        id: this._generateId(),
        name: `Itinerary ${this.savedItineraries.length + 1}`,
        coordinates: coordinates,
        timestamps: timestamps,
        accuracies: accuracies || null,
        config: properties.config || {},
        createdAt: new Date().toISOString(),
        waypointCount: coordinates.length,
        duration: timestamps.at(-1) - timestamps[0]
      };

      // 添加到列表开头
      this.savedItineraries.unshift(itinerary);
      this._saveToStorage('Itinerary imported');

      return itinerary;
    } catch (error) {
      console.error('Error importing GeoJSON:', error);
      return null;
    }
  }

  /**
   * 导出行程为GeoJSON
   * @param {string} id - 行程ID
   * @returns {string|null} - GeoJSON字符串，失败返回null
   */
  exportToGeoJSON(id) {
    const itinerary = this.getById(id);
    if (!itinerary) return null;

    const geoJson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: itinerary.coordinates
        },
        properties: {
          config: itinerary.config,
          timestamps: itinerary.timestamps,
          ...(itinerary.accuracies && { accuracies: itinerary.accuracies })
        }
      }]
    };

    return JSON.stringify(geoJson, null, 2);
  }

  /**
   * 获取所有行程
   * @returns {Array}
   */
  getAll() {
    return this.savedItineraries;
  }

  /**
   * 根据ID获取行程
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    return this.savedItineraries.find(it => it.id === id) || null;
  }

  /**
   * 根据索引获取行程
   * @param {number} index
   * @returns {Object|null}
   */
  getByIndex(index) {
    if (index >= 0 && index < this.savedItineraries.length) {
      return this.savedItineraries[index];
    }
    return null;
  }

  /**
   * 更新行程
   * @param {string} id - 行程ID
   * @param {Object} updates - 更新内容
   * @returns {boolean}
   */
  update(id, updates) {
    const index = this.savedItineraries.findIndex(it => it.id === id);
    if (index === -1) return false;

    this.savedItineraries[index] = {
      ...this.savedItineraries[index],
      ...updates
    };
    this._saveToStorage('Itinerary updated');
    return true;
  }

  /**
   * 删除行程
   * @param {string} id - 行程ID
   * @returns {boolean}
   */
  delete(id) {
    const index = this.savedItineraries.findIndex(it => it.id === id);
    if (index === -1) return false;

    this.savedItineraries.splice(index, 1);
    this._saveToStorage('Itinerary deleted');
    return true;
  }

  /**
   * 格式化持续时间
   * @param {number} ms - 毫秒
   * @returns {string}
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

export default ItineraryManager;
