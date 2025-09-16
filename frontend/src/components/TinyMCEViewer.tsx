import React from "react";

interface TinyMCEViewerProps {
  content: string;
  className?: string;
}

const TinyMCEViewer: React.FC<TinyMCEViewerProps> = ({
  content,
  className = "",
}) => {
  return (
    <div className={`tinymce-viewer ${className}`}>
      <div
        className="prose max-w-none"
        style={{
          direction: "ltr",
          textAlign: "left",
          unicodeBidi: "normal",
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

export default TinyMCEViewer;
