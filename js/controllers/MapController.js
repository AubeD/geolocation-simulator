/**
 * MapController 类 - 负责地图初始化和地图相关操作
 */
import HexagonGridLayer from '../hexagon/HexagonGridLayer.js';

class MapController {
  constructor() {
    this.map = null;
    this.marker = null;
    this.baseLayer = null;
    this.satelliteLayer = null;
    this.hexagonGridLayer = null;
    this.latElement = document.getElementById('lat');
    this.lngElement = document.getElementById('lng');
  }

  initMap() {
    // 默认位置：旧金山
    const initialPosition = [37.7749, -122.4194];
    
    // 初始化地图，为 MacBook 触摸板优化触摸交互选项
    this.map = L.map('map', {
      // scrollWheelZoom: true,  // 启用滚轮缩放，这也支持触摸板缩放
      // wheelPxPerZoomLevel: 120  // 调整触摸板缩放的灵敏度
    }).setView(initialPosition, 13);
    
    // 在模块化架构中不需要将地图对象暴露到全局
    
    // 创建基础地图图层
    this.baseLayer = L.tileLayer.provider('OpenStreetMap');
    this.satelliteLayer = L.tileLayer.provider('Esri.WorldImagery');
    
    // 默认添加基础地图图层
    this.baseLayer.addTo(this.map);
    
    // 添加图层切换事件监听
    this._setupLayerSwitching();
    
    // 添加可拖动的标记
    this.marker = L.marker(initialPosition, {
      draggable: true
    }).addTo(this.map);
    
    // 监听标记的拖动结束事件
    this.marker.on('dragend', () => {
      const position = this.marker.getLatLng();
      this.updateGeolocation(position.lat, position.lng);
    });
    
    // 设置键盘控制
    this._setupKeyboardControls();
    
    // 从存储中加载初始位置
    this._loadInitialPosition(initialPosition);
    
    // 初始化六边形网格层
    this.hexagonGridLayer = new HexagonGridLayer(this.map);
    
    // 请求连接到当前标签页的调试器
    this.connectToActiveTab();
    
    // 设置当前位置按钮事件
    this._setupLocationButton();
  }

  /**
   * 设置图层切换
   * @private
   */
  _setupLayerSwitching() {
    // 创建一个新的地图控件，放置在左侧缩放控件下方
    const layerControl = L.control({ position: 'topleft' });
    
    layerControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-layer-control');
      
      // Create map layer selector, vertical layout
      container.innerHTML = `
        <div class="map-layer-buttons">
          <a href="#" id="streetMapBtn" class="map-layer-btn active" title="Street Map"><i class="fas fa-road"></i></a>
          <a href="#" id="satelliteMapBtn" class="map-layer-btn" title="Satellite Image"><i class="fas fa-satellite"></i></a>
        </div>
      `;
      
      // Prevent click events from propagating to the map
      L.DomEvent.disableClickPropagation(container);
      
      return container;
    };
    
    // 将控件添加到地图
    layerControl.addTo(this.map);
    
