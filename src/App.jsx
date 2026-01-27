import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Sửa lỗi icon marker của Leaflet không hiển thị trong React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function App() {
  const [floodData, setFloodData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Gọi API từ Backend chuyên nghiệp (Port 3000)
        // Sử dụng endpoint /api/v1/flood-data (có đầy đủ thông tin vị trí)
        // Thêm tham số ngẫu nhiên ?t=... để tránh trình duyệt lưu cache kết quả cũ
        const response = await axios.get(`http://localhost:3000/api/v1/flood-data?t=${Date.now()}`);
        
        if (response.data && response.data.success && response.data.data) {
          // Cấu trúc response: {success: true, data: [...]}
          const data = response.data.data;
          
          // Chuẩn hóa dữ liệu để đảm bảo có đầy đủ các field cần thiết
          const normalizedData = data.map(item => ({
            sensor_id: item.sensor_id,
            water_level: item.water_level || 0,
            created_at: item.created_at,
            location_name: item.location_name || 'Vị trí không xác định',
            lat: item.lat || 10.776, // Mặc định tọa độ TP.HCM nếu không có
            lng: item.lng || 106.701
          }));
          
          setFloodData(normalizedData);
          console.log('Dữ liệu đã tải:', normalizedData);
        } else {
          console.warn('Response không đúng định dạng:', response.data);
          setFloodData([]);
        }
      } catch (error) {
        console.error("Lỗi cập nhật:", error);
        if (error.response) {
          console.error("Status:", error.response.status);
          console.error("Chi tiết lỗi:", error.response.data);
        } else if (error.request) {
          console.error("Không nhận được response từ server. Kiểm tra xem Backend đã chạy chưa?");
        } else {
          console.error("Lỗi:", error.message);
        }
        // Không set floodData = [] ở đây để giữ dữ liệu cũ nếu có
      } finally {
        setLoading(false);
      }
    };

    fetchData(); // Gọi ngay lần đầu khi load trang
    const interval = setInterval(fetchData, 5000); // Tự động đo và cập nhật sau mỗi 5 giây

    return () => clearInterval(interval); // Xóa bộ đợi khi tắt trang để tránh tốn tài nguyên
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <div style={{ padding: '10px', background: '#2c3e50', color: 'white', textAlign: 'center' }}>
        <h2>Hệ Thống Cảnh Báo Ngập Lụt TP.HCM - Real-time Dashboard</h2>
        {loading ? <p>Đang tải dữ liệu...</p> : <p>Đang theo dõi {floodData.length} trạm cảm biến</p>}
      </div>

      <MapContainer center={[10.776, 106.701]} zoom={13} style={{ height: 'calc(100vh - 80px)', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {floodData.map((item, index) => (
          <Marker key={index} position={[item.lat, item.lng]}>
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <strong style={{ color: '#e74c3c' }}>{item.location_name}</strong><br />
                <b>Mức nước: </b> {item.water_level} cm <br />
                <b>Trạng thái: </b> {item.water_level > 50 ? "⚠️ Cảnh báo ngập" : "✅ An toàn"} <br />
                <small>Cập nhật: {new Date(item.created_at).toLocaleString()}</small>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;