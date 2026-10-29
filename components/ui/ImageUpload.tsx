import React, { useState, useRef } from 'react';

const UploadCloudIcon: React.FC<{className?: string}> = ({ className = "h-8 w-8 text-gray-400" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
  </svg>
);

const CameraIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008v-.008z" />
  </svg>
);

const TrashSmallIcon: React.FC<{className?: string}> = ({ className = "h-3.5 w-3.5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface ImageUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onFilesChange, maxFiles = 10 }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const filesArray = Array.from(newFiles).filter(file => file.type.startsWith('image/'));
    const combinedFiles = [...files, ...filesArray].slice(0, maxFiles);
    
    setFiles(combinedFiles);
    onFilesChange(combinedFiles);

    const newPreviews = combinedFiles.map(file => URL.createObjectURL(file));
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews(newPreviews);
  };
  
  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);

    URL.revokeObjectURL(previews[index]);
    setFiles(newFiles);
    setPreviews(newPreviews);
    onFilesChange(newFiles);
  };
  
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Фотографии шин и дисков
        </label>
        <span className="text-[11px] text-gray-400">
          {previews.length > 0 ? `${previews.length} из ${maxFiles} фото` : `до ${maxFiles} фото`}
        </span>
      </div>

      <div 
        className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-150 ${
          isDragOver 
            ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/30' 
            : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/60'
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-2xs flex items-center justify-center mb-2 border border-gray-200 dark:border-gray-700">
          <UploadCloudIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          <span className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
            Нажмите для загрузки
          </span>{' '}
          или перетащите файлы сюда
        </p>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CameraIcon /> с камеры или галереи
          </span>
          <span>·</span>
          <span>PNG, JPG до 10MB</span>
        </div>

        <input 
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={onFileInputChange}
          capture="environment"
        />
      </div>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {previews.map((preview, index) => (
            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xs bg-gray-100 dark:bg-gray-900">
              <img src={preview} alt={`Фото ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform transform hover:scale-110"
                  title="Удалить фото"
                >
                  <TrashSmallIcon />
                </button>
              </div>
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/60 text-white leading-none">
                #{index + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
