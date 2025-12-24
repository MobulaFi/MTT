// app/not-found.tsx
import Link from 'next/link';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-foreground flex items-center justify-center text-center py-12 px-4">
      <div>
        <h1 className="text-4xl font-bold text-red-600">404 - Page Not Found</h1>
        <p className="text-xl my-4">Oops! The page you&apos;re looking for does not exist.</p>
        <Link href="/" className="text-lg text-blue-600 hover:underline">
          Go back to the homepage
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
