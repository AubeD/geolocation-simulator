// 存储当前的模拟位置
let mockGeolocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now()
};

// 跟踪连接到哪些标签页的调试器
const attachedTabs = new Map();

// 初始化时，从存储中获取位置
chrome.storage.local.get(['mockGeolocation'], function(result) {
  if (result.mockGeolocation) {
    mockGeolocation = result.mockGeolocation;
    console.log('Loaded mock location from storage:', mockGeolocation);
  } else {
    // 如果没有存储的位置，初始化存储
    chrome.storage.local.set({ mockGeolocation }, function() {
      console.log('Initialized mock location in storage');
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Geolocation Simulator installed");
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 打开侧边栏
    await chrome.sidePanel.open({ tabId: tab.id });
    
    // 设置侧边栏为当前扩展的面板
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'panel.html',
      enabled: true
    });
    
    console.log("Opened geolocation simulator sidebar");
    
    // 为当前标签页附加调试器
    attachDebugger(tab.id);
  } catch (err) {
    console.error('Failed to open sidebar:', err);
  }
});

// 接收来自 MapController 和其他组件的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background received message:', message);
  
  if (message.action === 'updateGeolocation') {
    // 来自 MapController 的位置更新请求
    mockGeolocation = {
      ...message.position,
      timestamp: Date.now()
    };
    
    // 同时更新存储
    chrome.storage.local.set({ mockGeolocation }, function() {
      console.log('Updated mock location in storage');
    });
    
    console.log('Mock location updated:', mockGeolocation);

    // Broadcast to all tabs so content scripts can update
    broadcastMockLocation();
    
    // 更新所有已连接标签页的模拟位置
    updateAllTabsGeolocation();
    
    sendResponse({ success: true });
    return true;
  }
  else if (message.action === 'connectToTab') {
    // 连接到特定标签页的调试器
    const tabId = message.tabId || sender.tab?.id;
    if (tabId) {
      // 检查是否是 chrome:// 或 chrome-extension:// 页面
      try {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting tab:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          
          if (tab && tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
            console.log(`Ignoring special page: ${tab.url}`);
            // sendResponse({ success: false, error: 'Unsupported chrome:// or chrome-extension:// page' });
            return;
          }
          
          attachDebugger(tabId)
            .then(result => {
              console.log(`Successfully connected debugger to tab ${tabId}`);
              sendResponse({ success: true, result });
            })
            .catch(error => {
              console.error(`Failed to connect debugger to tab ${tabId}:`, error);
              sendResponse({ success: false, error: error.message });
            });
        });
      } catch (error) {
        console.error('Exception when connecting to tab:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // 保持消息通道开放，以便异步发送响应
    }
    sendResponse({ success: false, error: 'No tab ID provided' });
    return true;
  }
  // 移除了未使用的 detachDebugger 消息处理代码
});

// 监听标签页关闭，断开相应的调试器连接
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs.has(tabId)) {
    detachDebugger(tabId)
      .catch(error => console.error(`Failed to disconnect debugger from tab ${tabId}:`, error));
  }
});

/**
 * 连接到标签页的调试器
 */
async function attachDebugger(tabId) {
  try {
    // 检查标签页URL
    const tab = await chrome.tabs.get(tabId);
    if (tab.url.startsWith('chrome://')) {
      console.log(`Cannot attach debugger to chrome:// URLs: ${tab.url}`);
      return { error: 'Cannot attach debugger to chrome:// URLs' };
    }

    if (attachedTabs.has(tabId)) {
      console.log(`Debugger already connected to tab ${tabId}`);
      return { alreadyAttached: true };
    }
    
    // 连接到调试器
    await chrome.debugger.attach({ tabId }, '1.3');
    console.log(`Debugger already connected to tab ${tabId}`);
    
    // 记录已连接的标签页
    attachedTabs.set(tabId, true);
    
    // 启用模拟
    await enableGeolocitionMock(tabId);
    
    // 设置初始位置
    await setGeoLocationMock(tabId, mockGeolocation.latitude, mockGeolocation.longitude);
    
    return { attached: true };
  } catch (error) {
    console.error(`Error connecting to debugger for tab ${tabId}:`, error);
    throw error;
  }
}

