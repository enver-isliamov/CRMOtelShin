


import React, { useState, useEffect } from 'react';
import { Client } from '../../types';
import { api } from '../../services/api';
import { Lightbox } from './Lightbox';
import { ImageUpload } from './ImageUpload';
import { Button } from './Button';

interface PhotoGalleryProps {
  client: Client;
  refreshClientData: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ImageIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>;

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center py-8">
        <svg className="animate-spin h-6 w-6 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ client, refreshClientData, showToast }) => {
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isFetchingPhotos, setIsFetchingPhotos] = useState(true);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!client || !client['Договор']) {
        setPhotoUrls([]);
        setIsFetchingPhotos(false);
        return;
      }
      setIsFetchingPhotos(true);
      try {
        const urls = await api.fetchPhotosForContract(client['Договор']);
        setPhotoUrls(Array.from(new Set(urls)));
      } catch (e: any) {
        console.error("Failed to fetch photos for contract", e);
        showToast("Не удалось загрузить фотографии.", 'error');
        setPhotoUrls([]);
      } finally {
        setIsFetchingPhotos(false);
      }
    };
    
    fetchPhotos();
  }, [client, showToast]);

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    setIsUploading(true);

    try {
        const uploadPromises = filesToUpload.map(file => api.uploadFile(file, client));
        const results = await Promise.all(uploadPromises);
        const newUrls = results.map(r => r.fileUrl);

        // Fetch the most current list of photo URLs to prevent race conditions.
        const freshUrls = client['Договор'] ? await api.fetchPhotosForContract(client['Договор']) : (client.photoUrls || []);
        
        // Combine the fresh list from the server with the newly uploaded URLs.
        const finalUrls = [...new Set([...freshUrls, ...newUrls])];
        
        await api.updateClient({ 
            id: client.id, 
            photoUrls: finalUrls
        });
        
        showToast(`${filesToUpload.length} фото успешно загружено`, 'success');
        setFilesToUpload([]);
        // The refreshClientData call will fetch the updated client object for the parent,
        // which in turn will re-render this component with the latest photoUrls.
        await refreshClientData(); 
    } catch (e: any) {
        showToast(`Ошибка загрузки: ${e.message}`, 'error');
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Галерея ({!isFetchingPhotos ? photoUrls.length : '...'} фото)</h3>
        {isFetchingPhotos ? (
            <LoadingSpinner />
        ) : (photoUrls && photoUrls.length > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photoUrls.map((url, index) => (
              <div key={url+index} className="relative group cursor-pointer aspect-w-1 aspect-h-1" onClick={() => setLightboxImageUrl(url)}>
                <img src={url} alt={`Client photo ${index + 1}`} className="w-full h-full object-cover rounded-lg shadow-md transition-transform duration-200 group-hover:scale-105" />
                 <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <ImageIcon className="h-8 w-8 text-white" />
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Фотографий для договора №{client['Договор']} не найдено. Загрузите их ниже.</p>
        )}
      </div>

      <hr className="dark:border-gray-700"/>

      <div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Добавить новые фото</h3>
        <ImageUpload onFilesChange={setFilesToUpload} />
        {filesToUpload.length > 0 && (
          <div className="mt-4 text-right">
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? `Загрузка...` : `Загрузить ${filesToUpload.length} фото`}
            </Button>
          </div>
        )}
      </div>
      
      {lightboxImageUrl && <Lightbox imageUrl={lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} />}
    </div>
  );
};