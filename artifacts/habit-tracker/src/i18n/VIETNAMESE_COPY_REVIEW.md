# Vietnamese copy review

Source: `locales/vi.ts`  
Format: `"current phrase" → "recommendation"`  
Legend: **OK** = keep as-is · **Tweak** = more natural / clearer · **Fix** = awkward, technical, or misleading

**Status:** All Fix + Tweak recommendations below have been applied to `locales/vi.ts`.

---

## common

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Thử lại"` → keep |
| OK | `"Hủy"` → keep |
| OK | `"Lưu"` → keep |
| OK | `"Xóa"` → keep |
| OK | `"Đang tải…"` → keep |
| OK | `"(tùy chọn)"` → keep |
| OK | `"Đăng xuất"` → keep |
| OK | `"Cài đặt"` → keep |
| OK | `"Quyền riêng tư"` → keep |
| OK | `"Hỗ trợ"` → keep |

---

## nav

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Hôm nay"` → keep |
| OK | `"Thói quen"` → keep |
| OK | `"Thống kê"` → keep |
| OK | `"Lịch sử"` → keep |
| OK | `"Sức khỏe"` → keep |
| Tweak | `"Cún"` → `"Cún con"` *(optional; "Cún" is cute but can feel abrupt as a tab label)* |
| OK | `"Bạn bè"` → keep |
| OK | `"Xếp hạng"` → keep |
| OK | `"Premium"` → keep *(English is normal in VN apps)* |

---

## welcome

| Status | Current → Recommendation |
|--------|--------------------------|
| Fix | `"Xây thói quen bền vững"` → `"Xây thói quen gắn bó lâu dài"` *"bền vững" sounds environmental/ESG; English means habits that stick* |
| OK | `"Bắt đầu"` → keep |
| OK | `"Đăng nhập"` → keep |
| Tweak | `"Dữ liệu của bạn được lưu theo tài khoản trên mọi thiết bị."` → `"Dữ liệu được lưu theo tài khoản của bạn trên mọi thiết bị."` |

---

## auth

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Đang tải Habiganize…"` → keep |
| Fix | `"Không tải được đăng nhập"` → `"Không thể mở trang đăng nhập"` |
| Fix | `"Clerk chưa khởi động xong. Trên môi trường production thường do site vẫn dùng khóa development (pk_test_), hoặc DNS clerk.habitganizer.tech chưa cấu hình."` → `"Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại sau, hoặc liên hệ hỗ trợ nếu lỗi vẫn còn."` *Too technical for end users; Clerk/DNS/pk_test_ should not appear in UI* |

---

## language

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Ngôn ngữ"` → keep |
| Tweak | `"Chọn ngôn ngữ hiển thị Habiganize"` → `"Chọn ngôn ngữ hiển thị cho Habiganize"` |
| OK | `"English"` → keep |
| OK | `"Tiếng Việt"` → keep |

---

## settings

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Cài đặt"` → keep |
| OK | `"Quản lý bạn bè, xếp hạng, hồ sơ và tài khoản ở một nơi."` → keep |
| OK | `"Quản lý"` → keep |
| OK | `"Hồ sơ"` → keep |
| OK | `"Tài khoản"` → keep |
| Fix | `"Mọi thứ bạn cần mỗi ngày, kể cả Bạn bè trên mobile."` → `"Mọi thứ bạn cần mỗi ngày, kể cả mục Bạn bè trên điện thoại."` *"mobile" is English; capitalize "Bạn bè" looks odd mid-sentence* |
| Tweak | `"Mã bạn bè, lời mời và vòng kết nối"` → `"Mã bạn bè, lời mời và danh sách bạn"` *"vòng kết nối" is unnatural* |
| Tweak | `"Lịch sử hoàn thành và lịch"` → `"Lịch sử hoàn thành và xem lịch"` |
| OK | `"Bảng xếp hạng bạn bè và toàn cầu"` → keep |
| OK | `"Gói và thành viên"` → keep |
| OK | `"Gửi phản hồi"` → keep |
| OK | `"Ý tưởng, lỗi, hoặc đánh giá nhanh"` → keep |
| Tweak | `"Sửa hồ sơ"` → `"Chỉnh sửa hồ sơ"` |
| OK | `"Email & bảo mật"` → keep |
| Fix | `"Tên gọi"` → `"Tên hiển thị"` *"Tên gọi" is uncommon in app UI* |
| OK | `"Chúng tôi nên gọi bạn là gì?"` → keep |
| OK | `"Sinh nhật"` → keep |
| OK | `"Số điện thoại"` → keep |
| OK | `"Ghi chú ngắn"` → keep |
| Fix | `"Một dòng về mục tiêu giúp trải nghiệm sau này cá nhân hơn."` → `"Viết một dòng về mục tiêu của bạn để trải nghiệm cá nhân hơn."` |
| OK | `"Email đăng nhập"` → keep |
| OK | `"Chưa có"` → keep |
| OK | `"Đổi email hoặc kết nối Gmail →"` → keep |
| OK | `"Lưu hồ sơ"` → keep |
| OK | `"Đã lưu hồ sơ"` → keep |
| Tweak | `"Không lưu được hồ sơ"` → `"Không thể lưu hồ sơ"` |
| OK | `"Vui lòng thử lại."` → keep |
| Fix | `"Clerk quản lý mật khẩu, MFA, Gmail / Google OAuth và các phương thức đăng nhập khác tại đây."` → `"Bạn có thể đổi mật khẩu, bật xác thực 2 bước, kết nối Gmail và các cách đăng nhập khác tại đây."` *Hide "Clerk" / "OAuth" / "MFA" jargon from users* |

