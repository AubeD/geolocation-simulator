/**
 * 主入口文件 - 初始化应用
 */
import MapController from './controllers/MapController.js';
import LocationManager from './managers/LocationManager.js';
import UIController from './controllers/UIController.js';
import GridController from './controllers/GridController.js';
import HexagonGridLayer from './hexagon/HexagonGridLayer.js';
import ItineraryManager from './managers/ItineraryManager.js';
import ItineraryPlayerController from './controllers/ItineraryPlayerController.js';
import ItineraryUIController from './controllers/ItineraryUIController.js';

document.addEventListener('DOMContentLoaded', () => {
  // 初始化地图控制器
  const mapController = new MapController();
  mapController.initMap();
  
  // 初始化六边形网格图层
  const hexagonGridLayer = new HexagonGridLayer(mapController.map);
  
  // 初始化位置管理器
  const locationManager = new LocationManager();
  
  // 初始化网格控制器
  const gridController = new GridController(hexagonGridLayer);
  
  // 初始化UI控制器
  const uiController = new UIController(mapController, locationManager);
  
  // 初始化行程管理器和控制器
  const itineraryManager = new ItineraryManager();
  const itineraryPlayerController = new ItineraryPlayerController(mapController);
  const itineraryUIController = new ItineraryUIController(
    itineraryManager,
    itineraryPlayerController,
    uiController.modalController
  );
  
  // 注册网格控制器事件
  document.addEventListener('openGridManager', () => {
    gridController.openGridManager();
  });
});
