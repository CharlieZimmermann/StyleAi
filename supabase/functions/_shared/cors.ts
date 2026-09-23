// Shared CORS headers for Edge Functions. Mainly matters for the web build
// (npm run web) -- React Native on iOS/Android doesn't enforce CORS -- but
// every browser-callable function needs to handle the preflight OPTIONS
// request, so this is included by default.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
