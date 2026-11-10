export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="font-mono text-sm text-stone-500">Parley · sandbox prototype</p>
      <h1 className="text-4xl font-semibold tracking-tight">AI organizes the facts. People decide. PayPal settles.</h1>
      <p className="text-lg text-stone-600">
        One shared case file for both sides of a PayPal dispute, with every claim linked to its evidence.
      </p>
      <p className="text-sm text-stone-500">The app is being built. Cases will appear here.</p>
    </main>
  );
}