    // 添加点击事件监听器
    setTimeout(() => {
      // 街道地图按钮
      document.getElementById('streetMapBtn').addEventListener('click', (e) => {
        e.preventDefault(); // 防止链接默认行为
        
        // 移除现有图层
        this.map.eachLayer((layer) => {
          if (layer instanceof L.TileLayer) {
            this.map.removeLayer(layer);
          }
        });
        
        // 添加街道地图图层
        this.baseLayer.addTo(this.map);
        
        // 更新按钮样式
        document.getElementById('streetMapBtn').classList.add('active');
        document.getElementById('satelliteMapBtn').classList.remove('active');
      });
      
      // 卫星地图按钮
      document.getElementById('satelliteMapBtn').addEventListener('click', (e) => {
        e.preventDefault(); // 防止链接默认行为
        
        // 移除现有图层
        this.map.eachLayer((layer) => {
          if (layer instanceof L.TileLayer) {
            this.map.removeLayer(layer);
          }
        });
        
        // 添加卫星地图图层
        this.satelliteLayer.addTo(this.map);
        
        // 更新按钮样式
        document.getElementById('satelliteMapBtn').classList.add('active');
        document.getElementById('streetMapBtn').classList.remove('active');
      });
    }, 100);
  }

  /**
   * 设置键盘控制
   * @private
   */
  _setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey; // Mac 用 Cmd，其他系统用 Ctrl
      
      if (cmdKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // 阻止默认行为，以防止浏览器处理
        e.preventDefault();
        
        const position = this.marker.getLatLng();
        let lat = position.lat;
        let lng = position.lng;
        
        // 设置移动步长 - 基础步长
        let stepBase = 0.0001;
        
        // Cmd+Shift+方向键进行粗调，Cmd+方向键进行微调
        let step = e.shiftKey ? stepBase * 10 : stepBase;
        
        switch(e.key) {
          case 'ArrowUp':
            lat += step;
            break;
          case 'ArrowDown':
            lat -= step;
            break;
          case 'ArrowLeft':
            lng -= step;
            break;
          case 'ArrowRight':
            lng += step;
            break;
        }
        
        // 更新标记位置并触发位置更新
        this.marker.setLatLng([lat, lng]);
        this.updateGeolocation(lat, lng);
      }
      // 普通方向键不做任何特殊处理，让地图控件自己处理（滚动地图）
    });
  }

  /**
   * 从存储中加载初始位置
   * @param {Array} initialPosition - 默认初始位置
   * @private
   */
  _loadInitialPosition(initialPosition) {
    chrome.storage.local.get(['mockGeolocation'], (result) => {
      if (result.mockGeolocation) {
        const position = [result.mockGeolocation.latitude, result.mockGeolocation.longitude];
        this.marker.setLatLng(position);
        this.map.setView(position);
        this.updateGeolocation(position[0], position[1]);
      } else {
        // 如果没有存储的位置，使用默认位置
        this.updateGeolocation(initialPosition[0], initialPosition[1]);
      }
    });
  }

  /**
   * Update geolocation
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} accuracy - Accuracy in meters (default: 10)
   */
  updateGeolocation(lat, lng, accuracy = 10) {
    console.log(`Updating mock location: Latitude ${lat}, Longitude ${lng}, Accuracy ${accuracy}m`);
    
    // Update UI display
    this.latElement.textContent = lat.toFixed(6);
    this.lngElement.textContent = lng.toFixed(6);
    
    // 创建模拟位置对象
    const mockPosition = {
      latitude: lat,
      longitude: lng,
      accuracy: accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    };
    
    // 向后台脚本发送位置更新消息
    // 后台脚本会负责更新存储和所有标签页
    chrome.runtime.sendMessage({
      action: 'updateGeolocation',
      position: mockPosition
    }, (response) => {
      if (response && response.success) {
        console.log('Location update message sent to background script');
      } else {
        console.error('Location update message send failed:', response?.error || 'Unknown error');
      }
    });
  }

  /**
   * 连接到当前活动标签页的调试器
   */
  connectToActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        console.log(`Connecting to tab: ${activeTab.id}`);
        
        chrome.runtime.sendMessage({
          action: 'connectToTab',
          tabId: activeTab.id
        }, (response) => {
          if (response && response.success) {
            console.log(`Successfully connected to tab ${activeTab.id} debugger`);
          } else {
            console.error(`Failed to connect to tab ${activeTab.id} debugger:`, response?.error || 'Unknown error');
          }
        });
      } else {
        console.error('Unable to get active tab');
      }
    });
  }

  /**
   * 设置地图位置
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   */
  setMapLocation(lat, lng) {
    const position = [lat, lng];
    this.marker.setLatLng(position);
    this.map.setView(position, this.map.getZoom());
    this.updateGeolocation(lat, lng);
  }

  /**
   * 设置当前位置按钮事件
   * @private
   */
  _setupLocationButton() {
    const locationButton = document.querySelector('.location-toggle');
    if (locationButton) {
      locationButton.addEventListener('click', () => {
        this.getCurrentRealPosition();
      });
    }
  }
  
  /**
   * 获取当前真实 GPS 位置
   */
  getCurrentRealPosition() {
    // 如果浏览器支持地理位置 API
    if (navigator.geolocation) {
      // 显示加载状态
      const locationButton = document.querySelector('.location-toggle');
      if (locationButton) {
        locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }
      
      try {
        // 获取当前位置，添加更多配置选项
        navigator.geolocation.getCurrentPosition(
          // 成功回调
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`Fetching real GPS location: Latitude ${latitude}, Longitude ${longitude}`);
            
            // 恢复按钮图标
            if (locationButton) {
              locationButton.innerHTML = '<i class="fas fa-location-arrow"></i>';
            }
            
            // 如果已经有了标记，先移除
            if (this.realPositionMarker) {
              this.map.removeLayer(this.realPositionMarker);
            }
            
            // 创建新标记显示真实位置，使用不同颜色区分模拟位置
            this.realPositionMarker = L.marker([latitude, longitude], {
              icon: L.divIcon({
                className: 'real-position-marker',
                html: `<div style="background-color: #4285F4; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 4px rgba(66, 133, 244, 0.4), 0 0 0 8px rgba(66, 133, 244, 0.2);"></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              }),
              draggable: false
            }).addTo(this.map);
            
            // 添加气泡提示
            this.realPositionMarker.bindPopup('<strong>Current Real Location</strong><br/>Latitude: ' + latitude.toFixed(6) + '<br/>Longitude: ' + longitude.toFixed(6)).openPopup();
            
            // 将地图移动到真实位置
            this.map.setView([latitude, longitude], this.map.getZoom());
            
            // Ask user if they want to set the mock location to the current real location
            if (confirm('Do you want to set the mock location to the current real location?')) {
              // 更新模拟位置标记（信标）的位置
              this.marker.setLatLng([latitude, longitude]);
              
              // 更新模拟位置
              this.updateGeolocation(latitude, longitude);
            }
          },
          // 错误回调
          (error) => {
            console.error('Failed to get location:', error.message, error.code);
            
            // 恢复按钮图标
            if (locationButton) {
              locationButton.innerHTML = '<i class="fas fa-location-arrow"></i>';
            }
            
            // 根据错误类型显示更友好的错误提示
            let errorMsg = '';
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMsg = 'You denied location permission. Please allow location access in your browser settings and try again.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMsg = 'Unable to get location information. Please ensure your device is enabled and in a location where GPS signals are available.';
                // Use fallback position for this error
                this.useFallbackPosition();
                break;
              case error.TIMEOUT:
                errorMsg = 'Unable to get location information. Please check your network connection and try again.';
                // Use fallback position for this error too
                this.useFallbackPosition();
                break;
              default:
                errorMsg = `Unable to get location information: ${error.message}`;
                // Use fallback position for unknown errors
                this.useFallbackPosition();
            }
            
            // 显示错误提示
            alert(errorMsg);
            
            // 如果是权限问题，提供更多帮助
            if (error.code === error.PERMISSION_DENIED) {
              console.info('Please allow location access in your browser settings and try again.');
              // Show instructions for enabling location services based on browser
              this.showLocationPermissionHelp();
            }
          },
          // 地理位置选项
          {
            enableHighAccuracy: true,  // 获取最高精度的位置信息
            timeout: 30000,           // 30秒超时，增加超时时间以提高成功率
            maximumAge: 0             // 不使用缓存的位置信息
          }
        );
      } catch (e) {
        console.error('Geolocation API error:', e);
        if (locationButton) {
          locationButton.innerHTML = '<i class="fas fa-location-arrow"></i>';
        }
        alert('An error occurred while trying to get your location. Using fallback position.');
        this.useFallbackPosition();
      }
    } else {
      alert('Your browser does not support the Geolocation API. Please try using a modern browser, such as Chrome, Firefox, or Safari.');
      this.useFallbackPosition();
    }
  }
  
  /**
   * Use a fallback position when geolocation fails
   * @private
   */
  useFallbackPosition() {
    console.log('Using fallback position');
    
    // Default fallback coordinates (San Francisco)
    const fallbackLat = 37.7749;
    const fallbackLng = -122.4194;
    
    // If already have a real position marker, remove it
    if (this.realPositionMarker) {
      this.map.removeLayer(this.realPositionMarker);
    }
    
    // Create a fallback marker with a different style to indicate it's not real
    this.realPositionMarker = L.marker([fallbackLat, fallbackLng], {
      icon: L.divIcon({
        className: 'fallback-position-marker',
        html: `<div style="background-color: #FFA500; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 4px rgba(255, 165, 0, 0.4), 0 0 0 8px rgba(255, 165, 0, 0.2);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }),
      draggable: false
    }).addTo(this.map);
    
    // Add a popup to indicate this is a fallback position
    this.realPositionMarker.bindPopup('<strong>Fallback Location</strong><br/>(Real location unavailable)<br/>Latitude: ' + fallbackLat.toFixed(6) + '<br/>Longitude: ' + fallbackLng.toFixed(6)).openPopup();
    
    // Move map to fallback position
    this.map.setView([fallbackLat, fallbackLng], this.map.getZoom());
  }
  
  /**
   * Show browser-specific help for enabling location permissions
   * @private
   */
  showLocationPermissionHelp() {
    // Detect browser
    const isChrome = navigator.userAgent.indexOf('Chrome') > -1;
    const isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    const isSafari = navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') === -1;
    const isEdge = navigator.userAgent.indexOf('Edg') > -1;
    
    let helpMessage = 'To enable location access:';
    
    if (isChrome || isEdge) {
      helpMessage += '\n1. Click the lock/info icon in the address bar\n2. Find "Location" in the site settings\n3. Change the permission to "Allow"';
    } else if (isFirefox) {
      helpMessage += '\n1. Click the lock/info icon in the address bar\n2. Click "More Information"\n3. Find "Access Your Location" under Permissions\n4. Change to "Allow"';
    } else if (isSafari) {
      helpMessage += '\n1. Open Safari Preferences\n2. Go to the Privacy tab\n3. Under Website tracking, ensure Location Services is enabled\n4. You may need to enable Location Services in System Preferences > Privacy & Security';
    } else {
      helpMessage += '\nPlease check your browser settings to allow location access for this website.';
    }
    
    console.info(helpMessage);
    alert(helpMessage);
  }
}

export default MapController;
