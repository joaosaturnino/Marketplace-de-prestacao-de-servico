import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: []
  }
};
