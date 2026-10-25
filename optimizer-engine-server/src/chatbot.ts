import { GoogleGenAI } from '@google/genai';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

export const OUT_OF_CONTEXT_MESSAGE =
  "I am eDIth (Enterprise Diagnostics & Infrastructure Telemetry Hub) for Utho Cloud. I am programmed to assist exclusively with cloud infrastructure, FinOps, rightsizing, telemetry diagnostics, and spending analysis. How can I assist with your cloud architecture today?";

/**
 * Builds a dynamic system prompt containing the live Utho Cloud inventory,
 * spend metrics, peak protection principles, and strict out-of-context guardrails.
 */
function buildSystemInstruction(analytics: any, financials: any): string {
  const currentSpend = financials?.current_monthly_spend_inr || 487200;
  const potentialSavings = financials?.potential_total_savings_inr || 194650;
  const acceptedSavings = financials?.accepted_savings_inr || 0;
  const projectedSpend = financials?.projected_monthly_spend_inr || (currentSpend - potentialSavings);

  const resourceCount = analytics?.resources?.length || 105;
  const recommendations = analytics?.recommendations || [];

  // Top recommendations summary for prompt grounding
  const recsSummary = recommendations.slice(0, 8).map((r: any, idx: number) => {
    const action = r.action_type || r.action || 'optimize';
    const isPeakProtected = r.protection_status === 'PEAK_PROTECTED' || !!r.peak_protected;
    return `${idx + 1}. [${String(action).toUpperCase()}] ${r.resource_name || r.resource_id} (${r.environment || 'prod'}, ${r.region || 'Noida'}): Save ₹${Number(r.monthly_savings_inr || 0).toLocaleString('en-IN')}/mo. Current: ${r.current_config || 'N/A'} -> Target: ${r.target_config || 'N/A'}. Peak Protected: ${isPeakProtected ? 'YES (High Peak Surge Risk)' : 'NO'}. Reason: ${r.plain_language_reason || r.justification || 'Optimization candidate'}`;
  }).join('\n');

  return `You are eDIth (Enterprise Diagnostics & Infrastructure Telemetry Hub), an advanced cloud intelligence system and FinOps advisor embedded within the SmartCloud Optimizer platform for Utho Cloud (India's premier sovereign cloud provider).

MISSION & DOMAIN:
You help engineering leads, DevOps engineers, FinOps practitioners, and leadership understand Utho Cloud spending, optimize compute/storage/network resources, explain peak-safe rightsizing recommendations, and analyze live telemetry anomalies.

STRICT RELEVANCE & OUT-OF-CONTEXT GUARDRAIL (CRITICAL):
You ONLY answer questions related to:
1. Cloud infrastructure, architecture, sizing, and performance (CPU, RAM, Disk IOPS, Network egress).
2. FinOps, cloud billing, cost optimization, rightsizing, waste elimination, and spend forecasts.
3. Utho Cloud services, tiers (utho.nano through utho.2xlarge), pricing, and Indian sovereign regions (Noida, Bangalore, Mumbai).
4. SmartCloud Optimizer dashboard features, What-If simulator policies, Peak Protection guarantees, and ESG carbon emissions.

IF THE USER QUERY IS IRRELEVANT OR OUT OF CONTEXT (e.g. asking for poems, general world knowledge, recipes, sports, movie reviews, casual chit-chat, personal advice, unrelated coding or homework):
You MUST immediately decline politely with EXACTLY this message:
"${OUT_OF_CONTEXT_MESSAGE}"
Do NOT provide partial answers, apologies, or creative interpretations for irrelevant queries.

LIVE CLOUD CONTEXT (REAL-TIME SNAPSHOT):
- Platform: SmartCloud Optimizer for Utho Cloud 🇮🇳
- Current Monthly Spend: ₹${Number(currentSpend).toLocaleString('en-IN')}
- Potential Monthly Savings: ₹${Number(potentialSavings).toLocaleString('en-IN')} (${((potentialSavings / currentSpend) * 100).toFixed(1)}% reduction opportunity)
- Accepted Savings: ₹${Number(acceptedSavings).toLocaleString('en-IN')}
- Projected Monthly Spend: ₹${Number(projectedSpend).toLocaleString('en-IN')}
- Annualized Potential Savings: ₹${Number(potentialSavings * 12).toLocaleString('en-IN')}
- Fleet Size: ${resourceCount} cloud resources across Noida (Delhi NCR), Mumbai, and Bangalore
- 6-Month Spend Trend: Crept from ₹3,45,000 to ₹4,87,200 (+41.2% growth)
- Key Waste Drivers Identified:
  * Orphaned unattached block storage volumes (billed at ₹8/GB/month)
  * Unattached static public IPv4 addresses incurring hoarding fees
  * Development/Staging clusters left running 24/7 without weekend auto-shutdown
  * Over-provisioned compute with low average and low peak usage
- Peak Protection Rule:
  * SmartCloud evaluates P95 and P99 peak CPU before suggesting downsizing.
  * Formula: Projected P99 CPU = (Current P99 CPU) * (Current vCPUs / Target vCPUs). If > 72%, downsizing is BLOCKED as "Peak Protected" to prevent outages during evening peak hours (e.g. 19:00 IST payments spikes).
- Sustainability & ESG:
  * Indian Data Center PUE: 1.38
  * Central Electricity Authority Emission Factor: 0.71 kg CO2e/kWh
  * Projected Annual Carbon Reduction: ~2,460 kg CO2e

SAMPLE HIGH-IMPACT RECOMMENDATIONS IN FLEET:
${recsSummary}

RESPONSE GUIDELINES:
- Always format currency in Indian Rupees (₹ or INR).
- Identity: You are eDIth (Enterprise Diagnostics & Infrastructure Telemetry Hub). Maintain a concise, confident, and analytical tone.
- Reference specific resources, numbers, and peak metrics whenever answering questions about the fleet.
- Use markdown formatting (bullet points, bold text, code tags) for clarity.`;
}

