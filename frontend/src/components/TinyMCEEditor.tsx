import React from "react";
import { Editor } from "@tinymce/tinymce-react";

interface TinyMCEEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const TinyMCEEditor: React.FC<TinyMCEEditorProps> = ({
  value,
  onChange,
  placeholder = "Tulis konten Anda...",
  className = "",
}) => {
  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  return (
    <div className={`tinymce-editor ${className}`}>
      <Editor
        apiKey="your-api-key-here" // Bisa dikosongkan untuk development
        value={value}
        onEditorChange={handleEditorChange}
        init={{
          height: 300,
          menubar: false,
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "image",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "fullscreen",
            "insertdatetime",
            "media",
            "table",
            "code",
            "help",
            "wordcount",
          ],
          toolbar:
            "undo redo | blocks | " +
            "bold italic forecolor | alignleft aligncenter " +
            "alignright alignjustify | bullist numlist outdent indent | " +
            "removeformat | image media link | help",
          content_style:
            'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
          placeholder: placeholder,
          language: "id", // Bahasa Indonesia
          directionality: "ltr", // Left to right
          text_align: "left",
          branding: false,
          elementpath: false,
          statusbar: false,
          resize: false,
          setup: function (editor: any) {
            editor.on("init", function () {
              // Set initial content jika ada
              if (value) {
                editor.setContent(value);
              }
            });
          },
        }}
      />
    </div>
  );
};

export default TinyMCEEditor;