---

## today

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Hôm nay"` → keep |
| OK | `"Ngày nghỉ!"` → keep |
| OK | `"Hôm nay không có thói quen nào. Tận hưởng ngày nghỉ nhé!"` → keep |
| OK | `"Xong hết hôm nay rồi!"` → keep |
| OK | `"Cứ tiếp tục — bạn làm được mà"` → keep |
| OK | `"Chưa có thói quen nào hôm nay"` → keep |
| OK | `"Thêm thói quen ở trang Thói quen, hoặc kiểm tra lịch của bạn."` → keep |
| OK | `"Đã xong"` → keep |
| OK | `"Còn lại"` → keep |
| OK | `"ngày liên tiếp"` → keep *(streak)* |
| OK | `"Thêm ghi chú"` → keep |
| Tweak | `"Sửa ghi chú"` → `"Chỉnh sửa ghi chú"` |
| OK | `"Hôm nay thế nào?"` → keep |
| OK | `"Bạn đang cảm thấy thế nào?"` → keep |
| OK | `"Tuyệt"` → keep *(Great)* |
| Fix | `"Ổn"` → `"Tốt"` *"Ổn" ≈ fine/meh; English is "Good"* |
| OK | `"Bình thường"` → keep *(Okay)* |
| Fix | `"Hơi mệt"` → `"Uể oải"` *"Meh" ≠ tired; "Uể oải" / "Hơi chán" closer* |
| OK | `"Tệ"` → keep |
| OK | `"Lưu"` → keep |
| OK | `"Hoàn tác"` → keep |
| OK | `"Xong"` → keep |
| OK | `"Danh sách mua sắm"` → keep |
| Tweak | `"Không tải được thói quen"` → `"Không thể tải thói quen"` |
| Fix | `"Không đánh dấu hoàn thành được"` → `"Không thể đánh dấu hoàn thành"` *Word order feels translated* |
| Fix | `"Không bỏ hoàn thành được"` → `"Không thể hủy hoàn thành"` |
| Tweak | `"Không lưu được"` → `"Không thể lưu"` |
| OK | `"Vui lòng thử lại."` → keep |
| OK | `"Xong hết thói quen!"` → keep |
| OK | `"Hoàn thành {pct}%"` → keep |
| Tweak | `"Xin chào,"` → `"Chào,"` *Shorter, matches casual app tone; or keep if you want warmer* |
| OK | `"Bạn"` → keep *(fallback name)* |
| Tweak | `"Sửa tên"` → `"Đổi tên"` |
| Tweak | `"Không cập nhật được tên"` → `"Không thể cập nhật tên"` |
| OK | `"Tâm trạng"` → keep |
| OK | `"Ghi chú"` → keep |
| OK | `"Cảm giác thế nào? Thêm ghi chú ngắn nếu muốn."` → keep |
| OK | `"Tùy chọn, ví dụ: thấy tràn đầy năng lượng, khó hơn thường ngày…"` → keep |
| OK | `"Xóa"` → keep |
| OK | `"Bỏ qua"` → keep |
| OK | `"Thói quen"` → keep |

