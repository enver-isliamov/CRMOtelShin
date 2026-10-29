import React, { useState, useEffect } from 'react';
import { Client } from '../../types';
import { api } from '../../services/api';
import { photoStorage } from '../../utils/photoStorage';
import { Lightbox } from './Lightbox';
import { ImageUpload } from './ImageUpload';
import { Button } from './Button';

interface PhotoGalleryProps {
  client: Client;
  refreshClientData: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ImageIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const TrashSmallIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const ZoomInIcon: React.FC<{className?: string}> = ({ className = "h-5 w-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
  </svg>
);

const parseClientPhotos = (c?: Partial<Client>): string[] => {
  if (!c || !c.photoUrls) return [];
  if (Array.isArray(c.photoUrls)) return c.photoUrls.filter(Boolean);
  if (typeof c.photoUrls === 'string' && (c.photoUrls as string).trim().length > 0) {
    return (c.photoUrls as string).split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ client, refreshClientData, showToast }) => {
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(() => parseClientPhotos(client));
  const [isFetchingPhotos, setIsFetchingPhotos] = useState(false);

  // Sync state when client prop updates
  useEffect(() => {
    const existing = parseClientPhotos(client);
    if (existing.length > 0) {
      setPhotoUrls(prev => Array.from(new Set([...prev, ...existing])));
    }
  }, [client?.photoUrls]);

  // Load photos from backend & IndexedDB
  useEffect(() => {
    let isMounted = true;
    const fetchPhotos = async () => {
      if (!client) return;
      setIsFetchingPhotos(true);
      try {
        const urls = await api.fetchPhotosForContract(client['Договор'], client.id);
        if (isMounted) {
          const clientPhotos = parseClientPhotos(client);
          setPhotoUrls(Array.from(new Set([...clientPhotos, ...(urls || [])])));
        }
      } catch (e: any) {
        console.warn("Photos fetch warning:", e);
      } finally {
        if (isMounted) setIsFetchingPhotos(false);
      }
    };
    
    fetchPhotos();
    return () => { isMounted = false; };
  }, [client?.id, client?.['Договор']]);

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map(file => api.uploadFile(file, client));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(r => r.fileUrl).filter(Boolean);

      const finalUrls = Array.from(new Set([...photoUrls, ...newUrls]));
      
      await api.updateClient({ 
        ...client, 
        photoUrls: finalUrls
      });
      
      setPhotoUrls(finalUrls);
      setFilesToUpload([]);
      showToast(`${newUrls.length} фото успешно загружено и сохранено!`, 'success');
      await refreshClientData();
    } catch (e: any) {
      console.error("Upload error:", e);
      showToast(`Ошибка загрузки: ${e.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (urlToDelete: string) => {
    if (!window.confirm("Удалить эту фотографию из карточки клиента?")) {
      return;
    }

    const updatedUrls = photoUrls.filter(u => u !== urlToDelete);
    setPhotoUrls(updatedUrls);

    try {
      await photoStorage.deletePhoto(urlToDelete);
      await api.updateClient({
        ...client,
        photoUrls: updatedUrls
      });
      showToast("Фотография удалена", 'success');
      await refreshClientData();
    } catch (e: any) {
      console.error("Failed to delete photo:", e);
      showToast(`Не удалось удалить фото: ${e.message}`, 'error');
      // Revert on error
      setPhotoUrls(photoUrls);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Photo Gallery Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="text-primary-600 dark:text-primary-400" />
              <span>Фото шин и дисков клиента</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold">
                {photoUrls.length}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Договор № {client['Договор'] || '—'} · {client['Имя клиента']}
            </p>
          </div>
        </div>

        {photoUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {photoUrls.map((url, index) => (
              <div 
                key={`${url}_${index}`} 
                className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-100 dark:bg-gray-900 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary-400"
                onClick={() => setLightboxImageUrl(url)}
              >
                <img 
                  src={url} 
                  alt={`Фото заказа ${index + 1}`} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                  loading="lazy"
                />
                
                {/* Overlay with zoom and delete buttons */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLightboxImageUrl(url); }}
                    className="p-2 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-md transition-transform active:scale-95"
                    title="Увеличить"
                  >
                    <ZoomInIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform active:scale-95"
                    title="Удалить фото"
                  >
                    <TrashSmallIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Index badge */}
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-white leading-none backdrop-blur-xs">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
            <ImageIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Фотографии к заказу ещё не прикреплены
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Загрузите фото шин, дисков или дефектов из галереи телефона или сделайте снимок на камеру
            </p>
          </div>
        )}
      </div>

      {/* Add New Photos Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Добавить новые фотографии в карточку
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Выберите фотографии из галереи смартфона или сделайте снимок на месте приёмки
          </p>
        </div>

        <ImageUpload onFilesChange={setFilesToUpload} />

        {filesToUpload.length > 0 && (
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setFilesToUpload([])}
              disabled={isUploading}
            >
              Сбросить
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleUpload}
              disabled={isUploading}
              className="font-bold shadow-md"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Загрузка {filesToUpload.length} фото...</span>
                </span>
              ) : (
                <span>Сохранить в заказ ({filesToUpload.length} фото)</span>
              )}
            </Button>
          </div>
        )}
      </div>
      
      {/* Full screen lightbox */}
      {lightboxImageUrl && (
        <Lightbox imageUrl={lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} />
      )}
    </div>
  );
};