/**
 * Express handler for POST /api/chat
 */
export function createChatHandler(
  getAnalyticsState: () => any,
  getDynamicFinancials: () => any
) {
  return async (req: Request, res: Response) => {
    try {
      const { message, history = [] } = req.body;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'Message is required and must be non-empty.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });
        dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true });
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'your_key_here') {
        return res.status(200).json({
          reply:
            "⚠️ **eDIth Offline**: Gemini API key is not configured.\n\nPlease obtain an API key from [Google AI Studio](https://aistudio.google.com) and add it to your `.env` file on the server:\n```env\nGEMINI_API_KEY=AIzaSy...\n```\nThen restart `smartcloud-optimizer`.",
          warning: 'MISSING_API_KEY',
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const analytics = getAnalyticsState();
      const financials = getDynamicFinancials();

      const systemInstruction = buildSystemInstruction(analytics, financials);

      // Build conversation contents
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(history)) {
        for (const item of history) {
          if (
            item &&
            typeof item.content === 'string' &&
            (item.role === 'user' || item.role === 'model')
          ) {
            contents.push({
              role: item.role,
              parts: [{ text: item.content }],
            });
          }
        }
      }

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: message.trim() }],
      });

      // Configurable model selection with official production Gemini models
      const preferredModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
      const candidateModels = Array.from(
        new Set([
          preferredModel,
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-2.5-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-pro',
        ])
      );
      let response: any = null;
      let lastErr: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
          if (response?.text) break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[Chatbot] Model ${modelName} error (${err?.status || err?.message}), falling back to next candidate...`);
        }
      }

      if (!response?.text) {
        throw lastErr || new Error('All model candidates failed');
      }

      const reply = response.text || OUT_OF_CONTEXT_MESSAGE;
      return res.json({ reply });
    } catch (err: any) {
      console.error('[Chatbot Error]:', err);
      return res.status(500).json({
        error: 'Failed to generate response from Gemini API',
        details: err?.message || String(err),
      });
    }
  };
}

