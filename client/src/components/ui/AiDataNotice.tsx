// SRS mục 1.2 Phạm vi: bắt buộc cảnh báo dữ liệu gửi cho bên thứ ba
export const AiDataNotice = ({ className = '' }: { className?: string }) => (
  <p className={`text-[10px] leading-snug text-stone-500 ${className}`}>
    Dữ liệu bạn cung cấp có thể được gửi tới nhà cung cấp dịch vụ AI bên thứ ba
    để thực hiện chức năng tạo nội dung/phân tích.
  </p>
)
