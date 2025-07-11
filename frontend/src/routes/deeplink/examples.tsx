/**
 * Deep linking system usage examples
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  DeepLinkHandler,
  DeepLinkRoute,
  DeepLinkPreview,
  useShareLink,
  useDeepLink,
  useDeepLinkState,
  generateQRCode,
} from './index';

/**
 * Example 1: App root setup with deep link handler
 */
export const AppWithDeepLinks: React.FC = () => {
  return (
    <BrowserRouter>
      <DeepLinkHandler
        fallbackPath="/"
        onError={(error) => console.error('Deep link error:', error)}
      >
        <Routes>
          {/* Deep link redirect route */}
          <Route path="/deeplink" element={<DeepLinkRoute />} />
          
          {/* Your app routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          {/* ... other routes */}
        </Routes>
      </DeepLinkHandler>
    </BrowserRouter>
  );
};

/**
 * Example 2: Recipe sharing component
 */
export const RecipeShareButton: React.FC<{ recipeId: string; recipeName: string }> = ({
  recipeId,
  recipeName,
}) => {
  const { generateRecipeLink, shareLink, canShareNative } = useShareLink();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  
  const handleShare = async (method?: string) => {
    const link = generateRecipeLink(recipeId, {
      source: 'app',
    });
    
    const options = {
      title: `Check out this recipe: ${recipeName}`,
      description: `I found this amazing recipe on Jidelnicek!`,
      hashtags: ['jidelnicek', 'recipe', 'cooking'],
    };
    
    if (method) {
      await shareLink(link, { ...options, method });
    } else {
      await shareLink(link, options);
    }
    
    setShowShareMenu(false);
  };
  
  const handleQRCode = async () => {
    const link = generateRecipeLink(recipeId, { source: 'qr' });
    const qrUrl = await generateQRCode(link);
    setQrCodeUrl(qrUrl);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowShareMenu(!showShareMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        <ShareIcon />
        Share Recipe
      </button>
      
      {showShareMenu && (
        <div className="absolute top-full mt-2 right-0 bg-white shadow-lg rounded-md p-2 min-w-[200px] z-10">
          {canShareNative && (
            <button
              onClick={() => handleShare()}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
            >
              Share...
            </button>
          )}
          
          <button
            onClick={() => handleShare('copy')}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
          >
            Copy Link
          </button>
          
          <button
            onClick={() => handleShare('facebook')}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
          >
            Share on Facebook
          </button>
          
          <button
            onClick={() => handleShare('whatsapp')}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
          >
            Share on WhatsApp
          </button>
          
          <button
            onClick={handleQRCode}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
          >
            Show QR Code
          </button>
        </div>
      )}
      
      {qrCodeUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold">Scan to view recipe</h3>
            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            <button
              onClick={() => setQrCodeUrl(null)}
              className="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Example 3: Trip invitation handler
 */
export const TripInvitationHandler: React.FC = () => {
  const { isFromDeepLink, deepLinkParams } = useDeepLinkState<{
    id: string;
    action?: string;
  }>();
  const [isJoining, setIsJoining] = useState(false);
  
  React.useEffect(() => {
    if (isFromDeepLink && deepLinkParams?.action === 'join') {
      // Handle trip join
      handleJoinTrip();
    }
  }, [isFromDeepLink, deepLinkParams]);
  
  const handleJoinTrip = async () => {
    setIsJoining(true);
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (!token) {
        throw new Error('Invalid invitation link');
      }
      
      // API call to join trip
      const response = await fetch(`/api/trips/${deepLinkParams?.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ inviteToken: token }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to join trip');
      }
      
      // Success - show confirmation
      alert('Successfully joined the trip!');
    } catch (error) {
      console.error('Failed to join trip:', error);
      alert('Failed to join trip. Please check your invitation link.');
    } finally {
      setIsJoining(false);
    }
  };
  
  if (!isFromDeepLink || deepLinkParams?.action !== 'join') {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">Trip Invitation</h2>
        <p>You've been invited to join a trip!</p>
        
        {isJoining ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleJoinTrip}
              className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Join Trip
            </button>
            <button
              onClick={() => window.history.back()}
              className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Example 4: Deep link preview in chat/messaging
 */
export const MessageWithDeepLink: React.FC<{ message: string }> = ({ message }) => {
  const [deepLinks, setDeepLinks] = useState<string[]>([]);
  const { handleDeepLink } = useDeepLink();
  
  React.useEffect(() => {
    // Extract deep links from message
    const regex = /jidelnicek:\/\/[^\s]+/g;
    const links = message.match(regex) || [];
    setDeepLinks(links);
  }, [message]);
  
  const handleLinkClick = (link: string) => {
    handleDeepLink(link);
  };
  
  return (
    <div className="space-y-3">
      <p className="text-gray-800">{message}</p>
      
      {deepLinks.map((link, index) => (
        <DeepLinkPreview
          key={index}
          url={link}
          onConfirm={() => handleLinkClick(link)}
        />
      ))}
    </div>
  );
};

/**
 * Example 5: Shopping list collaboration
 */
export const ShoppingListShare: React.FC<{ listId: string; listName: string }> = ({
  listId,
  listName,
}) => {
  const { generateShoppingLink, shareLink } = useShareLink();
  const [shareToken, setShareToken] = useState<string | null>(null);
  
  const handleGenerateShareLink = async () => {
    try {
      // Generate share token from API
      const response = await fetch(`/api/shopping-lists/${listId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      const data = await response.json();
      setShareToken(data.token);
      
      // Generate and share the link
      const link = generateShoppingLink(listId, data.token);
      await shareLink(link, {
        title: `Shopping List: ${listName}`,
        description: 'Collaborate on this shopping list with me!',
      });
    } catch (error) {
      console.error('Failed to share shopping list:', error);
    }
  };
  
  return (
    <div className="space-y-4">
      <button
        onClick={handleGenerateShareLink}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Share Shopping List
      </button>
      
      {shareToken && (
        <div className="p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">
            Share link generated! Anyone with the link can view and edit this list.
          </p>
          <button
            onClick={() => setShareToken(null)}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Revoke access
          </button>
        </div>
      )}
    </div>
  );
};

// Helper components
const HomePage: React.FC = () => <div>Home Page</div>;
const RecipeDetail: React.FC = () => <div>Recipe Detail</div>;
const TripDetail: React.FC = () => <div>Trip Detail</div>;
const ShareIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.751l-2.633-2.633M16.316 8.658a3 3 0 010 4.684m-5.263 5.263l-2.633 2.633m0 0a3 3 0 11-4.243-4.243l2.633-2.633" />
  </svg>
);