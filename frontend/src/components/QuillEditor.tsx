import React, { useState, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./QuillEditor.css"; // Custom CSS for QuillEditor
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand, faCompress } from "@fortawesome/free-solid-svg-icons";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  placeholder = "Tulis konten Anda...",
  className = "",
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "list",
    "bullet",
    "align",
    "image",
  ];

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  };

  return (
    <div
      ref={containerRef}
      className={`quill-editor dark:border-gray-600 dark:bg-gray-800 ${className} ${
        isFullscreen ? "fullscreen" : ""
      }`}
    >
      {/* Control Buttons */}
      <div className="quill-controls">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="quill-control-btn fullscreen-btn dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
        </button>
      </div>

      {/* Editor Container */}
      <div className="quill-container">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className="dark:bg-gray-800 dark:text-white"
          style={{
            direction: "ltr",
            textAlign: "left",
          }}
        />
      </div>
    </div>
  );
};

export default QuillEditor;
