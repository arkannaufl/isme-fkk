import React, { useRef, useEffect } from "react";
import "react-quill/dist/quill.snow.css";

interface QuillViewerProps {
  content: string;
  className?: string;
  onImageClick?: (imageSrc: string) => void;
}

const QuillViewer: React.FC<QuillViewerProps> = ({
  content,
  className = "",
  onImageClick,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Ensure content is safe and properly formatted
  const sanitizedContent = content || "";

  // Add click handlers to images if onImageClick is provided
  useEffect(() => {
    if (contentRef.current && onImageClick) {
      const images = contentRef.current.querySelectorAll("img");
      images.forEach((img) => {
        img.style.cursor = "pointer";
        img.addEventListener("click", () => {
          onImageClick(img.src);
        });
      });
    }
  }, [sanitizedContent, onImageClick]);

  return (
    <div className={`quill-viewer ${className}`}>
      <div
        ref={contentRef}
        className="ql-editor text-gray-900 dark:text-white"
        style={{
          direction: "ltr",
          textAlign: "left",
          unicodeBidi: "normal",
          padding: "12px 15px",
          lineHeight: "1.42",
          minHeight: "auto",
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
};

export default QuillViewer;
