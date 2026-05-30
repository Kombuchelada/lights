import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';

import { routes } from './app.routes';
import { authConfig } from './auth.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // The interceptor attaches the access token to outgoing /api/* calls.
    provideHttpClient(withInterceptors([authHttpInterceptorFn])),
    provideAuth0({
      domain: authConfig.domain,
      clientId: authConfig.clientId,
      authorizationParams: {
        audience: authConfig.audience,
        redirect_uri: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      // Rotating refresh tokens (the SPA app has refresh-token rotation enabled).
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
      httpInterceptor: {
        allowedList: [
          {
            uri: '/api/*',
            tokenOptions: {
              authorizationParams: { audience: authConfig.audience },
            },
          },
        ],
      },
    }),
  ],
};
