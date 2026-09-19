import type { SlideComponent } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

interface FloatingContextualToolbarProps {
    selectedComponent: SlideComponent | null;
    onUpdateComponent: (patch: Partial<SlideComponent>) => void;
    onDuplicateComponent: (comp: SlideComponent) => void;
    onDeleteComponent: (id: string) => void;
}

const COLOR_SWATCHES = [
    { name: "Mực đậm (Brand Ink)", value: "#173c39" },
    { name: "Cam đất (Brand Rust)", value: "#c45b3f" },
    { name: "Giấy ngà (Brand Paper)", value: "#f5f1e8" },
    { name: "Đen than", value: "#1c1917" },
    { name: "Xám đá", value: "#64748b" },
    { name: "Trắng", value: "#ffffff" },
    { name: "Đỏ rượu", value: "#dc2626" },
    { name: "Xanh dương", value: "#2563eb" },
];

export const FloatingContextualToolbar = ({
    selectedComponent,
    onUpdateComponent,
    onDuplicateComponent,
    onDeleteComponent,
}: FloatingContextualToolbarProps) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Đóng bảng màu khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setIsColorPickerOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!selectedComponent) {
        return null;
    }

    // TRƯỜNG HỢP: ĐỐI TƯỢNG HÌNH ẢNH
    if (selectedComponent.type === "image") {
        const currentWidth = selectedComponent.width ?? 40;

        return (
            <div className="flex h-11 items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-4 shadow-md backdrop-blur-xs select-none">
                <span className="flex items-center gap-1 text-xs font-bold text-brand-rust bg-brand-rust/10 px-2.5 py-1 rounded-full">
                    <span>🖼️</span>
                    <span>Hình ảnh</span>
                </span>

                <span className="h-4 w-px bg-stone-200" />

                {/* Kích thước chiều rộng ảnh (%) */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-stone-500">Rộng:</span>
                    <button
                        type="button"
                        onClick={() =>
                            onUpdateComponent({
                                width: Math.max(10, currentWidth - 5),
                            })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-xs font-bold hover:bg-stone-100"
                        title="Thu nhỏ ảnh"
                    >
                        -
                    </button>
                    <span className="w-10 text-center font-mono text-xs font-bold text-stone-800">{currentWidth}%</span>
                    <button
                        type="button"
                        onClick={() =>
                            onUpdateComponent({
                                width: Math.min(95, currentWidth + 5),
                            })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 text-xs font-bold hover:bg-stone-100"
                        title="Phóng to ảnh"
                    >
                        +
                    </button>
                </div>

                <span className="h-4 w-px bg-stone-200" />

                {/* Nhân bản */}
                <button
                    type="button"
                    onClick={() => onDuplicateComponent(selectedComponent)}
                    className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    title="Nhân bản ảnh"
                >
                    <span>📋</span>
                    <span>Nhân bản</span>
                </button>

                {/* Xóa */}
                <button
                    type="button"
                    onClick={() => onDeleteComponent(selectedComponent.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    title="Xóa ảnh khỏi slide"
                >
                    <span>🗑️</span>
                </button>
            </div>
        );
    }

    // TRƯỜNG HỢP: ĐỐI TƯỢNG VĂN BẢN (Text, Title, Subtitle, Bullets, Quote)
    const currentFontSize = selectedComponent.fontSize ?? 20;
    const isBold = selectedComponent.fontWeight === "bold";
    const isItalic = selectedComponent.fontStyle === "italic";
    const isUnderline = selectedComponent.textDecoration === "underline";
    const isUppercase = selectedComponent.textCase === "uppercase";
    const textAlign = selectedComponent.textAlign || "left";

    return (
        <div className="flex h-11 items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3.5 shadow-md backdrop-blur-xs select-none">
            {/* 1. Phông chữ (Canva font picker) */}
            <select
                value={selectedComponent.fontFamily || "sans"}
                onChange={e =>
                    onUpdateComponent({
                        fontFamily: e.target.value as "display" | "sans" | "mono",
                    })
                }
                className="h-7 rounded-md border border-stone-200 bg-transparent px-2 text-xs font-medium text-stone-800 outline-none hover:bg-stone-50 cursor-pointer"
                title="Chọn phông chữ"
            >
                <option value="sans">Inter Sans</option>
                <option value="display">Lora Serif</option>
                <option value="mono">JetBrains Mono</option>
            </select>

            <span className="h-4 w-px bg-stone-200" />

            {/* 2. Cỡ chữ (- [size] +) */}
            <div className="flex items-center gap-0.5">
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            fontSize: Math.max(10, currentFontSize - 2),
                        })
                    }
                    className="flex h-7 w-6 items-center justify-center rounded-l-md border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100"
                    title="Giảm cỡ chữ"
                >
                    -
                </button>
                <input
                    type="number"
                    value={currentFontSize}
                    onChange={e =>
                        onUpdateComponent({
                            fontSize: Math.max(8, Math.min(120, Number(e.target.value) || 20)),
                        })
                    }
                    className="h-7 w-11 border-y border-stone-200 text-center font-mono text-xs font-bold text-stone-800 outline-none"
                    title="Nhập cỡ chữ"
                />
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            fontSize: Math.min(120, currentFontSize + 2),
                        })
                    }
                    className="flex h-7 w-6 items-center justify-center rounded-r-md border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100"
                    title="Tăng cỡ chữ"
                >
                    +
                </button>
            </div>

            <span className="h-4 w-px bg-stone-200" />

            {/* 3. Màu chữ (Canva 'A' with color swatch) */}
            <div className="relative" ref={colorPickerRef}>
                <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(prev => !prev)}
                    className="flex h-7 flex-col items-center justify-center rounded-md px-2 hover:bg-stone-100"
                    title="Màu chữ"
                >
                    <span className="text-xs font-bold text-stone-900 leading-none">A</span>
                    <span
                        className="mt-0.5 h-1 w-4 rounded-full border border-stone-300"
                        style={{ backgroundColor: selectedComponent.color || "#1c1917" }}
                    />
                </button>

                {isColorPickerOpen && (
                    <div className="absolute left-0 top-9 z-50 flex w-40 flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-white p-2 shadow-xl">
                        {COLOR_SWATCHES.map(swatch => (
                            <button
                                key={swatch.value}
                                type="button"
                                onClick={() => {
                                    onUpdateComponent({ color: swatch.value });
                                    setIsColorPickerOpen(false);
                                }}
                                style={{ backgroundColor: swatch.value }}
                                className={`h-6 w-6 rounded-full border transition hover:scale-110 ${
                                    selectedComponent.color === swatch.value
                                        ? "ring-2 ring-brand-rust ring-offset-1 border-stone-400"
                                        : "border-stone-300"
                                }`}
                                title={swatch.name}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Định dạng chữ: Bold, Italic, Underline, Uppercase */}
            <div className="flex items-center gap-0.5">
                {/* Bold */}
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            fontWeight: isBold ? "normal" : "bold",
                        })
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-serif text-xs font-bold transition ${
                        isBold ? "bg-brand-rust/15 text-brand-rust font-black" : "text-stone-700 hover:bg-stone-100"
                    }`}
                    title="In đậm (Ctrl+B)"
                >
                    B
                </button>

                {/* Italic */}
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            fontStyle: isItalic ? "normal" : "italic",
                        })
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-serif text-xs italic transition ${
                        isItalic ? "bg-brand-rust/15 text-brand-rust font-bold" : "text-stone-700 hover:bg-stone-100"
                    }`}
                    title="In nghiêng (Ctrl+I)"
                >
                    I
                </button>

                {/* Underline */}
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            textDecoration: isUnderline ? "none" : "underline",
                        })
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs underline transition ${
                        isUnderline ? "bg-brand-rust/15 text-brand-rust font-bold" : "text-stone-700 hover:bg-stone-100"
                    }`}
                    title="Gạch chân (Ctrl+U)"
                >
                    U
                </button>

                {/* Uppercase toggle (aA) */}
                <button
                    type="button"
                    onClick={() =>
                        onUpdateComponent({
                            textCase: isUppercase ? "normal" : "uppercase",
                        })
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition ${
                        isUppercase ? "bg-brand-rust/15 text-brand-rust" : "text-stone-700 hover:bg-stone-100"
                    }`}
                    title="Chuyển đổi CHỮ HOA / chữ thường"
                >
                    aA
                </button>
            </div>

            <span className="h-4 w-px bg-stone-200" />

            {/* 5. Căn lề: Trái / Giữa / Phải */}
            <div className="flex items-center gap-0.5">
                {(["left", "center", "right"] as const).map(align => (
                    <button
                        key={align}
                        type="button"
                        onClick={() => onUpdateComponent({ textAlign: align })}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition ${
                            textAlign === align
                                ? "bg-brand-rust/15 text-brand-rust font-bold"
                                : "text-stone-600 hover:bg-stone-100"
                        }`}
                        title={align === "left" ? "Căn trái" : align === "center" ? "Căn giữa" : "Căn phải"}
                    >
                        {align === "left" ? "≡" : align === "center" ? "⬌" : "≣"}
                    </button>
                ))}
            </div>

            {/* 6. Bullets toggle */}
            <button
                type="button"
                onClick={() =>
                    onUpdateComponent({
                        type: selectedComponent.type === "bullets" ? "text" : "bullets",
                    })
                }
                className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs transition ${
                    selectedComponent.type === "bullets"
                        ? "bg-brand-rust/15 text-brand-rust font-bold"
                        : "text-stone-600 hover:bg-stone-100"
                }`}
                title="Bật / Tắt danh sách đầu dòng"
            >
                <span>•=</span>
            </button>

            <span className="h-4 w-px bg-stone-200" />

            {/* 7. Nhân bản & Xóa */}
            <button
                type="button"
                onClick={() => onDuplicateComponent(selectedComponent)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100"
                title="Nhân bản"
            >
                📋
            </button>
            <button
                type="button"
                onClick={() => onDeleteComponent(selectedComponent.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                title="Xóa đối tượng"
            >
                🗑️
            </button>
        </div>
    );
};