/**
 * 断开与标签页调试器的连接
 */
async function detachDebugger(tabId) {
  try {
    if (!attachedTabs.has(tabId)) return;
    
    // 禁用模拟
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearGeolocationOverride');
    } catch (e) {
      console.warn(`Error clearing geolocation override for tab ${tabId}:`, e);
    }
    
    // 断开连接
    await chrome.debugger.detach({ tabId });
    console.log(`Disconnected debugger from tab ${tabId}`);
    
    // 移除记录
    attachedTabs.delete(tabId);
  } catch (error) {
    console.error(`Error disconnecting debugger from tab ${tabId}:`, error);
    throw error;
  }
}

/**
 * 启用地理位置模拟
 * 使用当前的mockGeolocation设置模拟位置
 */
async function enableGeolocitionMock(tabId) {
  // 检查mockGeolocation是否定义
  if (!mockGeolocation) {
    console.warn(`Mock location object undefined, using default value`);
    mockGeolocation = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      timestamp: Date.now()
    };
  }
  
  // 使用setGeoLocationMock函数设置位置
  return await setGeoLocationMock(tabId, mockGeolocation.latitude, mockGeolocation.longitude);
}

/**
 * 设置模拟位置
 */
async function setGeoLocationMock(tabId, latitude, longitude) {
  try {
    // 验证参数
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      console.error(`Invalid mock location parameters: latitude ${latitude}, longitude ${longitude}`);
      return false;
    }
    
    // 检查标签页是否存在
    if (!attachedTabs.has(tabId)) {
      console.warn(`Tab ${tabId} has no debugger connected, attempting to reconnect`);
      await attachDebugger(tabId);
    }
    
    // 设置模拟位置
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.setGeolocationOverride', {
      latitude: latitude,
      longitude: longitude,
      accuracy: 10
    });
    
    console.log(`Updated mock location for tab ${tabId}: latitude ${latitude}, longitude ${longitude}`);
    return true;
  } catch (error) {
    console.error(`Error updating mock location for tab ${tabId}:`, error);
    
    // 如果是调试器连接问题，尝试重新连接
    if (error.message && (error.message.includes('Debugger is not attached') || 
                          error.message.includes('Cannot access') || 
                          error.message.includes('not found'))) {
      try {
        console.log(`Attempting to reconnect debugger for tab ${tabId}`);
        await detachDebugger(tabId).catch(() => {});
        await attachDebugger(tabId);
        return true;
      } catch (e) {
        console.error(`Failed to reconnect debugger for tab ${tabId}:`, e);
      }
    }
    
    return false;
  }
}

/**
 * 更新所有已连接标签页的模拟位置
 */
async function updateAllTabsGeolocation() {
  // 检查当前是否有模拟位置
  if (!mockGeolocation) {
    console.warn('No mock location data available, cannot update tabs');
    return;
  }
  
  // 遍历所有已连接的标签页
  for (const tabId of attachedTabs.keys()) {
    // 直接使用setGeoLocationMock函数，它已包含错误处理和重连逻辑
    await setGeoLocationMock(tabId, mockGeolocation.latitude, mockGeolocation.longitude)
      .then(success => {
        if (success) {
          console.log(`Updated mock location for tab ${tabId}`);
        }
      })
      .catch(error => {
        console.error(`Error updating mock location for tab ${tabId}:`, error);
      });
  }
}

/**
 * Broadcast the current mock location to all open tabs so that
 * the content script can forward it into the page context.
 */
function broadcastMockLocation() {
  if (!mockGeolocation) return;
  chrome.tabs.query({}, function(tabs) {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, {
        action: 'mockLocationUpdate',
        latitude: mockGeolocation.latitude,
        longitude: mockGeolocation.longitude,
        accuracy: mockGeolocation.accuracy
      }, () => {});
    }
  });
}

console.log('Background script loaded');
