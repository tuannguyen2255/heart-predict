"use client";

import { clearSession, getAccessToken } from "@/lib/client-session";
import { API_ENDPOINTS } from "@/lib/api-config";
import { apiErrorMessage } from "@/lib/api-errors";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, AlertTriangle, CheckCircle, HeartPulse, 
  Edit3, X, Save, Calendar, User, Ruler, Scale, Activity, Trash2, Shield
} from "lucide-react";

// ⚠️ CẤU HÌNH TẠI ĐÂY: Sửa lại cho đúng port FastAPI của bạn

interface UserProfileData {
  age: number | string;
  sex: number | string; // 0: Nữ, 1: Nam
  height: number | string;
  weight: number | string;
  blood_pressure: number | string;
  cholesterol: number | string;
}

export function ProfileForm() {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Trạng thái bật/tắt chế độ chỉnh sửa
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{
    reason: string;
    scheduled_delete_at?: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [username, setUsername] = useState("");
  
  // Dữ liệu gốc lưu từ Backend
  const [profile, setProfile] = useState<UserProfileData>({
    age: "", sex: "1", height: "", weight: "", blood_pressure: "", cholesterol: ""
  });

  // Dữ liệu tạm thời khi người dùng đang gõ trong Form chỉnh sửa
  const [formData, setFormData] = useState<UserProfileData>({
    age: "", sex: "1", height: "", weight: "", blood_pressure: "", cholesterol: ""
  });

  const fetchProfile = async () => {
    setIsFetching(true);
    setError("");
    try {
      const storedUsername = localStorage.getItem("username") || "Khách hàng";
      setUsername(storedUsername);

      const token = getAccessToken();
      if (!token) {
        setError("Yêu cầu mã xác thực xác minh tài khoản.");
        return;
      }

      // Gọi API lấy thông tin từ Backend
      const res = await fetch(API_ENDPOINTS.userInfo, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Lỗi kết nối: Server trả về giao diện HTML thay vì dữ liệu JSON.");
      }

      if (!res.ok) throw new Error(await apiErrorMessage(res));
      
      const data = await res.json();
      if (data) {
        const standardData = {
          age: data.age ?? "Chưa cập nhật",
          sex: data.sex === 0 || data.sex === 1 || data.sex === "0" || data.sex === "1" ? String(data.sex) : "",
          height: data.height ?? "Chưa cập nhật",
          weight: data.weight ?? "Chưa cập nhật",
          blood_pressure: data.blood_pressure ?? "Chưa cập nhật",
          cholesterol: data.cholesterol ?? "Chưa cập nhật"
        };
        setProfile(standardData);
        setFormData(standardData); // Đồng bộ luôn vào form tạm
      }

      // Kiểm tra trạng thái yêu cầu xóa tài khoản (nếu có)
      try {
        const delRes = await fetch(API_ENDPOINTS.deletionRequest, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (delRes.ok) {
          const delData = await delRes.json();
          if (delData?.pending) {
            setPendingDeletion({
              reason: delData.reason || "",
              scheduled_delete_at: delData.scheduled_delete_at || null,
            });
          } else {
            setPendingDeletion(null);
          }
        }
      } catch {
        // Không chặn tải hồ sơ nếu endpoint phụ tạm gián đoạn
      }
    } catch (err: any) {
      setError(err.message || "Lỗi đồng bộ hồ sơ.");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Bật chế độ sửa: Copy dữ liệu thật sang dữ liệu form tạm
  const handleStartEdit = () => {
    setFormData({
      age: profile.age === "Chưa cập nhật" ? "" : profile.age,
      sex: profile.sex === "0" || profile.sex === "1" ? String(profile.sex) : "1",
      height: profile.height === "Chưa cập nhật" ? "" : profile.height,
      weight: profile.weight === "Chưa cập nhật" ? "" : profile.weight,
      blood_pressure: profile.blood_pressure === "Chưa cập nhật" ? "" : profile.blood_pressure,
      cholesterol: profile.cholesterol === "Chưa cập nhật" ? "" : profile.cholesterol,
    });
    setError("");
    setSuccess("");
    setIsEditing(true);
  };

  // Hủy chế độ sửa: Quay về trạng thái xem ban đầu
  const handleCancelEdit = () => {
    setIsEditing(false);
    setError("");
  };

  // Gửi dữ liệu cập nhật lên Backend
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = getAccessToken();
      
      const payload = {
        age: formData.age !== "" ? parseInt(String(formData.age), 10) : null,
        sex: formData.sex === "0" || formData.sex === "1" ? parseInt(String(formData.sex), 10) : 1,
        height: formData.height !== "" ? parseFloat(String(formData.height)) : null,
        weight: formData.weight !== "" ? parseFloat(String(formData.weight)) : null,
        blood_pressure: formData.blood_pressure !== "" ? parseInt(String(formData.blood_pressure), 10) : null,
        cholesterol: formData.cholesterol !== "" ? parseInt(String(formData.cholesterol), 10) : null,
      };

      const res = await fetch(API_ENDPOINTS.updateProfile, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("Lỗi kết nối: Server cập nhật trả về giao diện HTML.");
      }

      if (!res.ok) throw new Error(await apiErrorMessage(res));
      
      setSuccess("Đã cập nhật hồ sơ sức khỏe.");
      setIsEditing(false); // Tắt chế độ sửa, quay về màn hình hiển thị
      fetchProfile(); // Tải lại dữ liệu mới nhất từ DB lên màn hình
    } catch (err: any) {
      setError(err.message || "Lỗi lưu thông tin.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-2" />
        <p className="text-xs">Đang tải hồ sơ...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="border border-slate-200 rounded-lg overflow-hidden">
        
        {/* Banner Top */}
        <CardHeader className="border-b border-slate-200 bg-white text-slate-900 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <HeartPulse className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Thông tin sức khỏe</CardTitle>
                <CardDescription className="text-slate-600 text-xs mt-0.5">
                  Tài khoản: <span className="font-mono font-bold underline px-1.5 py-0.5 rounded ml-0.5 text-primary">{username}</span>
                </CardDescription>
              </div>
            </div>

            {/* Nút kích hoạt chế độ sửa (Chỉ hiện khi đang ở chế độ xem) */}
            {!isEditing && (
              <Button onClick={handleStartEdit} className="bg-primary text-white hover:bg-primary/90 font-semibold rounded-md text-sm gap-1.5 self-start sm:self-auto">
                <Edit3 className="h-3.5 w-3.5" /> Chỉnh sửa hồ sơ
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Nội dung chính */}
        <CardContent className="p-6 bg-white">
          {!isEditing && error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          
          {/* CHẾ ĐỘ 1: CHỈ HIỂN THỊ (READ-ONLY) */}
          {!isEditing ? (
            <div className="space-y-6">
              
              {/* Nhóm 1: Thể trạng */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-sky-500 rounded-full"></span> Chỉ số hình thể hiện tại
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Tuổi</p>
                      <p className="text-sm font-bold text-slate-800">{profile.age} {typeof profile.age === 'number' ? 'tuổi' : ''}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Chiều cao</p>
                      <p className="text-sm font-bold text-slate-800">{profile.height} {typeof profile.height === 'number' ? 'cm' : ''}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Scale className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Cân nặng</p>
                      <p className="text-sm font-bold text-slate-800">{profile.weight} {typeof profile.weight === 'number' ? 'kg' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Tim mạch */}
              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-sky-500 rounded-full"></span> Chỉ số tim mạch
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <User className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Giới tính sinh học</p>
                      <p className="text-sm font-bold text-slate-800">
                        {profile.sex === "1" ? "Nam giới" : profile.sex === "0" ? "Nữ giới" : "Chưa cập nhật"}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Activity className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Huyết áp lúc nghỉ</p>
                      <p className="text-sm font-bold text-slate-800">{profile.blood_pressure} {typeof profile.blood_pressure === 'number' ? 'mmHg' : ''}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <HeartPulse className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Cholesterol huyết thanh</p>
                      <p className="text-sm font-bold text-slate-800">{profile.cholesterol} {typeof profile.cholesterol === 'number' ? 'mg/dl' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback thông báo thành công khi vừa lưu xong */}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-700 text-xs mt-4">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}
            </div>
          ) : (
            
            /* CHẾ ĐỘ 2: ĐIỀN FORM CHỈNH SỬA (EDIT MODE) */
            <form onSubmit={handleUpdate} className="space-y-6">
              
              {/* Form Nhóm 1 */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-sky-500 rounded-full"></span> Thay đổi thông số thể hình
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Tuổi hiện tại</Label>
                    <Input type="number" placeholder="Ví dụ: 24" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="rounded-xl border-slate-200 text-sm focus-visible:ring-sky-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Chiều cao (cm)</Label>
                    <Input type="number" step="0.1" placeholder="Ví dụ: 172" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="rounded-xl border-slate-200 text-sm focus-visible:ring-sky-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Cân nặng (kg)</Label>
                    <Input type="number" step="0.1" placeholder="Ví dụ: 68" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="rounded-xl border-slate-200 text-sm focus-visible:ring-sky-500" required />
                  </div>
                </div>
              </div>

              {/* Form Nhóm 2 */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-sky-500 rounded-full"></span> Thay đổi thông số tuần hoàn
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Giới tính sinh học</Label>
                    <select value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})} className="w-full h-10 px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                      <option value="1">Nam giới (Male)</option>
                      <option value="0">Nữ giới (Female)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Huyết áp (mm Hg)</Label>
                    <Input type="number" placeholder="Ví dụ: 120" value={formData.blood_pressure} onChange={e => setFormData({...formData, blood_pressure: e.target.value})} className="rounded-xl border-slate-200 text-sm focus-visible:ring-sky-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Cholesterol (mg/dl)</Label>
                    <Input type="number" placeholder="Ví dụ: 200" value={formData.cholesterol} onChange={e => setFormData({...formData, cholesterol: e.target.value})} className="rounded-xl border-slate-200 text-sm focus-visible:ring-sky-500" required />
                  </div>
                </div>
              </div>

              {/* Thông báo lỗi nếu có */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Cụm nút tác vụ Huỷ / Lưu */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isLoading} className="w-full sm:w-1/3 rounded-xl border-slate-200 font-semibold text-xs gap-1.5 h-11">
                  <X className="h-4 w-4" /> Hủy bỏ
                </Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-2/3 bg-slate-800 hover:bg-slate-900 text-white font-bold h-11 rounded-xl shadow-md gap-1.5">
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Lưu thông tin mới</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Quyền dữ liệu & Yêu cầu xóa tài khoản (duyệt & cam kết xóa trong 24 giờ) */}
      <Card className="border-slate-200/80 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-5 text-slate-600">
              <h3 className="text-sm font-bold text-slate-900">Quyền dữ liệu &amp; Yêu cầu xóa tài khoản</h3>
              <p>
                Bạn có thể gửi yêu cầu xóa tài khoản kèm lý do. Quản trị viên sẽ xem xét và{" "}
                <strong>cam kết xóa toàn bộ dữ liệu trong vòng 24 giờ</strong> nếu không có vấn đề phát sinh. Xem thêm tại{" "}
                <Link href="/terms#privacy" className="font-semibold text-sky-700 hover:underline">
                  Chính sách bảo vệ dữ liệu
                </Link>{" "}
                hoặc liên hệ{" "}
                <a href="mailto:tuannguyen2205@gmail.com" className="font-semibold text-sky-700 hover:underline">
                  tuannguyen2205@gmail.com
                </a>
                .
              </p>
            </div>
          </div>

          {pendingDeletion ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 text-xs text-amber-900">
              <div className="font-semibold">
                Đã tiếp nhận yêu cầu xóa tài khoản — đang chờ duyệt (cam kết xử lý trong 24 giờ)
              </div>
              <p className="text-amber-800">
                <strong>Lý do đã gửi:</strong> {pendingDeletion.reason}
              </p>
              {pendingDeletion.scheduled_delete_at && (
                <p className="text-amber-800">
                  <strong>Thời hạn dự kiến hoàn tất xóa:</strong>{" "}
                  {new Date(pendingDeletion.scheduled_delete_at).toLocaleString("vi-VN")}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSubmittingDelete}
                onClick={async () => {
                  setIsSubmittingDelete(true);
                  setError("");
                  try {
                    const token = getAccessToken();
                    if (!token) throw new Error("Phiên đăng nhập đã hết hạn.");
                    const res = await fetch(API_ENDPOINTS.deletionRequest, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error(await apiErrorMessage(res));
                    setPendingDeletion(null);
                    setSuccess("Đã hủy yêu cầu xóa tài khoản.");
                  } catch (err: any) {
                    setError(err.message || "Không thể hủy yêu cầu xóa.");
                  } finally {
                    setIsSubmittingDelete(false);
                  }
                }}
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs font-semibold"
              >
                {isSubmittingDelete ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Hủy yêu cầu xóa
              </Button>
            </div>
          ) : !showDeleteForm ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteForm(true);
                setError("");
              }}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Gửi yêu cầu xóa tài khoản &amp; dữ liệu
            </Button>
          ) : (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-900">
                  Vui lòng cho biết lý do bạn muốn xóa tài khoản (bắt buộc):
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "Đã trải nghiệm xong bản thử nghiệm",
                    "Không còn nhu cầu sử dụng",
                    "Lo ngại về quyền riêng tư dữ liệu",
                    "Muốn tạo lại tài khoản khác",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeleteReason(preset)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-700"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                maxLength={500}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Nhập lý do chi tiết (tối thiểu 5 ký tự)..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />

              <p className="text-[11px] leading-4 text-slate-600">
                Yêu cầu sẽ được gửi tới quản trị viên (<strong>Nguyễn Minh Tuấn</strong>) để rà soát và{" "}
                <strong>cam kết xóa hoàn toàn dữ liệu trong vòng 24 giờ</strong> nếu không có vấn đề phát sinh.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmittingDelete || deleteReason.trim().length < 5}
                  onClick={async () => {
                    setIsSubmittingDelete(true);
                    setError("");
                    setSuccess("");
                    try {
                      const token = getAccessToken();
                      if (!token) throw new Error("Phiên đăng nhập đã hết hạn.");
                      const res = await fetch(API_ENDPOINTS.deletionRequest, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ reason: deleteReason.trim() }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.detail || "Không thể gửi yêu cầu xóa.");
                      setPendingDeletion({
                        reason: data.reason || deleteReason.trim(),
                        scheduled_delete_at: data.scheduled_delete_at || null,
                      });
                      setShowDeleteForm(false);
                      setDeleteReason("");
                      setSuccess(data.message || "Đã gửi yêu cầu xóa tài khoản (xử lý trong vòng 24 giờ).");
                    } catch (err: any) {
                      setError(err.message || "Không thể gửi yêu cầu xóa.");
                    } finally {
                      setIsSubmittingDelete(false);
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5"
                >
                  {isSubmittingDelete ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Gửi yêu cầu xóa (xử lý trong 24h)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSubmittingDelete}
                  onClick={() => {
                    setShowDeleteForm(false);
                    setDeleteReason("");
                  }}
                  className="text-xs"
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
