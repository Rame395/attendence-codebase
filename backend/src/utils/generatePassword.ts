export const generateTemporaryPassword = () => {
  return (
    Math.random().toString(36).slice(-5) +
    "@" +
    Math.floor(100 + Math.random() * 900)
  );
};