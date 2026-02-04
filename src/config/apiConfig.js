// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3
};

// API Endpoints
export const API_ENDPOINTS = {
  // Flood Data
  FLOOD_DATA: '/api/v1/flood-data',
  FLOOD_DATA_REALTIME: '/api/v1/flood-data/realtime',
  SENSOR_HISTORY: '/api/sensors/:sensorId/history',
  
  // Sensors
  SENSORS: '/api/sensors',
  SENSOR_BY_ID: '/api/sensors/:sensorId',
  SENSOR_THRESHOLDS: '/api/sensors/:sensorId/thresholds',
  
  // Crowd Reports
  REPORT_FLOOD: '/api/report-flood',
  CROWD_REPORTS: '/api/crowd-reports',
  CROWD_REPORTS_ALL: '/api/crowd-reports/all',
  
  // Report Moderation (Moderator/Admin)
  REPORTS_PENDING: '/api/reports/pending',
  REPORT_MODERATE: '/api/reports/:reportId/moderate',
  REPORTS_RELIABILITY_RANKING: '/api/reports/reliability-ranking',
  
  // Report Evaluation
  REPORT_EVALUATIONS: '/api/report-evaluations/:reportId',
  REPORT_EVALUATIONS_AVERAGE: '/api/report-evaluations/:reportId/average',
  
  // Alerts
  ALERTS: '/api/alerts',
  ALERTS_ACTIVE: '/api/alerts/active',
  ALERTS_STATS: '/api/alerts/stats',
  ALERT_BY_ID: '/api/alerts/:alertId',
  ALERT_ACKNOWLEDGE: '/api/alerts/:alertId/acknowledge',
  ALERT_RESOLVE: '/api/alerts/:alertId/resolve',
  
  // Emergency Subscriptions
  EMERGENCY_SUBSCRIPTIONS: '/api/emergency-subscriptions',
  EMERGENCY_SUBSCRIPTIONS_MY: '/api/emergency-subscriptions/my-subscriptions',
  EMERGENCY_SUBSCRIPTION_BY_ID: '/api/emergency-subscriptions/:subscriptionId',
  
  // Heatmap
  HEATMAP: '/api/heatmap',
  HEATMAP_COMBINED: '/api/heatmap/combined',
  
  // OTA Updates (Admin)
  OTA: '/api/ota',
  OTA_PENDING: '/api/ota/pending',
  OTA_SENSOR: '/api/ota/sensor/:sensorId',
  OTA_STATUS: '/api/ota/:otaId/status',
  
  // Energy Monitoring
  ENERGY: '/api/energy',
  ENERGY_SENSOR: '/api/energy/sensor/:sensorId',
  ENERGY_SENSOR_LATEST: '/api/energy/sensor/:sensorId/latest',
  ENERGY_SENSOR_STATS: '/api/energy/sensor/:sensorId/stats',
  ENERGY_LOW_BATTERY: '/api/energy/low-battery',
  
  // Authentication
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_PROFILE: '/api/auth/profile',
  AUTH_CHANGE_PASSWORD: '/api/auth/change-password'
};

// Polling intervals (milliseconds)
export const POLLING_INTERVALS = {
  FLOOD_DATA: 5000,        // 5 seconds
  CROWD_REPORTS: 10000     // 10 seconds (giảm từ 30s để cập nhật nhanh hơn)
};

// Default values
export const DEFAULTS = {
  WARNING_THRESHOLD: 10,
  DANGER_THRESHOLD: 30,
  DEFAULT_LAT: 10.776,
  DEFAULT_LNG: 106.701
};
