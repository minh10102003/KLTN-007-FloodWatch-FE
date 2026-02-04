import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../../services/api';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });

  const loadProfile = async () => {
    setLoading(true);
    const result = await getProfile();
    if (result.success) {
      setUser(result.data);
      setFormData({
        full_name: result.data.full_name || '',
        email: result.data.email || '',
        phone: result.data.phone || ''
      });
    } else {
      setError(result.error || 'Không thể tải thông tin người dùng');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const result = await updateProfile(formData);
    
    if (result.success) {
      setUser(result.data);
      setSuccess('Cập nhật thông tin thành công!');
      setIsEditing(false);
    } else {
      setError(result.error || 'Cập nhật thất bại');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  // Get initials for avatar
  const getInitials = () => {
    if (user?.full_name) {
      const parts = user.full_name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      }
      return user.full_name.charAt(0).toUpperCase();
    }
    return user?.username?.charAt(0).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading">Đang tải thông tin...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="error-message">{error || 'Không thể tải thông tin người dùng'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-title">Chỉnh sửa hồ sơ của bạn</h1>

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-form-layout">
            {/* Left Side - Photo */}
            <div className="profile-photo-section">
              <label className="photo-label">Ảnh đại diện:</label>
              <div className="profile-avatar-container">
                <div className="profile-avatar">
                  <span>{getInitials()}</span>
                </div>
              </div>
              <button 
                type="button"
                className="btn-change-photo"
                onClick={() => {
                  // TODO: Implement photo upload
                }}
              >
                ĐỔI ẢNH
              </button>
            </div>

            {/* Right Side - Form Fields */}
            <div className="profile-form-fields">
              <div className="form-group">
                <label htmlFor="username">Tên đăng nhập</label>
                <input
                  type="text"
                  id="username"
                  value={user.username}
                  disabled
                  className="input-disabled"
                />
              </div>

              <div className="form-group">
                <label htmlFor="full_name">Họ và tên</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Nhập email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Số điện thoại</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div className="form-group">
                <label>Vai trò</label>
                <input
                  type="text"
                  value={user.role === 'admin' ? 'Quản trị viên' : user.role === 'moderator' ? 'Điều hành viên' : 'Người dùng'}
                  disabled
                  className="input-disabled"
                />
              </div>

              {user.created_at && (
                <div className="form-group">
                  <label>Ngày tạo</label>
                  <input
                    type="text"
                    value={new Date(user.created_at).toLocaleDateString('vi-VN')}
                    disabled
                    className="input-disabled"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-cancel"
              onClick={() => {
                if (isEditing) {
                  handleCancel();
                } else {
                  navigate(-1);
                }
              }}
              disabled={saving}
            >
              Hủy
            </button>
            {isEditing ? (
              <button 
                type="submit" 
                className="btn-save"
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            ) : (
              <button 
                type="button" 
                className="btn-edit"
                onClick={() => setIsEditing(true)}
              >
                Chỉnh sửa
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
