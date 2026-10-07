export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">লোড হচ্ছে...</p>
      </div>
    </div>
  );
}
