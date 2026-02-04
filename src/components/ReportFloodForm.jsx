import React, { useState, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { MapContainer, TileLayer, useMapEvents, Marker } from 'react-leaflet';
import { FaPenToSquare, FaCheck, FaXmark, FaClock, FaPaperPlane, FaXmark as FaClose } from 'react-icons/fa6';
import { submitFloodReport } from '../services/api';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../utils/constants';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Icon cho vị trí đã chọn
const createLocationIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #007bff;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `,
    className: 'location-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Component để lắng nghe click trên map
const MapClickHandler = ({ onLocationSelect  }) => {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lng, e.latlng.lat);
    },
  });
  return null;
};

const ReportFloodForm = ({ onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    reporter_id: null, // Có thể lấy từ user context sau
    level: '',
    lng: null,
    lat: null,
    location_description: null
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Flood level options for Combobox
  const floodLevelOptions = [
    { id: '', name: '-- Chọn mức độ ngập --' },
    { id: 'Nhẹ', name: 'Nhẹ - Đến mắt cá (~10cm)' },
    { id: 'Trung bình', name: 'Trung bình - Đến đầu gối (~30cm)' },
    { id: 'Nặng', name: 'Nặng - Ngập nửa xe (~50cm)' },
  ];
  
  const selectedLevel = floodLevelOptions.find(opt => opt.id === formData.level) || floodLevelOptions[0];
  const [levelQuery, setLevelQuery] = useState('');
  
  const filteredLevels =
    levelQuery === ''
      ? floodLevelOptions
      : floodLevelOptions.filter((option) =>
          option.name
            .toLowerCase()
            .replace(/\s+/g, '')
            .includes(levelQuery.toLowerCase().replace(/\s+/g, ''))
        );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Validation
    if (!formData.name || formData.name.trim().length < 2) {
      setError('Tên phải có ít nhất 2 ký tự');
      return;
    }

    if (!['Nhẹ', 'Trung bình', 'Nặng'].includes(formData.level)) {
      setError('Vui lòng chọn mức độ ngập hợp lệ');
      return;
    }

    if (!formData.lng || !formData.lat) {
      setError('Vui lòng chọn vị trí trên bản đồ (click vào bản đồ)');
      return;
    }

    setLoading(true);
    try {
      const response = await submitFloodReport(formData);
      
      if (response.success) {
        setResult(response);
        // Reset form
        setFormData({
          name: '',
          level: '',
          lng: null,
          lat: null,
          location_description: null
        });
        
        // Callback success (chỉ gọi nếu có data)
        if (onSuccess && response.data) {
          onSuccess(response.data);
        }
      } else {
        setError(response.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setError('Lỗi kết nối: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (data) => {
    if (!data || !data.address) return null;
    
    const addr = data.address;
    const parts = [];
    
    // Ưu tiên: tên đường > tên địa điểm > quận/huyện > thành phố
    if (addr.road) {
      parts.push(addr.road);
    }
    if (addr.house_number) {
      parts.unshift(addr.house_number); // Số nhà đặt trước tên đường
    }
    if (addr.suburb || addr.neighbourhood) {
      parts.push(addr.suburb || addr.neighbourhood);
    }
    if (addr.ward) {
      parts.push(`Phường ${addr.ward}`);
    }
    if (addr.district || addr.city_district) {
      parts.push(`Quận ${addr.district || addr.city_district}`);
    }
    if (addr.city && !addr.district) {
      parts.push(addr.city);
    }
    if (addr.state) {
      parts.push(addr.state);
    }
    
    // Nếu có đủ thông tin, trả về địa chỉ đã format
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    // Fallback: dùng display_name nhưng format lại
    if (data.display_name) {
      // Loại bỏ các phần không cần thiết như country code
      const displayName = data.display_name
        .split(',')
        .slice(0, 4) // Lấy 4 phần đầu (thường là địa chỉ cụ thể)
        .join(', ')
        .trim();
      return displayName;
    }
    
    return null;
  };

  const handleLocationSelect = async (lng, lat) => {
    setFormData({ ...formData, lng, lat, location_description: null });
    setError(null);
    
    // Reverse geocoding để lấy địa chỉ từ tọa độ
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`,
        {
          headers: {
            'User-Agent': 'HCM-Flood-Frontend/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      
      if (data) {
        // Format địa chỉ đẹp hơn
        const formattedAddress = formatAddress(data);
        
        if (formattedAddress) {
          setFormData(prev => ({ ...prev, lng, lat, location_description: formattedAddress }));
        } else if (data.display_name) {
          // Fallback: dùng display_name gốc
          setFormData(prev => ({ ...prev, lng, lat, location_description: data.display_name }));
        }
      }
    } catch (err) {
      // Vẫn cho phép submit với lat/lng, nhưng thử lấy địa chỉ đơn giản hơn
      setFormData(prev => ({ ...prev, lng, lat }));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '90vh',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        background: '#007bff',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Báo cáo ngập lụt
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 10px'
            }}
          >
            <FaClose />
          </button>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Tên */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Tên của bạn <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nhập tên hoặc để ẩn danh"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
            required
          />
        </div>

        {/* Mức độ ngập */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Mức độ ngập <span style={{ color: 'red' }}>*</span>
          </label>
          <div className="relative">
            <Combobox value={selectedLevel} onChange={(option) => {
              setFormData({ ...formData, level: option.id });
            }}>
              <div className="relative mt-1">
                <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md border border-gray-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-200 text-xs">
                  <Combobox.Input
                    className="w-full border-none py-2 pl-3 pr-10 text-xs leading-4 text-gray-900 focus:ring-0 focus:outline-none cursor-pointer"
                    displayValue={(option) => option.name}
                    onChange={(event) => setLevelQuery(event.target.value)}
                    onClick={(e) => {
                      e.target.select();
                    }}
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2 focus:outline-none outline-none border-none bg-transparent">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400 pointer-events-none"
                      aria-hidden="true"
                    />
                  </Combobox.Button>
                </div>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                  afterLeave={() => setLevelQuery('')}
                >
                  <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-xs shadow-lg ring-1 ring-black/5 focus:outline-none">
                    {filteredLevels.length === 0 && levelQuery !== '' ? (
                      <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                        Không tìm thấy.
                      </div>
                    ) : (
                      filteredLevels.map((option) => (
                        <Combobox.Option
                          key={option.id}
                          className={({ active }) =>
                            `relative cursor-default select-none py-2 pl-10 pr-4 ${
                              active ? 'bg-blue-600 text-white' : 'text-gray-900'
                            }`
                          }
                          value={option}
                        >
                          {({ selected, active }) => (
                            <>
                              <span
                                className={`block truncate ${
                                  selected ? 'font-medium' : 'font-normal'
                                }`}
                              >
                                {option.name}
                              </span>
                              {selected ? (
                                <span
                                  className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                    active ? 'text-white' : 'text-blue-600'
                                  }`}
                                >
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              ) : null}
                            </>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </Transition>
              </div>
            </Combobox>
          </div>
        </div>

        {/* Bản đồ chọn vị trí */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Vị trí ngập <span style={{ color: 'red' }}>*</span>
          </label>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Click vào bản đồ để chọn vị trí ngập
          </p>
          <div style={{ height: '300px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ddd' }}>
            <MapContainer
              center={formData.lat && formData.lng ? [formData.lat, formData.lng] : DEFAULT_CENTER}
              zoom={formData.lat && formData.lng ? 15 : DEFAULT_ZOOM}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler 
                onLocationSelect={handleLocationSelect}
                selectedLocation={formData.lat && formData.lng ? [formData.lat, formData.lng] : null}
              />
              {formData.lat && formData.lng && (
                <Marker position={[formData.lat, formData.lng]} icon={createLocationIcon()} />
              )}
            </MapContainer>
          </div>
          {formData.lat && formData.lng && (
            <div style={{ fontSize: '12px', color: '#28a745', marginTop: '5px' }}>
              <p style={{ margin: '0 0 4px 0' }}>
                <FaCheck style={{ marginRight: '6px' }} /> Đã chọn: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
              </p>
              {formData.location_description && (
                <p style={{ margin: '0', color: '#17a2b8', fontSize: '11px' }}>
                  📍 {formData.location_description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '10px',
            background: '#fff5f5',
            border: '1px solid #dc3545',
            borderRadius: '6px',
            color: '#dc3545',
            marginBottom: '15px'
          }}>
            <FaXmark style={{ marginRight: '6px' }} /> {error}
          </div>
        )}

        {/* Success message */}
        {result && result.success && result.data && (
          <div style={{
            padding: '10px',
            background: result.data.verified_by_sensor ? '#f0fff4' : '#fffbf0',
            border: `1px solid ${result.data.verified_by_sensor ? '#28a745' : '#ffc107'}`,
            borderRadius: '6px',
            color: result.data.verified_by_sensor ? '#28a745' : '#856404',
            marginBottom: '15px'
          }}>
            {result.data.verified_by_sensor ? (
              <>
                <FaCheck style={{ marginRight: '6px' }} /> <strong>Đã xác minh!</strong> {result.message || 'Báo cáo của bạn đã được xác minh bởi hệ thống cảm biến. Cảm ơn!'}
              </>
            ) : (
              <>
                <FaClock style={{ marginRight: '6px' }} /> <strong>Đang xem xét</strong> {result.message || 'Báo cáo của bạn đang được xem xét. Cảm ơn!'}
              </>
            )}
          </div>
        )}
        
        {/* Success message khi không có data */}
        {result && result.success && !result.data && result.message && (
          <div style={{
            padding: '10px',
            background: '#fffbf0',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            color: '#856404',
            marginBottom: '15px'
          }}>
            <FaClock style={{ marginRight: '6px' }} /> {result.message}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s'
          }}
        >
          {loading ? (
            <>
              <FaClock /> Đang gửi...
            </>
          ) : (
            <>
              <FaPaperPlane /> Gửi báo cáo
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ReportFloodForm;
