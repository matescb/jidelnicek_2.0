# Deep Linking Support System

This module provides comprehensive deep linking support for the Jidelnicek application, enabling seamless navigation from external sources (emails, social media, QR codes) directly into specific app content.

## Features

- **Universal Link Support**: Handle both app-specific (`jidelnicek://`) and web URLs
- **Authentication Handling**: Automatically redirect to login for protected resources
- **Share Functionality**: Generate shareable links with multiple sharing options
- **QR Code Generation**: Create QR codes for easy sharing
- **Social Media Integration**: Direct sharing to Facebook, Twitter, WhatsApp, etc.
- **Legacy Format Support**: Handle old link formats gracefully
- **Analytics Tracking**: Track deep link usage and sharing

## Quick Start

### 1. Setup Deep Link Handler

Add the `DeepLinkHandler` to your app root:

```tsx
import { DeepLinkHandler } from '@/routes/deeplink';

function App() {
  return (
    <BrowserRouter>
      <DeepLinkHandler
        fallbackPath="/"
        onError={(error) => console.error('Deep link error:', error)}
      >
        <Routes>
          {/* Your app routes */}
        </Routes>
      </DeepLinkHandler>
    </BrowserRouter>
  );
}
```

### 2. Generate Share Links

Use the `useShareLink` hook to generate and share links:

```tsx
import { useShareLink } from '@/routes/deeplink';

function RecipeCard({ recipe }) {
  const { generateRecipeLink, shareLink } = useShareLink();
  
  const handleShare = async () => {
    const link = generateRecipeLink(recipe.id);
    await shareLink(link, {
      title: `Check out ${recipe.name}!`,
      method: 'native', // or 'copy', 'facebook', etc.
    });
  };
  
  return (
    <button onClick={handleShare}>Share Recipe</button>
  );
}
```

### 3. Handle Incoming Deep Links

The system automatically handles incoming deep links, but you can check if a user arrived via deep link:

```tsx
import { useDeepLinkState } from '@/routes/deeplink';

function RecipeDetail() {
  const { isFromDeepLink, deepLinkParams } = useDeepLinkState();
  
  useEffect(() => {
    if (isFromDeepLink) {
      // Track analytics or show special UI
      console.log('User arrived via deep link', deepLinkParams);
    }
  }, [isFromDeepLink]);
}
```

## Supported Deep Link Formats

### Recipe Links
- View recipe: `jidelnicek://recipe/{id}`
- Share recipe: `jidelnicek://recipe/{id}/share`

### Trip Links
- View trip: `jidelnicek://trip/{id}`
- Join trip: `jidelnicek://trip/{id}/join?token={token}`
- Trip planner: `jidelnicek://trip/{id}/planner`

### Shopping List Links
- View list: `jidelnicek://shopping-list/{id}`
- Share list: `jidelnicek://shopping-list/{id}/share?token={token}`

### Navigation Links
- Dashboard: `jidelnicek://dashboard`
- Recipes: `jidelnicek://recipes`
- Search: `jidelnicek://recipes/search`
- Profile: `jidelnicek://profile`

## Advanced Usage

### Generate QR Codes

```tsx
import { generateQRCode, generateRecipeShareLink } from '@/routes/deeplink';

const link = generateRecipeShareLink(recipeId);
const qrCodeUrl = await generateQRCode(link, {
  size: 256,
  margin: 4,
});
```

### Social Media Sharing

```tsx
import { generateSocialShareUrl } from '@/routes/deeplink';

const facebookUrl = generateSocialShareUrl('facebook', deepLink, {
  title: 'Check out this recipe!',
});

window.open(facebookUrl, '_blank');
```

### Custom Deep Link Handling

```tsx
import { useDeepLink } from '@/routes/deeplink';

function CustomHandler() {
  const { handleDeepLink, parseDeepLink } = useDeepLink();
  
  const processCustomLink = async (url: string) => {
    const parsed = parseDeepLink(url);
    
    if (parsed.isValid && parsed.path.startsWith('custom/')) {
      // Handle custom logic
      console.log('Custom link:', parsed);
    } else {
      // Use default handler
      await handleDeepLink(url);
    }
  };
}
```

## Configuration

### Deep Link Schemes

Configure supported schemes in `deepLinkConfig.ts`:

```typescript
export const DEEP_LINK_SCHEMES = {
  APP: 'jidelnicek://',
  HTTPS: 'https://app.jidelnicek.cz/',
  HTTP: 'http://localhost:3000/',
};
```

### Add New Link Patterns

Add patterns to `DEEP_LINK_PATTERNS`:

```typescript
{
  pattern: /^custom\/([a-zA-Z0-9-]+)$/,
  route: '/custom/:id',
  requiresAuth: true,
  extractParams: (match) => ({ id: match[1] }),
}
```

## Security Considerations

1. **Token Validation**: Always validate share tokens on the backend
2. **Expiration**: Implement link expiration for sensitive content
3. **Rate Limiting**: Limit deep link generation to prevent abuse
4. **Authentication**: Protected resources require authentication
5. **HTTPS**: Use HTTPS for universal links in production

## Testing

### Test Deep Links Locally

1. Use the URL hash format: `http://localhost:3000/#deeplink=jidelnicek://recipe/123`
2. Use query parameters: `http://localhost:3000/deeplink?url=jidelnicek://recipe/123`
3. Trigger custom events:
   ```javascript
   window.dispatchEvent(new CustomEvent('deeplink', {
     detail: { url: 'jidelnicek://recipe/123' }
   }));
   ```

### Mobile Testing

1. **iOS**: Configure Universal Links in `apple-app-site-association`
2. **Android**: Configure App Links in `assetlinks.json`
3. Use deep link testing tools for each platform

## Analytics

Track deep link events:

```typescript
import { trackShareEvent } from '@/routes/deeplink';

trackShareEvent('recipe', 'facebook', recipeId);
```

Events tracked:
- `deep_link_opened`: When a deep link is opened
- `deep_link_shared`: When content is shared
- `deep_link_failed`: When a deep link fails
- `deep_link_expired`: When an expired link is used

## Troubleshooting

### Common Issues

1. **Link not opening**: Check if the pattern matches in `DEEP_LINK_PATTERNS`
2. **Authentication loop**: Ensure `pendingDeepLink` is cleared after auth
3. **QR code generation fails**: Check CORS settings for QR API
4. **Social sharing fails**: Verify social media URLs are not blocked

### Debug Mode

Enable debug logging:

```typescript
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('deeplink', (e) => {
    console.log('Deep link event:', e);
  });
}
```

## Best Practices

1. **Use Type-Safe Builders**: Use the provided builder functions instead of manual string concatenation
2. **Include Source Tracking**: Always include source parameter for analytics
3. **Handle Errors Gracefully**: Provide fallback behavior for invalid links
4. **Test All Platforms**: Test on web, iOS, and Android
5. **Document Custom Patterns**: Keep pattern documentation up to date