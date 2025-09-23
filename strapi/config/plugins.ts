export default () => ({
  upload: {
    config: {
      provider: "local",
      providerOptions: {
        sizeLimit: 6 * 1024 * 1024, // 6MB
      },
    },
  },
  "users-permissions": {
    enabled: true,
  },
});
