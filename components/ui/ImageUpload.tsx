import React, { useState, useRef } from 'react';
import { optimizeImage } from '../../utils/imageOptimizer';

const UploadCloudIcon: React.FC<{className?: string}> = ({ className = "h-8 w-8 text-gray-400" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
  </svg>
);

const PhotoLibraryIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
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

const SpinnerSmall: React.FC = () => (
  <svg className="animate-spin h-4 w-4 text-primary-600 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

interface ImageUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  existingPhotos?: string[];
  onRemoveExisting?: (url: string) => void;
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onFilesChange, 
  maxFiles = 12,
  existingPhotos = [],
  onRemoveExisting,
  label = "Фотографии шин и дисков"
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Dedicated refs: gallery picker (no capture) and camera snap (with capture)
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processAndSetFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    if (rawFiles.length === 0) return;

    setIsOptimizing(true);
    try {
      // Optimize each image (downscale large smartphone camera photos, compress to smooth JPEG)
      const optimizedFiles = await Promise.all(rawFiles.map(file => optimizeImage(file)));
      
      const combined = [...files, ...optimizedFiles].slice(0, maxFiles);
      setFiles(combined);
      onFilesChange(combined);

      // Create new blob URLs for previews
      const newPreviews = combined.map(file => URL.createObjectURL(file));
      previews.forEach(url => URL.revokeObjectURL(url));
      setPreviews(newPreviews);
    } catch (e) {
      console.error("Error optimizing selected images:", e);
      // Fallback: use raw files
      const combined = [...files, ...rawFiles].slice(0, maxFiles);
      setFiles(combined);
      onFilesChange(combined);
      setPreviews(combined.map(file => URL.createObjectURL(file)));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    processAndSetFiles(newFiles);
  };
  
  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);

    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }
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

  const onGalleryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset so the same file can be re-selected if needed
  };

  const onCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const totalPhotosCount = existingPhotos.length + previews.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <span className="text-[11px] text-gray-400">
          {totalPhotosCount > 0 ? `${totalPhotosCount} из ${maxFiles} фото` : `до ${maxFiles} фото`}
        </span>
      </div>

      {/* Upload Drop Area */}
      <div 
        className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl text-center transition-all duration-150 ${
          isDragOver 
            ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/30' 
            : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/60'
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-2xs flex items-center justify-center mb-2 border border-gray-200 dark:border-gray-700">
          <UploadCloudIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
        
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          Перетащите фото сюда или выберите источник:
        </p>

        {/* Buttons for Gallery and Camera */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isOptimizing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <PhotoLibraryIcon className="w-4 h-4 text-white" />
            <span>Выбрать из галереи</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isOptimizing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-xs font-medium shadow-2xs transition-all active:scale-95 disabled:opacity-50"
          >
            <CameraIcon className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            <span>Камера</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-gray-400">
          <span>Поддерживаются форматы JPG, PNG, WEBP</span>
          <span>·</span>
          <span>Автоматическое сжатие</span>
        </div>

        {isOptimizing && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400 font-medium">
            <SpinnerSmall />
            <span>Обработка и оптимизация фото...</span>
          </div>
        )}

        {/* Gallery Input: NO capture attribute so mobile opens Photo Library / Gallery */}
        <input 
          type="file"
          ref={galleryInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={onGalleryInputChange}
        />

        {/* Camera Input: WITH capture attribute for direct photo snap */}
        <input 
          type="file"
          ref={cameraInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={onCameraInputChange}
        />
      </div>

      {/* Combined Preview Grid: Existing Photos + Staged Uploads */}
      {(existingPhotos.length > 0 || previews.length > 0) && (
        <div className="space-y-2">
          {existingPhotos.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Сохранённые фото ({existingPhotos.length}):
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {existingPhotos.map((url, index) => (
                  <div key={`existing_${index}`} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xs bg-gray-100 dark:bg-gray-900">
                    <img src={url} alt={`Сохранённое фото ${index + 1}`} className="w-full h-full object-cover" />
                    {onRemoveExisting && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemoveExisting(url); }}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform transform hover:scale-110"
                          title="Удалить фото"
                        >
                          <TrashSmallIcon />
                        </button>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-700/80 text-white leading-none">
                      в базе #{index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previews.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1.5">
                Новые фото к сохранению ({previews.length}):
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {previews.map((preview, index) => (
                  <div key={`preview_${index}`} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-primary-500/50 dark:border-primary-400/50 shadow-xs bg-gray-100 dark:bg-gray-900">
                    <img src={preview} alt={`Новое фото ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                        className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform transform hover:scale-110"
                        title="Убрать фото"
                      >
                        <TrashSmallIcon />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary-600/90 text-white leading-none">
                      новое #{index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
