// Shared Gemini caller for Edge Functions: structured-JSON output plus a
// model fallback chain.
//
// The newest model is best but also the busiest, so when one is overloaded,
// rate-limited, or retired we fall through to the next instead of failing the
// whole request. Gemini's lineup moves fast (new versions every couple of
// months as of 2026) -- see https://ai.google.dev/gemini-api/docs/models to
// refresh this list.

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// HTTP statuses where trying a different model can help. Anything else
// (e.g. 400 bad request, 403 bad key) would fail on every model, so stop.
const RETRYABLE_STATUSES = new Set([404, 429, 500, 503, 504]);

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export type ValidateResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export type GenerateJsonResult<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; failures: string[] };

/**
 * Sends `parts` (text and/or inlineData) to Gemini and returns the model's
 * JSON answer, constrained by `schema`. `validate` gets the parsed JSON and
 * either returns the cleaned value or a reason it was unacceptable -- an
 * unacceptable answer moves on to the next model just like an API error.
 *
 * `failures` on a failed result records what each model said. It's safe to
 * show to the app: it's Gemini's own status/message and never contains our
 * API key.
 */
export async function generateJson<T>(options: {
  apiKey: string;
  parts: unknown[];
  schema: unknown;
  validate: (data: unknown) => ValidateResult<T>;
}): Promise<GenerateJsonResult<T>> {
  const body = JSON.stringify({
    contents: [{ parts: options.parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: options.schema,
    },
  });

  const failures: string[] = [];

  for (const model of GEMINI_MODELS) {
    let response: Response;
    try {
      response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body,
      });
    } catch (err) {
      console.error(`Network error calling ${model}:`, err);
      failures.push(`${model}: network error`);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${model} error:`, response.status, errorText);
      failures.push(`${model} ${response.status}: ${errorText.slice(0, 120)}`);
      if (!RETRYABLE_STATUSES.has(response.status)) break;
      continue;
    }

    const result = await response.json();
    const rawText: string | undefined = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error(`${model} returned no usable content:`, JSON.stringify(result));
      failures.push(`${model}: empty response`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error(`${model} returned malformed JSON:`, rawText);
      failures.push(`${model}: malformed JSON`);
      continue;
    }

    const checked = options.validate(parsed);
    if (checked.ok) return { ok: true, value: checked.value, model };

    console.error(`${model} output rejected:`, checked.reason, rawText);
    failures.push(`${model}: ${checked.reason}`);
  }

  return { ok: false, failures };
}
