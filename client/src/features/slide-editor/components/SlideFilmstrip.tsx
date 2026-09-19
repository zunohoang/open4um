import type { Slide } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editor.store";

interface SlideFilmstripProps {
    slides: Slide[];
    activeSlideIndex: number;
    onSelectSlide: (index: number) => void;
    onAddSlide: () => void;
    onDuplicateSlide: (slideId: string) => void;
    onDeleteSlide: (slideId: string) => void;
    onMoveSlide: (slideId: string, toIndex: number) => void;
}

export const SlideFilmstrip = ({
    slides,
    activeSlideIndex,
    onSelectSlide,
    onAddSlide,
    onDuplicateSlide,
    onDeleteSlide,
    onMoveSlide,
}: SlideFilmstripProps) => {
    const { isFilmstripOpen, toggleFilmstrip } = useEditorStore();
    const stripRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Kiểm tra khả năng cuộn trái/phải để bật/tắt nút điều hướng
    const checkScrollability = () => {
        const el = stripRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 5);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    };

    useEffect(() => {
        checkScrollability();
        const el = stripRef.current;
        if (!el) return;

        el.addEventListener("scroll", checkScrollability);
        window.addEventListener("resize", checkScrollability);
        return () => {
            el.removeEventListener("scroll", checkScrollability);
            window.removeEventListener("resize", checkScrollability);
        };
    }, [slides.length, isFilmstripOpen]);

    // Tự động cuộn đến slide đang kích hoạt
    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const activeEl = el.children[activeSlideIndex] as HTMLElement | undefined;
        if (activeEl) {
            activeEl.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
            });
        }
    }, [activeSlideIndex]);

    // Chuyển đổi con lăn chuột thông thường (deltaY) thành cuộn ngang (scrollLeft)
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const el = stripRef.current;
        if (!el) return;

        if (e.deltaY !== 0) {
            el.scrollLeft += e.deltaY;
            checkScrollability();
        }
    };

    // Cuộn bằng nút bấm sang trái/phải
    const handleScrollBy = (offset: number) => {
        const el = stripRef.current;
        if (!el) return;
        el.scrollBy({ left: offset, behavior: "smooth" });
    };

    return (
        <footer className="w-full shrink-0 overflow-hidden border-t border-stone-300 bg-brand-paper/95 font-sans select-none">
            {/* Thanh điều khiển phụ của Filmstrip: Trang X/Y và nút Ẩn/Hiện */}
            <div className="flex h-7 items-center justify-between px-4 text-[11px] text-stone-500">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={toggleFilmstrip}
                        className="flex items-center gap-1 font-semibold text-stone-700 hover:text-brand-rust transition"
                        title={isFilmstripOpen ? "Thu nhỏ dải slide" : "Mở rộng dải slide"}
                    >
                        <span>{isFilmstripOpen ? "▼" : "▲"}</span>
                        <span>{isFilmstripOpen ? "Ẩn dải slide" : "Hiện dải slide"}</span>
                    </button>

                    {/* Hướng dẫn cuộn chuột */}
                    {isFilmstripOpen && (
                        <span className="hidden text-[10px] text-stone-400 sm:inline">
                            (Lăn chuột hoặc bấm ‹ › để cuộn)
                        </span>
                    )}
                </div>

                {/* Nút trượt trái/phải và bộ đếm trang */}
                <div className="flex items-center gap-2">
                    {isFilmstripOpen && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleScrollBy(-280)}
                                disabled={!canScrollLeft}
                                className={`flex h-5 w-5 items-center justify-center rounded border border-stone-300 bg-white text-xs font-bold transition ${
                                    canScrollLeft
                                        ? "text-stone-700 hover:border-brand-rust hover:text-brand-rust"
                                        : "cursor-not-allowed opacity-30"
                                }`}
                                title="Trượt sang trái"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScrollBy(280)}
                                disabled={!canScrollRight}
                                className={`flex h-5 w-5 items-center justify-center rounded border border-stone-300 bg-white text-xs font-bold transition ${
                                    canScrollRight
                                        ? "text-stone-700 hover:border-brand-rust hover:text-brand-rust"
                                        : "cursor-not-allowed opacity-30"
                                }`}
                                title="Trượt sang phải"
                            >
                                ›
                            </button>
                        </div>
                    )}

                    <div className="font-mono font-medium">
                        Trang {activeSlideIndex + 1} / {slides.length}
                    </div>
                </div>
            </div>

            {/* Dải danh sách thumbnail cuộn ngang có xử lý con lăn chuột và thanh cuộn rõ ràng */}
            {isFilmstripOpen && (
                <div className="relative w-full overflow-hidden px-2 pb-2">
                    <div
                        ref={stripRef}
                        onWheel={handleWheel}
                        className="flex h-24 items-center gap-3 overflow-x-auto px-2 pb-2 scroll-smooth custom-scrollbar"
                    >
                        {slides.map((slide, index) => {
                            const isActive = index === activeSlideIndex;

                            return (
                                <div
                                    key={slide.id || index}
                                    onClick={() => onSelectSlide(index)}
                                    className={`group relative flex h-20 w-32 shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-md border bg-white p-2 shadow-2xs transition ${
                                        isActive
                                            ? "border-brand-rust ring-2 ring-brand-rust/30 font-bold"
                                            : "border-stone-300 hover:border-stone-400"
                                    }`}
                                >
                                    {/* Số thứ tự slide */}
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-[10px] font-bold text-stone-400">
                                            {index + 1}
                                        </span>

                                        {/* Menu thao tác nhanh khi hover */}
                                        <div
                                            onClick={e => e.stopPropagation()}
                                            className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100"
                                        >
                                            {/* Di chuyển trước */}
                                            <button
                                                type="button"
                                                disabled={index === 0}
                                                onClick={() => onMoveSlide(slide.id, index - 1)}
                                                className="flex h-4 w-4 items-center justify-center rounded text-[10px] hover:bg-stone-200 disabled:opacity-20"
                                                title="Di chuyển sang trái"
                                            >
                                                ←
                                            </button>

                                            {/* Di chuyển sau */}
                                            <button
                                                type="button"
                                                disabled={index === slides.length - 1}
                                                onClick={() => onMoveSlide(slide.id, index + 1)}
                                                className="flex h-4 w-4 items-center justify-center rounded text-[10px] hover:bg-stone-200 disabled:opacity-20"
                                                title="Di chuyển sang phải"
                                            >
                                                →
                                            </button>

                                            {/* Nhân bản */}
                                            <button
                                                type="button"
                                                onClick={() => onDuplicateSlide(slide.id)}
                                                className="flex h-4 w-4 items-center justify-center rounded text-[9px] hover:bg-stone-200"
                                                title="Nhân bản slide"
                                            >
                                                📋
                                            </button>

                                            {/* Xóa */}
                                            {slides.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteSlide(slide.id)}
                                                    className="flex h-4 w-4 items-center justify-center rounded text-[9px] text-red-600 hover:bg-red-50"
                                                    title="Xóa slide"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tiêu đề tóm tắt slide */}
                                    <div className="truncate text-[11px] text-stone-800 font-serif">
                                        {slide.title || "Slide trống"}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Nút + Thêm slide ở cuối dải */}
                        <button
                            type="button"
                            onClick={onAddSlide}
                            className="flex h-20 w-28 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-stone-400 bg-stone-50 text-stone-600 transition hover:border-brand-rust hover:bg-brand-rust/5 hover:text-brand-rust"
                            title="Thêm slide mới"
                        >
                            <span className="text-lg font-bold">+</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider">Thêm slide</span>
                        </button>
                    </div>
                </div>
            )}
        </footer>
    );
};
