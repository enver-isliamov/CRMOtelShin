
import React, { useState } from 'react';

export const DevViewToggle: React.FC = () => {
    const [isMobileView, setIsMobileView] = useState(false);

    const toggleView = () => {
        document.body.classList.toggle('mobile-view-emulator');
        setIsMobileView(!isMobileView);
    };
    
    const Icon: React.FC<{isMobile: boolean}> = ({ isMobile }) => {
        if (isMobile) {
            // Desktop icon
            return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" /></svg>;
        }
        // Mobile icon
        return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" /></svg>;
    };

    return (
        <button
            onClick={toggleView}
            title="Toggle mobile/desktop view"
            className="fixed bottom-4 right-4 z-50 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        >
            <Icon isMobile={isMobileView} />
        </button>
    );
};