---

## habits

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Tất cả thói quen"` → keep |
| Fix | `"Cấu hình thói quen hàng ngày của bạn."` → `"Quản lý thói quen hàng ngày của bạn."` *"Cấu hình" is techy* |
| OK | `"Thói quen mới"` → keep |
| OK | `"Tạo thói quen"` → keep |
| OK | `"Đang dùng"` → keep *(Active)* |
| OK | `"Đã lưu trữ"` → keep *(Archived)* |
| OK | `"Chưa có thói quen nào"` → keep |
| Fix | `"Tạo thói quen đầu tiên để bắt đầu xây dựng lộ trình của bạn."` → `"Tạo thói quen đầu tiên để bắt đầu xây dựng nhịp sống của bạn."` *"lộ trình" sounds like a business roadmap* |
| OK | `"Không có thói quen đã lưu trữ"` → keep |
| OK | `"Thói quen đã lưu trữ sẽ hiện ở đây. Lịch sử luôn được giữ."` → keep |
| Tweak | `"Sửa"` → `"Chỉnh sửa"` |
| OK | `"Lưu trữ"` → keep |
| OK | `"Khôi phục"` → keep |
| OK | `"Xóa thói quen vĩnh viễn?"` → keep |
| Tweak | `'Thao tác này xóa vĩnh viễn "{name}" và mọi lần hoàn thành trong lịch sử. Không thể hoàn tác. Nếu chỉ muốn ẩn khỏi danh sách đang dùng, hãy lưu trữ thay vì xóa.'` → `'Thao tác này sẽ xóa vĩnh viễn "{name}" và toàn bộ lịch sử hoàn thành. Không thể hoàn tác. Nếu chỉ muốn ẩn khỏi danh sách đang dùng, hãy chọn Lưu trữ.'` |
| OK | `"Xóa vĩnh viễn"` → keep |
| Tweak | `"Không tải được thói quen"` → `"Không thể tải thói quen"` |
| OK | `"Đã xóa thói quen"` → keep |
| OK | `"Thói quen và lịch sử đã bị xóa hoàn toàn."` → keep |
| OK | `"Đã lưu trữ thói quen"` → keep |
| OK | `'"{name}" đã ẩn khỏi danh sách đang dùng. Lịch sử vẫn được giữ.'` → keep |
| OK | `"Đã khôi phục thói quen"` → keep |
| OK | `'"{name}" đã quay lại danh sách đang dùng.'` → keep |
| OK | `"ngày liên tiếp"` → keep |
| Tweak | `"Chuỗi"` → `"Chuỗi ngày"` *(short label for Streak; clearer)* |
| OK | `"Kỷ lục"` → keep |

---

## Section titles only (stats / history / health / pups / friends / ranks / premium)

| Status | Current → Recommendation |
|--------|--------------------------|
| OK | `"Thống kê"` → keep |
| OK | `"Lịch sử"` → keep |
| OK | `"Sức khỏe"` → keep |
| Tweak | `"Cún"` → `"Cún con"` *(same as nav)* |
| OK | `"Bạn bè"` → keep |
| OK | `"Xếp hạng"` → keep |
| OK | `"Premium"` → keep |

---

## Priority fixes (do these first)

1. **Hide developer jargon** — auth failed body, settings `accountIntro` (Clerk / MFA / OAuth / pk_test_ / DNS).
2. **Mood labels** — `"Ổn"` → `"Tốt"`; `"Hơi mệt"` → `"Uể oải"`.
3. **Error phrasing** — prefer `"Không thể …"` over `"Không … được"`.
4. **Tagline** — `"bền vững"` → something closer to “habits that stick”.
5. **Settings mobile line** — replace English `"mobile"`; soften `"Tên gọi"` and bio placeholder.
6. **Habits subtitle** — `"Cấu hình"` → `"Quản lý"`; `"lộ trình"` → `"nhịp sống"`.

---

## Consistency notes

- Prefer one pattern for failures: **`Không thể …`** everywhere.
- Prefer **`Chỉnh sửa`** over bare **`Sửa`** on buttons (clearer on mobile).
- Keep casual tone on Today (`Xong hết`, `bạn làm được mà`) — that part already feels user-friendly.
- Streak wording is consistent as **`ngày liên tiếp`** — good; if you shorten the label, use **`Chuỗi ngày`** not just **`Chuỗi`**.
)
