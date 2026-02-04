// Authentication Helper Functions

/**
 * Lấy thông tin user hiện tại từ localStorage
 */
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Lấy token từ localStorage
 */
export const getToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Kiểm tra xem user đã đăng nhập chưa
 */
export const isAuthenticated = () => {
  return !!getToken();
};

/**
 * Kiểm tra xem user có phải admin không
 */
export const isAdmin = () => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};

/**
 * Kiểm tra xem user có phải moderator không (bao gồm admin)
 */
export const isModerator = () => {
  const user = getCurrentUser();
  return ['admin', 'moderator'].includes(user?.role);
};

/**
 * Kiểm tra xem user có phải user thường không
 */
export const isUser = () => {
  const user = getCurrentUser();
  return user?.role === 'user';
};

/**
 * Kiểm tra xem user có một trong các roles được chỉ định không
 * @param {string[]} roles - Mảng các roles cần kiểm tra
 * @returns {boolean}
 */
export const hasRole = (roles) => {
  const user = getCurrentUser();
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

/**
 * Kiểm tra xem user có quyền thực hiện action không
 * @param {string} requiredRole - Role tối thiểu cần có: 'user', 'moderator', 'admin'
 * @returns {boolean}
 */
export const hasPermission = (requiredRole) => {
  const user = getCurrentUser();
  if (!user || !user.role) return false;
  
  const roleHierarchy = {
    'user': 1,
    'moderator': 2,
    'admin': 3
  };
  
  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
};


