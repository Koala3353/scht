import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Scht',
    short_name: 'Scht',
    description: 'Your school and work flow, in one place.',
    start_url: '/today',
    display: 'standalone',
    background_color: '#f4f7f7',
    theme_color: '#075e60',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
