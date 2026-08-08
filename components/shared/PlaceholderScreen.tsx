export function PlaceholderScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-8 lg:px-12 lg:py-10">
      <h1 className="font-screen-title m-0 text-text">{title}</h1>
      <p className="font-body m-0 text-text-secondary">{message}</p>
    </div>
  );
}
