Deno.serve(() => new Response(
  'Ce point d’entrée Stripe est désactivé. Utiliser le webhook signé configuré par FormaPrompt.',
  {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  },
));
