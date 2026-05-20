// /api/extract-receipt.js — Claude vision reads a receipt photo, returns structured fields.
// ==========================================================================================
// POST body: { imageBase64: string (data URL or raw base64), mediaType?: string }
// Returns:   { supplier, spentOn (YYYY-MM-DD), amountPence, vatPence, suggestedCategory, confidence }
// Auth:      bearer token of the signed-in user.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  'stock_supplies', 'equipment_repairs', 'software', 'marketing',
  'professional_fees', 'training_cpd', 'travel', 'phone_internet',
  'insurance', 'rent_rates', 'utilities', 'bank_fees',
  'food_drink', 'cleaning', 'other',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No auth token' });

  const userResp = await supabase.auth.getUser(token);
  if (userResp.error || !userResp.data?.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  // Normalise — strip data: prefix if present
  let raw = imageBase64;
  let detectedMedia = mediaType || 'image/jpeg';
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    detectedMedia = dataUrlMatch[1];
    raw = dataUrlMatch[2];
  }

  const prompt = `You are reading a UK retail/business receipt. Extract these fields and return ONLY a JSON object (no markdown, no commentary):

{
  "supplier": "<merchant name>",
  "spent_on": "<YYYY-MM-DD>",
  "amount_pence": <integer pence, total inc. VAT>,
  "vat_pence": <integer pence, VAT amount if shown, else null>,
  "suggested_category": "<one of: ${CATEGORIES.join(', ')}>",
  "confidence": "<high|medium|low>"
}

Rules:
- Amounts in PENCE (multiply pounds by 100, e.g. £48.72 → 4872).
- Use today's date if no date visible.
- Pick the best category for a UK self-employed Pilates / fitness coach. Common ones: training_cpd (course fees), equipment_repairs (reformer parts, mats), travel (parking, fuel, train), insurance (instructor cover), marketing (ads, photography), software (Xplor, etc), stock_supplies (cleaning, towels, hand wash).
- Confidence: "high" if you read everything cleanly, "medium" if you guessed something, "low" if image was blurry or partial.
- Return nothing but the JSON object.`;

  try {
    const anthResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: detectedMedia, data: raw },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!anthResp.ok) {
      const errText = await anthResp.text();
      console.error('Anthropic error:', anthResp.status, errText);
      return res.status(502).json({ error: 'AI extraction failed', detail: errText });
    }

    const data = await anthResp.json();
    const text = data.content?.find(c => c.type === 'text')?.text || '';
    // Strip any markdown fences just in case
    const cleaned = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Bad JSON from Claude:', cleaned);
      return res.status(502).json({ error: 'Could not parse extraction', raw: cleaned });
    }

    return res.status(200).json({
      supplier:           parsed.supplier || '',
      spentOn:            parsed.spent_on || null,
      amountPence:        Number.isInteger(parsed.amount_pence) ? parsed.amount_pence : 0,
      vatPence:           Number.isInteger(parsed.vat_pence) ? parsed.vat_pence : null,
      suggestedCategory:  CATEGORIES.includes(parsed.suggested_category) ? parsed.suggested_category : 'other',
      confidence:         ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    });
  } catch (e) {
    console.error('extract-receipt error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
