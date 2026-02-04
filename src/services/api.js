import axios from 'axios';
import { API_CONFIG, API_ENDPOINTS, DEFAULTS } from '../config/apiConfig';

// Tạo axios instance với interceptor để tự động thêm token
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL
});

// Interceptor: Tự động thêm token vào header cho mọi request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor: Xử lý lỗi 401 (token hết hạn) - tự động logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Redirect to login nếu cần
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Chuẩn hóa dữ liệu từ API
const normalizeFloodData = (data, isRealtimeEndpoint = false) => {
  return data.map(item => {
    const waterLevel = item.water_level || 0;
    const warningThreshold = item.warning_threshold || DEFAULTS.WARNING_THRESHOLD;
    const dangerThreshold = item.danger_threshold || DEFAULTS.DANGER_THRESHOLD;
    
    // Tính toán status nếu endpoint cũ không có
    let status = item.status;
    if (!status && isRealtimeEndpoint === false) {
      // Tính toán status từ water_level và thresholds
      if (waterLevel >= dangerThreshold) {
        status = 'danger';
      } else if (waterLevel >= warningThreshold) {
        status = 'warning';
      } else {
        status = 'normal';
      }
    }
    status = status || 'normal';

    // Tính toán velocity nếu không có (endpoint cũ)
    const velocity = item.velocity || 0;

    return {
      sensor_id: item.sensor_id,
      location_name: item.location_name || 'Vị trí không xác định',
      model: item.model || 'N/A',
      sensor_status: item.sensor_status || status,
      water_level: waterLevel,
      velocity: velocity,
      status: status, // normal/warning/danger/offline
      lng: item.lng || DEFAULTS.DEFAULT_LNG,
      lat: item.lat || DEFAULTS.DEFAULT_LAT,
      warning_threshold: warningThreshold,
      danger_threshold: dangerThreshold,
      last_data_time: item.last_data_time || item.created_at,
      created_at: item.created_at || new Date().toISOString()
    };
  });
};

// Fetch dữ liệu flood với fallback endpoint
export const fetchFloodData = async (endpointRef) => {
  try {
    let response;
    let isRealtimeEndpoint = false;

    // Nếu chưa xác định endpoint nào hoạt động, thử endpoint mới trước
    if (endpointRef.current === null) {
      try {
        // Thử endpoint mới với validateStatus để không throw 404
        response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.FLOOD_DATA_REALTIME}?t=${Date.now()}`, {
          validateStatus: (status) => status < 500 // Chỉ throw nếu >= 500
        });
        
        // Kiểm tra status code
        if (response.status === 404) {
          // Endpoint không tồn tại, fallback
          endpointRef.current = 'fallback';
          isRealtimeEndpoint = false;
          // Gọi endpoint cũ
          response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.FLOOD_DATA}?t=${Date.now()}`);
        } else if (response.status === 200) {
          // Endpoint tồn tại
          endpointRef.current = 'realtime';
          isRealtimeEndpoint = true;
        }
      } catch {
        endpointRef.current = 'fallback';
        isRealtimeEndpoint = false;
        // Gọi endpoint cũ
        response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.FLOOD_DATA}?t=${Date.now()}`);
      }
    } else {
      // Sử dụng endpoint đã xác định
      if (endpointRef.current === 'realtime') {
        response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.FLOOD_DATA_REALTIME}?t=${Date.now()}`);
        isRealtimeEndpoint = true;
      } else {
        response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.FLOOD_DATA}?t=${Date.now()}`);
        isRealtimeEndpoint = false;
      }
    }
    
    if (response.data && response.data.success && response.data.data) {
      const normalizedData = normalizeFloodData(response.data.data, isRealtimeEndpoint);
      return { success: true, data: normalizedData };
    } else {
      return { success: false, data: [] };
    }
  } catch (error) {
    return { success: false, data: null, error };
  }
};

// ==================== CROWDSOURCING APIs ====================

// Gửi báo cáo ngập từ người dùng
export const submitFloodReport = async (reportData) => {
  try {
    const response = await axios.post(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.REPORT_FLOOD}`, reportData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data || null,
        message: response.data.message || 'Báo cáo đã được gửi thành công'
      };
    } else {
      return { 
        success: false, 
        error: response.data?.error || 'Có lỗi xảy ra' 
      };
    }
  } catch (error) {
    if (error.response) {
      return { 
        success: false, 
        error: error.response.data?.error || 'Có lỗi xảy ra' 
      };
    } else if (error.request) {
      return { 
        success: false, 
        error: 'Không thể kết nối đến server' 
      };
    } else {
      return { 
        success: false, 
        error: error.message || 'Có lỗi xảy ra' 
      };
    }
  }
};

// Lấy danh sách báo cáo từ người dân (24h qua)
// Public endpoint - không cần auth
export const fetchCrowdReports = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    // Dùng endpoint public /api/crowd-reports (24h) - không cần auth
    const response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.CROWD_REPORTS}${queryString ? `?${queryString}` : ''}`);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data || [] 
      };
    } else {
      return { 
        success: false, 
        data: [] 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      data: [], 
      error: error.response?.data || error.message
    };
  }
};

// Lấy tất cả báo cáo (không giới hạn thời gian)
export const fetchAllCrowdReports = async (params = {}) => {
  try {
    const queryParams = { limit: 100, ...params };
    const queryString = new URLSearchParams(queryParams).toString();
    // Dùng apiClient để tự động thêm token (cần thiết để backend biết user nào đang request)
    const response = await apiClient.get(`${API_ENDPOINTS.CROWD_REPORTS_ALL}?${queryString}`);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data || [] 
      };
    } else {
      return { 
        success: false, 
        data: [] 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      data: [], 
      error: error.response?.data || error.message
    };
  }
};

// Authentication APIs
export const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH_LOGIN}`, {
      username,
      password
    });
    
    if (response.data && response.data.success) {
      // Lưu thông tin user và token vào localStorage
      if (response.data.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
      if (response.data.data.token) {
        localStorage.setItem('authToken', response.data.data.token);
      }
      return { 
        success: true, 
        data: response.data.data 
      };
    } else {
      return { 
        success: false, 
        error: response.data.error || 'Đăng nhập thất bại' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH_REGISTER}`, userData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data 
      };
    } else {
      return { 
        success: false, 
        error: response.data.error || 'Đăng ký thất bại' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

export const getProfile = async () => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.AUTH_PROFILE);
    
    if (response.data && response.data.success) {
      // Cập nhật thông tin user trong localStorage
      if (response.data.data) {
        localStorage.setItem('user', JSON.stringify(response.data.data));
      }
      return { 
        success: true, 
        data: response.data.data 
      };
    } else {
      return { 
        success: false, 
        error: response.data.error || 'Không thể lấy thông tin người dùng' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

export const updateProfile = async (profileData) => {
  try {
    const response = await apiClient.put(API_ENDPOINTS.AUTH_PROFILE, profileData);
    
    if (response.data && response.data.success) {
      // Cập nhật thông tin user trong localStorage
      if (response.data.data) {
        localStorage.setItem('user', JSON.stringify(response.data.data));
      }
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Cập nhật profile thành công'
      };
    } else {
      return { 
        success: false, 
        error: response.data.error || 'Cập nhật profile thất bại' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await apiClient.put(API_ENDPOINTS.AUTH_CHANGE_PASSWORD, {
      old_password: oldPassword,
      new_password: newPassword
    });
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        message: response.data.message || 'Đổi mật khẩu thành công'
      };
    } else {
      return { 
        success: false, 
        error: response.data.error || 'Đổi mật khẩu thất bại' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

export const logout = () => {
  // Xóa thông tin user và token khỏi localStorage
  localStorage.removeItem('user');
  localStorage.removeItem('authToken');
};

// Re-export auth helpers from utils/auth.js for backward compatibility
export { getCurrentUser, isAuthenticated } from '../utils/auth';

// ==================== SENSOR MANAGEMENT APIs ====================

/**
 * Lấy tất cả sensors
 * @param {Object} params - Query parameters (is_active, status, hardware_type)
 */
export const fetchSensors = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`${API_ENDPOINTS.SENSORS}${queryString ? `?${queryString}` : ''}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy thông tin sensor theo ID
 */
export const fetchSensorById = async (sensorId) => {
  try {
    const endpoint = API_ENDPOINTS.SENSOR_BY_ID.replace(':sensorId', sensorId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.error || 'Không tìm thấy sensor' };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy lịch sử sensor
 */
export const fetchSensorHistory = async (sensorId, limit = 100) => {
  try {
    const endpoint = API_ENDPOINTS.SENSOR_HISTORY.replace(':sensorId', sensorId);
    const response = await apiClient.get(`${endpoint}?limit=${limit}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Tạo sensor mới (Admin only)
 */
export const createSensor = async (sensorData) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.SENSORS, sensorData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Tạo sensor thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Tạo sensor thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Cập nhật sensor (Admin only)
 */
export const updateSensor = async (sensorId, sensorData) => {
  try {
    const endpoint = API_ENDPOINTS.SENSOR_BY_ID.replace(':sensorId', sensorId);
    const response = await apiClient.put(endpoint, sensorData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Cập nhật sensor thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Cập nhật sensor thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Cập nhật ngưỡng báo động (Admin only)
 */
export const updateSensorThresholds = async (sensorId, thresholds) => {
  try {
    const endpoint = API_ENDPOINTS.SENSOR_THRESHOLDS.replace(':sensorId', sensorId);
    const response = await apiClient.put(endpoint, thresholds);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Cập nhật ngưỡng thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Cập nhật ngưỡng thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Xóa sensor (Admin only)
 */
export const deleteSensor = async (sensorId) => {
  try {
    const endpoint = API_ENDPOINTS.SENSOR_BY_ID.replace(':sensorId', sensorId);
    const response = await apiClient.delete(endpoint);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        message: response.data.message || 'Xóa sensor thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Xóa sensor thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== REPORT MODERATION APIs (Moderator/Admin) ====================

/**
 * Lấy báo cáo cần kiểm duyệt
 */
export const fetchPendingReports = async (limit = 50) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.REPORTS_PENDING}?limit=${limit}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Duyệt/Từ chối báo cáo
 */
export const moderateReport = async (reportId, action, rejectionReason = null) => {
  try {
    const endpoint = API_ENDPOINTS.REPORT_MODERATE.replace(':reportId', reportId);
    const payload = { action };
    if (action === 'reject' && rejectionReason) {
      payload.rejection_reason = rejectionReason;
    }
    
    const response = await apiClient.put(endpoint, payload);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || `${action === 'approve' ? 'Duyệt' : 'Từ chối'} báo cáo thành công`
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Thao tác thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy xếp hạng tin cậy
 */
export const fetchReliabilityRanking = async (limit = 100) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.REPORTS_RELIABILITY_RANKING}?limit=${limit}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== REPORT EVALUATION APIs ====================

/**
 * Đánh giá báo cáo
 */
export const evaluateReport = async (reportId, rating, comment = '') => {
  try {
    const endpoint = API_ENDPOINTS.REPORT_EVALUATIONS.replace(':reportId', reportId);
    const response = await apiClient.post(endpoint, { rating, comment });
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Đánh giá thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Đánh giá thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy đánh giá của báo cáo
 */
export const fetchReportEvaluations = async (reportId) => {
  try {
    const endpoint = API_ENDPOINTS.REPORT_EVALUATIONS.replace(':reportId', reportId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy điểm trung bình của báo cáo
 */
export const fetchReportAverageRating = async (reportId) => {
  try {
    const endpoint = API_ENDPOINTS.REPORT_EVALUATIONS_AVERAGE.replace(':reportId', reportId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null,
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== ALERT APIs ====================

/**
 * Lấy tất cả alerts
 */
export const fetchAlerts = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`${API_ENDPOINTS.ALERTS}${queryString ? `?${queryString}` : ''}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy alerts đang active
 */
export const fetchActiveAlerts = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await apiClient.get(`${API_ENDPOINTS.ALERTS_ACTIVE}${queryString ? `?${queryString}` : ''}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Thống kê alerts
 */
export const fetchAlertStats = async (days = 7) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.ALERTS_STATS}?days=${days}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy alert theo ID
 */
export const fetchAlertById = async (alertId) => {
  try {
    const endpoint = API_ENDPOINTS.ALERT_BY_ID.replace(':alertId', alertId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data?.error || 'Không tìm thấy alert' };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Xác nhận alert
 */
export const acknowledgeAlert = async (alertId) => {
  try {
    const endpoint = API_ENDPOINTS.ALERT_ACKNOWLEDGE.replace(':alertId', alertId);
    const response = await apiClient.put(endpoint);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Xác nhận alert thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Xác nhận alert thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Đánh dấu alert đã xử lý
 */
export const resolveAlert = async (alertId) => {
  try {
    const endpoint = API_ENDPOINTS.ALERT_RESOLVE.replace(':alertId', alertId);
    const response = await apiClient.put(endpoint);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Đánh dấu alert đã xử lý thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Xử lý alert thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== EMERGENCY SUBSCRIPTION APIs ====================

/**
 * Đăng ký nhận cảnh báo khẩn
 */
export const createEmergencySubscription = async (subscriptionData) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.EMERGENCY_SUBSCRIPTIONS, subscriptionData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Đăng ký cảnh báo thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Đăng ký cảnh báo thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy subscriptions của user
 */
export const fetchMySubscriptions = async () => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.EMERGENCY_SUBSCRIPTIONS_MY);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Cập nhật subscription
 */
export const updateEmergencySubscription = async (subscriptionId, subscriptionData) => {
  try {
    const endpoint = API_ENDPOINTS.EMERGENCY_SUBSCRIPTION_BY_ID.replace(':subscriptionId', subscriptionId);
    const response = await apiClient.put(endpoint, subscriptionData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Cập nhật subscription thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Cập nhật subscription thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Xóa subscription
 */
export const deleteEmergencySubscription = async (subscriptionId) => {
  try {
    const endpoint = API_ENDPOINTS.EMERGENCY_SUBSCRIPTION_BY_ID.replace(':subscriptionId', subscriptionId);
    const response = await apiClient.delete(endpoint);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        message: response.data.message || 'Xóa subscription thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Xóa subscription thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== HEATMAP APIs ====================

/**
 * Lấy dữ liệu heatmap từ sensors
 */
export const fetchHeatmap = async (params) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.HEATMAP}?${queryString}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy heatmap kết hợp (Sensors + Crowd Reports)
 */
export const fetchCombinedHeatmap = async (params) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.HEATMAP_COMBINED}?${queryString}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== OTA UPDATE APIs (Admin only) ====================

/**
 * Tạo OTA update
 */
export const createOTAUpdate = async (otaData) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.OTA, otaData);
    
    if (response.data && response.data.success) {
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message || 'Tạo OTA update thành công'
      };
    }
    return { 
      success: false, 
      error: response.data?.error || 'Tạo OTA update thất bại'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy OTA updates đang pending
 */
export const fetchPendingOTAUpdates = async (limit = 50) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.OTA_PENDING}?limit=${limit}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy OTA updates theo sensor
 */
export const fetchSensorOTAUpdates = async (sensorId) => {
  try {
    const endpoint = API_ENDPOINTS.OTA_SENSOR.replace(':sensorId', sensorId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

// ==================== ENERGY MONITORING APIs ====================

/**
 * Lấy energy logs theo sensor
 */
export const fetchEnergyLogs = async (sensorId, limit = 100) => {
  try {
    const endpoint = API_ENDPOINTS.ENERGY_SENSOR.replace(':sensorId', sensorId);
    const response = await apiClient.get(`${endpoint}?limit=${limit}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy energy log mới nhất
 */
export const fetchLatestEnergyLog = async (sensorId) => {
  try {
    const endpoint = API_ENDPOINTS.ENERGY_SENSOR_LATEST.replace(':sensorId', sensorId);
    const response = await apiClient.get(endpoint);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Thống kê năng lượng
 */
export const fetchEnergyStats = async (sensorId, hours = 24) => {
  try {
    const endpoint = API_ENDPOINTS.ENERGY_SENSOR_STATS.replace(':sensorId', sensorId);
    const response = await apiClient.get(`${endpoint}?hours=${hours}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data };
    }
    return { success: false, data: null };
  } catch (error) {
    return { 
      success: false, 
      data: null,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Lấy sensors có pin thấp (Admin only)
 */
export const fetchLowBatterySensors = async (threshold = 20) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.ENERGY_LOW_BATTERY}?threshold=${threshold}`);
    
    if (response.data && response.data.success) {
      return { success: true, data: response.data.data || [] };
    }
    return { success: false, data: [] };
  } catch (error) {
    return { 
      success: false, 
      data: [],
      error: error.response?.data?.error || error.message
    };
  }
};

